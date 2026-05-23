'use client';
import { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, BarChart3, AlertTriangle, Target, FileText, User, Code, HelpCircle, RotateCcw, ClipboardCheck, ArrowRight, ArrowLeftRight, CheckCircle2, Sun, Moon, Heart, Link, Clock, ListOrdered, UserCheck, MessageSquarePlus, UploadCloud, Building2, MapPin, DollarSign } from 'lucide-react';

export default function Home() {
  const [mounted, setMounted] = useState(false);
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
  const [tab, setTab] = useState<'builder' | 'validation' | 'updated_resume' | 'prep' | 'job_search'>('builder');
  const [darkMode, setDarkMode] = useState(false);
  // 🔍 Specialized Job Tracker Search State Elements
  const [searchCity, setSearchCity] = useState('');
  const [searchSkills, setSearchSkills] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [jobResults, setJobResults] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCopyLink = () => {
    if (!results?.shareable_url) return;
    navigator.clipboard.writeText(results.shareable_url);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setResumeFile(file);
      setUploadStatus(`Uploaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    }
  };
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
  const handleSearchJobs = async () => {
    if (!searchCity) return alert("Please enter a target city location.");
    setSearchLoading(true); setJobResults(null);
    const formData = new FormData();
    formData.append('target_role', targetRole || 'Software Engineer');
    formData.append('location_city', searchCity);
    formData.append('resume_skills', searchSkills || 'Technical Background Profile');
    if (resumeFile) {
      formData.append('resume_file', resumeFile);
    }
    try {
      const res = await fetch('https://onrender.com', { method: 'POST', body: formData });
      if (!res.ok) throw new Error();
      setJobResults(await res.json());
    } catch {
      alert("Job verification indexing broken. Refocusing backend search parameters.");
    } finally { setSearchLoading(false); }
  };

  if (!mounted) return <div className="min-h-screen bg-[#FAF8F5] dark:bg-stone-950 animate-pulse" />;
  return (
    <main className={`min-h-screen p-4 md:p-8 font-sans antialiased transition-colors duration-300 ${darkMode ? 'bg-stone-950 text-slate-100' : 'bg-[#FAF8F5] text-slate-900'}`}>
      <div className="max-w-5xl mx-auto space-y-6">
        
        <header className="relative flex flex-col items-center text-center space-y-3 py-4 border-b border-dashed border-amber-900/20 dark:border-slate-800">
          <button type="button" onClick={() => setDarkMode(!darkMode)} className={`absolute top-2 right-2 p-2 rounded-xl border flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider cursor-pointer shadow-sm transition-all ${darkMode ? 'bg-stone-900 border-stone-800 text-amber-500' : 'bg-white border-stone-200 text-stone-800'}`}>
            {darkMode ? <><Sun className="w-3.5 h-3.5"/> Light Theme</> : <><Moon className="w-3.5 h-3.5"/> Dark Theme</>}
          </button>
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold border ${darkMode ? 'bg-indigo-500/10 border-slate-800 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}><Sparkles className="w-3 h-3 text-indigo-500" /> Engine Active: Gemini 2.5 Pro Tier</div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight">AI Career Intelligence Matrix</h1>
          <p className="text-xs md:text-sm max-w-xl mx-auto leading-relaxed font-medium text-slate-500 dark:text-slate-400">Bridge the gap between your engineering profile and ATS screening rules to secure premium placement.</p>
        </header>

        <div className={`flex flex-wrap border p-1.5 gap-1.5 backdrop-blur-md rounded-2xl shadow-sm overflow-x-auto ${darkMode ? 'bg-stone-900/80 border-slate-800' : 'bg-white border-amber-900/10'}`}>
          {([['builder', 'Pipeline Builder', Sparkles], ['validation', 'Resume Validation', ClipboardCheck], ['updated_resume', 'Tailored Output', FileText], ['prep', 'Interview Vectors', User], ['job_search', 'Dynamic Job Tracker', Target]] as const).map(([t, label, Icon]) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all duration-200 text-xxs tracking-wide ${tab === t ? 'bg-amber-900 text-white shadow-md scale-[1.01]' : darkMode ? 'text-stone-400 hover:bg-stone-800' : 'text-stone-600 hover:bg-amber-50'}`}><Icon className="w-3.5 h-3.5"/> {label}</button>
          ))}
        </div>
        {tab === 'builder' && (
          <div className={`border p-6 rounded-2xl shadow-sm space-y-6 ${darkMode ? 'bg-stone-900/40 border-stone-800/60 shadow-2xl' : 'bg-white border-amber-900/10'}`}>
            <div className={`flex justify-between items-center border-b pb-3 ${darkMode ? 'border-stone-800/60' : 'border-stone-100'}`}>
              <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${darkMode ? 'text-amber-400' : 'text-amber-900'}`}><ArrowLeftRight className="w-4 h-4"/> Core Variable Mapping</h2>
              {results && <button type="button" onClick={() => { setFullName(''); setTargetRole(''); setLinkedin(''); setDuration('30 minutes'); setTotalQuestions(5); setInterviewType('technical'); setCareerHistory(''); setJobDescription(''); setResults(null); setTab('builder'); }} className={`flex items-center gap-1 font-bold px-3 py-1 rounded-xl border text-xxs tracking-wide cursor-pointer ${darkMode ? 'bg-rose-950 text-rose-400 border-rose-900/40' : 'bg-rose-50 text-rose-700 border-rose-200'}`}><RotateCcw className="w-3 h-3"/> Reset Form</button>}
            </div>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-xxs uppercase tracking-wider text-slate-500">Applicant Full Name</label>
                  <input type="text" className={`w-full border p-3 rounded-xl focus:outline-none transition-all ${darkMode ? 'bg-stone-950 border-stone-800 text-slate-200' : 'bg-stone-50 border-stone-200 text-slate-800'}`} placeholder="e.g. Alex Mercer" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-xxs uppercase tracking-wider text-slate-500">Target Role Objective</label>
                  <input type="text" className={`w-full border p-3 rounded-xl focus:outline-none transition-all ${darkMode ? 'bg-stone-950 border-slate-800 text-slate-200' : 'bg-stone-50 border-stone-200 text-slate-800'}`} placeholder="e.g. Senior Frontend Architect" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 border-t border-b border-dashed border-slate-200 dark:border-slate-800 py-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-xxs uppercase tracking-wider text-slate-500 flex items-center gap-1"><Link className="w-3 h-3 text-indigo-500"/> LinkedIn Profile URL</label>
                  <input type="url" className={`w-full border p-3 rounded-xl focus:outline-none transition-all ${darkMode ? 'bg-stone-950 border-slate-800 text-slate-200' : 'bg-stone-50 border-stone-200 text-slate-800'}`} placeholder="e.g. https://linkedin.com" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-xxs uppercase tracking-wider text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3 text-indigo-500"/> Interview Duration</label>
                  <select className={`w-full border p-3 rounded-xl focus:outline-none transition-all cursor-pointer ${darkMode ? 'bg-stone-950 border-stone-800 text-slate-200' : 'bg-stone-50 border-stone-200 text-slate-800'}`} value={duration} onChange={(e) => setDuration(e.target.value)}>
                    <option value="30 minutes">30 Minutes</option>
                    <option value="45 minutes">45 Minutes</option>
                    <option value="60 minutes">60 Minutes</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-xxs uppercase tracking-wider text-slate-500 flex items-center gap-1"><UserCheck className="w-3 h-3 text-indigo-500"/> Interview Category</label>
                  <select className={`w-full border p-3 rounded-xl focus:outline-none transition-all cursor-pointer ${darkMode ? 'bg-stone-950 border-stone-800 text-slate-200' : 'bg-stone-50 border-stone-200 text-slate-800'}`} value={interviewType} onChange={(e) => { setInterviewType(e.target.value as 'hr' | 'technical'); setResults(null); }}>
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
                  <textarea rows={5} className={`w-full border p-3 rounded-xl focus:outline-none font-mono text-[11px] leading-relaxed ${darkMode ? 'bg-stone-950 border-stone-800 text-slate-300' : 'bg-white border-stone-200 text-slate-800'}`} placeholder="Frontend Dev at TechCorp. Managed React architecture, optimizing layout loops..." value={careerHistory} onChange={(e) => setCareerHistory(e.target.value)} />
                </div>
                <div className={`space-y-1.5 p-4 rounded-xl border ${darkMode ? 'bg-stone-950/40 border-slate-800/60' : 'bg-stone-50/60 border-stone-200/60'}`}>
                  <label className="font-bold text-xxs uppercase tracking-wider flex items-center gap-1 text-amber-900 dark:text-amber-400"><Target className="w-3.5 h-3.5"/> Job Description Target</label>
                  <textarea rows={5} className={`w-full border p-3 rounded-xl focus:outline-none font-mono text-[11px] leading-relaxed ${darkMode ? 'bg-stone-950 border-slate-800 text-slate-300' : 'bg-white border-stone-200 text-slate-800'}`} placeholder="Seeking an engineer with deep runtime comprehension of cloud topologies..." value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
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
            <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 border-b pb-4 text-amber-900 dark:text-amber-400"><BarChart3 className="w-5 h-5"/> Resume Validation Metrics Panel</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className={`p-8 rounded-2xl border text-center relative overflow-hidden flex flex-col justify-center items-center ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-amber-50/50 border-amber-200/60'}`}>
                <BarChart3 className="w-8 h-8 text-amber-800 dark:text-amber-500 mb-2"/>
                <h4 className="font-extrabold uppercase tracking-widest text-xs text-amber-900 dark:text-amber-400">ATS Alignment Score</h4>
                <div className="text-6xl font-black mt-3 tracking-tight text-amber-950 dark:text-stone-100">{results.match_score}%</div>
              </div>
              <div className={`p-6 rounded-2xl border flex flex-col ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 text-slate-100 border-slate-950'}`}>
                <h4 className="text-amber-400 font-black uppercase tracking-widest text-xs flex items-center gap-1.5 border-b pb-2 border-amber-500/20 mb-4"><AlertTriangle className="w-4 h-4 text-amber-500 shrink-0"/> Critical Keyword Gaps</h4>
                <div className="flex flex-wrap gap-2 overflow-y-auto max-h-48">
                  {results.missing_skills?.map((s: string, i: number) => <span key={i} className="bg-amber-500/20 text-amber-300 font-bold px-3 py-1.5 rounded-xl border border-amber-400/30 text-[11px]">{s}</span>) || <span className="text-stone-400 italic text-xs">None</span>}
                </div>
              </div>
              <div className={`p-6 rounded-2xl border flex flex-col ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-[#F2ECE4] border-amber-200/80 text-stone-900'}`}>
                <h4 className="text-amber-800 dark:text-amber-400 font-black uppercase tracking-widest text-xs flex items-center gap-1.5 border-b pb-2 border-amber-800/10 mb-4"><Target className="w-4 h-4 text-amber-800 dark:text-amber-400 shrink-0"/> Optimization Advice</h4>
                <ul className="space-y-2.5 text-xs font-semibold leading-relaxed overflow-y-auto max-h-48 list-none pl-0">{results.tailoring_tips?.map((t: string, i: number) => <li key={i} className="flex items-start gap-2 border-b border-dashed pb-1.5 last:border-0 border-amber-900/10"><CheckCircle2 className="w-4 h-4 text-amber-800 dark:text-amber-500 shrink-0 mt-0.5"/> <span>{t}</span></li>)}</ul>
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

            {results.tell_me_about_yourself && (
              <div className={`p-5 rounded-xl border space-y-3 shadow-inner ${darkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-amber-50/20 border-amber-200 text-slate-900'}`}>
                <h4 className="text-xxs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-1"><UserCheck className="w-4 h-4"/> Primary Pitch: Tell Me About Yourself Blueprint</h4>
                <p className="text-xs leading-relaxed opacity-95 whitespace-pre-wrap">{results.tell_me_about_yourself}</p>
              </div>
            )}

            <div className="space-y-4">
              <h4 className="text-xxs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 border-b pb-2 flex items-center gap-1.5 border-amber-900/10 dark:border-slate-800"><HelpCircle className="w-4 h-4"/> Core Target Interview Question Matrices</h4>
              <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto pr-1">
                {results.interview_questions?.map((item: any, i: number) => (
                  <div key={i} className={`p-4 rounded-xl border space-y-3 transition-all ${darkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-amber-50/40 border-amber-200 text-slate-900'}`}>
                    <div className="font-bold flex items-start gap-1.5 text-xs"><HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5"/> <span>Q{i+1}: {item.question}</span></div>
                    <div className="text-[11px] pl-5 space-y-1.5 leading-relaxed opacity-95 font-medium">
                      {String(item.response || '').split('\n').map((line, lineIdx) => {
                        const trimmed = line.replace(/<\/?[^>]+(>|$)/g, "").trim();
                        if (!trimmed) return null;
                        if (trimmed.toLowerCase().startsWith('situation:') || trimmed.startsWith('- situation:')) return <div key={lineIdx} className="pt-0.5"><strong>Situation:</strong> {trimmed.replace(/^(-\s*)?situation:\s*/i, '')}</div>;
                        if (trimmed.toLowerCase().startsWith('task:') || trimmed.startsWith('- task:')) return <div key={lineIdx}><strong>Task:</strong> {trimmed.replace(/^(-\s*)?task:\s*/i, '')}</div>;
                        if (trimmed.toLowerCase().startsWith('action:') || trimmed.startsWith('- action:')) return <div key={lineIdx}><strong>Action:</strong> {trimmed.replace(/^(-\s*)?action:\s*/i, '')}</div>;
                        if (trimmed.toLowerCase().startsWith('result:') || trimmed.startsWith('- result:')) return <div key={lineIdx} className="pb-0.5"><strong>Result:</strong> {trimmed.replace(/^(-\s*)?result:\s*/i, '')}</div>;
                        return <div key={lineIdx} className="text-stone-400 dark:text-stone-500 font-normal">{trimmed}</div>;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {results.follow_up_questions && results.follow_up_questions.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xxs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 border-b pb-2 flex items-center gap-1.5 border-amber-900/10 dark:border-slate-800"><MessageSquarePlus className="w-4 h-4"/> Tactical Follow-up Questions to Ask</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {results.follow_up_questions.map((q: string, idx: number) => <div key={idx} className={`p-3 rounded-xl border text-xs font-semibold flex items-start gap-2 ${darkMode ? 'bg-stone-900 border-slate-800' : 'bg-stone-50 border-stone-200'}`}><span className="text-indigo-500 font-mono">#{idx+1}</span><span>{q}</span></div>)}
                </div>
              </div>
            )}
          </div>
        )}
            {/* Dynamic Job Tracker Real-time Layout Grid Data Matrix Panel */}
            {jobResults && (
              <div className="space-y-6 pt-2 border-t border-dashed border-amber-900/10 dark:border-slate-800">
                <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-800 shadow-inner">
                  <table className="w-full text-left border-collapse text-xxs leading-relaxed">
                    <thead>
                      <tr className={`font-black uppercase tracking-wider ${darkMode ? 'bg-slate-950 border-b border-stone-800 text-amber-400' : 'bg-stone-100 border-b border-stone-200 text-amber-950'}`}>
                        <th className="p-3">Job Title</th>
                        <th className="p-3">Company Name</th>
                        <th className="p-3">Location</th>
                        <th className="p-3">Salary Range</th>
                        <th className="p-3">Required Skills</th>
                        <th className="p-3">Application Link</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-medium">
                      {jobResults.jobs?.map((job: any, index: number) => (
                        <tr key={index} className={`transition-colors ${darkMode ? 'hover:bg-stone-900/40 text-slate-300' : 'hover:bg-stone-50 text-slate-800'}`}>
                          <td className="p-3 font-bold text-slate-900 dark:text-white max-w-[150px] truncate">{job.title}</td>
                          <td className="p-3 max-w-[120px] truncate">{job.company}</td>
                          <td className="p-3 max-w-[100px] truncate">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${job.location?.toLowerCase().includes('remote') ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-stone-500/10 text-stone-500'}`}>
                              {job.location}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap">{job.salary}</td>
                          <td className="p-3 max-w-[180px]">
                            <div className="flex flex-wrap gap-1">
                              {job.skills?.slice(0, 3).map((s: string, idx: number) => (
                                <span key={idx} className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded text-[9px] font-bold border border-amber-500/10">{s}</span>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {job.link && job.link.startsWith('http') ? (
                              <a href={job.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Apply Here <ArrowRight className="w-3 h-3"/></a>
                            ) : (
                              <span className="text-stone-400 dark:text-stone-500 italic">search on company website</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Algorithmic Best-Match Analysis One-liner Statement Header Node */}
                {jobResults.best_match_summary && (
                  <div className={`p-4 rounded-xl border flex items-start gap-2 text-xs font-semibold leading-relaxed shadow-sm ${darkMode ? 'bg-indigo-950/20 border-indigo-900/40 text-slate-200' : 'bg-indigo-50 border-indigo-100 text-indigo-900'}`}>
                    <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold uppercase text-xxs tracking-wider bg-indigo-500/20 px-2 py-0.5 rounded mr-2 text-indigo-600 dark:text-indigo-400">Match Strategy Insights</span>
                      {jobResults.best_match_summary}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Unified Professional Layout Sandbox Brand Execution Footer Block Node */}
      <footer className="w-full text-center py-6 mt-12 border-t border-dashed border-amber-900/10 dark:border-slate-800">
        <p className="text-[11px] font-bold tracking-widest text-stone-400 dark:text-stone-500 uppercase flex items-center justify-center gap-1.5">
          Crafted with <Heart className="w-3.5 h-3.5 text-rose-600 fill-rose-600" /> & Developed by <span className="text-amber-900 dark:text-indigo-400 font-extrabold font-mono">Kuldeep Sharma</span>
        </p>
      </footer>
    </main>
  );
}

