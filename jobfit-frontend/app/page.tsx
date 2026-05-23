'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Heart,
  HelpCircle,
  Link,
  ListOrdered,
  MessageSquarePlus,
  Moon,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Sun,
  Target,
  User,
  UserCheck,
} from 'lucide-react';

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

  const [searchCity, setSearchCity] = useState('');
  const [searchRoleSkills, setSearchRoleSkills] = useState('');
  const [searchFile, setSearchFile] = useState<File | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [jobResults, setJobResults] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleGenerate = async () => {
    if (!fullName.trim() || !targetRole.trim() || !careerHistory.trim() || !jobDescription.trim()) {
      return alert('Please fill out all mandatory fields.');
    }

    setLoading(true);
    setResults(null);

    const formData = new FormData();
    formData.append('full_name', fullName.trim());
    formData.append('target_role', targetRole.trim());
    formData.append('linkedin_profile', linkedin.trim());
    formData.append('interview_duration', duration);
    formData.append('total_questions_requested', totalQuestions.toString());
    formData.append('interview_type', interviewType);
    formData.append('career_history', careerHistory.trim());
    formData.append('job_description', jobDescription.trim());

    try {
      const res = await fetch('https://resume-builder-backend-ph7b.onrender.com/build-resume', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || 'Resume generation failed.');
      }

      setResults(data);
      setTab('validation');
    } catch (error: any) {
      alert(error?.message || 'AI optimization cycle broken. Refocusing backend container parameters.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchJobs = async () => {
    if (!searchCity.trim()) {
      return alert('Please enter Search City before running job search.');
    }

    if (!searchRoleSkills.trim() && !searchFile) {
      return alert('Please enter Target Role / Skills Summary or upload a CV.');
    }

    setSearchLoading(true);
    setJobResults(null);

    const inferredTargetRole = searchRoleSkills.trim() || targetRole.trim() || 'Software Engineer';

    const formData = new FormData();
    formData.append('target_role', inferredTargetRole);
    formData.append('location_city', searchCity.trim());
    formData.append('resume_skills', searchRoleSkills.trim());

    if (searchFile) {
      formData.append('resume_file', searchFile);
    }

    try {
      const res = await fetch('https://resume-builder-backend-ph7b.onrender.com/search-jobs', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || 'Job search failed on backend.');
      }

      setJobResults(data);
    } catch (error: any) {
      alert(error?.message || 'Live open web query pipeline timing mismatch. Verify backend endpoint channels.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!results?.shareable_url) return;
    navigator.clipboard.writeText(results.shareable_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!mounted) {
    return <div className="min-h-screen bg-[#f6efe6] dark:bg-stone-950 animate-pulse" />;
  }

  const pageTheme = darkMode
    ? 'bg-stone-950 text-slate-100'
    : 'bg-[radial-gradient(circle_at_top,_#fff8ef_0%,_#f5ede3_45%,_#eee2d1_100%)] text-slate-900';

  const panelTheme = darkMode
    ? 'bg-stone-900/50 border-stone-800/70'
    : 'bg-white/90 border-[#dbc8b1]';

  const inputTheme = darkMode
    ? 'bg-stone-950 border-stone-800 text-slate-200 focus:border-amber-700'
    : 'bg-[#fffaf4] border-[#dcc9b5] text-stone-800 focus:border-amber-800';

  return (
    <main className={`min-h-screen p-4 md:p-8 font-sans antialiased transition-colors duration-300 ${pageTheme}`}>
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="relative flex flex-col items-center text-center space-y-4 py-6 border-b border-dashed border-amber-900/20 dark:border-stone-800">
          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className={`absolute top-2 right-2 p-2 rounded-xl border flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider shadow-sm transition-all ${
              darkMode ? 'bg-stone-900 border-stone-800 text-amber-400' : 'bg-white border-[#d9c8b4] text-stone-800'
            }`}
          >
            {darkMode ? (
              <>
                <Sun className="w-3.5 h-3.5" /> Light Theme
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5" /> Dark Theme
              </>
            )}
          </button>

          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold border ${
              darkMode ? 'bg-indigo-500/10 border-stone-800 text-indigo-300' : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <Sparkles className="w-3 h-3" /> Engine Active: Gemini 2.5 Flash
          </div>

          <h1 className="text-3xl md:text-5xl font-black tracking-tight">AI Career Intelligence Matrix</h1>
          <p className={`text-xs md:text-sm max-w-2xl mx-auto leading-relaxed font-medium ${darkMode ? 'text-slate-400' : 'text-stone-600'}`}>
            Optimize resume fit, generate interview prep, and search real active roles from a cleaner career workflow.
          </p>
        </header>

        <div className={`flex flex-wrap border p-1.5 gap-1.5 backdrop-blur-md rounded-2xl shadow-sm overflow-x-auto ${panelTheme}`}>
          <button
            onClick={() => setTab('builder')}
            className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all duration-200 text-xxs tracking-wide ${
              tab === 'builder' ? 'bg-amber-900 text-white shadow-md scale-[1.01]' : darkMode ? 'text-stone-300 hover:bg-stone-800' : 'text-stone-700 hover:bg-amber-50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Pipeline Builder
          </button>

          {results && (
            <>
              <button
                onClick={() => setTab('validation')}
                className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all duration-200 text-xxs tracking-wide ${
                  tab === 'validation' ? 'bg-amber-900 text-white shadow-md scale-[1.01]' : darkMode ? 'text-stone-300 hover:bg-stone-800' : 'text-stone-700 hover:bg-amber-50'
                }`}
              >
                <ClipboardCheck className="w-3.5 h-3.5" /> Resume Validation
              </button>
              <button
                onClick={() => setTab('updated_resume')}
                className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all duration-200 text-xxs tracking-wide ${
                  tab === 'updated_resume' ? 'bg-amber-900 text-white shadow-md scale-[1.01]' : darkMode ? 'text-stone-300 hover:bg-stone-800' : 'text-stone-700 hover:bg-amber-50'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Tailored Output
              </button>
              <button
                onClick={() => setTab('prep')}
                className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all duration-200 text-xxs tracking-wide ${
                  tab === 'prep' ? 'bg-amber-900 text-white shadow-md scale-[1.01]' : darkMode ? 'text-stone-300 hover:bg-stone-800' : 'text-stone-700 hover:bg-amber-50'
                }`}
              >
                <User className="w-3.5 h-3.5" /> Interview Vectors
              </button>
            </>
          )}

          <button
            onClick={() => setTab('job_search')}
            className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all duration-200 text-xxs tracking-wide ${
              tab === 'job_search' ? 'bg-amber-900 text-white shadow-md scale-[1.01]' : darkMode ? 'text-stone-300 hover:bg-stone-800' : 'text-stone-700 hover:bg-amber-50'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" /> Web Job Discovery Tool
          </button>
        </div>

        {tab === 'builder' && (
          <div className={`border p-6 rounded-2xl shadow-sm space-y-6 ${panelTheme}`}>
            <div className={`flex justify-between items-center border-b pb-3 ${darkMode ? 'border-stone-800/60' : 'border-stone-200'}`}>
              <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${darkMode ? 'text-amber-400' : 'text-amber-900'}`}>
                <ArrowLeftRight className="w-4 h-4" /> Core Variable Mapping
              </h2>

              {results && (
                <button
                  type="button"
                  onClick={() => {
                    setFullName('');
                    setTargetRole('');
                    setLinkedin('');
                    setDuration('30 minutes');
                    setTotalQuestions(5);
                    setInterviewType('technical');
                    setCareerHistory('');
                    setJobDescription('');
                    setResults(null);
                    setJobResults(null);
                    setTab('builder');
                  }}
                  className={`flex items-center gap-1 font-bold px-3 py-1 rounded-xl border text-xxs tracking-wide ${darkMode ? 'bg-rose-950 text-rose-400 border-rose-500/20' : 'bg-rose-50 text-rose-700 border-rose-200'}`}
                >
                  <RotateCcw className="w-3 h-3" /> Reset Form
                </button>
              )}
            </div>

            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-xxs uppercase tracking-wider text-slate-500">Applicant Full Name</label>
                  <input className={`w-full border p-3 rounded-xl focus:outline-none transition-all ${inputTheme}`} placeholder="e.g. Alex Mercer" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-xxs uppercase tracking-wider text-slate-500">Target Role Objective</label>
                  <input className={`w-full border p-3 rounded-xl focus:outline-none transition-all ${inputTheme}`} placeholder="e.g. Senior Frontend Architect" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 border-t border-b border-dashed border-slate-200 dark:border-stone-800 py-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-xxs uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Link className="w-3 h-3 text-indigo-500" /> LinkedIn Profile URL
                  </label>
                  <input className={`w-full border p-3 rounded-xl focus:outline-none transition-all ${inputTheme}`} placeholder="e.g. https://linkedin.com/in/..." value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-xxs uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-indigo-500" /> Interview Duration
                  </label>
                  <select className={`w-full border p-3 rounded-xl focus:outline-none transition-all ${inputTheme}`} value={duration} onChange={(e) => setDuration(e.target.value)}>
                    <option value="30 minutes">30 Minutes</option>
                    <option value="45 minutes">45 Minutes</option>
                    <option value="60 minutes">60 Minutes</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-xxs uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-indigo-500" /> Interview Category
                  </label>
                  <select className={`w-full border p-3 rounded-xl focus:outline-none transition-all ${inputTheme}`} value={interviewType} onChange={(e) => setInterviewType(e.target.value as 'hr' | 'technical')}>
                    <option value="technical">Technical Interview Track</option>
                    <option value="hr">HR Interview Tool</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="font-bold text-xxs uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <ListOrdered className="w-3 h-3 text-indigo-500" />
                    Number of Questions: <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{totalQuestions}</span>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="25"
                    className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-800"
                    value={totalQuestions}
                    onChange={(e) => setTotalQuestions(parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`space-y-1.5 p-4 rounded-xl border ${darkMode ? 'bg-stone-950/40 border-slate-800/60' : 'bg-stone-50/60 border-stone-200/60'}`}>
                  <label className="font-bold text-xxs uppercase tracking-wider flex items-center gap-1 text-amber-900 dark:text-amber-400">
                    <FileText className="w-3.5 h-3.5" /> Legacy Career Profile
                  </label>
                  <textarea rows={6} className={`w-full border p-3 rounded-xl focus:outline-none font-mono text-[11px] leading-relaxed ${inputTheme}`} placeholder="Describe your experience, tools, achievements, and roles..." value={careerHistory} onChange={(e) => setCareerHistory(e.target.value)} />
                </div>

                <div className={`space-y-1.5 p-4 rounded-xl border ${darkMode ? 'bg-stone-950/40 border-slate-800/60' : 'bg-stone-50/60 border-stone-200/60'}`}>
                  <label className="font-bold text-xxs uppercase tracking-wider flex items-center gap-1 text-amber-900 dark:text-amber-400">
                    <Target className="w-3.5 h-3.5" /> Job Description Target
                  </label>
                  <textarea rows={6} className={`w-full border p-3 rounded-xl focus:outline-none font-mono text-[11px] leading-relaxed ${inputTheme}`} placeholder="Paste the target job description here..." value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
                </div>
              </div>

              <button type="button" onClick={handleGenerate} disabled={loading} className="w-full bg-amber-900 hover:bg-amber-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-xxs uppercase tracking-widest disabled:opacity-60">
                {loading ? (
                  <>
                    <RefreshCw className="animate-spin w-4 h-4 text-amber-200" /> Computing Neural Vectors...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-400" /> Execute Generation Cycle
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {tab === 'validation' && results && (
          <div className={`border p-8 rounded-2xl shadow-md space-y-6 ${panelTheme}`}>
            <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 border-b pb-4">
              <BarChart3 className="w-5 h-5" /> Resume Validation Metrics Panel
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-8 rounded-2xl border text-center">
                <div className="text-6xl font-black">{results.match_score}%</div>
              </div>

              <div className="p-6 rounded-2xl border">
                <h4 className="font-bold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Critical Keyword Gaps
                </h4>
                <div className="flex flex-wrap gap-2">
                  {results.missing_skills?.map((s: string, i: number) => (
                    <span key={i} className="bg-amber-500/10 px-3 py-1 rounded-xl text-[11px] font-bold">{s}</span>
                  ))}
                </div>
              </div>

              <div className="p-6 rounded-2xl border">
                <h4 className="font-bold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Optimization Tips
                </h4>
                <ul className="space-y-2">
                  {results.tailoring_tips?.map((t: string, i: number) => (
                    <li key={i} className="flex gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {tab === 'updated_resume' && results && (
          <div className={`border p-6 rounded-2xl shadow-sm space-y-5 ${panelTheme}`}>
            <div className="bg-amber-800 p-4 rounded-xl text-white flex justify-between items-center">
              <div className="flex items-center gap-1.5 font-bold text-xxs uppercase">
                <FileText className="w-4 h-4" /> Tailored Optimization Resume Output Map
              </div>
              <button onClick={handleCopyLink} className="bg-white text-amber-900 px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase">
                {copied ? 'Blueprint Linked!' : 'Copy Public PDF Link'}
              </button>
            </div>

            <div className={`border p-6 rounded-xl space-y-4 max-h-[500px] overflow-y-auto ${darkMode ? 'border-stone-800 bg-stone-950' : 'border-stone-200 bg-white'}`}>
              <h2 className="text-xl font-extrabold">{results.resume?.full_name}</h2>
              <p>{results.resume?.professional_summary}</p>
            </div>
          </div>
        )}

        {tab === 'prep' && results && (
          <div className={`border p-6 rounded-2xl shadow-sm space-y-6 ${panelTheme}`}>
            <div className="p-4 rounded-xl text-white bg-stone-800">
              Active Vector Focus: {interviewType === 'hr' ? 'HR Interview Tool' : 'Technical & Behavioral Split'}
            </div>

            {results.tell_me_about_yourself && (
              <div className="p-5 rounded-xl border space-y-3">
                <h4 className="text-xxs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <UserCheck className="w-4 h-4" /> Tell Me About Yourself
                </h4>
                <p className="text-xs leading-relaxed whitespace-pre-wrap">{results.tell_me_about_yourself}</p>
              </div>
            )}

            {results.interview_questions?.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-xxs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 border-b pb-2 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4" /> Interview Questions ({results.interview_questions.length})
                </h4>

                <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto pr-1">
                  {results.interview_questions.map((item: any, i: number) => (
                    <div key={i} className={`p-4 rounded-xl border space-y-3 ${darkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-amber-50/40 border-amber-200 text-slate-900'}`}>
                      <div className="font-bold flex items-start gap-1.5 text-xs">
                        <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                        <span>Q{i + 1}: {item.question}</span>
                      </div>
                      <div className="text-[11px] pl-5 whitespace-pre-wrap">{item.response}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results.follow_up_questions?.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xxs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 border-b pb-2 flex items-center gap-1.5">
                  <MessageSquarePlus className="w-4 h-4" /> Follow-up Questions
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {results.follow_up_questions.map((q: string, idx: number) => (
                    <div key={idx} className={`p-3 rounded-xl border text-xs font-semibold flex items-start gap-2 ${darkMode ? 'bg-stone-900 border-slate-800' : 'bg-stone-50 border-stone-200'}`}>
                      <span className="text-indigo-500 font-mono">#{idx + 1}</span>
                      <span>{q}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'job_search' && (
          <div className={`border p-6 rounded-2xl shadow-sm space-y-6 ${panelTheme}`}>
            <div className={`border-b pb-3 ${darkMode ? 'border-stone-800' : 'border-stone-200'}`}>
              <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${darkMode ? 'text-amber-400' : 'text-amber-900'}`}>
                <Target className="w-4 h-4" /> Web Job Discovery Tool
              </h2>
            </div>

            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSearchJobs(); }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-xxs uppercase tracking-wider text-slate-500">Target Location City</label>
                  <input className={`w-full border p-3 rounded-xl focus:outline-none transition-all text-xs ${inputTheme}`} placeholder="e.g. London or Remote" value={searchCity} onChange={(e) => setSearchCity(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-xxs uppercase tracking-wider text-slate-500">Target Role / Skills Summary</label>
                  <input className={`w-full border p-3 rounded-xl focus:outline-none transition-all text-xs ${inputTheme}`} placeholder="e.g. Lead Technical Program Manager, Agile, AI, SaaS, Strategy" value={searchRoleSkills} onChange={(e) => setSearchRoleSkills(e.target.value)} />
                </div>
              </div>

              <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${searchFile ? 'border-green-500 bg-green-500/5' : darkMode ? 'border-stone-800 bg-stone-950/40' : 'border-[#d9c8b4] bg-[#fffaf5]'}`}>
                <input type="file" id="job-search-file-picker" accept=".pdf,.docx" className="hidden" onChange={(e) => setSearchFile(e.target.files?.[0] || null)} />
                <label htmlFor="job-search-file-picker" className="cursor-pointer block space-y-2">
                  <FileText className={`w-8 h-8 mx-auto ${searchFile ? 'text-green-500' : 'text-slate-400'}`} />
                  <div className="text-xxs font-bold uppercase tracking-wide">
                    {searchFile ? `CV Attached: ${searchFile.name}` : 'Attach CV in PDF or DOCX format'}
                  </div>
                </label>

                {searchFile && (
                  <button type="button" onClick={() => setSearchFile(null)} className="mt-2 text-[10px] font-bold text-rose-600 hover:underline">
                    Remove Attached CV
                  </button>
                )}
              </div>

              <button type="submit" disabled={searchLoading} className="w-full bg-amber-900 hover:bg-amber-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-xxs uppercase tracking-widest disabled:opacity-60">
                {searchLoading ? (
                  <>
                    <RefreshCw className="animate-spin w-4 h-4 text-amber-200" /> Searching Active Jobs...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-400" /> Find 40 Active Matches
                  </>
                )}
              </button>
            </form>

            {jobResults && (
              <div className="space-y-6 pt-2 border-t border-dashed border-amber-900/10 dark:border-stone-800">
                <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-800 shadow-inner">
                  <table className="w-full text-left border-collapse text-xxs leading-relaxed">
                    <thead>
                      <tr className={`${darkMode ? 'bg-stone-950 text-amber-400' : 'bg-stone-100 text-amber-950'} font-black uppercase tracking-wider`}>
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
                        <tr key={index}>
                          <td className="p-3 font-bold">{job.title}</td>
                          <td className="p-3">{job.company}</td>
                          <td className="p-3">{job.location}</td>
                          <td className="p-3">{job.salary}</td>
                          <td className="p-3">{Array.isArray(job.skills) ? job.skills.join(', ') : job.skills}</td>
                          <td className="p-3">
                            {job.link && job.link.startsWith('http') ? (
                              <a href={job.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                                Apply Here <ArrowRight className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="italic text-stone-400">search on company website</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {jobResults.best_match_summary && (
                  <div className={`p-4 rounded-xl border flex items-start gap-2 text-xs font-semibold leading-relaxed ${darkMode ? 'bg-indigo-950/20 border-indigo-900/40 text-slate-200' : 'bg-indigo-50 border-indigo-100 text-indigo-900'}`}>
                    <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                    <div>{jobResults.best_match_summary}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="w-full text-center py-6 mt-12 border-t border-dashed border-amber-900/10 dark:border-stone-800">
        <p className="text-[11px] font-bold tracking-widest text-stone-400 dark:text-stone-500 uppercase flex items-center justify-center gap-1.5">
          Crafted with <Heart className="w-3.5 h-3.5 text-rose-600 fill-rose-600" /> & Developed by <span className="text-amber-900 dark:text-indigo-400 font-extrabold font-mono">Kuldeep Sharma</span>
        </p>
      </footer>
    </main>
  );
}
