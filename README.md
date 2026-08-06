# ResumeMatch AI — RAG-based Resume/JD Gap Analyzer

> **A full-stack developer tool** that semantically audits a resume against a job description using Retrieval-Augmented Generation (RAG). Provides a detailed match score, evidence-backed gap analysis, and copyable resume improvement suggestions — without fabricating experience.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Backend API** | FastAPI, Python 3.11+, Uvicorn, Pydantic |
| **RAG & Orchestration** | LangChain, LangChain Community, LangChain Text Splitters |
| **Vector Database** | ChromaDB (ephemeral per-session, local) |
| **LLM / Embeddings** | Google Gemini (`gemini-1.5-flash` + `embedding-001`) **or** OpenAI (`gpt-4o-mini` + `text-embedding-3-small`) |
| **File Parsing** | `pdfplumber` (accurate text & layout extraction) |
| **Frontend** | React 19, Vite, TailwindCSS v3, Lucide React |

---

## 📐 RAG Pipeline Architecture

```
                      +-------------------+
                      |   Target Job JD   |
                      +---------+---------+
                                |
                                v (LLM Parser)
                  +-------------+-------------+
                  |  Extracted Requirements   |  (Array of Standalone Criteria)
                  +-------------+-------------+
                                |
                                v (For Each Requirement)
                        [Semantic Query]
                                |
                                v
+------------------+     +------+------+     +----------------------------+
|  Resume (PDF/TXT)| --> |  ChromaDB   | --> | Top-3 Matching Excerpts    |
+------------------+     | Vector Store|     +-------------+--------------+
                         +-------------+                   |
                                                           v
                                                +----------+----------+
                                                |   Batched LLM Prompt|
                                                +----------+----------+
                                                           |
                                                           v (Strict JSON Output)
                                                +----------+----------+
                                                | Structured Report   |
                                                | & Reframed Bullets  |
                                                +---------------------+
```

### Pipeline Steps
1. **Upload & Parse**: User uploads their resume (PDF or TXT). Backend extracts clean text via `pdfplumber`.
2. **Resume Chunking**: Text is split into logical sections (Summary, Skills, Experience, Education) using a custom heuristic chunker, then indexed into ChromaDB as per-session vectors.
3. **Requirement Extraction**: The JD is sent to the LLM to extract up to 12 individual, standalone qualification criteria.
4. **Vector Retrieval**: For each requirement, a semantic similarity search against the resume vector store retrieves the top-3 most relevant resume chunks.
5. **Batched Audit**: Requirements + retrieved contexts are sent to the LLM in a single batched prompt, returning a strict JSON gap analysis array.
6. **Scoring**: A fit score is computed — Strong Match = 100%, Partial Match = 50%, Missing = 0%.

---

## ⚙ Setup & Installation

### Prerequisites
- **Python 3.11+**
- **Node.js v18+** and **npm**

---

### Step 1: Clone & Configure Environment

```bash
git clone https://github.com/your-username/rag-resume-jd-matcher.git
cd rag-resume-jd-matcher
```

Copy the environment template into the backend directory and add your API key:

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and add at least one key (Gemini is free-tier friendly):

```env
GEMINI_API_KEY=your_gemini_api_key_here
# OR
OPENAI_API_KEY=your_openai_api_key_here
```

> **Note**: The app works without any API key in **Local Heuristic Mode** — a fully offline keyword-based fallback. Results are less accurate but functional.

---

### Step 2: Run the Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows PowerShell
.\venv\Scripts\Activate.ps1
# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server
python main.py
```

Backend runs at: `http://127.0.0.1:8000`  
Interactive API docs: `http://127.0.0.1:8000/docs`

---

### Step 3: Run the Frontend

Open a **new terminal**:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`

---

## 🧪 Running Verification Tests

Verify the chunker and model initialization work without running the full app:

```bash
cd backend
.\venv\Scripts\python.exe test_pipeline.py   # Windows
# or
python test_pipeline.py                       # macOS / Linux
```

---

## 🔑 API Key Options

| Provider | Key | Model Used | Notes |
|---|---|---|---|
| **Google Gemini** | `GEMINI_API_KEY` | `gemini-1.5-flash` + `embedding-001` | Free-tier available at [aistudio.google.com](https://aistudio.google.com) |
| **OpenAI** | `OPENAI_API_KEY` | `gpt-4o-mini` + `text-embedding-3-small` | Pay-as-you-go at [platform.openai.com](https://platform.openai.com) |

If **both** keys are set, Gemini takes priority. If **neither** is set, the backend falls back to the local heuristic mode.

---

## 📁 Project Structure

```
rag-resume-jd-matcher/
├── backend/
│   ├── main.py              # FastAPI routes & app setup
│   ├── rag_pipeline.py      # Core RAG logic (chunking, embedding, LLM calls)
│   ├── test_pipeline.py     # Standalone chunker & model initialization tests
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Environment variable template
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main React UI (upload, analysis dashboard)
│   │   ├── main.jsx         # React entry point
│   │   └── index.css        # Global styles + TailwindCSS + glassmorphism
│   ├── index.html           # HTML shell
│   ├── package.json         # Node dependencies
│   └── vite.config.js       # Vite build config
├── .env.example             # Root-level env reference
├── .gitignore               # Excludes venv, node_modules, .env, chroma_db
└── README.md
```

---

## 📝 Technical Exploration Notes

This project was built to explore and demonstrate:

- **Custom Heuristic Chunking**: A section-aware splitter for short, structured documents like resumes, avoiding over-chunking common in generic splitters.
- **Batch Query Optimization**: All requirements + retrieved contexts are sent in a single LLM call, reducing latency and API costs vs. sequential per-requirement calls.
- **Hallucination Prevention**: The LLM prompt strictly constrains suggestions to evidence from the retrieved resume excerpts — it cannot fabricate skills or projects.
- **Graceful Offline Fallback**: A fully local keyword/alias heuristic mode runs without any API dependency, useful for demos and testing.
