import os
import re
import uuid
import json
import pdfplumber
from typing import List, Dict, Any, Tuple
from dotenv import load_dotenv

# LangChain Imports
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma

# Load environment variables
load_dotenv()

def extract_text_from_pdf(file_path_or_stream) -> str:
    """
    Extracts raw text from a PDF resume file using pdfplumber.
    """
    text = ""
    try:
        with pdfplumber.open(file_path_or_stream) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
        raise ValueError(f"Could not parse PDF file: {str(e)}")
    return text

def chunk_resume(text: str) -> List[Document]:
    """
    Splits the resume text into logical sections if possible,
    falling back to RecursiveCharacterTextSplitter.
    """
    headers = [
        r"(?i)^summary$", r"(?i)^profile$", r"(?i)^professional summary$",
        r"(?i)^experience$", r"(?i)^work experience$", r"(?i)^professional experience$", r"(?i)^employment history$",
        r"(?i)^skills$", r"(?i)^technical skills$", r"(?i)^key skills$", r"(?i)^core competencies$",
        r"(?i)^projects$", r"(?i)^key projects$", r"(?i)^personal projects$",
        r"(?i)^education$", r"(?i)^academic background$", r"(?i)^certifications$", r"(?i)^awards$"
    ]
    
    lines = text.split("\n")
    sections: Dict[str, List[str]] = {"Header": []}
    current_section = "Header"
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        
        is_header = False
        for h_pat in headers:
            if re.match(h_pat, stripped):
                current_section = stripped
                sections[current_section] = []
                is_header = True
                break
        
        if not is_header:
            sections[current_section].append(line)
            
    docs: List[Document] = []
    splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=100)
    
    for sec_name, sec_lines in sections.items():
        sec_text = "\n".join(sec_lines).strip()
        if not sec_text:
            continue
        
        metadata = {"section": sec_name}
        
        if len(sec_text) <= 800:
            docs.append(Document(page_content=f"[{sec_name}]\n{sec_text}", metadata=metadata))
        else:
            sub_chunks = splitter.split_text(sec_text)
            for i, chunk in enumerate(sub_chunks):
                docs.append(Document(
                    page_content=f"[{sec_name} - Part {i+1}]\n{chunk}",
                    metadata=metadata
                ))
                
    if len(docs) <= 1:
        raw_chunks = splitter.split_text(text)
        docs = [Document(page_content=c, metadata={"section": "General"}) for c in raw_chunks]
        
    return docs

def get_llm_and_embeddings() -> Tuple[Any, Any]:
    """
    Dynamically loads the LLM and Embeddings based on available .env keys.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    
    if gemini_key:
        print("[RAG] Initializing Google Gemini LLM and Embeddings...")
        from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenAIEmbeddings
        embeddings = GoogleGenAIEmbeddings(
            model="models/embedding-001",
            google_api_key=gemini_key
        )
        llm = ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            google_api_key=gemini_key,
            temperature=0.0
        )
        return llm, embeddings
    elif openai_key:
        print("[RAG] Initializing OpenAI GPT LLM and Embeddings...")
        from langchain_openai import ChatOpenAI, OpenAIEmbeddings
        embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small",
            openai_api_key=openai_key
        )
        llm = ChatOpenAI(
            model="gpt-4o-mini",
            openai_api_key=openai_key,
            temperature=0.0
        )
        return llm, embeddings
    else:
        raise ValueError("Neither GEMINI_API_KEY nor OPENAI_API_KEY is set in environment.")

def extract_jd_requirements(jd_text: str, llm: Any) -> List[str]:
    """
    Uses the LLM to extract a clean flat list of job requirements / qualifications from the JD.
    """
    prompt = f"""
You are a professional recruiting assistant. Extract a list of up to 12 key requirements, core responsibilities, and target qualifications from the job description below.
Each item should be a clear, standalone qualification (e.g. "Proficiency in Python and FastAPI", "3+ years of experience with React", "Experience deploying to AWS", "B.S. in Computer Science or equivalent").

Format your output strictly as a JSON array of strings. Do not include any explanations, markdown code blocks, or preamble. Return ONLY the raw JSON array.

Job Description:
{jd_text}
"""
    try:
        response = llm.invoke(prompt)
        content = response.content.strip()
        
        if content.startswith("```"):
            lines = content.split("\n")
            if lines[0].startswith("```"):
                content = "\n".join(lines[1:-1]) if lines[-1].startswith("```") else "\n".join(lines[1:])
            if content.startswith("json"):
                content = content[4:].strip()
                
        content = content.strip()
        reqs = json.loads(content)
        if isinstance(reqs, list):
            return [str(r).strip() for r in reqs if r]
    except Exception as e:
        print(f"Error parsing JD requirements with LLM: {e}")
        
    return fallback_local_requirements(jd_text)

def fallback_local_requirements(jd_text: str) -> List[str]:
    """
    Extracts requirements locally without LLM using standard list indicators and keywords.
    """
    lines = [line.strip().strip("-*•").strip() for line in jd_text.split("\n") if line.strip()]
    reqs = []
    for l in lines:
        if len(l) > 15 and any(kw in l.lower() for kw in ["experience", "skill", "must", "require", "qualification", "responsibilit", "proficien", "knowledge"]):
            reqs.append(l)
    # If no line matches standard filters, just grab first few long lines
    if not reqs:
        reqs = [l for l in lines if len(l) > 20][:8]
    return reqs[:10]

def local_mock_analysis(resume_text: str, jd_text: str) -> Dict[str, Any]:
    """
    Local heuristic gap analyzer that runs fully offline without API keys.
    Checks for keywords in resume text to mock the RAG output.
    """
    print("[RAG - LOCAL FALLBACK] No API keys detected. Running in Local Heuristic Mode...")
    requirements = fallback_local_requirements(jd_text)
    
    analysis_results = []
    resume_lower = resume_text.lower()
    
    # Common tech mapping for partial matching suggestions
    tech_aliases = {
        "fastapi": ["python", "flask", "django", "rest api", "backend"],
        "react": ["javascript", "typescript", "frontend", "html", "css"],
        "aws": ["cloud", "docker", "kubernetes", "gcp", "azure", "ci/cd"],
        "docker": ["containers", "kubernetes", "devops", "aws"],
        "postgresql": ["sql", "mysql", "database", "mongodb", "nosql"],
        "python": ["programming", "backend", "scripting"],
        "machine learning": ["data science", "python", "pandas", "numpy", "ai", "llm"],
        "rag": ["llm", "ai", "vector", "embeddings", "langchain"],
        "langchain": ["ai", "agents", "llm", "python"]
    }
    
    # Split resume into lines for evidence search
    resume_lines = [line.strip() for line in resume_text.split("\n") if line.strip()]
    
    for req in requirements:
        req_lower = req.lower()
        
        # Check for direct keyword matches (Strong Match)
        matched_words = []
        evidence_line = None
        
        # Extract alphanumeric words from the requirement
        words = re.findall(r'\b[a-zA-Z]{3,}\b', req_lower)
        for w in words:
            if w in resume_lower:
                matched_words.append(w)
                # Find the line in the resume containing this word
                for line in resume_lines:
                    if w in line.lower():
                        evidence_line = line
                        break
        
        if evidence_line and len(matched_words) >= 1:
            match_level = "Strong Match"
            evidence = evidence_line
            suggested_bullet = f"Refined suggestion: Lead developer in optimizing system capabilities using {', '.join([w.title() for w in matched_words])}, aligning with target requirements."
        else:
            # Check for partial matches
            has_partial = False
            partial_evidence = None
            suggested_bullet = None
            
            for key_tech, aliases in tech_aliases.items():
                if key_tech in req_lower:
                    for alias in aliases:
                        if alias in resume_lower:
                            has_partial = True
                            # Find the line with the alias
                            for line in resume_lines:
                                if alias in line.lower():
                                    partial_evidence = line
                                    break
                            suggested_bullet = f"Leverage your experience with '{alias.title()}' (from: \"{partial_evidence}\") to highlight transferable skills matching the requirement for '{key_tech.title()}'."
                            break
                if has_partial:
                    break
            
            if has_partial:
                match_level = "Partial Match"
                evidence = partial_evidence
            else:
                match_level = "Missing"
                evidence = "None"
                # Extract clean term for action guidance
                target_skill = "this technology"
                tech_words = [w for w in words if w not in ["experience", "knowledge", "understanding", "skills", "ability", "strong", "familiarity", "good", "have"]]
                if tech_words:
                    target_skill = tech_words[0].title()
                suggested_bullet = f"Gained a conceptual understanding of {target_skill}. Bridge this gap by completing a small project or implementing a simple demo using {target_skill} in your local setup."
                
        analysis_results.append({
            "requirement": req,
            "match_level": match_level,
            "evidence": evidence,
            "suggested_bullet": suggested_bullet
        })
        
    total_reqs = len(analysis_results)
    strong_matches = sum(1 for r in analysis_results if r["match_level"] == "Strong Match")
    partial_matches = sum(1 for r in analysis_results if r["match_level"] == "Partial Match")
    missing_matches = sum(1 for r in analysis_results if r["match_level"] == "Missing")
    
    raw_score = (strong_matches * 1.0 + partial_matches * 0.5) / total_reqs if total_reqs > 0 else 0
    match_score_percentage = int(raw_score * 100)
    
    return {
        "match_score": match_score_percentage,
        "stats": {
            "total_requirements": total_reqs,
            "strong_matches": strong_matches,
            "partial_matches": partial_matches,
            "missing": missing_matches
        },
        "analysis": analysis_results
    }

def analyze_resume_gaps(resume_text: str, jd_text: str) -> Dict[str, Any]:
    """
    Runs the RAG pipeline. If no API keys are configured, falls back
    to the local offline mock analysis.
    """
    try:
        # Check if keys are present. If not, this raises ValueError immediately
        llm, embeddings = get_llm_and_embeddings()
    except ValueError:
        # Fallback to local heuristic processing
        return local_mock_analysis(resume_text, jd_text)
        
    # --- Real RAG Pipeline (runs when keys are present) ---
    print("[RAG] Running real LLM-backed gap analysis...")
    
    # 1. Extract requirements from JD
    requirements = extract_jd_requirements(jd_text, llm)
    if not requirements:
        raise ValueError("Could not extract any distinct requirements from the Job Description.")
    
    # 2. Chunk resume
    resume_docs = chunk_resume(resume_text)
    
    # 3. Index resume in ChromaDB
    session_id = f"session_{uuid.uuid4().hex[:8]}"
    vector_store = Chroma(
        collection_name=session_id,
        embedding_function=embeddings,
        persist_directory="./chroma_db"
    )
    vector_store.add_documents(resume_docs)
    
    # 4. Retrieve context for each requirement
    reqs_with_context = []
    for i, req in enumerate(requirements):
        results = vector_store.similarity_search(req, k=3)
        retrieved_texts = [doc.page_content for doc in results]
        context_str = "\n".join([f"- {text}" for text in retrieved_texts])
        reqs_with_context.append({
            "index": i + 1,
            "requirement": req,
            "context": context_str
        })
        
    # Clean up ChromaDB collection
    try:
        vector_store.delete_collection()
    except Exception as e:
        print(f"Error cleaning up collection: {e}")
        
    # 5. Batched gap analysis report via LLM
    formatted_context_list = []
    for item in reqs_with_context:
        block = f"Requirement {item['index']}: {item['requirement']}\nRelevant Resume Excerpts:\n{item['context']}\n"
        formatted_context_list.append(block)
    
    requirements_context_str = "\n---\n".join(formatted_context_list)
    
    analysis_prompt = f"""
You are a professional resume gap analyst. Your job is to perform a detailed audit of a candidate's resume excerpts against each requirement of a job description.
For each requirement, you must classify the match level, extract the direct evidence (excerpts) if present, and suggest an honest resume improvement.

Here are the requirements and the relevant resume excerpts retrieved:

{requirements_context_str}

Rules:
1. "match_level" must be one of:
   - "Strong Match": The candidate has direct, explicit experience or skills meeting this requirement.
   - "Partial Match": The candidate has related or transferable experience, or some subset of the skill, but not a full match.
   - "Missing": No relevant experience or skills are mentioned in the resume excerpts.
2. "evidence" must be a direct quote or short paraphrase of the relevant experience from the resume excerpts. If missing, set it to "None".
3. "suggested_bullet" rules:
   - If "Strong Match": Provide a refined, high-impact version of their existing bullet point, or set to null if no improvement is needed.
   - If "Partial Match": Suggest 1-2 honest bullet points that frame the candidate's existing experience to align better with the requirement. DO NOT fabricate new skills, certifications, or projects. Only reframe/rephrase what is actually in the excerpts.
   - If "Missing": Recommend a realistic project or experience they should pursue to bridge this gap, or write a guidance tip on how they can honestly build this skill. DO NOT suggest fake resume text.
4. Keep the output extremely objective and truthful.

Return your response strictly as a JSON array of objects, containing the exact list of requirements in the order they were provided.
Format:
[
  {{
    "requirement": "the exact text of the requirement",
    "match_level": "Strong Match" | "Partial Match" | "Missing",
    "evidence": "excerpts or None",
    "suggested_bullet": "refined bullet, suggested guidance, or null"
  }},
  ...
]

Do not include any explanation, intro text, markdown wrapping (such as ```json), or helper remarks. Output ONLY the raw JSON array.
"""
    
    try:
        analysis_response = llm.invoke(analysis_prompt)
        analysis_content = analysis_response.content.strip()
        
        if analysis_content.startswith("```"):
            lines = analysis_content.split("\n")
            if lines[0].startswith("```"):
                analysis_content = "\n".join(lines[1:-1]) if lines[-1].startswith("```") else "\n".join(lines[1:])
            if analysis_content.startswith("json"):
                analysis_content = analysis_content[4:].strip()
                
        analysis_content = analysis_content.strip()
        results_list = json.loads(analysis_content)
        if not isinstance(results_list, list):
            raise ValueError("LLM response is not a JSON list.")
    except Exception as e:
        print(f"Error parsing gap analysis JSON: {e}")
        # Local fallback in case of API failure
        return local_mock_analysis(resume_text, jd_text)
        
    # Calculate scores
    total_reqs = len(results_list)
    strong_matches = sum(1 for r in results_list if r.get("match_level") == "Strong Match")
    partial_matches = sum(1 for r in results_list if r.get("match_level") == "Partial Match")
    missing_matches = sum(1 for r in results_list if r.get("match_level") == "Missing")
    
    raw_score = (strong_matches * 1.0 + partial_matches * 0.5) / total_reqs if total_reqs > 0 else 0
    match_score_percentage = int(raw_score * 100)
    
    return {
        "match_score": match_score_percentage,
        "stats": {
            "total_requirements": total_reqs,
            "strong_matches": strong_matches,
            "partial_matches": partial_matches,
            "missing": missing_matches
        },
        "analysis": results_list
    }
