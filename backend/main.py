import os
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn
from dotenv import load_dotenv

# Import pipeline functions
from rag_pipeline import extract_text_from_pdf, chunk_resume, analyze_resume_gaps

load_dotenv()

app = FastAPI(
    title="ResumeMatch AI API",
    description="Backend API for RAG-based Resume/JD Gap Analyzer",
    version="1.0.0"
)

# Enable CORS for frontend interactions
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    resume_text: str
    jd_text: str

@app.get("/health")
def health_check():
    """
    Basic health check endpoint.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    
    status = "healthy"
    configured_providers = []
    
    if gemini_key:
        configured_providers.append("Gemini")
    if openai_key:
        configured_providers.append("OpenAI")
        
    if not configured_providers:
        status = "degraded (no API keys configured)"
        
    return {
        "status": status,
        "active_providers": configured_providers,
        "port": int(os.getenv("PORT", 8000))
    }

@app.post("/upload-resume")
async def upload_resume(file: UploadFile = File(...)):
    """
    Accepts PDF or text resume file upload, extracts raw text,
    creates logical chunks, and returns them to the frontend.
    """
    filename = file.filename.lower()
    
    if not (filename.endswith(".pdf") or filename.endswith(".txt")):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload a PDF or TXT file."
        )
        
    try:
        if filename.endswith(".pdf"):
            # Read pdf bytes directly in memory
            pdf_bytes = await file.read()
            # Wrap bytes in a file-like stream
            import io
            pdf_stream = io.BytesIO(pdf_bytes)
            extracted_text = extract_text_from_pdf(pdf_stream)
        else:
            # Handle plain text files
            content_bytes = await file.read()
            extracted_text = content_bytes.decode("utf-8", errors="ignore")
            
        if not extracted_text.strip():
            raise HTTPException(
                status_code=400,
                detail="The uploaded resume file appeared to be empty."
            )
            
        # Get chunks to show count metadata to the frontend
        chunks = chunk_resume(extracted_text)
        
        return {
            "filename": file.filename,
            "char_count": len(extracted_text),
            "chunk_count": len(chunks),
            "extracted_text": extracted_text
        }
        
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while parsing the resume: {str(e)}"
        )

@app.post("/analyze")
def analyze_gap(payload: AnalyzeRequest):
    """
    Performs full RAG-based Gap Analysis.
    Takes parsed resume text and pasted JD text.
    Returns JSON structured gap report.
    """
    if not payload.resume_text.strip():
        raise HTTPException(status_code=400, detail="Resume text cannot be empty.")
    if not payload.jd_text.strip():
        raise HTTPException(status_code=400, detail="Job description text cannot be empty.")
        
    try:
        report = analyze_resume_gaps(payload.resume_text, payload.jd_text)
        return report
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        print(f"Error during gap analysis: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Gap analysis pipeline failed: {str(e)}"
        )

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "127.0.0.1")
    print(f"Starting FastAPI server on {host}:{port}...")
    uvicorn.run("main:app", host=host, port=port, reload=True)
