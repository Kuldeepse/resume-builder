'use client';
import { useState } from 'react';
import { Sparkles, RefreshCw, BarChart3, AlertTriangle, Target, FileText, User, Code, HelpCircle, RotateCcw, ClipboardCheck, ArrowRight, ArrowLeftRight, CheckCircle2, Sun, Moon, Heart, Link, Clock, ListOrdered, UserCheck, MessageSquarePlus } from 'lucide-react';

export default function Home() {
  const [fullName, setFullName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [duration, setDuration] = useState('30 minutes');
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [interviewType, setInterviewType] = useState<'hr' | 'technical'>('technical');
  const [careerHistory, setCareerHistory] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'builder' | 'validation' | 'updated_resume' | 'prep'>('builder');
  const [darkMode, setDarkMode] = useState(false);

  const handleGenerate = async () => {
    if (!fullName || !targetRole || !careerHistory || !jobDescription) return alert("Please fill out all mandatory fields.");
    setLoading(true); setResults(null);
    const formData = new FormData();
    formData.append('full_name', fullName); 
    formData.append('target_role', targetRole);
    formData.append('linkedin_profile', linkedin);
    formData.append('interview_duration', duration);
    formData.append('total_questions_requested', totalQuestions.toString());
    formData.append('interview_type', interviewType);
    formData.append('career_history', careerHistory); 
    formData.append('job_description', jobDescription);
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
    <main className={`min-h-screen p-4 md:p-8 font-sans antialiased transition-colors duration-300 ${darkMode ? 'bg-stone-950 text-slate-100' : 'bg-[#FAF8F5] text-slate-900'}`}>
      <div className="max-w-5xl mx-auto space-y-6">
        
        <header className="relative flex flex-col items-center text-center space-y-3 py-4 border-b border-dashed border-amber-900/20 dark:border-slate-800">
          <button type="button" onClick={() => setDarkMode(!darkMode)} className={`absolute top-2 right-2 p-2 rounded-xl border flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider cursor-pointer shadow-sm transition-all ${darkMode ? 'bg-stone-900 border-stone-800 text-amber-500' : 'bg-white border-stone-200 text-stone-800'}`}>
            {darkMode ? <><Sun className="w-3.5 h-3.5"/> Light Theme</> : <><Moon className="w-3.5 h-3.5"/> Dark Theme</>}
          </button>
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold border ${darkMode ? 'bg-indigo-500/10 border-slate-800 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}><Sparkles className="w-3 h-3 text-indigo-500" /> Engine Active: Gemini 2.5 Pro Tier</div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">AI Career Intelligence Matrix</h1>
          <p className={`text-xs md:text-sm max-w-xl mx-auto leading-relaxed font-medium ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Bridge the gap between your engineering experience profile and ATS screening rules to secure premium interview placement.</p>
        </header>

        {results && (
          <div className={`flex flex-wrap border p-1.5 gap-1.5 backdrop-blur-md rounded-2xl shadow-sm overflow-x-auto ${darkMode ? 'bg-stone-900/80 border-slate-800' : 'bg-white border-amber-900/10'}`}>
            {([['builder', 'Pipeline Builder', Sparkles], ['validation', 'Resume Validation', ClipboardCheck], ['updated_resume', 'Tailored Output', FileText], ['prep', 'Interview Vectors', User]] as const).map(([t, label, Icon]) => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all duration-200 text-xxs tracking-wide ${tab === t ? 'bg-amber-900 text-white shadow-md scale-[1.01]' : darkMode ? 'text-stone-400 hover:bg-stone-800' : 'text-stone-600 hover:bg-amber-50'}`}><Icon className="w-3.5 h-3.5"/> {label}</button>
            ))}
          </div>
        )}

        {tab === 'builder' && (
          <div className={`border p-6 rounded-2xl shadow-sm space-y-6 ${darkMode ? 'bg-stone-900/40 border-slate-800/60 shadow-2xl' : 'bg-white border-amber-900/10'}`}>
            <div className={`flex justify-between items-center border-b pb-3 ${darkMode ? 'border-stone-800/60' : 'border-stone-100'}`}>
              <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${darkMode ? 'text-amber-400' : 'text-amber-900'}`}><ArrowLeftRight className="w-4 h-4"/> Core Variable Mapping</h2>
              {results && <button type="button" onClick={() => { setFullName(''); setTargetRole(''); setLinkedin(''); setDuration('30 minutes'); setTotalQuestions(5); setInterviewType('technical'); setCareerHistory(''); setJobDescription(''); setResults(null); setTab('builder'); }} className={`flex items-center gap-1 font-bold px-3 py-1 rounded-xl border text-xxs tracking-wide cursor-pointer ${darkMode ? 'bg-rose-950 text-rose-400 border-rose-500/20' : 'bg-rose-50 text-rose-700 border-rose-200'}`}><RotateCcw className="w-3 h-3"/> Reset Form</button>}
            </div>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-xxs uppercase tracking-wider text-slate-500">Applicant Full Name</label>
                  <input type="text" className={`w-full border p-3 rounded-xl focus:outline-none transition-all ${darkMode ? 'bg-stone-950 border-slate-800 text-slate-200 focus:border-amber-800' : 'bg-stone-50 border-stone-200 text-stone-800'}`} placeholder="e.g. Alex Mercer" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-xxs uppercase tracking-wider text-slate-500">Target Role Objective</label>
                  <input type="text" className={`w-full border p-3 rounded-xl focus:outline-none transition-all ${darkMode ? 'bg-stone-950 border-slate-800 text-slate-200 focus:border-amber-800' : 'bg-stone-50 border-stone-200 text-stone-800'}`} placeholder="e.g. Senior Frontend Architect" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 border-t border-b border-dashed border-slate-200 dark:border-slate-800 py-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-xxs uppercase tracking-wider text-slate-500 flex items-center gap-1"><Link className="w-3 h-3 text-indigo-500"/> LinkedIn Profile URL</label>
                  <input type="url" className={`w-full border p-3 rounded-xl focus:outline-none transition-all ${darkMode ? 'bg-stone-950 border-slate-800 text-slate-200 focus:border-amber-800' : 'bg-stone-50 border-stone-200 text-stone-800'}`} placeholder="e.g. https://linkedin.com" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-xxs uppercase tracking-wider text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3 text-indigo-500"/> Interview Duration</label>
                  <select className={`w-full border p-3 rounded-xl focus:outline-none transition-all cursor-pointer ${darkMode ? 'bg-stone-950 border-slate-800 text-slate-200 focus:border-amber-800' : 'bg-stone-50 border-stone-200 text-stone-800'}`} value={duration} onChange={(e) => setDuration(e.target.value)}>
                    <option value="30 minutes">30 Minutes</option>
                    <option value="45 minutes">45 Minutes</option>
                    <option value="60 minutes">60 Minutes</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-xxs uppercase tracking-wider text-slate-500 flex items-center gap-1"><UserCheck className="w-3 h-3 text-indigo-500"/> Interview Category</label>
                  <select className={`w-full border p-3 rounded-xl focus:outline-none transition-all cursor-pointer ${darkMode ? 'bg-stone-950 border-slate-800 text-slate-200 focus:border-amber-800' : 'bg-stone-50 border-stone-200 text-stone-800'}`} value={interviewType} onChange={(e) => { setInterviewType(e.target.value as 'hr' | 'technical'); setResults(null); }}>
                    <option value="technical">Technical Interview Track</option>
                    <option value="hr">HR / Behavioral Interview Track</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-xxs uppercase tracking-wider text-slate-500 flex items-center gap-1"><ListOrdered className="w-3 h-3 text-indigo-500"/> Total Questions Needed: <span className="text-indigo-600 dark:text-indigo-400 font-extrabold ml-1">{totalQuestions}</span></label>
                  <div className="flex items-center gap-2 pt-2">
                    <input type="range" min="5" max="25" className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-800" value={totalQuestions} onChange={(e) => setTotalQuestions(parseInt(e.target.value))} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`space-y-1.5 p-4 rounded-xl border ${darkMode ? 'bg-stone-950/40 border-slate-800/60' : 'bg-stone-50/60 border-stone-200/60'}`}>
                  <label className="font-bold text-xxs uppercase tracking-wider flex items-center gap-1 text-amber-900 dark:text-amber-400"><FileText className="w-3.5 h-3.5"/> Legacy Career Profile</label>
                  <p className="text-[10px] text-slate-400 mb-2 font-medium">Hint: List positions, technology stack tools used, or clip history.</p>
                  <textarea rows={6} className={`w-full border p-3 rounded-xl focus:outline-none font-mono text-[11px] leading-relaxed ${darkMode ? 'bg-stone-950 border-slate-800 text-slate-300 focus:border-amber-800' : 'bg-white border-stone-200 text-slate-800'}`} placeholder="Frontend Dev at TechCorp. Managed React architecture, optimizing layout loops..." value={careerHistory} onChange={(e) => setCareerHistory(e.target.value)} />
                </div>
                <div className={`space-y-1.5 p-4 rounded-xl border ${darkMode ? 'bg-stone-950/40 border-slate-800/60' : 'bg-stone-50/60 border-stone-200/60'}`}>
                  <label className="font-bold text-xxs uppercase tracking-wider flex items-center gap-1 text-amber-900 dark:text-amber-400"><Target className="w-3.5 h-3.5"/> Job Description Target</label>
                  <p className="text-[10px] text-slate-400 mb-2">Hint: Paste the complete responsibilities checklist text from your target listing.</p>
                  <textarea rows={6} className={`w-full border p-3 rounded-xl focus:outline-none font-mono text-[11px] leading-relaxed ${darkMode ? 'bg-stone-950 border-slate-800 text-slate-300 focus:border-amber-800' : 'bg-white border-stone-200 text-slate-800'}`} placeholder="Seeking an engineer with deep runtime comprehension of cloud topologies..." value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
                </div>
              </div>
              <button type="button" onClick={handleGenerate} disabled={loading} className="w-full bg-amber-900 hover:bg-amber-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer text-xxs uppercase tracking-widest disabled:bg-stone-300 dark:disabled:bg-stone-900 shadow-md">
                {loading ? <><RefreshCw className="animate-spin w-4 h-4 text-amber-200" /> Computing Neural Vectors...</> : <><Sparkles className="w-4 h-4 text-amber-400" /> Execute Generation Cycle</>}
              </button>
            </form>
          </div>
        )}

        {tab === 'validation' && results && (
          <div className={`border p-8 rounded-2xl shadow-md space-y-6 ${darkMode ? 'bg-stone-900/40 border-slate-800/60' : 'bg-white border-amber-900/10'}`}>
            <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 border-b pb-4 ${darkMode ? 'text-amber-400 border-slate-800' : 'text-amber-900 border-stone-100'}`}><BarChart3 className="w-5 h-5"/> Resume Validation Metrics Panel</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className={`p-8 rounded-2xl border text-center relative overflow-hidden flex flex-col justify-center items-center ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-amber-50/50 border-amber-200/60'}`}>
                <BarChart3 className="w-8 h-8 text-amber-800 dark:text-amber-500 mb-2"/>
                <h4 className={`font-extrabold uppercase tracking-widest text-xs ${darkMode ? 'text-amber-400' : 'text-amber-900'}`}>ATS Alignment Score</h4>
                <div className={`text-6xl font-black mt-3 tracking-tight ${darkMode ? 'text-stone-100' : 'text-amber-950'}`}>{results.match_score}%</div>
                <p className={`text-[11px] mt-3 font-semibold leading-normal ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Target evaluation calculated via total requirement coverage parameters.</p>
              </div>
              <div className={`p-6 rounded-2xl border flex flex-col ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 text-slate-100 border-slate-950 shadow-inner'}`}>
                <h4 className="text-amber-400 font-black uppercase tracking-widest text-xs flex items-center gap-1.5 border-b pb-2 border-amber-500/20 mb-4"><AlertTriangle className="w-4 h-4 text-amber-500 shrink-0"/> Critical Keyword Gaps Isolate</h4>
                <div className="flex flex-wrap gap-2 overflow-y-auto pr-1 max-h-48">
                  {results.missing_skills?.map((s: string, i: number) => <span key={i} className="bg-amber-400/20 text-amber-300 font-bold px-3 py-1.5 rounded-xl border border-amber-400/30 text-[11px] tracking-wide shadow-sm">{s}</span>) || <span className="text-stone-400 italic text-xs">None</span>}
                </div>
              </div>
              <div className={`p-6 rounded-2xl border flex flex-col ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-[#F2ECE4] border-amber-200/80 text-stone-900'}`}>
                <h4 className="text-amber-800 dark:text-amber-400 font-black uppercase tracking-widest text-xs flex items-center gap-1.5 border-b pb-2 border-amber-800/10 mb-4"><Target className="w-4 h-4 text-amber-800 dark:text-amber-400 shrink-0"/> Optimization Strategy Advice</h4>
                <ul className="space-y-2.5 text-xs font-semibold leading-relaxed overflow-y-auto pr-1 max-h-48 pl-0 list-none">{results.tailoring_tips?.map((t: string, i: number) => <li key={i} className={`flex items-start gap-2 border-b border-dashed pb-1.5 last:border-0 ${darkMode ? 'border-slate-800' : 'border-amber-900/10'}`}><CheckCircle2 className="w-4 h-4 text-amber-800 dark:text-amber-500 shrink-0 mt-0.5"/> <span>{t}</span></li>)}</ul>
              </div>
            </div>
          </div>
        )}

        {tab === 'updated_resume' && results && (
          <div className={`border p-6 rounded-2xl shadow-sm space-y-5 ${darkMode ? 'bg-stone-900/40 border-slate-800/60' : 'bg-white border-amber-900/10'}`}>
            <div className="bg-amber-800 p-4 rounded-xl text-white flex justify-between items-center shadow-md">
              <div className="flex items-center gap-1.5 font-bold text-xxs tracking-wider uppercase text-amber-100"><FileText className="w-4 h-4"/> Tailored Optimization Resume Output Map</div>
              <button onClick={handleCopyLink} className="bg-white text-amber-900 px-3 py-1.5 rounded-xl font-bold cursor-pointer text-[10px] uppercase tracking-wider border border-amber-100">{copied ? "Blueprint Linked!" : "Copy Public PDF Link"}</button>
            </div>
            <div className={`border p-6 rounded-xl space-y-4 max-h-[500px] overflow-y-auto shadow-inner leading-relaxed ${darkMode ? 'border-slate-800 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-900'}`}>
              <h2 className="text-xl font-extrabold tracking-tight border-b pb-2 border-slate-200 dark:border-slate-800">{results.resume?.full_name}</h2>
              <p className="text-xs font-medium tracking-wide leading-relaxed">{results.resume?.professional_summary}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {results.resume?.skills?.map((s: string, i: number) => <span key={i} className={`font-bold px-2 py-0.5 rounded-md border text-[10px] tracking-wide ${darkMode ? 'bg-slate-900 border-slate-800 text-indigo-400' : 'bg-slate-50 border-slate-200 text-indigo-700'}`}>{s}</span>)}
              </div>
              <div className="space-y-4 pt-3">
                {results.resume?.experience?.map((exp: any, i: number) => (
                  <div key={i} className="space-y-1.5 border-l-2 border-amber-600/50 pl-4 relative">
                    <div className="absolute w-2 h-2 rounded-full bg-amber-600 -left-[5px] top-1 shadow-sm" />
                    <div className="flex justify-between font-bold text-xs"><span>{exp.role} at {exp.company}</span><span className="text-indigo-600 dark:text-indigo-400 text-[10px] tracking-wider font-mono">{exp.duration}</span></div>
                    <ul className="list-none space-y-1 text-[11px] pl-0 opacity-85">{exp.bullet_points?.map((b: string, idx: number) => <li key={idx} className="flex items-start gap-2">▪ <span>{b}</span></li>)}</ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {tab === 'prep' && results && (
          <div className={`border p-6 rounded-2xl shadow-sm space-y-6 ${darkMode ? 'bg-stone-900/40 border-slate-800/60' : 'bg-white border-amber-900/10'}`}>
            <div className={`p-4 rounded-xl text-white flex justify-between items-center shadow-md ${darkMode ? 'bg-slate-950 border border-slate-800' : 'bg-stone-800'}`}>
              <div className="flex items-center gap-1.5 font-bold text-xxs tracking-wider uppercase text-amber-100">
                <User className="w-4 h-4 text-amber-500"/> Active Vector Focus: {interviewType === 'hr' ? 'HR / Behavioral' : 'Technical & Behavioral Split'}
              </div>
            </div>

            {/* Profile Intro Bio Card (Tell Me About Yourself) */}
            {results.tell_me_about_yourself && (
              <div className={`p-5 rounded-xl border space-y-3 shadow-inner ${darkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-amber-50/20 border-amber-200 text-slate-900'}`}>
                <h4 className="text-xxs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-1"><UserCheck className="w-4 h-4"/> Primary Pitch: Tell Me About Yourself Blueprint</h4>
                <p className="text-xs leading-relaxed opacity-95 whitespace-pre-wrap">{results.tell_me_about_yourself}</p>
              </div>
            )}

            {/* Primary Dynamic Target Question and Response Matrix Node */}
            <div className="space-y-4">
              <h4 className="text-xxs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 border-b pb-2 flex items-center gap-1.5 border-amber-900/10 dark:border-slate-800">
                <HelpCircle className="w-4 h-4"/> Core Target Interview Question Matrices ({results.interview_questions?.length || 0} Evaluated Items)
              </h4>
              <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto pr-1">
                {results.interview_questions?.map((item: any, i: number) => (
                  <div key={i} className={`p-4 rounded-xl border space-y-3 transition-all ${darkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-amber-50/40 border-amber-200 text-slate-900'}`}>
                    <div className="font-bold flex items-start gap-1.5 text-xs">
                      <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5"/> <span>Q{i+1}: {item.question}</span>
                    </div>
                    
                    {/* ✅ FIXED: STAR Framework Renderer - Bold headers and crisp linebreaks */}
                    <div className="text-[11px] pl-5 space-y-1.5 leading-relaxed opacity-95 font-medium">
                      {String(item.response || '').split('\n').map((line, lineIdx) => {
                        const trimmed = line.trim();
                        if (!trimmed) return null;
                        
                        // Captures standard key indicators to perform high-visibility bold layouts
                        if (trimmed.toLowerCase().startswith('situation:') || trimmed.startswith('- situation:')) {
                          return <div key={lineIdx} className="pt-0.5"><strong>Situation:</strong> {trimmed.replace(/^(-\s*)?situation:\s*/i, '')}</div>;
                        }
                        if (trimmed.toLowerCase().startswith('task:') || trimmed.startswith('- task:')) {
                          return <div key={lineIdx}><strong>Task:</strong> {trimmed.replace(/^(-\s*)?task:\s*/i, '')}</div>;
                        }
                        if (trimmed.toLowerCase().startswith('action:') || trimmed.startswith('- action:')) {
                          return <div key={lineIdx}><strong>Action:</strong> {trimmed.replace(/^(-\s*)?action:\s*/i, '')}</div>;
                        }
                        if (trimmed.toLowerCase().startswith('result:') || trimmed.startswith('- result:')) {
                          return <div key={lineIdx} className="pb-0.5"><strong>Result:</strong> {trimmed.replace(/^(-\s*)?result:\s*/i, '')}</div>;
                        }
                        
                        return <div key={lineIdx} className="text-stone-400 dark:text-stone-500 font-normal">{trimmed}</div>;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Strategic Follow-Up Questions (Questions to Ask the Interviewer) */}
            {results.follow_up_questions && results.follow_up_questions.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xxs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 border-b pb-2 flex items-center gap-1.5 border-amber-900/10 dark:border-slate-800">
                  <MessageSquarePlus className="w-4 h-4"/> Tactical Follow-up Questions To Ask the Interviewer
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {results.follow_up_questions.map((q: string, idx: number) => (
                    <div key={idx} className={`p-3 rounded-xl border text-xs font-semibold flex items-start gap-2 ${darkMode ? 'bg-stone-900 border-slate-800' : 'bg-stone-50 border-stone-200'}`}>
                      <span className="text-indigo-500 font-mono">#{idx+1}</span>
                      <span>{q}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      <footer className="w-full text-center py-6 mt-12 border-t border-dashed border-amber-900/10 dark:border-slate-800">
        <p className="text-[11px] font-bold tracking-widest text-stone-400 dark:text-stone-500 uppercase flex items-center justify-center gap-1.5">
          Crafted with <Heart className="w-3.5 h-3.5 text-rose-600 fill-rose-600 " /> & Developed by <span className="text-amber-900 dark:text-indigo-400 font-extrabold font-mono">Kuldeep Sharma</span>
        </p>
      </footer>
    </main>
  );
}
