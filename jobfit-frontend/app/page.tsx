'use client';
import { useState } from 'react';
import { FileText, CheckCircle, Share2, Copy, Sparkles, RefreshCw, BarChart3, AlertTriangle, Target } from 'lucide-react';

export default function Home() {
  const [fullName, setFullName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [careerHistory, setCareerHistory] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (e: React.MouseEvent<HTMLButtonElement> | React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !targetRole || !careerHistory || !jobDescription) {
      alert("Please fill out all fields including the Target Job Description before generating.");
      return;
    }

    setLoading(true);
    setResults(null);

    const formData = new FormData();
    formData.append('full_name', fullName);
    formData.append('target_role', targetRole);
    formData.append('career_history', careerHistory);
    formData.append('job_description', jobDescription);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); 

      const response = await fetch('https://onrender.com', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server returned error code: ${response.status}`);
      }

      const data = await response.json();
      setResults(data);
    } catch (error: any) {
      console.error("Error processing building request profile:", error);
      if (error.name === 'AbortError') {
        alert("The AI Engine is taking a bit longer to wake up on Render's free tier. Please wait 10 seconds and click 'Generate Resume' again!");
      } else {
        alert("Connected to server, but the AI generation failed. Please check your Render logs for API Key limits.");
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (results && results.shareable_url) {
      navigator.clipboard.writeText(results.shareable_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-4xl font-extrabold text-indigo-600 flex items-center justify-center gap-2">
            <Sparkles className="text-indigo-500 w-9 h-9" /> AI Resume Builder & Matcher
          </h1>
          <p className="text-slate-500 mt-2">Generate a tailored, ATS-optimized resume and review your job fit score instantly</p>
        </header>

        {!results ? (
          <div className="bg-white p-6 rounded-xl shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Full Name</label>
                <input 
                  type="text" 
                  required 
                  className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900" 
                  placeholder="John Doe" 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Target Job Title</label>
                <input 
                  type="text" 
                  required 
                  className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900" 
                  placeholder="Senior Software Engineer" 
                  value={targetRole} 
                  onChange={(e) => setTargetRole(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Your Career History & Notes</label>
                <textarea 
                  rows={8} 
                  required 
                  className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900" 
                  placeholder="Paste your rough background notes, old resume bullet points, or list past responsibilities here..." 
                  value={careerHistory} 
                  onChange={(e) => setCareerHistory(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Target Job Description (Requirements)</label>
                <textarea 
                  rows={8} 
                  required 
                  className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900" 
                  placeholder="Paste the complete job description details here to analyze your ATS match profile matrix..." 
                  value={jobDescription} 
                  onChange={(e) => setJobDescription(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="button"
              onClick={handleGenerate} 
              disabled={loading} 
              className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin w-5 h-5" /> Analyzing Fit & Crafting Resume...
                </>
              ) : (
                "Generate Resume & Fit Report"
              )}
            </button>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-xl shadow-sm space-y-8">
            {/* Share link Banner Component */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4 rounded-lg text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Share2 className="w-6 h-6 shrink-0" />
                <div>
                  <h3 className="font-bold">Your Optimized AI Resume is Live!</h3>
                  <p className="text-xs text-indigo-100">Send this cloud hosted link straight to hiring managers.</p>
                </div>
              </div>
              <div className="flex w-full sm:w-auto items-center gap-2 bg-white/10 p-1 rounded-md border border-white/20">
                <input 
                  type="text" 
                  readOnly 
                  value={results.shareable_url || ''} 
                  className="bg-transparent text-xs px-2 outline-none w-full sm:w-48 text-white select-all" 
                />
                <button 
                  onClick={copyToClipboard} 
                  className="bg-white text-indigo-600 p-2 rounded text-xs font-bold hover:bg-indigo-50 flex items-center gap-1 transition"
                >
                  {copied ? <CheckCircle className="w-3 h-3 text-green-600"/> : <Copy className="w-3 h-3"/>} {copied ? "Copied" : "Copy Link"}
                </button>
              </div>
            </div>

            {/* Side-by-Side Job Fit Comparison Analytics Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-100">
              <div className="flex flex-col items-center justify-center bg-white p-6 rounded-lg border border-slate-200 text-center shadow-sm">
                <BarChart3 className="w-8 h-8 text-indigo-500 mb-2" />
                <h4 className="text-xs font-bold text-slate-400 tracking-wider uppercase">ATS Match Score</h4>
                <div className={`text-5xl font-black mt-2 ${results.match_score >= 80 ? 'text-emerald-500' : results.match_score >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                  {results.match_score}%
                </div>
              </div>

              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-2">
                <h4 className="text-sm font-bold text-rose-500 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Missing Keywords / Skills
                </h4>
                <ul className="list-disc list-inside text-xs text-slate-600 space-y-1 pl-1">
                  {results.missing_skills?.map((skill: string, i: number) => <li key={i}>{skill}</li>)}
                  {results.missing_skills?.length === 0 && <li className="text-slate-400 list-none italic">None! You hit all core keywords.</li>}
                </ul>
              </div>

              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-2">
                <h4 className="text-sm font-bold text-indigo-600 flex items-center gap-1.5">
                  <Target className="w-4 h-4" /> Optimization Tips
                </h4>
                <ul className="list-disc list-inside text-xs text-slate-600 space-y-1 pl-1">
                  {results.tailoring_tips?.map((tip: string, i: number) => <li key={i}>{tip}</li>)}
                </ul>
              </div>
            </div>

            {/* Generated Content Preview Area */}
            <div className="border border-slate-200 p-6 rounded-lg space-y-6 bg-white shadow-sm">
              <div className="border-b border-slate-200 pb-4">
