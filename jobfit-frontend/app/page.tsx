'use client';
import { useState } from 'react';
import { Sparkles, RefreshCw, BarChart3, AlertTriangle, Target, FileText, User, Code, HelpCircle, ArrowLeft } from 'lucide-react';

export default function Home() {
  const [fullName, setFullName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [careerHistory, setCareerHistory] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'resume' | 'hr' | 'tech'>('resume');

 const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !targetRole || !careerHistory || !jobDescription) return alert("Fill out all fields.");
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
      
      // ✅ Explicitly targets your backend instance AND the /build-resume route endpoint
     // const res = await fetch("https://resume-builder-backend-ph7b.onrender.com/resume-builder", { //  CORRECT SUBDOMAIN
     const res = await fetch("https://onrender.com", {
        method: 'POST', 
        body: formData, 
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server responded with status ${res.status}`);
      }
      
      setResults(await res.json());
    } catch (err: any) {
      alert(`Pipeline Interrupted: ${err.message || "Check your Render backend logs or environment variables."}`);
    } finally { 
      setLoading(false); 
    }
  };

  const resetForm = () => {
    setResults(null);
    setTab('resume');
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900 text-xs">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="text-center space-y-1">
          <h1 className="text-2xl font-extrabold text-indigo-600 flex items-center justify-center gap-1">
            <Sparkles className="w-6 h-6"/> AI Career Dashboard
          </h1>
          <p className="text-slate-500">Tailor resumes, track ATS matching score, and unlock interview prep guides</p>
        </header>

        {!results ? (
          <form onSubmit={handleGenerate} className="bg-white p-5 rounded-xl shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="text" required className="border p-2 rounded bg-white" placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <input type="text" required className="border p-2 rounded bg-white" placeholder="Target Job Title" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <textarea rows={5} required className="border p-2 rounded bg-white" placeholder="Career History & Notes" value={careerHistory} onChange={(e) => setCareerHistory(e.target.value)} />
              <textarea rows={5} required className="border p-2 rounded bg-white" placeholder="Target Job Description" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-2 rounded flex items-center justify-center gap-1 cursor-pointer">
              {loading ? <><RefreshCw className="animate-spin w-4 h-4" /> Analyzing...</> : "Generate Dashboard"}
            </button>
          </form>
        ) : (
          <div className="bg-white p-6 rounded-xl shadow-sm space-y-6">
            <div className="bg-indigo-600 p-3 rounded text-white flex justify-between items-center">
              <button onClick={resetForm} className="flex items-center gap-1 text-white opacity-80 hover:opacity-100 transition font-bold bg-indigo-700 px-2 py-1 rounded cursor-pointer">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button onClick={() => { navigator.clipboard.writeText(results.shareable_url); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="bg-white text-indigo-600 p-1.5 rounded font-bold cursor-pointer transition hover:bg-slate-100">
                {copied ? "Copied!" : "Copy PDF Link"}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border">
              <div className="bg-white p-3 rounded text-center">
                <BarChart3 className="w-5 h-5 text-indigo-500 mx-auto mb-1"/>
                <h4 className="text-slate-400 font-bold uppercase">Match Score</h4>
                <div className="text-2xl font-black text-indigo-600 mt-1">{results.match_score}%</div>
              </div>
              <div className="bg-white p-3 rounded">
                <h4 className="text-rose-500 font-bold flex items-center gap-1 mb-1"><AlertTriangle className="w-4 h-4"/> Missing Skills</h4>
                <div className="flex flex-wrap gap-1">
                  {results.missing_skills?.map((s: string, i: number) => <span key={i} className="bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border">{s}</span>) || "None"}
                </div>
              </div>
              <div className="bg-white p-3 rounded">
                <h4 className="text-indigo-600 font-bold flex items-center gap-1 mb-1"><Target className="w-4 h-4"/> Strategy Tips</h4>
                <ul className="list-disc list-inside space-y-0.5">
                  {results.tailoring_tips?.map((t: string, i: number) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            </div>

            <div className="flex border-b gap-4">
              <button onClick={() => setTab('resume')} className={`pb-2 font-bold border-b-2 flex items-center gap-1 cursor-pointer ${tab === 'resume' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}><FileText className="w-4 h-4"/> Resume</button>
              <button onClick={() => setTab('hr')} className={`pb-2 font-bold border-b-2 flex items-center gap-1 cursor-pointer ${tab === 'hr' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}><User className="w-4 h-4"/> HR Prep</button>
              <button onClick={() => setTab('tech')} className={`pb-2 font-bold border-b-2 flex items-center gap-1 cursor-pointer ${tab === 'tech' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}><Code className="w-4 h-4"/> Tech Prep</button>
            </div>

            {tab === 'resume' && (
              <div className="border p-4 rounded bg-white space-y-3">
                <h2 className="text-lg font-bold border-b pb-1">{results.resume?.full_name}</h2>
                <p className="text-slate-700 leading-relaxed">{results.resume?.professional_summary}</p>
                <div className="flex flex-wrap gap-1">
                  {results.resume?.skills?.map((s: string, i: number) => <span key={i} className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border">{s}</span>)}
                </div>
                <div className="space-y-3">
                  {results.resume?.experience?.map((exp: any, i: number) => (
                    <div key={i} className="space-y-0.5 border-l-2 pl-2">
                      <div className="flex justify-between font-bold text-slate-800">
                        <span>{exp.role} — {exp.company}</span>
                        <span>{exp.duration}</span>
                      </div>
                      <ul className="list-disc list-inside text-slate-500 space-y-0.5">
                        {exp.bullet_points?.map((b: string, idx: number) => <li key={idx}>{b}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'hr' && (
              <div className="space-y-3">
                {results.hr_interview?.map((item: any, i: number) => (
                  <div key={i} className="p-3 bg-slate-50 rounded border space-y-1">
                    <div className="font-bold text-slate-800 flex items-start gap-1">
                      <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5"/> Q: {item.question}
                    </div>
                    <div className="text-slate-600 pl-5 leading-relaxed">
                      <span className="font-semibold text-indigo-600">Answer Strategy:</span> {item.response}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'tech' && (
              <div className="space-y-3">
                {results.technical_interview?.map((item: any, i: number) => (
                  <div key={i} className="p-3 bg-slate-50 rounded border space-y-1">
                    <div className="font-bold text-slate-800 flex items-start gap-1">
                      <Code className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5"/> Q: {item.question}
                    </div>
                    <div className="text-slate-600 pl-5 leading-relaxed">
                      <span className="font-semibold text-indigo-600">Answer Strategy:</span> {item.response}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
