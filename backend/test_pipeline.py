import os
from dotenv import load_dotenv
from rag_pipeline import chunk_resume, get_llm_and_embeddings, extract_jd_requirements

# Load environment variables
load_dotenv()

def test_chunker():
    print("--- Testing Resume Chunker ---")
    mock_resume = """
John Doe
Software Engineer
john.doe@email.com

SUMMARY
Passionate backend engineer with 4 years of experience building scalable applications.

SKILLS
Python, FastAPI, PostgreSQL, AWS, Docker, Kubernetes

EXPERIENCE
Senior Software Engineer - TechCorp (2022 - Present)
- Designed and built a microservices platform using FastAPI and Python, serving 1M+ active users.
- Migrated legacy database to PostgreSQL, improving query response time by 40%.
- Configured CI/CD pipelines and deployed Docker images to AWS EKS.

Software Developer - StartupCo (2020 - 2022)
- Built REST APIs in Python using Flask.
- Maintained legacy codebases and wrote extensive unit tests.

EDUCATION
B.S. in Computer Science - State University (2016 - 2020)
"""
    chunks = chunk_resume(mock_resume)
    print(f"Generated {len(chunks)} chunks:")
    for i, chunk in enumerate(chunks):
        print(f"  Chunk {i+1} (Section: {chunk.metadata['section']}):")
        print(f"    {repr(chunk.page_content[:150])}...")
    
    assert len(chunks) > 0, "No chunks generated!"
    print("SUCCESS: Chunker test passed!\n")
    return mock_resume

def test_models():
    print("--- Testing API Keys & Model Initializations ---")
    gemini_key = os.getenv("GEMINI_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    
    if not gemini_key and not openai_key:
        print("WARNING: Neither GEMINI_API_KEY nor OPENAI_API_KEY detected in .env.")
        print("  Skipping LLM/Embeddings initialization check. Please add keys to run full pipeline.")
        return
        
    try:
        llm, embeddings = get_llm_and_embeddings()
        print("SUCCESS: Successfully initialized LLM and Embeddings!")
        
        # Test requirement extraction
        mock_jd = """
Job Title: Python Developer
Requirements:
- 3+ years of experience with Python and FastAPI
- Familiarity with SQL databases, especially PostgreSQL
- Experience deploying containers with Docker and AWS
- Degree in Computer Science or equivalent
"""
        print("Testing JD requirements extraction...")
        requirements = extract_jd_requirements(mock_jd, llm)
        print(f"Extracted requirements: {requirements}")
        assert len(requirements) > 0, "No requirements extracted!"
        print("SUCCESS: Model initialization and query test passed!\n")
        
    except Exception as e:
        print(f"ERROR: Model initialization failed: {e}")
        print("  Check that your API keys are valid and you have internet access.")

if __name__ == "__main__":
    mock_resume = test_chunker()
    test_models()
