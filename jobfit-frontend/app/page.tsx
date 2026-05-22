'use client';
import { useState } from 'react';
import { Sparkles, RefreshCw, BarChart3, AlertTriangle, Target, FileText, User, Code, HelpCircle, RotateCcw, ClipboardCheck, ArrowRight, ArrowLeftRight, CheckCircle2, Sun, Moon } from 'lucide-react';

export default function Home() {
  const [fullName, setFullName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [careerHistory, setCareerHistory] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'builder' | 'validation' | 'updated_resume' | 'prep'>('builder');
  const [darkMode, setDarkMode] = useState(false);

  const handleGenerate = async () => {
    if (!fullName || !targetRole || !careerHistory || !jobDescription) return alert("Please fill out all metric fields.");
    setLoading(true); setResults(null);
    const formData = new FormData();
    formData.append('full_name', fullName); formData.append('target_role', targetRole);
    formData.append('career_history', careerHistory); formData.append('job_description', jobDescription);
    try {
      const res = await fetch('https://onrender.com', { method: 'POST', body: formData });
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
    <main className={`min-h-screen p-4 md:p-8 font-sans antialiased transition-colors duration-300 ${darkMode ? 'bg-amber-950 text-amber-50 selection:bg-amber-600 selection:text-white' : 'bg-[#FDFBF7] text-stone-900 selection:bg-amber-700 selection:text-white'}`}>
      <div className="max-w-5xl mx-auto space-y-6">
        
        <header className="relative flex flex-col items-center text-center space-y-2 py-4 border-b border-dashed border-amber-200 dark:border-amber-900/60">
          <button type="button" onClick={() => setDarkMode(!darkMode)} className={`absolute top-2 right-2 p-2 rounded-xl border flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider cursor-pointer shadow-sm transition-all ${darkMode ? 'bg-amber-900/40 border-amber-800/60 text-amber-400 hover:bg-amber-900/60' : 'bg-white border-amber-200 text-amber-800 hover:bg-amber-50'}`}>
            {darkMode ? <><Sun className="w-3.5 h-3.5"/> Light Theme</> : <><Moon className="w-3.5 h-3.5"/> Dark Theme</>}
          </button>
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold border ${darkMode ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-100 text-amber-800'}`}><Sparkles className="w-3 h-3 text-amber-600" /> Engine Verified: Gemini 2.5 Pro Tier</div>
          <h1 className={`text-3xl md:text-5xl font-black tracking-tight ${darkMode ? 'text-amber-100' : 'text-stone-900'}`}>AI Career Intelligence Matrix</h1>
          <p className={`text-xs md:text-sm max-w-xl mx-auto leading-relaxed font-medium ${darkMode ? 'text-amber-200/60' : 'text-stone-600'}`}>Bridge the gap between your engineering experience profile and ATS screening rules to secure premium interview placement.</p>
        </header>

        {results && (
          <div className={`flex flex-wrap border p-1.5 gap-1.5 backdrop-blur-md rounded-2xl shadow-sm overflow-x-auto ${darkMode ? 'bg-amber-900/20 border-amber-900/60' : 'bg-white border-amber-200'}`}>
            {([['builder', 'Pipeline Builder', Sparkles], ['validation', 'Resume Validation', ClipboardCheck], ['updated_resume', 'Tailored Output', FileText], ['prep', 'Interview Vectors', User]] as const).map(([t, label, Icon]) => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all duration-200 text-xxs tracking-wide ${tab === t ? 'bg-amber-800 text-white shadow-md scale-[1.01]' : darkMode ? 'text-amber-300 hover:bg-amber-900/40 hover:text-amber-100' : 'text-stone-600 hover:bg-amber-50 hover:text-stone-900'}`}><Icon className="w-3.5 h-3.5"/> {label}</button>
            ))}
          </div>
        )}

        {tab === 'builder' && (
          <div className={`border p-6 rounded-2xl shadow-sm space-y-6 ${darkMode ? 'bg-amber-900/10 border-amber-900/40 shadow-2xl' : 'bg-white border-amber-200'}`}>
            <div className={`flex justify-between items-center border-b pb-3 ${darkMode ? 'border-amber-900/40' : 'border-amber-100'}`}>
              <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${darkMode ? 'text-amber-400' : 'text-amber-800'}`}><ArrowLeftRight className="w-4 h-4"/> Core Variable Mapping</h2>
              {results && <button type="button" onClick={() => { setFullName(''); setTargetRole(''); setCareerHistory(''); setJobDescription(''); setResults(null); setTab('builder'); }} className={`flex items-center gap-1 font-bold px-3 py-1 rounded-xl border transition-all text-xxs tracking-wide cursor-pointer ${darkMode ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20' : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'}`}><RotateCcw className="w-3 h-3"/> Reset Form</button>}
            </div>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={`font-semibold text-xxs uppercase tracking-wider ${darkMode ? 'text-amber-300/80' : 'text-stone-500'}`}>Applicant Full Name</label>
                  <input type="text" className={`w-full border p-3 rounded-xl focus:outline-none focus:ring-1 transition-all ${darkMode ? 'bg-amber-950/40 border-amber-900/60 focus:border-amber-500 focus:ring-amber-500/40 text-amber-100' : 'bg-amber-50/40 border-amber-200 focus:border-amber-700 focus:ring-amber-700 text-stone-800'}`} placeholder="e.g. Alex Mercer" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className={`font-semibold text-xxs uppercase tracking-wider ${darkMode ? 'text-amber-300/80' : 'text-stone-500'}`}>Target Role Objective</label>
                  <input type="text" className={`w-full border p-3 rounded-xl focus:outline-none focus:ring-1 transition-all ${darkMode ? 'bg-amber-950/40 border-amber-900/60 focus:border-amber-500 focus:ring-amber-500/40 text-amber-100' : 'bg-amber-50/40 border-amber-200 focus:border-amber-700 focus:ring-amber-700 text-stone-800'}`} placeholder="e.g. Senior Frontend Architect" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`space-y-1.5 p-4 rounded-xl border ${darkMode ? 'bg-amber-950/20 border-amber-900/40' : 'bg-amber-50/30 border-amber-100'}`}>
                  <label className={`font-semibold text-xxs uppercase tracking-wider flex items-center gap-1 ${darkMode ? 'text-amber-300' : 'text-amber-900'}`}><FileText className="w-3.5 h-3.5 text-amber-600"/> Legacy Career Profile</label>
                  <p className="text-[10px] text-stone-400 dark:text-amber-300/60 mb-2 leading-normal">Hint: List parameters, engineering tools used, or clip structural history.</p>
                  <textarea rows={6} className={`w-full border p-3 rounded-xl focus:outline-none font-mono text-[11px] leading-relaxed transition-all ${darkMode ? 'bg-amber-950/60 border-amber-900 text-amber-200 focus:border-amber-500' : 'bg-white border-amber-200 text-stone-800 focus:border-amber-700'}`} placeholder="Frontend Dev at TechCorp. Managed core React components, optimizing layout loops..." value={careerHistory} onChange={(e) => setCareerHistory(e.target.value)} />
                </div>
                <div className={`space-y-1.5 p-4 rounded-xl border ${darkMode ? 'bg-amber-950/20 border-amber-900/40' : 'bg-amber-50/30 border-amber-100'}`}>
                  <label className={`font-semibold text-xxs uppercase tracking-wider flex items-center gap-1 ${darkMode ? 'text-amber-300' : 'text-amber-900'}`}><Target className="w-3.5 h-3.5 text-amber-600"/> Job Description Target</label>
                  <p className="text-[10px] text-stone-400 dark:text-amber-300/60 mb-2 leading-normal">Hint: Paste complete requirements checklist from your target hiring pipe.</p>
                  <textarea rows={6} className={`w-full border p-3 rounded-xl focus:outline-none font-mono text-[11px] leading-relaxed transition-all ${darkMode ? 'bg-amber-950/60 border-amber-900 text-amber-200 focus:border-amber-500' : 'bg-white border-amber-200 text-stone-800 focus:border-amber-700'}`} placeholder="Seeking an engineer with deep runtime comprehension of cloud topologies..." value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button type="button" onClick={handleGenerate} disabled={loading} className="w-full bg-amber-800 hover:bg-amber-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all text-xxs uppercase tracking-widest disabled:bg-stone-300 dark:disabled:bg-amber-950/40 dark:disabled:text-amber-800">
{tab === 'validation' && results && (
          <div className={`border p-6 rounded-2xl shadow-sm space-y-5 ${darkMode ? 'bg-amber-900/10 border-amber-900/40' : 'bg-white border-amber-200'}`}>
            <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b pb-3 ${darkMode ? 'text-amber-400 border-amber-900/40' : 'text-amber-800 border-amber-100'}`}><BarChart3 className="w-4 h-4"/> Resume Validation Metrics Panel</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className={`p-6 rounded-2xl border text-center relative overflow-hidden ${darkMode ? 'bg-amber-950 border-amber-800' : 'bg-amber-50/80 border-amber-200'}`}>
                <BarChart3 className="w-6 h-6 text-amber-700 dark:text-amber-500 mx-auto mb-2"/>
                <h4 className={`font-bold uppercase tracking-widest text-[10px] ${darkMode ? 'text-amber-300' : 'text-amber-900'}`}>ATS Alignment Match Score</h4>
                <div className={`text-5xl font-black mt-2 ${darkMode ? 'text-amber-200' : 'text-amber-800'}`}>{results.match_score}%</div>
                <p className="text-[10px] text-stone-500 dark:text-amber-400/60 mt-2 font-medium">Target calculation based on requirement coverage.</p>
              </div>

              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-amber-950 border-amber-800' : 'bg-stone-900 text-stone-100 border-stone-950'}`}>
                <h4 className="text-amber-400 font-extrabold uppercase tracking-widest text-[10px] flex items-center gap-1.5 border-b pb-1.5 border-amber-500/20 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400"/> Critical Keyword Gaps Isolate
                </h4>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
                  {results.missing_skills?.map((s: string, i: number) => (
                    <span key={i} className="bg-amber-400/20 text-amber-300 font-bold px-2.5 py-1 rounded-lg border border-amber-400/30 text-[10px] tracking-wide shadow-sm">{s}</span>
                  )) || <span className="text-stone-400 italic text-[10px]">No core variance exceptions found.</span>}
                </div>
              </div>

              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-amber-950 border-amber-800' : 'bg-[#F5EFE6] border-amber-200/80 text-stone-900'}`}>
                <h4 className="text-amber-900 dark:text-amber-400 font-extrabold uppercase tracking-widest text-[10px] flex items-center gap-1.5 border-b pb-1.5 border-amber-700/20 mb-3">
                  <Target className="w-4 h-4 text-amber-700 dark:text-amber-500"/> Optimization Strategy Advice
                </h4>
                <ul className="space-y-2 text-[10px] font-medium leading-relaxed max-h-32 overflow-y-auto pr-1 list-none pl-0">
                  {results.tailoring_tips?.map((t: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 border-b border-dashed border-amber-700/10 pb-1 last:border-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-700 dark:text-amber-500 shrink-0 mt-0.5"/> 
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {tab === 'updated_resume' && results && (
          <div className={`border p-6 rounded-2xl shadow-sm space-y-5 ${darkMode ? 'bg-amber-900/10 border-amber-900/40' : 'bg-white border-amber-200'}`}>
            <div className="bg-amber-800 p-4 rounded-xl text-white flex justify-between items-center shadow-md">
              <div className="flex items-center gap-1.5 font-bold text-xxs tracking-wider uppercase"><FileText className="w-4 h-4 text-amber-200"/> Tailored Optimization Resume Output Map</div>
              <button onClick={handleCopyLink} className="bg-white text-amber-900 px-3 py-1.5 rounded-xl font-bold cursor-pointer text-[10px] uppercase tracking-wider transition-all hover:bg-amber-50 shadow-sm border border-amber-100">{copied ? "Blueprint Linked!" : "Copy Public PDF Link"}</button>
            </div>
            <div className={`border p-6 rounded-xl space-y-4 max-h-[500px] overflow-y-auto shadow-inner leading-relaxed ${darkMode ? 'border-amber-900/40 bg-amber-950/80' : 'border-amber-200 bg-amber-50/40'}`}>
              <h2 className={`text-xl font-extrabold tracking-tight border-b pb-2 ${darkMode ? 'text-white border-slate-800' : 'text-slate-900 border-amber-200'}`}>{results.resume?.full_name}</h2>
              <p className={`text-xs font-medium tracking-wide ${darkMode ? 'text-amber-200/70' : 'text-stone-600'}`}>{results.resume?.professional_summary}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {results.resume?.skills?.map((s: string, i: number) => <span key={i} className={`font-bold px-2 py-0.5 rounded-md border text-[10px] tracking-wide ${darkMode ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>{s}</span>)}
              </div>
              <div className="space-y-4 pt-3">
                {results.resume?.experience?.map((exp: any, i: number) => (
                  <div key={i} className="space-y-1.5 border-l-2 border-amber-600/50 pl-4 relative">
                    <div className="absolute w-2 h-2 rounded-full bg-amber-600 -left-[5px] top-1 shadow-sm" />
                    <div className={`flex justify-between font-bold text-xs ${darkMode ? 'text-amber-100' : 'text-stone-800'}`}><span>{exp.role} <span className="font-normal text-stone-400">at</span> {exp.company}</span><span className="text-amber-700 dark:text-amber-400 text-[10px] tracking-wider">{exp.duration}</span></div>
                    <ul className={`list-none space-y-1 text-[10px] pl-0 ${darkMode ? 'text-amber-200/60' : 'text-stone-600'}`}>{exp.bullet_points?.map((b: string, idx: number) => <li key={idx} className="flex items-start gap-2">⚡ <span>{b}</span></li>)}</ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'prep' && results && (
          <div className={`border p-6 rounded-2xl shadow-sm space-y-5 ${darkMode ? 'bg-amber-900/10 border-amber-900/40' : 'bg-white border-slate-200'}`}>
            <div className={`p-4 rounded-xl text-white flex justify-between items-center shadow-md ${darkMode ? 'bg-amber-950 border border-amber-900/60' : 'bg-stone-800'}`}>
              <div className="flex items-center gap-1.5 font-bold text-xxs tracking-wider uppercase text-amber-100"><User className="w-4 h-4 text-amber-400"/> Recruitment Readiness Training Matrix</div>
              <button onClick={handleCopyLink} className="bg-amber-700 text-white px-3 py-1.5 rounded-xl font-bold cursor-pointer text-[10px] uppercase tracking-wider transition-all hover:bg-amber-600 shadow-sm border border-amber-600/40">{copied ? "Link Copied!" : "Copy Public PDF Link"}</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[500px] overflow-y-auto pr-1">
              <div className="space-y-4">
                <h4 className="text-xxs font-bold uppercase tracking-widest text-amber-800 dark:text-amber-400 border-b pb-2 flex items-center gap-1.5 dark:border-amber-900/60"><User className="w-4 h-4"/> Behavioral Strategy Vectors</h4>
                {results.hr_interview?.map((item: any, i: number) => (
                  <div key={i} className={`p-4 rounded-xl border space-y-2 transition-all ${darkMode ? 'bg-amber-950/60 border-amber-900/40 hover:border-amber-800' : 'bg-amber-50/40 border-amber-200 hover:border-amber-300'}`}>
                    <div className={`font-bold flex items-start gap-1.5 text-xs ${darkMode ? 'text-amber-200' : 'text-stone-800'}`}><HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"/> <span>Q: {item.question}</span></div>
                    <div className={`text-[11px] pl-5 leading-relaxed ${darkMode ? 'text-amber-200/70' : 'text-stone-600 font-medium'}`}><span className="font-bold text-amber-800 dark:text-amber-400">Response Logic:</span> {item.response}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                <h4 className="text-xxs font-bold uppercase tracking-widest text-amber-800 dark:text-amber-400 border-b pb-2 flex items-center gap-1.5 dark:border-amber-900/60"><Code className="w-4 h-4"/> Domain Execution Vectors</h4>
                {results.technical_interview?.map((item: any, i: number) => (
                  <div key={i} className={`p-4 rounded-xl border space-y-2 transition-all ${darkMode ? 'bg-amber-950/60 border-amber-900/40 hover:border-amber-800' : 'bg-amber-50/40 border-amber-200 hover:border-amber-300'}`}>
                    <div className={`font-bold flex items-start gap-1.5 text-xs ${darkMode ? 'text-amber-200' : 'text-stone-800'}`}><Code className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"/> <span>Q: {item.question}</span></div>
                    <div className={`text-[11px] pl-5 leading-relaxed ${darkMode ? 'text-amber-200/70' : 'text-stone-600 font-medium'}`}><span className="font-bold text-amber-800 dark:text-amber-400">Technical Strategy:</span> {item.response}</div>
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
