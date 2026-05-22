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
    <main className={`min-h-screen p-4 md:p-8 font-sans antialiased transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <div className="max-w-5xl mx-auto space-y-6">
        
        <header className="relative flex flex-col items-center text-center space-y-2 py-4 border-b border-dashed border-slate-300 dark:border-slate-800">
          <button type="button" onClick={() => setDarkMode(!darkMode)} className={`absolute top-2 right-2 p-2 rounded-xl border flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider cursor-pointer shadow-sm transition-all ${darkMode ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-indigo-600 hover:bg-slate-50'}`}>
            {darkMode ? <><Sun className="w-3.5 h-3.5"/> Light Theme</> : <><Moon className="w-3.5 h-3.5"/> Dark Theme</>}
          </button>
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold border ${darkMode ? 'bg-indigo-500/10 border-indigo-400/20 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}><Sparkles className="w-3 h-3 text-amber-500" /> Engine Verified: Gemini 2.5 Flash</div>
          <h1 className={`text-3xl md:text-5xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>AI Career Intelligence Matrix</h1>
          <p className={`text-xs md:text-sm max-w-xl mx-auto leading-relaxed font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Bridge the gap between your engineering experience profile and ATS screening rules to secure premium interview placement.</p>
        </header>

        {results && (
          <div className={`flex flex-wrap border p-1.5 gap-1.5 backdrop-blur-md rounded-2xl shadow-sm overflow-x-auto ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
            {([['builder', 'Pipeline Builder', Sparkles], ['validation', 'Score Validation', ClipboardCheck], ['updated_resume', 'Tailored Output', FileText], ['prep', 'Interview Vectors', User]] as const).map(([t, label, Icon]) => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all duration-200 text-xxs tracking-wide ${tab === t ? 'bg-indigo-600 text-white shadow-md scale-[1.01]' : darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}><Icon className="w-3.5 h-3.5"/> {label}</button>
            ))}
          </div>
        )}

        {tab === 'builder' && (
          <div className={`border p-6 rounded-2xl shadow-sm space-y-6 ${darkMode ? 'bg-slate-900/40 border-slate-800/80 shadow-2xl' : 'bg-white border-slate-200'}`}>
            <div className={`flex justify-between items-center border-b pb-3 ${darkMode ? 'border-slate-800/60' : 'border-slate-100'}`}>
              <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`}><ArrowLeftRight className="w-4 h-4"/> Core Variable Mapping</h2>
              {results && <button type="button" onClick={() => { setFullName(''); setTargetRole(''); setCareerHistory(''); setJobDescription(''); setResults(null); setTab('builder'); }} className={`flex items-center gap-1 font-bold px-3 py-1 rounded-xl border transition-all text-xxs tracking-wide cursor-pointer ${darkMode ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20' : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'}`}><RotateCcw className="w-3 h-3"/> Purge Matrix</button>}
            </div>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={`font-semibold text-xxs uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Applicant Full Name</label>
                  <input type="text" className={`w-full border p-3 rounded-xl focus:outline-none focus:ring-1 transition-all ${darkMode ? 'bg-slate-950/80 border-slate-800 focus:border-indigo-500/80 text-slate-200' : 'bg-slate-50 border-slate-200 focus:border-indigo-500 text-slate-800'}`} placeholder="e.g. Alex Mercer" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className={`font-semibold text-xxs uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Target Role Objective</label>
                  <input type="text" className={`w-full border p-3 rounded-xl focus:outline-none focus:ring-1 transition-all ${darkMode ? 'bg-slate-950/80 border-slate-800 focus:border-indigo-500/80 text-slate-200' : 'bg-slate-50 border-slate-200 focus:border-indigo-500 text-slate-800'}`} placeholder="e.g. Senior Frontend Architect" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`space-y-1.5 p-4 rounded-xl border ${darkMode ? 'bg-slate-950/30 border-slate-800/40' : 'bg-slate-50/50 border-slate-100'}`}>
                  <label className={`font-semibold text-xxs uppercase tracking-wider flex items-center gap-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}><FileText className="w-3.5 h-3.5 text-indigo-500"/> Legacy Career Profile</label>
                  <p className="text-[10px] text-slate-400 mb-2 leading-normal">Hint: List parameters, engineering tools used, or clip structural history.</p>
                  <textarea rows={6} className={`w-full border p-3 rounded-xl focus:outline-none font-mono text-[11px] leading-relaxed transition-all ${darkMode ? 'bg-slate-950 border-slate-800 text-slate-300 focus:border-indigo-500/80' : 'bg-white border-slate-200 text-slate-800 focus:border-indigo-500'}`} placeholder="Frontend Dev at TechCorp. Managed core React components, optimizing layout loops..." value={careerHistory} onChange={(e) => setCareerHistory(e.target.value)} />
                </div>
                <div className={`space-y-1.5 p-4 rounded-xl border ${darkMode ? 'bg-slate-950/30 border-slate-800/40' : 'bg-slate-50/50 border-slate-100'}`}>
                  <label className={`font-semibold text-xxs uppercase tracking-wider flex items-center gap-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}><Target className="w-3.5 h-3.5 text-emerald-500"/> Job Description Target</label>
                  <p className="text-[10px] text-slate-400 mb-2 leading-normal">Hint: Paste complete requirements checklist from your target hiring pipe.</p>
                  <textarea rows={6} className={`w-full border p-3 rounded-xl focus:outline-none font-mono text-[11px] leading-relaxed transition-all ${darkMode ? 'bg-slate-950 border-slate-800 text-slate-300 focus:border-indigo-500/80' : 'bg-white border-slate-200 text-slate-800 focus:border-indigo-500'}`} placeholder="Seeking an engineer with deep runtime comprehension of cloud topologies..." value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button type="button" onClick={handleGenerate} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all text-xxs uppercase tracking-widest disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-600">
                  {loading ? <><RefreshCw className="animate-spin w-4 h-4 text-indigo-200" /> Computing Neural Vectors...</> : <><Sparkles className="w-4 h-4 text-amber-400" /> Execute Generation Cycle</>}
                </button>
              </div>
            </form>
 {tab === 'validation' && results && (
          <div className={`border p-6 rounded-2xl shadow-sm space-y-5 ${darkMode ? 'bg-slate-900/40 border-slate-800/80' : 'bg-white border-slate-200'}`}>
            <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b pb-3 ${darkMode ? 'text-indigo-400 border-slate-800/60' : 'text-indigo-600 border-slate-100'}`}><BarChart3 className="w-4 h-4"/> Analytical Delta Dashboard</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className={`p-5 rounded-2xl text-center border relative overflow-hidden ${darkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200/60'}`}>
                <BarChart3 className="w-6 h-6 text-indigo-500 mx-auto mb-1.5"/>
                <h4 className={`font-bold uppercase tracking-widest text-[9px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>ATS Alignment Matrix</h4>
                <div className={`text-4xl font-black mt-1 ${darkMode ? 'text-white' : 'text-indigo-600'}`}>{results.match_score}%</div>
              </div>
              <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200/60'}`}>
                <h4 className="text-rose-600 font-bold uppercase tracking-widest text-[9px] flex items-center gap-1 mb-2"><AlertTriangle className="w-3.5 h-3.5 text-rose-500"/> Core Keyword Gaps</h4>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {results.missing_skills?.map((s: string, i: number) => <span key={i} className={`font-medium px-2 py-0.5 rounded-lg border text-[10px] tracking-wide ${darkMode ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>{s}</span>) || "None"}
                </div>
              </div>
              <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200/60'}`}>
                <h4 className="text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest text-[9px] flex items-center gap-1 mb-2"><Target className="w-3.5 h-3.5"/> Strategic Tailoring Focus</h4>
                <ul className={`space-y-1.5 text-[10px] leading-relaxed max-h-24 overflow-y-auto pr-1 list-none ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{results.tailoring_tips?.map((t: string, i: number) => <li key={i} className="flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 text-indigo-500 shrink-0 mt-0.5"/> <span>{t}</span></li>)}</ul>
              </div>
            </div>
          </div>
        )}

        {tab === 'updated_resume' && results && (
          <div className={`border p-6 rounded-2xl shadow-sm space-y-5 ${darkMode ? 'bg-slate-900/40 border-slate-800/80' : 'bg-white border-slate-200'}`}>
            <div className="bg-indigo-600 p-4 rounded-xl text-white flex justify-between items-center shadow-md">
              <div className="flex items-center gap-1.5 font-bold text-xxs tracking-wider uppercase"><FileText className="w-4 h-4 text-indigo-200"/> Dynamic Resume Blueprint Map</div>
              <button onClick={handleCopyLink} className="bg-white text-indigo-700 px-3 py-1.5 rounded-xl font-bold cursor-pointer text-[10px] uppercase tracking-wider transition-all hover:bg-slate-100 shadow-sm border border-slate-200">{copied ? "Blueprint Linked!" : "Copy Public PDF Link"}</button>
            </div>
            <div className={`border p-6 rounded-xl space-y-4 max-h-[500px] overflow-y-auto shadow-inner leading-relaxed ${darkMode ? 'border-slate-800/80 bg-slate-950/80' : 'border-slate-200 bg-slate-50/50'}`}>
              <h2 className={`text-xl font-extrabold tracking-tight border-b pb-2 ${darkMode ? 'text-white border-slate-800' : 'text-slate-900 border-slate-200'}`}>{results.resume?.full_name}</h2>
              <p className={`text-xs font-normal tracking-wide ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{results.resume?.professional_summary}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {results.resume?.skills?.map((s: string, i: number) => <span key={i} className={`font-medium px-2 py-0.5 rounded-md border text-[10px] tracking-wide ${darkMode ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>{s}</span>)}
              </div>
              <div className="space-y-4 pt-3">
                {results.resume?.experience?.map((exp: any, i: number) => (
                  <div key={i} className="space-y-1.5 border-l-2 border-indigo-500/50 pl-4 relative">
                    <div className="absolute w-2 h-2 rounded-full bg-indigo-500 -left-[5px] top-1 shadow-sm" />
                    <div className={`flex justify-between font-bold text-xs ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}><span>{exp.role} <span className="font-normal text-slate-400">at</span> {exp.company}</span><span className="text-indigo-500 dark:text-indigo-400 text-[10px] tracking-wider">{exp.duration}</span></div>
                    <ul className={`list-none space-y-1 text-[10px] pl-0 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{exp.bullet_points?.map((b: string, idx: number) => <li key={idx} className="flex items-start gap-2">⚡ <span>{b}</span></li>)}</ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'prep' && results && (
          <div className={`border p-6 rounded-2xl shadow-sm space-y-5 ${darkMode ? 'bg-slate-900/40 border-slate-800/80' : 'bg-white border-slate-200'}`}>
            <div className={`p-4 rounded-xl text-white flex justify-between items-center shadow-md ${darkMode ? 'bg-slate-950 border border-slate-800' : 'bg-slate-800'}`}>
              <div className="flex items-center gap-1.5 font-bold text-xxs tracking-wider uppercase"><User className="w-4 h-4 text-indigo-400"/> Recruitment Readiness Training Matrix</div>
              <button onClick={handleCopyLink} className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl font-bold cursor-pointer text-[10px] uppercase tracking-wider transition-all hover:bg-indigo-500 shadow-sm border border-indigo-500/40">{copied ? "Link Copied!" : "Copy Public PDF Link"}</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[500px] overflow-y-auto pr-1">
              <div className="space-y-4">
                <h4 className="text-xxs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 border-b pb-2 flex items-center gap-1.5 dark:border-slate-800"><User className="w-4 h-4"/> Behavioral Strategy Vectors</h4>
                {results.hr_interview?.map((item: any, i: number) => (
                  <div key={i} className={`p-4 rounded-xl border space-y-2 transition-all ${darkMode ? 'bg-slate-950/60 border-slate-800/60 hover:border-slate-700/80' : 'bg-slate-50 border-slate-200/60 hover:border-slate-300'}`}>
                    <div className={`font-bold flex items-start gap-1.5 text-xs ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}><HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5"/> <span>Q: {item.question}</span></div>
                    <div className={`text-[11px] pl-5 leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}><span className="font-semibold text-indigo-600 dark:text-indigo-400">Response Logic:</span> {item.response}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                <h4 className="text-xxs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 border-b pb-2 flex items-center gap-1.5 dark:border-slate-800"><Code className="w-4 h-4"/> Domain Execution Vectors</h4>
                {results.technical_interview?.map((item: any, i: number) => (
                  <div key={i} className={`p-4 rounded-xl border space-y-2 transition-all ${darkMode ? 'bg-slate-950/60 border-slate-800/60 hover:border-slate-700/80' : 'bg-slate-50 border-slate-200/60 hover:border-slate-300'}`}>
                    <div className={`font-bold flex items-start gap-1.5 text-xs ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}><Code className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5"/> <span>Q: {item.question}</span></div>
                    <div className={`text-[11px] pl-5 leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}><span className="font-semibold text-indigo-600 dark:text-indigo-400">Technical Strategy:</span> {item.response}</div>
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
