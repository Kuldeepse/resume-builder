'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Heart,
  HelpCircle,
  Link,
  ListOrdered,
  MessageSquarePlus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
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
    const syncTheme = () => {
      setDarkMode(document.documentElement.dataset.theme === 'dark');
    };

    setMounted(true);
    syncTheme();
    window.addEventListener('cognitwist-theme-change', syncTheme);
    return () => window.removeEventListener('cognitwist-theme-change', syncTheme);
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
    ? 'bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.95)_0%,_rgba(12,18,32,1)_48%,_rgba(3,7,18,1)_100%)] text-stone-100'
    : 'bg-transparent text-stone-950';

  const panelTheme = darkMode
    ? 'bg-slate-950/76 border-white/10 shadow-[0_28px_90px_rgba(2,6,23,0.48)] backdrop-blur-xl'
    : 'bg-[var(--surface)] border-[var(--surface-border)] shadow-[var(--shadow-xl)] backdrop-blur-xl';

  const inputTheme = darkMode
    ? 'bg-slate-950/90 border-white/10 text-stone-100 placeholder:text-stone-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20'
    : 'bg-[var(--surface-strong)] border-[var(--surface-border)] text-stone-900 placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(15,118,110,0.16)]';

  const fieldLabelTheme = darkMode ? 'text-stone-200' : 'text-stone-700';
  const sectionLabelTheme = darkMode ? 'text-cyan-200' : 'text-[var(--accent-strong)]';
  const mutedTextTheme = darkMode ? 'text-stone-400' : 'text-stone-600';
  const softPanelTheme = darkMode ? 'bg-white/[0.04] border-white/8' : 'bg-[var(--surface-strong)]/80 border-[var(--surface-border)]';
  const tabIdleTheme = darkMode ? 'text-stone-300 hover:bg-white/[0.06]' : 'text-stone-700 hover:bg-white/70';
  const tabActiveTheme = darkMode
    ? 'bg-cyan-400 text-slate-950 shadow-[0_18px_40px_rgba(34,211,238,0.25)]'
    : 'bg-[var(--accent)] text-white shadow-[0_18px_40px_rgba(15,118,110,0.24)]';

  return (
    <main className={`min-h-screen p-4 md:p-8 font-sans antialiased transition-colors duration-300 ${pageTheme}`}>
      <div className="max-w-6xl mx-auto space-y-6">
        <header className={`relative overflow-hidden rounded-[2rem] border px-6 py-8 md:px-10 md:py-10 ${panelTheme}`}>
          <div className="absolute inset-0 pointer-events-none">
            <div className={`absolute -left-12 top-0 h-36 w-36 rounded-full blur-3xl ${darkMode ? 'bg-cyan-400/12' : 'bg-[color:rgba(15,118,110,0.14)]'}`} />
            <div className={`absolute right-0 top-10 h-40 w-40 rounded-full blur-3xl ${darkMode ? 'bg-orange-400/10' : 'bg-[color:rgba(194,108,58,0.18)]'}`} />
          </div>

          <div className="relative z-10 grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
            <div className="space-y-5 text-left">
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] ${
                  darkMode ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100' : 'border-[color:rgba(15,118,110,0.16)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                }`}
              >
                <Sparkles className="w-3 h-3" /> Career Studio
              </div>

              <div className="space-y-3">
                <h1 className="max-w-3xl text-4xl font-black tracking-tight md:text-5xl">
                  Build sharper applications with the same CogniTwist AI portal language.
                </h1>
                <p className={`max-w-2xl text-sm leading-7 md:text-base ${mutedTextTheme}`}>
                  Optimize resume fit, pressure-test interview answers, and search active roles from one polished workflow.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 text-[11px] font-semibold uppercase tracking-[0.18em]">
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 ${darkMode ? 'border-white/10 bg-white/[0.04] text-stone-200' : 'border-[var(--surface-border)] bg-white/80 text-stone-700'}`}>
                  <ClipboardCheck className="h-3.5 w-3.5" /> Resume Validation
                </span>
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 ${darkMode ? 'border-white/10 bg-white/[0.04] text-stone-200' : 'border-[var(--surface-border)] bg-white/80 text-stone-700'}`}>
                  <User className="h-3.5 w-3.5" /> Interview Prep
                </span>
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 ${darkMode ? 'border-white/10 bg-white/[0.04] text-stone-200' : 'border-[var(--surface-border)] bg-white/80 text-stone-700'}`}>
                  <Search className="h-3.5 w-3.5" /> Live Job Search
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <div className={`rounded-[1.5rem] border p-4 ${softPanelTheme}`}>
                <div className={`text-[10px] font-bold uppercase tracking-[0.22em] ${sectionLabelTheme}`}>Studio Flow</div>
                <div className="mt-3 text-xl font-black">3 Tracks</div>
                <p className={`mt-1 text-xs leading-6 ${mutedTextTheme}`}>Build, validate, and prepare without leaving the portal.</p>
              </div>
              <div className={`rounded-[1.5rem] border p-4 ${softPanelTheme}`}>
                <div className={`text-[10px] font-bold uppercase tracking-[0.22em] ${sectionLabelTheme}`}>Question Depth</div>
                <div className="mt-3 text-xl font-black">{totalQuestions}</div>
                <p className={`mt-1 text-xs leading-6 ${mutedTextTheme}`}>Interview prompts adapt to your selected role and track.</p>
              </div>
              <div className={`rounded-[1.5rem] border p-4 ${softPanelTheme}`}>
                <div className={`text-[10px] font-bold uppercase tracking-[0.22em] ${sectionLabelTheme}`}>Current Mode</div>
                <div className="mt-3 text-lg font-black">{interviewType === 'hr' ? 'HR Interview Tool' : 'Technical Track'}</div>
                <p className={`mt-1 text-xs leading-6 ${mutedTextTheme}`}>Switch between people-first and technical preparation at any point.</p>
              </div>
            </div>
          </div>
        </header>

        <div className={`flex flex-wrap gap-1.5 overflow-x-auto rounded-[1.75rem] border p-2 ${panelTheme}`}>
          <button
            onClick={() => setTab('builder')}
            className={`flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xxs font-bold tracking-[0.18em] uppercase transition-all duration-200 ${
              tab === 'builder' ? tabActiveTheme : tabIdleTheme
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Pipeline Builder
          </button>

          {!results && (
            <button
              onClick={() => setTab('job_search')}
              className={`flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xxs font-bold tracking-[0.18em] uppercase transition-all duration-200 ${
                tab === 'job_search' ? tabActiveTheme : tabIdleTheme
              }`}
            >
              <Search className="w-3.5 h-3.5" /> Web Job Discovery Tool
            </button>
          )}

          {results && (
            <>
              <button
                onClick={() => setTab('validation')}
                className={`flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xxs font-bold tracking-[0.18em] uppercase transition-all duration-200 ${
                  tab === 'validation' ? tabActiveTheme : tabIdleTheme
                }`}
              >
                <ClipboardCheck className="w-3.5 h-3.5" /> Resume Validation
              </button>
              <button
                onClick={() => setTab('updated_resume')}
                className={`flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xxs font-bold tracking-[0.18em] uppercase transition-all duration-200 ${
                  tab === 'updated_resume' ? tabActiveTheme : tabIdleTheme
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Tailored Output
              </button>
              <button
                onClick={() => setTab('prep')}
                className={`flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xxs font-bold tracking-[0.18em] uppercase transition-all duration-200 ${
                  tab === 'prep' ? tabActiveTheme : tabIdleTheme
                }`}
              >
                <User className="w-3.5 h-3.5" /> Interview Vectors
              </button>
              <button
                onClick={() => setTab('job_search')}
                className={`flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xxs font-bold tracking-[0.18em] uppercase transition-all duration-200 ${
                  tab === 'job_search' ? tabActiveTheme : tabIdleTheme
                }`}
              >
                <Search className="w-3.5 h-3.5" /> Web Job Discovery Tool
              </button>
            </>
          )}
        </div>

        {tab === 'builder' && (
          <div className={`space-y-6 rounded-[2rem] border p-6 shadow-sm md:p-8 ${panelTheme}`}>
            <div className={`flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between ${darkMode ? 'border-white/8' : 'border-[var(--surface-border)]'}`}>
              <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${sectionLabelTheme}`}>
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
                  className={`flex items-center gap-1 rounded-full border px-3 py-2 text-xxs font-bold uppercase tracking-[0.18em] ${darkMode ? 'border-rose-400/20 bg-rose-950/40 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'}`}
                >
                  <RotateCcw className="w-3 h-3" /> Reset Form
                </button>
              )}
            </div>

            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={`font-bold text-xxs uppercase tracking-wider ${fieldLabelTheme}`}>Applicant Full Name</label>
                  <input className={`w-full border p-3 rounded-xl focus:outline-none transition-all ${inputTheme}`} placeholder="e.g. Alex Mercer" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <label className={`font-bold text-xxs uppercase tracking-wider ${fieldLabelTheme}`}>Target Role Objective</label>
                  <input className={`w-full border p-3 rounded-xl focus:outline-none transition-all ${inputTheme}`} placeholder="e.g. Senior Frontend Architect" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} />
                </div>
              </div>

              <div className={`grid grid-cols-1 gap-4 border-y border-dashed py-4 sm:grid-cols-4 ${darkMode ? 'border-white/8' : 'border-[var(--surface-border)]'}`}>
                <div className="space-y-1.5">
                  <label className={`font-bold text-xxs uppercase tracking-wider flex items-center gap-1 ${fieldLabelTheme}`}>
                    <Link className={`w-3 h-3 ${darkMode ? 'text-cyan-300' : 'text-[var(--accent)]'}`} /> LinkedIn Profile URL
                  </label>
                  <input className={`w-full border p-3 rounded-xl focus:outline-none transition-all ${inputTheme}`} placeholder="e.g. https://linkedin.com/in/..." value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <label className={`font-bold text-xxs uppercase tracking-wider flex items-center gap-1 ${fieldLabelTheme}`}>
                    <Clock className={`w-3 h-3 ${darkMode ? 'text-cyan-300' : 'text-[var(--accent)]'}`} /> Interview Duration
                  </label>
                  <select className={`w-full border p-3 rounded-xl focus:outline-none transition-all ${inputTheme}`} value={duration} onChange={(e) => setDuration(e.target.value)}>
                    <option value="30 minutes">30 Minutes</option>
                    <option value="45 minutes">45 Minutes</option>
                    <option value="60 minutes">60 Minutes</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className={`font-bold text-xxs uppercase tracking-wider flex items-center gap-1 ${fieldLabelTheme}`}>
                    <UserCheck className={`w-3 h-3 ${darkMode ? 'text-cyan-300' : 'text-[var(--accent)]'}`} /> Interview Category
                  </label>
                  <select className={`w-full border p-3 rounded-xl focus:outline-none transition-all ${inputTheme}`} value={interviewType} onChange={(e) => setInterviewType(e.target.value as 'hr' | 'technical')}>
                    <option value="technical">Technical Interview Track</option>
                    <option value="hr">HR Interview Tool</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className={`font-bold text-xxs uppercase tracking-wider flex items-center gap-1 ${fieldLabelTheme}`}>
                    <ListOrdered className="w-3 h-3 text-indigo-500" />
                    Number of Questions: <span className={`font-extrabold ${darkMode ? 'text-cyan-300' : 'text-[var(--accent)]'}`}>{totalQuestions}</span>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="25"
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-[var(--accent)] dark:bg-slate-800"
                    value={totalQuestions}
                    onChange={(e) => setTotalQuestions(parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`space-y-1.5 rounded-[1.5rem] border p-4 ${softPanelTheme}`}>
                  <label className={`font-bold text-xxs uppercase tracking-wider flex items-center gap-1 ${sectionLabelTheme}`}>
                    <FileText className="w-3.5 h-3.5" /> Legacy Career Profile
                  </label>
                  <textarea rows={6} className={`w-full border p-3 rounded-xl focus:outline-none font-mono text-[11px] leading-relaxed ${inputTheme}`} placeholder="Describe your experience, tools, achievements, and roles..." value={careerHistory} onChange={(e) => setCareerHistory(e.target.value)} />
                </div>

                <div className={`space-y-1.5 rounded-[1.5rem] border p-4 ${softPanelTheme}`}>
                  <label className={`font-bold text-xxs uppercase tracking-wider flex items-center gap-1 ${sectionLabelTheme}`}>
                    <Target className="w-3.5 h-3.5" /> Job Description Target
                  </label>
                  <textarea rows={6} className={`w-full border p-3 rounded-xl focus:outline-none font-mono text-[11px] leading-relaxed ${inputTheme}`} placeholder="Paste the target job description here..." value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xxs font-bold uppercase tracking-[0.22em] text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60 ${darkMode ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300' : 'bg-[var(--accent)] hover:bg-[var(--accent-strong)]'}`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="animate-spin w-4 h-4" /> Computing Neural Vectors...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Execute Generation Cycle
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {tab === 'validation' && results && (
          <div className={`space-y-6 rounded-[2rem] border p-8 shadow-md ${panelTheme}`}>
            <h3 className={`flex items-center gap-2 border-b pb-4 text-sm font-bold uppercase tracking-wider ${darkMode ? 'border-white/8' : 'border-[var(--surface-border)]'}`}>
              <BarChart3 className="w-5 h-5" /> Resume Validation Metrics Panel
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className={`rounded-[1.75rem] border p-8 text-center ${softPanelTheme}`}>
                <div className="text-5xl font-black md:text-6xl">{results.match_score}%</div>
              </div>

              <div className={`rounded-[1.75rem] border p-6 ${softPanelTheme}`}>
                <h4 className="font-bold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Critical Keyword Gaps
                </h4>
                <div className="flex flex-wrap gap-2">
                  {results.missing_skills?.map((s: string, i: number) => (
                    <span key={i} className={`rounded-full px-3 py-1 text-[11px] font-bold ${darkMode ? 'bg-amber-400/10 text-amber-100' : 'bg-[color:rgba(194,108,58,0.12)] text-[color:#8f4d28]'}`}>{s}</span>
                  ))}
                </div>
              </div>

              <div className={`rounded-[1.75rem] border p-6 ${softPanelTheme}`}>
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
          <div className={`space-y-5 rounded-[2rem] border p-6 shadow-sm ${panelTheme}`}>
            <div className={`flex flex-col gap-3 rounded-[1.5rem] p-4 sm:flex-row sm:items-center sm:justify-between ${darkMode ? 'bg-cyan-400 text-slate-950' : 'bg-[var(--accent)] text-white'}`}>
              <div className="flex items-center gap-1.5 font-bold text-xxs uppercase tracking-[0.18em]">
                <FileText className="w-4 h-4" /> Tailored Optimization Resume Output Map
              </div>
              <button onClick={handleCopyLink} className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] ${darkMode ? 'bg-slate-950 text-cyan-100' : 'bg-white text-[var(--accent-strong)]'}`}>
                {copied ? 'Blueprint Linked!' : 'Copy Public PDF Link'}
              </button>
            </div>

            <div className={`max-h-[640px] space-y-6 overflow-y-auto rounded-[1.5rem] border p-6 ${darkMode ? 'border-white/8 bg-slate-950/90' : 'border-[var(--surface-border)] bg-white/88'}`}>
              <div className={`space-y-3 border-b border-dashed pb-4 ${darkMode ? 'border-white/8' : 'border-[var(--surface-border)]'}`}>
                <h2 className="text-2xl font-extrabold tracking-tight">{results.resume?.full_name}</h2>
                <div className={`text-[11px] uppercase tracking-[0.14em] font-bold ${darkMode ? 'text-stone-300' : 'text-stone-700'}`}>
                  {results.resume?.headline || `Tailored Resume Draft for ${targetRole || 'Target Role'}`}
                </div>
                {(results.resume?.contact?.linkedin || results.resume?.contact?.location) && (
                  <div className={`text-xs flex flex-wrap gap-3 ${darkMode ? 'text-stone-400' : 'text-stone-600'}`}>
                    {results.resume?.contact?.location && <span>{results.resume.contact.location}</span>}
                    {results.resume?.contact?.linkedin && <span>{results.resume.contact.linkedin}</span>}
                  </div>
                )}
                <p className="text-sm leading-7">{results.resume?.professional_summary}</p>
              </div>

              <section className="space-y-3">
                <div className={`text-[11px] uppercase tracking-[0.14em] font-black ${darkMode ? 'text-stone-200' : 'text-stone-800'}`}>
                  Core Skills
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {results.resume?.skills?.length ? (
                    results.resume.skills.map((s: string, i: number) => (
                      <span
                        key={i}
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide ${
                          darkMode ? 'border-white/8 bg-slate-900 text-stone-200' : 'border-[var(--surface-border)] bg-[var(--accent-soft)]/60 text-stone-700'
                        }`}
                      >
                        {s}
                      </span>
                    ))
                  ) : (
                    <p className={`text-xs ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>Skills will appear here once returned by the model.</p>
                  )}
                </div>
              </section>

              <section className="space-y-4">
                <div className={`text-[11px] uppercase tracking-[0.14em] font-black ${darkMode ? 'text-stone-200' : 'text-stone-800'}`}>
                  Professional Experience
                </div>
                {results.resume?.experience?.length ? (
                  results.resume.experience.map((exp: any, i: number) => (
                    <div key={i} className="relative space-y-2.5 border-l-2 border-[color:rgba(15,118,110,0.45)] pl-4">
                      <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-[var(--accent)] shadow-sm" />
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-0.5">
                          <div className="font-extrabold text-sm">{exp.role}</div>
                          <div className={`text-xs font-semibold ${darkMode ? 'text-stone-300' : 'text-stone-700'}`}>{exp.company}</div>
                        </div>
                        <div className="text-stone-500 dark:text-stone-400 text-[10px] tracking-wider font-mono whitespace-nowrap">
                          {exp.duration}
                        </div>
                      </div>
                      <ul className="list-none space-y-1.5 text-[12px] pl-0 leading-6">
                        {exp.bullet_points?.map((b: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="mt-[2px]">▪</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                ) : (
                  <p className={`text-xs ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>Experience details will appear here once returned by the model.</p>
                )}
              </section>

              <section className="space-y-4">
                <div className={`text-[11px] uppercase tracking-[0.14em] font-black ${darkMode ? 'text-stone-200' : 'text-stone-800'}`}>
                  Education
                </div>
                {results.resume?.education?.length ? (
                  <div className="space-y-2">
                    {results.resume.education.map((edu: any, i: number) => (
                      <div key={i} className={`rounded-[1.25rem] border p-3 ${softPanelTheme}`}>
                        <div className="font-bold text-sm">{edu.qualification}</div>
                        <div className="text-xs opacity-80">{edu.institution}</div>
                        <div className="text-[10px] font-mono mt-1 text-stone-500 dark:text-stone-400">{edu.duration}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`text-xs ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>Education details will appear here once returned by the model.</p>
                )}
              </section>

              <section className="space-y-3">
                <div className={`text-[11px] uppercase tracking-[0.14em] font-black ${darkMode ? 'text-stone-200' : 'text-stone-800'}`}>
                  Certifications
                </div>
                {results.resume?.certifications?.length ? (
                  <ul className="space-y-2">
                    {results.resume.certifications.map((cert: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-xs leading-6">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-1 text-stone-500 dark:text-stone-400" />
                        <span>{cert}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={`text-xs ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>Certifications will appear here once returned by the model.</p>
                )}
              </section>

              <section className="space-y-4">
                <div className={`text-[11px] uppercase tracking-[0.14em] font-black ${darkMode ? 'text-stone-200' : 'text-stone-800'}`}>
                  Selected Projects
                </div>
                {results.resume?.projects?.length ? (
                  <div className="space-y-3">
                    {results.resume.projects.map((project: any, i: number) => (
                      <div key={i} className={`space-y-1.5 rounded-[1.25rem] border p-4 ${softPanelTheme}`}>
                        <div className="font-bold text-sm">{project.name}</div>
                        <p className="text-xs leading-6">{project.description}</p>
                        {project.impact && <p className={`text-xs font-semibold ${darkMode ? 'text-stone-300' : 'text-stone-700'}`}>{project.impact}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`text-xs ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>Projects will appear here once returned by the model.</p>
                )}
              </section>

              <section className="space-y-3">
                <div className={`text-[11px] uppercase tracking-[0.14em] font-black ${darkMode ? 'text-stone-200' : 'text-stone-800'}`}>
                  Achievements
                </div>
                {results.resume?.achievements?.length ? (
                  <ul className="space-y-2">
                    {results.resume.achievements.map((achievement: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-xs leading-6">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-1 text-stone-500 dark:text-stone-400" />
                        <span>{achievement}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={`text-xs ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>Achievements will appear here once returned by the model.</p>
                )}
              </section>

              <section className={`space-y-3 border-t border-dashed pt-4 ${darkMode ? 'border-white/8' : 'border-[var(--surface-border)]'}`}>
                <div className={`text-[11px] uppercase tracking-[0.14em] font-black ${darkMode ? 'text-stone-200' : 'text-stone-800'}`}>
                  Tailoring Notes
                </div>
                <ul className="space-y-2">
                  {results.tailoring_tips?.length ? (
                    results.tailoring_tips.map((tip: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-xs leading-6">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-1 text-stone-500 dark:text-stone-400" />
                        <span>{tip}</span>
                      </li>
                    ))
                  ) : (
                    <li className={`text-xs ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>No additional tailoring notes were returned.</li>
                  )}
                </ul>
              </section>
            </div>
          </div>
        )}

        {tab === 'prep' && results && (
          <div className={`space-y-6 rounded-[2rem] border p-6 shadow-sm ${panelTheme}`}>
            <div className={`rounded-[1.5rem] p-4 text-sm font-semibold ${darkMode ? 'bg-cyan-400 text-slate-950' : 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'}`}>
              Active Vector Focus: {interviewType === 'hr' ? 'HR Interview Tool' : 'Technical & Behavioral Split'}
            </div>

            {results.tell_me_about_yourself && (
              <div className={`space-y-3 rounded-[1.5rem] border p-5 ${softPanelTheme}`}>
                <h4 className={`flex items-center gap-1 text-xxs font-black uppercase tracking-widest ${darkMode ? 'text-cyan-200' : 'text-[var(--accent-strong)]'}`}>
                  <UserCheck className="w-4 h-4" /> Tell Me About Yourself
                </h4>
                <p className="text-xs leading-relaxed whitespace-pre-wrap">{results.tell_me_about_yourself}</p>
              </div>
            )}

            {results.interview_questions?.length > 0 && (
              <div className="space-y-4">
                <h4 className={`flex items-center gap-1.5 border-b pb-2 text-xxs font-bold uppercase tracking-widest ${darkMode ? 'border-white/8 text-cyan-200' : 'border-[var(--surface-border)] text-[var(--accent-strong)]'}`}>
                  <HelpCircle className="w-4 h-4" /> Interview Questions ({results.interview_questions.length})
                </h4>

                <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto pr-1">
                  {results.interview_questions.map((item: any, i: number) => (
                    <div key={i} className={`space-y-3 rounded-[1.5rem] border p-4 ${softPanelTheme} ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                      <div className="font-bold flex items-start gap-1.5 text-xs">
                        <HelpCircle className={`mt-0.5 h-4 w-4 shrink-0 ${darkMode ? 'text-cyan-300' : 'text-[var(--accent)]'}`} />
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
                <h4 className={`flex items-center gap-1.5 border-b pb-2 text-xxs font-bold uppercase tracking-widest ${darkMode ? 'border-white/8 text-cyan-200' : 'border-[var(--surface-border)] text-[var(--accent-strong)]'}`}>
                  <MessageSquarePlus className="w-4 h-4" /> Follow-up Questions
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {results.follow_up_questions.map((q: string, idx: number) => (
                    <div key={idx} className={`flex items-start gap-2 rounded-[1.25rem] border p-3 text-xs font-semibold ${softPanelTheme}`}>
                      <span className={`font-mono ${darkMode ? 'text-cyan-300' : 'text-[var(--accent)]'}`}>#{idx + 1}</span>
                      <span>{q}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'job_search' && (
          <div className={`space-y-6 rounded-[2rem] border p-6 shadow-sm ${panelTheme}`}>
            <div className={`border-b pb-3 ${darkMode ? 'border-white/8' : 'border-[var(--surface-border)]'}`}>
              <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${sectionLabelTheme}`}>
                <Search className="w-4 h-4" /> Web Job Discovery Tool
              </h2>
            </div>

            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSearchJobs(); }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={`font-bold text-xxs uppercase tracking-wider ${fieldLabelTheme}`}>Target Location City</label>
                  <input className={`w-full border p-3 rounded-xl focus:outline-none transition-all text-xs ${inputTheme}`} placeholder="e.g. London or Remote" value={searchCity} onChange={(e) => setSearchCity(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <label className={`font-bold text-xxs uppercase tracking-wider ${fieldLabelTheme}`}>Target Role / Skills Summary</label>
                  <input className={`w-full border p-3 rounded-xl focus:outline-none transition-all text-xs ${inputTheme}`} placeholder="e.g. Lead Technical Program Manager, Agile, AI, SaaS, Strategy" value={searchRoleSkills} onChange={(e) => setSearchRoleSkills(e.target.value)} />
                </div>
              </div>

              <div className={`rounded-[1.5rem] border-2 border-dashed p-6 text-center transition-all ${searchFile ? 'border-green-500 bg-green-500/5' : darkMode ? 'border-white/10 bg-slate-950/40' : 'border-[var(--surface-border)] bg-[var(--surface-strong)]/70'}`}>
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

              <button
                type="submit"
                disabled={searchLoading}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xxs font-bold uppercase tracking-[0.22em] text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60 ${darkMode ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300' : 'bg-[var(--accent)] hover:bg-[var(--accent-strong)]'}`}
              >
                {searchLoading ? (
                  <>
                    <RefreshCw className="animate-spin w-4 h-4" /> Searching Active Jobs...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Find 40 Active Matches
                  </>
                )}
              </button>
            </form>

            {jobResults && (
              <div className={`space-y-6 border-t border-dashed pt-2 ${darkMode ? 'border-white/8' : 'border-[var(--surface-border)]'}`}>
                <div className={`overflow-x-auto rounded-[1.5rem] border shadow-inner ${darkMode ? 'border-white/8' : 'border-[var(--surface-border)]'}`}>
                  <table className="w-full text-left border-collapse text-xxs leading-relaxed">
                    <thead>
                      <tr className={`${darkMode ? 'bg-slate-950 text-cyan-200' : 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'} font-black uppercase tracking-wider`}>
                        <th className="p-3">Job Title</th>
                        <th className="p-3">Company Name</th>
                        <th className="p-3">Location</th>
                        <th className="p-3">Salary Range</th>
                        <th className="p-3">Required Skills</th>
                        <th className="p-3">Application Link</th>
                      </tr>
                    </thead>
                    <tbody className={`font-medium ${darkMode ? 'divide-y divide-white/8' : 'divide-y divide-[color:rgba(155,124,83,0.16)]'}`}>
                      {jobResults.jobs?.map((job: any, index: number) => (
                        <tr key={index}>
                          <td className="p-3 font-bold">{job.title}</td>
                          <td className="p-3">{job.company}</td>
                          <td className="p-3">{job.location}</td>
                          <td className="p-3">{job.salary}</td>
                          <td className="p-3">{Array.isArray(job.skills) ? job.skills.join(', ') : job.skills}</td>
                          <td className="p-3">
                            {job.link && job.link.startsWith('http') ? (
                              <a href={job.link} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 font-bold hover:underline ${darkMode ? 'text-cyan-300' : 'text-[var(--accent-strong)]'}`}>
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
                  <div className={`flex items-start gap-2 rounded-[1.5rem] border p-4 text-xs font-semibold leading-relaxed ${darkMode ? 'border-cyan-400/20 bg-cyan-400/10 text-slate-100' : 'border-[color:rgba(15,118,110,0.16)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'}`}>
                    <Sparkles className={`mt-0.5 h-4 w-4 shrink-0 ${darkMode ? 'text-cyan-300' : 'text-[var(--accent)]'}`} />
                    <div>{jobResults.best_match_summary}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <footer className={`mt-12 w-full border-t border-dashed py-6 text-center ${darkMode ? 'border-white/8' : 'border-[var(--surface-border)]'}`}>
        <p className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-stone-400 dark:text-stone-500">
          Crafted with <Heart className="h-3.5 w-3.5 fill-rose-600 text-rose-600" /> & Developed by <span className={`font-mono font-extrabold ${darkMode ? 'text-cyan-300' : 'text-[var(--accent-strong)]'}`}>Kuldeep Sharma</span>
        </p>
      </footer>
    </main>
  );
}
