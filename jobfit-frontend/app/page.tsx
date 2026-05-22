'use client';
import { useState } from 'react';
import { Sparkles, RefreshCw, BarChart3, AlertTriangle, Target, FileText, User, Code, HelpCircle, RotateCcw, ClipboardCheck, ArrowRight } from 'lucide-react';

export default function Home() {
  const [fullName, setFullName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [careerHistory, setCareerHistory] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'builder' | 'validation' | 'updated_resume' | 'prep'>('builder');

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
      const res = await fetch('https://onrender.com', { method: 'POST', body: formData, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error();
      setResults(await res.json());
      setTab('validation');
    } catch {
      alert("AI generation failed. Check your Render key or reload.");
    } finally { 
      setLoading(false); 
    }
  };

  const handleReset = () => {
    setFullName(''); setTargetRole(''); setCareerHistory(''); setJobDescription('');
    setResults(null); setTab('builder');
  };

  const handleCopyLink = () => {
    if (!results?.shareable_url) return;
    navigator.clipboard.writeText(results.shareable_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900 text-xs">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="text-center space-y-1">
          <h1 className="text-2xl font-extrabold text-indigo-600 flex items-center justify-center gap-1"><Sparkles className="w-6 h-6"/> AI Career Dashboard</h1>
          <p className="text-slate-500">Tailor resumes, track ATS matching score, and unlock interview prep guides</p>
        </header>

        {results && (
          <div className="flex flex-wrap border-b gap-4 bg-white p-3 rounded-t-xl shadow-sm border-x border-t">
            <button onClick={() => setTab('builder')} className={`pb-2 pt-1 font-bold border-b-2 flex items-center gap-1 cursor-pointer transition ${tab === 'builder' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}><Sparkles className="w-4 h-4"/> AI Resume Builder</button>
            <button onClick={() => setTab('validation')} className={`pb-2 pt-1 font-bold border-b-2 flex items-center gap-1 cursor-pointer transition ${tab === 'validation' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}><ClipboardCheck className="w-4 h-4"/> Resume Validation</button>
            <button onClick={() => setTab('updated_resume')} className={`pb-2 pt-1 font-bold border-b-2 flex items-center gap-1 cursor-pointer transition ${tab === 'updated_resume' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}><FileText className="w-4 h-4"/> Updated Resume</button>
            <button onClick={() => setTab('prep')} className={`pb-2 pt-1 font-bold border-b-2 flex items-center gap-1 cursor-pointer transition ${tab === 'prep' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}><User className="w-4 h-4"/> Interview Prep (HR & Tech)</button>
          </div>
        )}

        {tab === 'builder' && (
          <div className="bg-white p-5 rounded-xl shadow-sm border space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-sm font-bold text-slate-700 flex items-center gap-1">Input Specifications Matrix</h2>
              {results && <button type="button" onClick={handleReset} className="flex items-center gap-1 bg-rose-50 text-rose-600 font-bold px-2 py-1 rounded border border-rose-200 hover:bg-rose-100 cursor-pointer"><RotateCcw className="w-3.5 h-3.5"/> Reset Form</button>}
            </div>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1"><label className="font-semibold text-slate-500">Applicant Full Name</label><input type="text" required className="w-full border p-2 rounded bg-white" placeholder="e.g. John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                <div className="space-y-1"><label className="font-semibold text-slate-500">Target Role Objective</label><input type="text" required className="w-full border p-2 rounded bg-white" placeholder="e.g. Senior Software Engineer" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1"><label className="font-semibold text-slate-500">Career History Profile Summary</label><textarea rows={6} required className="w-full border p-2 rounded bg-white" placeholder="Paste your comprehensive work history nodes here..." value={careerHistory} onChange={(e) => setCareerHistory(e.target.value)} /></div>
                <div className="space-y-1"><label className="font-semibold text-slate-500">Target Job Description Criteria</label><textarea rows={6} required className="w-full border p-2 rounded bg-white" placeholder="Paste the employer's job requirement listing text here..." value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} /></div>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={loading} className="flex-1 bg-indigo-600 text-white font-bold py-2 rounded flex items-center justify-center gap-1 cursor-pointer hover:bg-indigo-700 disabled:bg-slate-300">{loading ? <><RefreshCw className="animate-spin w-4 h-4" /> Analyzing Architecture...</></> : "Generate Career Analytics"}</button>
                {results && <button type="button" onClick={() => setTab('validation')} className="bg-slate-800 text-white font-bold px-4 py-2 rounded flex items-center gap-1 cursor-pointer hover:bg-slate-900">View Extracted Analysis <ArrowRight className="w-4 h-4"/></button>}
              </div>
            </form>
          </div>
        )}
        {tab === 'validation' && results && (
          <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b pb-2 flex items-center gap-1"><BarChart3 className="w-4 h-4 text-indigo-600"/> Resume Metrics Comparison Scope</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border">
              <div className="bg-white p-3 rounded text-center border"><BarChart3 className="w-5 h-5 text-indigo-500 mx-auto mb-1"/><h4 className="text-slate-400 font-bold uppercase">Match Score</h4><div className="text-2xl font-black text-indigo-600 mt-1">{results.match_score}%</div></div>
              <div className="bg-white p-3 rounded border"><h4 className="text-rose-500 font-bold flex items-center gap-1 mb-1"><AlertTriangle className="w-4 h-4"/> Missing Skills</h4><div className="flex flex-wrap gap-1">{results.missing_skills?.map((s: string, i: number) => <span key={i} className="bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200">{s}</span>) || "None detected"}</div></div>
              <div className="bg-white p-3 rounded border"><h4 className="text-indigo-600 font-bold flex items-center gap-1 mb-1"><Target className="w-4 h-4"/> Strategy Tips</h4><ul className="list-disc list-inside space-y-0.5 text-slate-600">{results.tailoring_tips?.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul></div>
            </div>
          </div>
        )}

        {tab === 'updated_resume' && results && (
          <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
            <div className="bg-indigo-600 p-3 rounded text-white flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-1 font-bold"><FileText className="w-4 h-4"/> Tailored Optimization Document Map</div>
              <button onClick={handleCopyLink} className="bg-white text-indigo-600 px-2 py-1 rounded font-bold cursor-pointer text-xxs hover:bg-slate-100 shadow-sm border">{copied ? "Copied Link Successfully!" : "Copy Generated PDF Link"}</button>
            </div>
            <div className="border p-4 rounded bg-slate-50 space-y-3 font-sans max-h-96 overflow-y-auto">
              <h2 className="text-lg font-bold border-b pb-1 text-slate-800">{results.resume?.full_name}</h2>
              <p className="text-slate-700 leading-relaxed text-xs">{results.resume?.professional_summary}</p>
              <div className="flex flex-wrap gap-1">{results.resume?.skills?.map((s: string, i: number) => <span key={i} className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">{s}</span>)}</div>
              <div className="space-y-3 pt-2">
                {results.resume?.experience?.map((exp: any, i: number) => (
                  <div key={i} className="space-y-1 border-l-2 border-indigo-500 pl-3">
                    <div className="flex justify-between font-bold text-slate-800 text-xs"><span>{exp.role} — {exp.company}</span><span className="text-slate-500">{exp.duration}</span></div>
                    <ul className="list-disc list-inside text-slate-600 space-y-0.5 text-xxs">{exp.bullet_points?.map((b: string, idx: number) => <li key={idx}>{b}</li>)}</ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'prep' && results && (
          <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
            <div className="bg-slate-800 p-3 rounded text-white flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-1 font-bold"><User className="w-4 h-4 text-indigo-400"/> Recruiter Behavioral & Core Technical Matrix</div>
              <button onClick={handleCopyLink} className="bg-white text-slate-800 px-2 py-1 rounded font-bold cursor-pointer text-xxs hover:bg-slate-100 shadow-sm border">{copied ? "Copied Link Successfully!" : "Copy Generated PDF Link"}</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[450px] overflow-y-auto pr-1">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-indigo-600 border-b pb-1 flex items-center gap-1"><User className="w-4 h-4"/> Human Resources Strategy Prep</h4>
                {results.hr_interview?.map((item: any, i: number) => (
                  <div key={i} className="p-3 bg-slate-50 rounded border space-y-1 hover:border-indigo-200 transition">
                    <div className="font-bold text-slate-800 flex items-start gap-1"><HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5"/> Q: {item.question}</div>
                    <div className="text-slate-600 pl-5 leading-relaxed"><span className="font-semibold text-indigo-600">Answer Guide:</span> {item.response}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-indigo-600 border-b pb-1 flex items-center gap-1"><Code className="w-4 h-4"/> Engineering Domain Technical Prep</h4>
                {results.technical_interview?.map((item: any, i: number) => (
                  <div key={i} className="p-3 bg-slate-50 rounded border space-y-1 hover:border-indigo-200 transition">
                    <div className="font-bold text-slate-800 flex items-start gap-1"><Code className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5"/> Q: {item.question}</div>
                    <div className="text-slate-600 pl-5 leading-relaxed"><span className="font-semibold text-indigo-600">Technical Strategy:</span> {item.response}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
