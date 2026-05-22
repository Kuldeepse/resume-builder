'use client';
import { useState } from 'react';
import { Sparkles, RefreshCw, BarChart3, AlertTriangle, Target, FileText, User, Code, HelpCircle, RotateCcw, ClipboardCheck, ArrowRight, ArrowLeftRight, CheckCircle2 } from 'lucide-react';

export default function Home() {
  const [fullName, setFullName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [careerHistory, setCareerHistory] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'builder' | 'validation' | 'updated_resume' | 'prep'>('builder');

  const handleGenerate = async () => {
    if (!fullName || !targetRole || !careerHistory || !jobDescription) return alert("Please fill out all metric fields.");
    setLoading(true); setResults(null);
    const formData = new FormData();
    formData.append('full_name', fullName); formData.append('target_role', targetRole);
    formData.append('career_history', careerHistory); formData.append('job_description', jobDescription);
    try {
      const res = await fetch('https://resume-builder-backend-ph7b.onrender.com/build-resume', { method: 'POST', body: formData });
      if (!res.ok) throw new Error();
      setResults(await res.json());
      setTab('validation');
    } catch {
      alert("AI optimization cycle broken. Refocusing backend container parameters.");
    } finally { setLoading(false); }
  };

  const handleCopyLink = () => {
    if (!results?.shareable_url) return;
    navigator.clipboard.writeText(results.shareable_url);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-indigo-950 to-slate-950 p-4 md:p-8 text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="text-center space-y-2 py-4 relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-400 font-medium text-[10px] uppercase tracking-wider mx-auto shadow-sm"><Sparkles className="w-3 h-3 text-amber-400" /> Powered by Gemini 2.5 Flash Engine</div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-indigo-400 drop-shadow-md">AI Career Intelligence Matrix</h1>
          <p className="text-slate-400 text-xs md:text-sm max-w-xl mx-auto font-normal leading-relaxed">Bridge the gap between your engineering experience profile and ATS algorithms to secure premium interview placement.</p>
        </header>

        {results && (
          <div className="flex flex-wrap border border-slate-800 p-1.5 gap-1.5 bg-slate-900/60 backdrop-blur-md rounded-2xl shadow-2xl overflow-x-auto">
            {([['builder', 'Pipeline Builder', Sparkles], ['validation', 'Score Validation', ClipboardCheck], ['updated_resume', 'Tailored Output', FileText], ['prep', 'Interview Vectors', User]] as const).map(([t, label, Icon]) => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all duration-300 text-xxs tracking-wide ${tab === t ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 scale-[1.02]' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}><Icon className="w-3.5 h-3.5"/> {label}</button>
            ))}
          </div>
        )}

        {tab === 'builder' && (
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 p-6 rounded-2xl shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800/60 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5"><ArrowLeftRight className="w-4 h-4 text-indigo-500"/> Core Variable Mapping</h2>
              {results && <button type="button" onClick={() => { setFullName(''); setTargetRole(''); setCareerHistory(''); setJobDescription(''); setResults(null); setTab('builder'); }} className="flex items-center gap-1 bg-rose-500/10 text-rose-400 font-bold px-3 py-1 rounded-xl border border-rose-500/20 transition-all hover:bg-rose-500/20 text-xxs tracking-wide cursor-pointer"><RotateCcw className="w-3 h-3"/> Purge Architecture</button>}
            </div>
            <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="font-semibold text-slate-400 text-xxs uppercase tracking-wider">Applicant Full Name</label><input type="text" className="w-full border border-slate-800 focus:border-indigo-500/80 p-3 rounded-xl bg-slate-950/80 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 placeholder:text-slate-600 transition-all" placeholder="e.g. Alex Mercer" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                <div className="space-y-1.5"><label className="font-semibold text-slate-400 text-xxs uppercase tracking-wider">Target Role Objective</label><input type="text" className="w-full border border-slate-800 focus:border-indigo-500/80 p-3 rounded-xl bg-slate-950/80 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 placeholder:text-slate-600 transition-all" placeholder="e.g. Senior Backend Architect" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 p-4 rounded-xl bg-slate-950/30 border border-slate-800/40">
                  <label className="font-semibold text-slate-300 text-xxs uppercase tracking-wider flex items-center gap-1"><FileText className="w-3.5 h-3.5 text-indigo-400"/> Legacy Career Profile</label>
                  <p className="text-[10px] text-slate-500 mb-2">Hint: List positions, achievements, or paste old resume snippets.</p>
                  <textarea rows={6} className="w-full border border-slate-800 focus:border-indigo-500/80 p-3 rounded-xl bg-slate-950/90 text-slate-300 focus:outline-none font-mono text-[11px] leading-relaxed" placeholder="Frontend Architect at TechCorp. Spearheaded modular state machines using React..." value={careerHistory} onChange={(e) => setCareerHistory(e.target.value)} />
                </div>
                <div className="space-y-1.5 p-4 rounded-xl bg-slate-950/30 border border-slate-800/40">
                  <label className="font-semibold text-slate-300 text-xxs uppercase tracking-wider flex items-center gap-1"><Target className="w-3.5 h-3.5 text-emerald-400"/> Job Description Target</label>
                  <p className="text-[10px] text-slate-500 mb-2">Hint: Paste employer requirements from your hiring targets.</p>
                  <textarea rows={6} className="w-full border border-slate-800 focus:border-indigo-500/80 p-3 rounded-xl bg-slate-950/90 text-slate-300 focus:outline-none font-mono text-[11px] leading-relaxed" placeholder="Seeking an engineer with deep runtime comprehension of cloud topologies..." value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button type="button" onClick={handleGenerate} disabled={loading} className="flex-1 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 shadow-lg shadow-indigo-600/20 text-xxs uppercase tracking-widest disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500">
                  {loading ? <><RefreshCw className="animate-spin w-4 h-4 text-indigo-300" /> Computing Neural Vectors...</> : <><Sparkles className="w-4 h-4 text-amber-300" /> Execute Generation Cycle</>}
                </button>
                {results && <button type="button" onClick={() => setTab('validation')} className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-5 py-3 rounded-xl flex items-center justify-center gap-1 cursor-pointer text-xxs uppercase tracking-widest transition-all">Review Analytics Panel <ArrowRight className="w-4 h-4 text-indigo-400"/></button>}
              </div>
            </form>
          </div>
        )}
        {tab === 'validation' && results && (
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 p-6 rounded-2xl shadow-2xl space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 border-b border-slate-800/60 pb-3"><BarChart3 className="w-4 h-4 text-indigo-500"/> Analytical Delta Dashboard</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-slate-950/80 to-slate-900/80 p-5 rounded-2xl text-center border border-slate-800 relative overflow-hidden">
                <BarChart3 className="w-6 h-6 text-indigo-400 mx-auto mb-1.5"/><h4 className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">ATS Alignment Matrix</h4>
                <div className="text-4xl font-black bg-gradient-to-r from-white via-indigo-100 to-indigo-400 bg-clip-text text-transparent mt-1">{results.match_score}%</div>
              </div>
              <div className="bg-gradient-to-br from-slate-950/80 to-slate-900/80 p-5 rounded-2xl border border-slate-800 overflow-hidden">
                <h4 className="text-rose-400 font-bold uppercase tracking-widest text-[9px] flex items-center gap-1 mb-2"><AlertTriangle className="w-3.5 h-3.5 text-rose-500"/> Core Keyword Gaps</h4>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">{results.missing_skills?.map((s: string, i: number) => <span key={i} className="bg-rose-500/10 text-rose-300 font-medium px-2 py-0.5 rounded-lg border border-rose-500/20 text-[10px] tracking-wide">{s}</span>) || "None"}</div>
              </div>
              <div className="bg-gradient-to-br from-slate-950/80 to-slate-900/80 p-5 rounded-2xl border border-slate-800">
                <h4 className="text-indigo-400 font-bold uppercase tracking-widest text-[9px] flex items-center gap-1 mb-2"><Target className="w-3.5 h-3.5 text-indigo-400"/> Strategic Tailoring Focus</h4>
                <ul className="space-y-1.5 text-slate-400 text-[10px] leading-relaxed max-h-24 overflow-y-auto pr-1 list-none">{results.tailoring_tips?.map((t: string, i: number) => <li key={i} className="flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 text-indigo-500 shrink-0 mt-0.5"/> <span>{t}</span></li>)}</ul>
              </div>
            </div>
          </div>
        )}

        {tab === 'updated_resume' && results && (
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 p-6 rounded-2xl shadow-2xl space-y-5">
            <div className="bg-indigo-600/90 p-4 rounded-xl text-white flex justify-between items-center shadow-lg border border-indigo-500/40">
              <div className="flex items-center gap-1.5 font-bold text-xxs tracking-wider uppercase"><FileText className="w-4 h-4 text-indigo-200"/> Dynamic Resume Blueprint Maps</div>
              <button onClick={handleCopyLink} className="bg-white text-indigo-700 px-3 py-1.5 rounded-xl font-bold cursor-pointer text-[10px] uppercase tracking-wider transition-all hover:bg-slate-100 shadow-md border border-slate-200">{copied ? "Blueprint Linked!" : "Copy Public PDF Artifact Link"}</button>
            </div>
            <div className="border border-slate-800/80 p-6 rounded-xl bg-slate-950/80 space-y-4 max-h-[500px] overflow-y-auto shadow-inner leading-relaxed">
              <h2 className="text-xl font-extrabold tracking-tight text-white border-b border-slate-800 pb-2">{results.resume?.full_name}</h2>
              <p className="text-slate-400 text-xs font-light tracking-wide">{results.resume?.professional_summary}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">{results.resume?.skills?.map((s: string, i: number) => <span key={i} className="bg-indigo-500/10 text-indigo-300 font-medium px-2 py-0.5 rounded-md border border-indigo-500/20 text-[10px] tracking-wide">{s}</span>)}</div>
              <div className="space-y-4 pt-3">
                {results.resume?.experience?.map((exp: any, i: number) => (
                  <div key={i} className="space-y-1.5 border-l-2 border-indigo-600/50 pl-4 relative">
                    <div className="absolute w-2 h-2 rounded-full bg-indigo-500 -left-[5px] top-1 shadow-sm" />
                    <div className="flex justify-between font-bold text-slate-200 text-xs"><span>{exp.role} <span className="text-slate-500 font-normal">at</span> {exp.company}</span><span className="text-indigo-400 text-[10px] tracking-wider">{exp.duration}</span></div>
                    <ul className="list-none space-y-1 text-slate-400 text-[10px] pl-0">{exp.bullet_points?.map((b: string, idx: number) => <li key={idx} className="flex items-start gap-2">⚡ <span>{b}</span></li>)}</ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'prep' && results && (
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 p-6 rounded-2xl shadow-2xl space-y-5">
            <div className="bg-slate-950 p-4 rounded-xl text-white flex justify-between items-center shadow-lg border border-slate-800">
              <div className="flex items-center gap-1.5 font-bold text-xxs tracking-wider uppercase text-slate-300"><User className="w-4 h-4 text-indigo-400"/> Recruitment Readiness Training Matrix</div>
              <button onClick={handleCopyLink} className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl font-bold cursor-pointer text-[10px] uppercase tracking-wider transition-all hover:bg-indigo-500 shadow-md border border-indigo-500/40">{copied ? "Artifact Linked!" : "Copy Public PDF Link"}</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[500px] overflow-y-auto pr-1">
              <div className="space-y-4">
                <h4 className="text-xxs font-bold uppercase tracking-widest text-indigo-400 border-b border-slate-800 pb-2 flex items-center gap-1.5"><User className="w-4 h-4 text-indigo-500"/> Behavioral Strategy Vectors</h4>
                {results.hr_interview?.map((item: any, i: number) => (
                  <div key={i} className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/60 space-y-2 hover:border-slate-700/80 transition-all">
                    <div className="font-bold text-slate-200 flex items-start gap-1.5 text-xs"><HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5"/> ... <span>Q: {item.question}</span></div>
                    <div className="text-slate-400 text-[11px] pl-5 leading-relaxed"><span className="font-semibold text-indigo-400">Response Logic:</span> {item.response}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                <h4 className="text-xxs font-bold uppercase tracking-widest text-indigo-400 border-b border-slate-800 pb-2 flex items-center gap-1.5"><Code className="w-4 h-4 text-indigo-500"/> Domain Execution Vectors</h4>
                {results.technical_interview?.map((item: any, i: number) => (
                  <div key={i} className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/60 space-y-2 hover:border-slate-700/80 transition-all">
                    <div className="font-bold text-slate-200 flex items-start gap-1.5 text-xs"><Code className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5"/> <span>Q: {item.question}</span></div>
                    <div className="text-slate-400 text-[11px] pl-5 leading-relaxed"><span className="font-semibold text-indigo-400">Technical Strategy:</span> {item.response}</div>
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
