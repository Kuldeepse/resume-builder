'use client';
import { useState, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  BarChart3,
  AlertTriangle,
  Target,
  FileText,
  User,
  HelpCircle,
  RotateCcw,
  ClipboardCheck,
  ArrowRight,
  ArrowLeftRight,
  CheckCircle2,
  Sun,
  Moon,
  Heart,
  Link,
  Clock,
  ListOrdered,
  UserCheck,
  MessageSquarePlus,
  Briefcase,
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
  const [searchSkills, setSearchSkills] = useState('');
  const [searchFile, setSearchFile] = useState<File | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [jobResults, setJobResults] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleGenerate = async () => {
    if (!fullName || !targetRole || !careerHistory || !jobDescription) {
      return alert('Please fill out all mandatory fields.');
    }

    setLoading(true);
    setResults(null);

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
      const res = await fetch('https://resume-builder-backend-ph7b.onrender.com/build-resume', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error();

      setResults(await res.json());
      setTab('validation');
    } catch {
      alert('AI optimization cycle broken. Refocusing backend container parameters.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchJobs = async () => {
    if (!targetRole.trim() || !searchCity.trim()) {
      return alert('Please enter Target Role and Search City before running job search.');
    }

    if (!searchSkills.trim() && !searchFile) {
      return alert('Please enter Resume / Skills Summary Profile or upload a CV.');
    }

    setSearchLoading(true);
    setJobResults(null);

    const formData = new FormData();
    formData.append('target_role', targetRole.trim());
    formData.append('location_city', searchCity.trim());
    formData.append('resume_skills', searchSkills.trim());

    if (searchFile) {
      formData.append('resume_file', searchFile);
    }

    try {
      const res = await fetch('https://resume-builder-backend-ph7b.onrender.com/search-jobs', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error();

      setJobResults(await res.json());
    } catch {
      alert('Live open web query pipeline timing mismatch. Verify backend endpoint channels.');
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
    return <div className="min-h-screen bg-[#f5efe7] dark:bg-stone-950 animate-pulse" />;
  }

  const pageTheme = darkMode
    ? 'bg-stone-950 text-slate-100'
    : 'bg-[radial-gradient(circle_at_top,#fff7ed_0%,#f5efe7_45%,#efe6d9_100%)] text-slate-900';

  const panelTheme = darkMode
    ? 'bg-stone-900/50 border-stone-800/70'
    : 'bg-white/90 border-[#d9c8b4]';

  const inputTheme = darkMode
    ? 'bg-stone-950 border-stone-800 text-slate-200 focus:border-amber-700'
    : 'bg-[#fffaf5] border-[#dbcab7] text-stone-800 focus:border-[#a16207]';

  return (
    <main className={`min-h-screen p-4 md:p-8 font-sans antialiased transition-colors duration-300 ${pageTheme}`}>
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="relative flex flex-col items-center text-center space-y-4 py-6 border-b border-dashed border-amber-900/20 dark:border-stone-800">
          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className={`absolute top-2 right-2 p-2 rounded-xl border flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider cursor-pointer shadow-sm transition-all ${
              darkMode ? 'bg-stone-900 border-stone-800 text-amber-400' : 'bg-white border-[#d9c8b4] text-stone-800'
            }`}
          >
            {darkMode ? <><Sun className="w-3.5 h-3.5" /> Light Theme</> : <><Moon className="w-3.5 h-3.5" /> Dark Theme</>}
          </button>

          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold border ${
            darkMode ? 'bg-indigo-500/10 border-stone-800 text-indigo-300' : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            <Sparkles className="w-3 h-3" /> Engine Active: Gemini 2.5 Pro Tier
          </div>

          <h1 className="text-3xl md:text-5xl font-black tracking-tight">AI Career Intelligence Matrix</h1>
          <p className={`text-xs md:text-sm max-w-2xl mx-auto leading-relaxed font-medium ${darkMode ? 'text-slate-400' : 'text-stone-600'}`}>
            Optimize resume fit, generate interview prep, and search real active roles from a cleaner career workflow.
          </p>
        </header>

        <div className={`flex flex-wrap border p-1.5 gap-1.5 backdrop-blur-md rounded-2xl shadow-sm overflow-x-auto ${panelTheme}`}>
          {[
            ['builder', 'Pipeline Builder', Sparkles],
            ['validation', 'Resume Validation', ClipboardCheck],
            ['updated_resume', 'Tailored Output', FileText],
            ['prep', 'Interview Vectors', User],
            ['job_search', 'Web Job Discovery Tool', Briefcase],
          ].map(([t, label, Icon]: any) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all duration-200 text-xxs tracking-wide ${
                tab === t
                  ? 'bg-amber-900 text-white shadow-md scale-[1.01]'
                  : darkMode
                    ? 'text-stone-300 hover:bg-stone-800'
                    : 'text-stone-700 hover:bg-amber-50'
              } ${!results && t !== 'builder' && t !== 'job_search' ? 'hidden' : ''}`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
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
                  className={`flex items-center gap-1 font-bold px-3 py-1 rounded-xl border text-xxs tracking-wide cursor-pointer ${
                    darkMode ? 'bg-rose-950 text-rose-400 border-rose-500/20' : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  <RotateCcw className="w-3 h-3" /> Reset Form
                </button>
              )}
            </div>

            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input className={`w-full border p-3 rounded-xl focus:outline-none transition-all ${inputTheme}`} placeholder="Applicant Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                <input className={`w-full border p-3 rounded-xl focus:outline-none transition-all ${inputTheme}`} placeholder="Target Role Objective" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 border-t border-b border-dashed border-slate-200 dark:border-stone-800 py-4">
                <input className={`w-full border p-3 rounded-xl focus:outline-none transition-all ${inputTheme}`} placeholder="LinkedIn Profile URL" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
                <select className={`w-full border p-3 rounded-xl focus:outline-none transition-all ${inputTheme}`} value={duration} onChange={(e) => setDuration(e.target.value)}>
                  <option value="30 minutes">30 Minutes</option>
                  <option value="45 minutes">45 Minutes</option>
                  <option value="60 minutes">60 Minutes</option>
                </select>
                <select className={`w-full border p-3 rounded-xl focus:outline-none transition-all ${inputTheme}`} value={interviewType} onChange={(e) => setInterviewType(e.target.value as 'hr' | 'technical')}>
                  <option value="technical">Technical Interview Track</option>
                  <option value="hr">HR / Behavioral Interview Track</option>
                </select>
                <input type="range" min="5" max="25" className="w-full h-12 accent-amber-800" value={totalQuestions} onChange={(e) => setTotalQuestions(parseInt(e.target.value))} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <textarea rows={6} className={`w-full border p-3 rounded-xl focus:outline-none font-mono text-[11px] leading-relaxed ${inputTheme}`} placeholder="Legacy Career Profile" value={careerHistory} onChange={(e) => setCareerHistory(e.target.value)} />
                <textarea rows={6} className={`w-full border p-3 rounded-xl focus:outline-none font-mono text-[11px] leading-relaxed ${inputTheme}`} placeholder="Job Description Target" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
              </div>

              <button type="button" onClick={handleGenerate} disabled={loading} className="w-full bg-amber-900 hover:bg-amber-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-xxs uppercase tracking-widest shadow-md">
                {loading ? <><RefreshCw className="animate-spin w-4 h-4 text-amber-200" /> Computing Neural Vectors...</> : <><Sparkles className="w-4 h-4 text-amber-400" /> Execute Generation Cycle</>}
              </button>
            </form>
          </div>
        )}

        {tab === 'validation' && results && <div className={`border p-8 rounded-2xl shadow-md space-y-6 ${panelTheme}`}><h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 border-b pb-4"><BarChart3 className="w-5 h-5" /> Resume Validation Metrics Panel</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div className="p-8 rounded-2xl border text-center"><div className="text-6xl font-black">{results.match_score}%</div></div><div className="p-6 rounded-2xl border"><div className="flex flex-wrap gap-2">{results.missing_skills?.map((s: string, i: number) => <span key={i} className="bg-amber-500/10 px-3 py-1 rounded-xl text-[11px] font-bold">{s}</span>)}</div></div><div className="p-6 rounded-2xl border"><ul className="space-y-2">{results.tailoring_tips?.map((t: string, i: number) => <li key={i} className="flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /><span>{t}</span></li>)}</ul></div></div></div>}

        {tab === 'updated_resume' && results && <div className={`border p-6 rounded-2xl shadow-sm space-y-5 ${panelTheme}`}><div className="bg-amber-800 p-4 rounded-xl text-white flex justify-between items-center"><div className="flex items-center gap-1.5 font-bold text-xxs uppercase"><FileText className="w-4 h-4" /> Tailored Optimization Resume Output Map</div><button onClick={handleCopyLink} className="bg-white text-amber-900 px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase">{copied ? 'Blueprint Linked!' : 'Copy Public PDF Link'}</button></div><div className={`border p-6 rounded-xl space-y-4 max-h-[500px] overflow-y-auto ${darkMode ? 'border-stone-800 bg-stone-950' : 'border-stone-200 bg-white'}`}><h2 className="text-xl font-extrabold">{results.resume?.full_name}</h2><p>{results.resume?.professional_summary}</p></div></div>}

        {tab === 'prep' && results && <div className={`border p-6 rounded-2xl shadow-sm space-y-6 ${panelTheme}`}><div className="p-4 rounded-xl text-white bg-stone-800">Active Vector Focus: {interviewType === 'hr' ? 'HR / Behavioral' : 'Technical & Behavioral Split'}</div></div>}

        {tab === 'job_search' && (
          <div className={`border p-6 rounded-2xl shadow-sm space-y-6 ${panelTheme}`}>
            <div className={`border-b pb-3 ${darkMode ? 'border-stone-800' : 'border-stone-200'}`}>
              <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${darkMode ? 'text-amber-400' : 'text-amber-900'}`}>
                <Target className="w-4 h-4" /> Web Job Discovery Tool
              </h2>
            </div>

            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSearchJobs(); }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input className={`w-full border p-3 rounded-xl focus:outline-none transition-all text-xs ${inputTheme}`} placeholder="Target Location City" value={searchCity} onChange={(e) => setSearchCity(e.target.value)} />
                <input className={`w-full border p-3 rounded-xl focus:outline-none transition-all text-xs ${inputTheme}`} placeholder="Resume / Skills Summary Profile" value={searchSkills} onChange={(e) => setSearchSkills(e.target.value)} />
              </div>

              <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${searchFile ? 'border-green-500 bg-green-500/5' : darkMode ? 'border-stone-800 bg-stone-950/40' : 'border-[#d9c8b4] bg-[#fffaf5]'}`}>
                <input
                  type="file"
                  id="job-search-file-picker"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => setSearchFile(e.target.files?.[0] || null)}
                />
                <label htmlFor="job-search-file-picker" className="cursor-pointer block space-y-2">
                  <FileText className={`w-8 h-8 mx-auto ${searchFile ? 'text-green-500' : 'text-slate-400'}`} />
                  <div className="text-xxs font-bold uppercase tracking-wide">
                    {searchFile ? `CV Attached: ${searchFile.name}` : 'Attach CV in PDF or Word format'}
                  </div>
                </label>
                {searchFile && (
                  <button type="button" onClick={() => setSearchFile(null)} className="mt-2 text-[10px] font-bold text-rose-600 hover:underline">
                    Remove Attached CV
                  </button>
                )}
              </div>

              <button type="submit" disabled={searchLoading} className="w-full bg-amber-900 hover:bg-amber-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-xxs uppercase tracking-widest shadow-md">
                {searchLoading ? <><RefreshCw className="animate-spin w-4 h-4 text-amber-200" /> Searching Active Jobs...</> : <><Sparkles className="w-4 h-4 text-amber-400" /> Find 40 Active Matches</>}
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
                          <td className="p-3">{job.skills?.join(', ')}</td>
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
