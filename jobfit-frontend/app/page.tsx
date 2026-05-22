'use client';
import { useState } from 'react';
import { Sparkles, RefreshCw, BarChart3, AlertTriangle, Target, Share2, Copy, CheckCircle, HelpCircle, User, Code } from 'lucide-react';

export default function Home() {
  const [fullName, setFullName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [careerHistory, setCareerHistory] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'resume' | 'hr' | 'tech'>('resume');

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !targetRole || !careerHistory || !jobDescription) {
      alert("Please fill out all fields before generating.");
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
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      setResults(data);
    } catch (error: any) {
      console.error(error);
      alert(error.name === 'AbortError' ? "The Google Gemini Engine is waking up on Render. Please try again in 10 seconds!" : "AI generation failed. Check your Render logs to ensure your GEMINI_API_KEY is correct.");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (results?.shareable_url) {
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
            <Sparkles className="text-indigo-500 w-9 h-9" /> AI Career Dashboard & Matcher
          </h1>
          <p className="text-slate-500 mt-2">Tailor your resume, track job compatibility matrix score, and unlock AI interview mock runs</p>
        </header>

        {!results ? (
          <form onSubmit={handleGenerate} className="bg-white p-6 rounded-xl shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Full Name</label>
                <input type="text" required className="w-full border border-slate-300 p-3 rounded-lg bg-white text-slate-900" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Target Job Title</label>
                <input type="text" required className="w-full border border-slate-300 p-3 rounded-lg bg-white text-slate-900" placeholder="Software Engineer" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Career History & Notes</label>
                <textarea rows={6} required className="w-full border border-slate-300 p-3 rounded-lg bg-white text-slate-900" placeholder="Past roles and experiences..." value={careerHistory} onChange={(e) => setCareerHistory(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Target Job Description</label>
                <textarea rows={6} required className="w-full border border-slate-300 p-3 rounded-lg bg-white text-slate-900" placeholder="Paste target requirements here..." value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 cursor-pointer">
              {loading ? <><RefreshCw className="animate-spin w-5 h-5" /> Generating Live Dashboard Report...</> : "Analyze Fit & Build Smart Dashboard"}
            </button>
          </form>
        ) : (
          <div className="bg-white p-8 rounded-xl shadow-sm space-y-8">
            {/* Live Link Share Link */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4 rounded-lg text-white flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Share2 className="w-6 h-6 shrink-0" />
                <div>
                  <h3 className="font-bold">Your Optimized AI Resume is Live!</h3>
                  <p className="text-xs text-indigo-100">Send this cloud hosted link straight to hiring managers.</p>
                </div>
              </div>
              <button onClick={copyLink} className="bg-white text-indigo-600 p-2 rounded text-xs font-bold hover:bg-indigo-50 flex items-center gap-1 transition cursor-pointer">
                {copied ? <CheckCircle className="w-3 h-3 text-green-600"/> : <Copy className="w-3 h-3"/>} {copied ? "Copied" : "Copy Link"}
              </button>
            </div>

            {/* Core Analytics Scoring Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-100">
              <div className="flex flex-col items-center justify-center bg-white p-6 rounded-lg text-center shadow-sm">
                <BarChart3 className="w-8 h-8 text-indigo-500 mb-2" />
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Match Score</h4>
                <div className="text-4xl font-black mt-2 text-indigo-600">{results.match_score}%</div>
              </div>
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                <h4 className="text-sm font-bold text-rose-500 flex items-center gap-1.5 mb-2"><AlertTriangle className="w-4 h-4" /> Missing Keywords</h4>
                <div className="text-xs text-slate-600 flex flex-wrap gap-1">
                  {results.missing_skills?.map((s: string, i: number) => <span key={i} className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-100">{s}</span>) || "None"}
                </div>
              </div>
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                <h4 className="text-sm font-bold text-indigo-600 flex items-center gap-1.5 mb-2"><Target className="w-4 h-4" /> Optimization Tips</h4>
                <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">{results.tailoring_tips?.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul>
              </div>
            </div>

            {/* Interactive Section Toggles Tab Bar */}
            <div className="flex border-b border-slate-200 gap-4">
              <button onClick={() => setActiveTab('resume')} className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-1.5 cursor-pointer transition ${activeTab === 'resume' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}><FileText className="w-4 h-4"/> Generated Resume</button>
              <button onClick={() => setActiveTab('hr')} className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-1.5 cursor-pointer transition ${activeTab === 'hr' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}><User className="w-4 h-4"/> HR Interview Prep</button>
              <button onClick={() => setActiveTab('tech')} className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-1.5 cursor-pointer transition ${activeTab === 'tech' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}><Code className="w-4 h-4"/> Tech Interview Prep</button>
            </div>

            {/* TAB PANEL CONTENT: Optimized Resume Template View */}
            {activeTab === 'resume' && (
              <div className="border border-slate-200 p-6 rounded-lg space-y-4 bg-white shadow-xs">
                <h2 className="text-2xl font-bold text-slate-900 border-b pb-2">{results.resume?.full_name}</h2>
                <p className="text-sm text-slate-700 leading-relaxed">{results.resume?.professional_summary}</p>
                <div className="flex flex-wrap gap-1.5 py-2">
                  {results.resume?.skills?.map((s: string, i: number) => <span key={i} className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded font-medium border border-indigo-100">{s}</span>)}
                </div>
                <div className="space-y-4">
                  {results.resume?.experience?.map((exp: any, i: number) => (
                    <div key={i} className="text-xs space-y-1 border-l-2 border-slate-100 pl-3">
                      <div className="flex justify-between font-bold text-slate-800"><span>{exp.role} — {exp.company}</span><span>{exp.duration}</span></div>
                      <ul className="list-disc list-inside text-slate-500 space-y-0.5">{exp.bullet_points?.map((b: string, idx: number) => <li key={idx}>{b}</li>)}</ul>
                    </div>
                  ))}
