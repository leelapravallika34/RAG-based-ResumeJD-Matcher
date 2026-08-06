import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Search, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  AlertTriangle,
  Sparkles,
  BookOpen,
  Briefcase,
  Copy,
  Check,
  Info
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

function App() {
  // Input states
  const [resumeText, setResumeText] = useState('');
  const [jdText, setJdText] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  
  // UI helper states
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [parsingDetails, setParsingDetails] = useState(null);
  
  // Analysis states
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  
  // Dashboard states
  const [activeFilter, setActiveFilter] = useState('All');
  const [expandedReq, setExpandedReq] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [healthStatus, setHealthStatus] = useState('Checking...');

  // Check backend health on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/health`)
      .then(res => res.json())
      .then(data => {
        setHealthStatus(data.status.includes('degraded') ? 'Degraded (No keys)' : 'Connected');
      })
      .catch(() => {
        setHealthStatus('Disconnected');
      });
  }, []);

  // Loading screen steps simulation
  useEffect(() => {
    let interval;
    if (loading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep(prev => {
          if (prev < 3) return prev + 1;
          return prev;
        });
      }, 3500);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setResumeFile(file);
    setUploading(true);
    setUploadSuccess(false);
    setUploadError('');
    setParsingDetails(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/upload-resume`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to upload and parse resume.');
      }

      const data = await response.json();
      setResumeText(data.extracted_text);
      setUploadSuccess(true);
      setParsingDetails({
        filename: data.filename,
        charCount: data.char_count,
        chunkCount: data.chunk_count
      });
    } catch (err) {
      console.error(err);
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const runAnalysis = async () => {
    if (!resumeText.trim() || !jdText.trim()) return;

    setLoading(true);
    setError('');
    setResults(null);

    try {
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resume_text: resumeText,
          jd_text: jdText,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Analysis failed. Please check your API keys.');
      }

      const data = await response.json();
      setResults(data);
      // Automatically expand the first few items
      const initialExpanded = {};
      if (data.analysis && data.analysis.length > 0) {
        data.analysis.slice(0, 3).forEach((item, index) => {
          initialExpanded[index] = true;
        });
      }
      setExpandedReq(initialExpanded);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (index) => {
    setExpandedReq(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadMarkdownReport = () => {
    if (!results) return;

    let mdContent = `# ResumeMatch AI - Job Fit Report\n\n`;
    mdContent += `**Overall Match Score:** ${results.match_score}%\n\n`;
    mdContent += `## Summary Statistics\n`;
    mdContent += `- Total JD Requirements Evaluated: ${results.stats.total_requirements}\n`;
    mdContent += `- Strong Matches: ${results.stats.strong_matches}\n`;
    mdContent += `- Partial Matches: ${results.stats.partial_matches}\n`;
    mdContent += `- Gaps / Missing Items: ${results.stats.missing}\n\n`;
    mdContent += `## Detailed Gap Analysis\n\n`;

    results.analysis.forEach((item, index) => {
      mdContent += `### ${index + 1}. Requirement: ${item.requirement}\n`;
      mdContent += `- **Match Status:** ${item.match_level}\n`;
      mdContent += `- **Resume Evidence:** *${item.evidence !== 'None' ? item.evidence : 'No matching evidence found in resume.'}*\n`;
      if (item.suggested_bullet) {
        mdContent += `- **Tailored Resume Improvement Suggestion:** \n  \`\`\`\n  ${item.suggested_bullet}\n  \`\`\`\n`;
      } else {
        mdContent += `- **Recommendation:** Key capability gap. Gain experience or project credentials in this area.\n`;
      }
      mdContent += `\n---\n\n`;
    });

    mdContent += `*Report generated by ResumeMatch AI. Built for RAG and LLM orchestration explorations.*`;

    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ResumeMatch_Report_${results.match_score}pct.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getMatchLevelColor = (level) => {
    switch (level) {
      case 'Strong Match': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'Partial Match': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'Missing': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  const getFilteredAnalysis = () => {
    if (!results) return [];
    if (activeFilter === 'All') return results.analysis;
    return results.analysis.filter(item => {
      if (activeFilter === 'Strong' && item.match_level === 'Strong Match') return true;
      if (activeFilter === 'Partial' && item.match_level === 'Partial Match') return true;
      if (activeFilter === 'Missing' && item.match_level === 'Missing') return true;
      return false;
    });
  };

  const loadingSteps = [
    "Extracting clean text and layout sections from resume...",
    "Embedding resume sections into session vector store (ChromaDB)...",
    "Retrieving semantically relevant resume excerpts for each JD requirement...",
    "Auditing gaps and generating structured reframing bullet points via LLM..."
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between pb-8 border-b border-slate-800/80 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">RAG-Powered</span>
            <span className="text-slate-500 text-xs flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${healthStatus.includes('Connected') ? 'bg-emerald-500' : healthStatus.includes('Degraded') ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}`} />
              API: {healthStatus}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent">
            ResumeMatch AI
          </h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base max-w-xl">
            Audit your resume gaps against any job description. Uses semantic search retrieval and structured LLM feedback.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          <a href="#analyzer" className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white glass-card rounded-lg flex items-center gap-1.5 transition-colors">
            <BookOpen className="w-3.5 h-3.5" /> Docs / Setup
          </a>
        </div>
      </header>

      {/* Main Grid */}
      <main className="space-y-8">
        {/* Step 1: Input Forms */}
        <section id="analyzer" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Resume Upload / Input */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-emerald-400">
                <FileText className="w-5 h-5" /> 1. Resume
              </h2>
              <span className="text-xs text-slate-500">PDF or clean text</span>
            </div>

            {/* File Drag and Drop / Uploader */}
            <div className="relative border border-dashed border-slate-700/80 rounded-xl p-6 bg-slate-900/40 hover:bg-slate-900/60 transition-colors flex flex-col items-center justify-center text-center cursor-pointer">
              <input
                type="file"
                accept=".pdf,.txt"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={uploading}
              />
              <Upload className={`w-8 h-8 mb-2 ${uploading ? 'animate-bounce text-emerald-400' : 'text-slate-400'}`} />
              <p className="text-sm font-medium text-slate-200">
                {uploading ? 'Parsing File contents...' : 'Upload PDF or TXT resume'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Drag here or click to select
              </p>
            </div>

            {/* Upload Feedback */}
            {uploadSuccess && parsingDetails && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <div>
                  Parsed <span className="font-semibold">{parsingDetails.filename}</span> ({parsingDetails.chunkCount} section chunks, {(parsingDetails.charCount/1024).toFixed(1)} KB)
                </div>
              </div>
            )}

            {uploadError && (
              <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
                <XCircle className="w-4 h-4 shrink-0" />
                <div>{uploadError}</div>
              </div>
            )}

            {/* Resume Text Area */}
            <div className="flex flex-col space-y-1.5 grow">
              <label className="text-xs text-slate-400 font-medium">Resume Text (Editable)</label>
              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste or edit raw resume text here..."
                className="w-full h-56 p-3 bg-slate-950 border border-slate-800 rounded-xl focus:border-emerald-500 focus:outline-none text-sm text-slate-300 resize-none font-sans"
              />
            </div>
          </div>

          {/* Job Description Input */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-teal-400">
                <Briefcase className="w-5 h-5" /> 2. Job Description
              </h2>
              <span className="text-xs text-slate-500 font-medium">Pasted requirements</span>
            </div>

            <div className="flex flex-col space-y-1.5 grow">
              <label className="text-xs text-slate-400 font-medium">Job Description / Target Criteria</label>
              <textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder="Paste the full job description or key list of requirements here..."
                className="w-full h-80 p-3 bg-slate-950 border border-slate-800 rounded-xl focus:border-teal-500 focus:outline-none text-sm text-slate-300 resize-none font-sans"
              />
            </div>

            {/* Run Button */}
            <button
              onClick={runAnalysis}
              disabled={loading || !resumeText.trim() || !jdText.trim()}
              className={`w-full py-3.5 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                loading || !resumeText.trim() || !jdText.trim()
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold shadow-lg shadow-emerald-500/10 active:scale-[0.98]'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Running Semantic Analyzer...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Analyze Gaps & Fit Score
                </>
              )}
            </button>
          </div>
        </section>

        {/* Loading Overlay / Progress State */}
        {loading && (
          <section className="glass-panel p-8 rounded-2xl flex flex-col items-center justify-center text-center py-16 space-y-6">
            <div className="relative flex items-center justify-center">
              {/* Spinning outer loader */}
              <div className="w-20 h-20 border-4 border-emerald-500/10 border-t-emerald-400 rounded-full animate-spin"></div>
              {/* Inner glowing core */}
              <Sparkles className="w-8 h-8 text-emerald-400 absolute animate-pulse" />
            </div>
            
            <div className="space-y-2 max-w-lg">
              <h3 className="text-xl font-bold text-slate-100">Running RAG Analysis Pipeline</h3>
              <p className="text-xs text-emerald-400 font-mono tracking-wider uppercase">Stage {loadingStep + 1} of 4</p>
              
              {/* Active step message */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 mt-4 min-h-[70px] flex items-center justify-center">
                <p className="text-slate-300 text-sm font-medium italic animate-fade-in">
                  "{loadingSteps[loadingStep]}"
                </p>
              </div>
            </div>

            {/* Step list visualization */}
            <div className="w-full max-w-md space-y-2 pt-4 border-t border-slate-800/60">
              {loadingSteps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2.5 text-left text-xs">
                  <span className={`w-2.5 h-2.5 rounded-full flex items-center justify-center font-bold text-[8px] ${
                    idx < loadingStep 
                      ? 'bg-emerald-500 text-slate-950' 
                      : idx === loadingStep 
                        ? 'bg-teal-400 animate-ping' 
                        : 'bg-slate-800 text-slate-500'
                  }`}>
                    {idx < loadingStep && '✓'}
                  </span>
                  <span className={idx === loadingStep ? 'text-slate-200 font-medium' : idx < loadingStep ? 'text-slate-400' : 'text-slate-600'}>
                    {step.slice(0, 50)}...
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Errors */}
        {error && (
          <section className="bg-rose-500/10 border border-rose-500/25 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-rose-200">Analysis Error</h4>
              <p className="text-xs text-rose-300 mt-0.5">{error}</p>
              <div className="mt-2 text-xs text-slate-400">
                Please make sure either <code className="bg-slate-950 px-1.5 py-0.5 rounded text-rose-300">GEMINI_API_KEY</code> or <code className="bg-slate-950 px-1.5 py-0.5 rounded text-rose-300">OPENAI_API_KEY</code> is correctly set in your <code className="bg-slate-950 px-1.5 py-0.5 rounded font-mono">backend/.env</code> file and the server is running.
              </div>
            </div>
          </section>
        )}

        {/* Step 2: Results Dashboard */}
        {results && !loading && (
          <section className="space-y-6">
            <div className="glass-panel p-6 rounded-2xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
                
                {/* Score Section */}
                <div className="flex items-center gap-6">
                  {/* Circular Score Visualizer */}
                  <div className="relative w-24 h-24 shrink-0">
                    <svg className="w-full h-full" viewBox="0 0 36 36">
                      {/* Gray background track */}
                      <path
                        className="text-slate-800"
                        strokeWidth="3.5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      {/* Active score indicator */}
                      <path
                        className={`transition-all duration-1000 ${
                          results.match_score >= 80 
                            ? 'text-emerald-400' 
                            : results.match_score >= 50 
                              ? 'text-amber-400' 
                              : 'text-rose-400'
                        }`}
                        strokeWidth="3.5"
                        strokeDasharray={`${results.match_score}, 100`}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-slate-100">{results.match_score}%</span>
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold">Match</span>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-slate-200">Analysis Summary</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Semantically processed {results.stats.total_requirements} key expectations.
                    </p>
                    {/* Score badge label */}
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-2 border ${
                      results.match_score >= 80 
                        ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/25' 
                        : results.match_score >= 50 
                          ? 'text-amber-400 bg-amber-400/10 border-amber-400/25' 
                          : 'text-rose-400 bg-rose-400/10 border-rose-400/25'
                    }`}>
                      {results.match_score >= 80 ? 'Excellent Match' : results.match_score >= 50 ? 'Moderate Match' : 'Action Required'}
                    </span>
                  </div>
                </div>

                {/* Score Stats Grid */}
                <div className="grid grid-cols-3 gap-2 md:gap-4">
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-center min-w-[80px] md:min-w-[100px]">
                    <div className="text-emerald-400 text-lg md:text-xl font-black">{results.stats.strong_matches}</div>
                    <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Strong</div>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-center min-w-[80px] md:min-w-[100px]">
                    <div className="text-amber-400 text-lg md:text-xl font-black">{results.stats.partial_matches}</div>
                    <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Partial</div>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-center min-w-[80px] md:min-w-[100px]">
                    <div className="text-rose-400 text-lg md:text-xl font-black">{results.stats.missing}</div>
                    <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Missing</div>
                  </div>
                </div>
              </div>

              {/* Toolbar & Filter Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6">
                {/* Filter buttons */}
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80 self-start">
                  {['All', 'Strong', 'Partial', 'Missing'].map(filter => (
                    <button
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                        activeFilter === filter 
                          ? 'bg-slate-850 text-slate-200 shadow-sm border border-slate-700/30' 
                          : 'text-slate-500 hover:text-slate-350'
                      }`}
                    >
                      {filter} {filter === 'All' ? `(${results.stats.total_requirements})` : filter === 'Strong' ? `(${results.stats.strong_matches})` : filter === 'Partial' ? `(${results.stats.partial_matches})` : `(${results.stats.missing})`}
                    </button>
                  ))}
                </div>

                {/* Export Report button */}
                <button
                  onClick={downloadMarkdownReport}
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-center gap-1.5 self-end sm:self-auto transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Markdown Report
                </button>
              </div>
            </div>

            {/* List of analyzed cards */}
            <div className="space-y-4">
              {getFilteredAnalysis().length === 0 ? (
                <div className="glass-panel p-10 text-center rounded-2xl">
                  <Info className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">No criteria match the current filter.</p>
                </div>
              ) : (
                getFilteredAnalysis().map((item, idx) => {
                  const itemIndex = results.analysis.findIndex(a => a.requirement === item.requirement);
                  const isExpanded = expandedReq[itemIndex];
                  
                  return (
                    <div 
                      key={idx} 
                      className={`glass-panel rounded-xl overflow-hidden transition-all duration-200 border-l-4 ${
                        item.match_level === 'Strong Match' 
                          ? 'border-l-emerald-500/80 hover:border-l-emerald-400' 
                          : item.match_level === 'Partial Match' 
                            ? 'border-l-amber-500/80 hover:border-l-amber-400' 
                            : 'border-l-rose-500/80 hover:border-l-rose-400'
                      }`}
                    >
                      {/* Accordion Header */}
                      <div 
                        onClick={() => toggleExpand(itemIndex)}
                        className="p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-900/10 transition-colors"
                      >
                        <div className="flex items-center gap-3.5">
                          {item.match_level === 'Strong Match' ? (
                            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                          ) : item.match_level === 'Partial Match' ? (
                            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                          ) : (
                            <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                          )}
                          <span className="text-sm font-semibold text-slate-200 line-clamp-1 sm:line-clamp-none">
                            {item.requirement}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full shrink-0 ${getMatchLevelColor(item.match_level)}`}>
                            {item.match_level}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                          )}
                        </div>
                      </div>

                      {/* Accordion Body */}
                      {isExpanded && (
                        <div className="px-5 pb-5 pt-1 border-t border-slate-900 bg-slate-950/20 space-y-4">
                          {/* Evidence Section */}
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Evidence in Resume</h4>
                            <div className="bg-slate-950/80 border border-slate-900 rounded-xl p-3.5">
                              {item.evidence !== 'None' ? (
                                <p className="text-xs md:text-sm text-slate-300 italic font-sans leading-relaxed">
                                  "{item.evidence}"
                                </p>
                              ) : (
                                <span className="text-xs text-slate-500 italic">
                                  No related matching evidence detected in the resume text.
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Bullet Point Suggestion */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                {item.match_level === 'Missing' ? (
                                  <>Recommended Development Action</>
                                ) : (
                                  <>
                                    <Sparkles className="w-3 h-3 text-emerald-400" />
                                    Tailored Resume Bullet Suggestion
                                  </>
                                )}
                              </h4>
                              {item.suggested_bullet && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(item.suggested_bullet, idx);
                                  }}
                                  className="text-[10px] font-medium text-slate-400 hover:text-slate-200 flex items-center gap-1"
                                >
                                  {copiedId === idx ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-400" /> Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" /> Copy Suggestion
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                            
                            <div className={`border rounded-xl p-4 ${
                              item.match_level === 'Missing' 
                                ? 'bg-rose-500/5 border-rose-500/10' 
                                : 'bg-emerald-500/5 border-emerald-500/10'
                            }`}>
                              {item.suggested_bullet ? (
                                <p className="text-xs md:text-sm text-slate-200 font-sans leading-relaxed">
                                  {item.suggested_bullet}
                                </p>
                              ) : (
                                <p className="text-xs md:text-sm text-slate-400 italic">
                                  No bullet suggestion needed. Your current resume demonstrates a robust match.
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Truthful Note (Only for matches to remind users not to fake things) */}
                          {item.match_level !== 'Missing' && item.suggested_bullet && (
                            <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                              <AlertCircle className="w-3 h-3" />
                              <span>This suggestion reframes your existing experience. Do not adopt if it contradicts your actual accomplishments.</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
