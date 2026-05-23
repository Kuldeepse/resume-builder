'use client';
import { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, BarChart3, AlertTriangle, Target, FileText, User, Code, HelpCircle, RotateCcw, ClipboardCheck, ArrowLeftRight, CheckCircle2, Sun, Moon, Heart, Link, Clock, ListOrdered, UserCheck, MessageSquarePlus, Briefcase, Search, MapPin, DollarSign } from 'lucide-react';

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
  
  // 💼 New Real-time Job Tracking State Engine Parameters
  const [targetCity, setTargetCity] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobSearchLoading, setJobSearchLoading] = useState(false);
  const [jobResults, setJobResults] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'builder' | 'validation' | 'updated_resume' | 'prep' | 'job_hunter'>('builder');
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleGenerate = async () => {
    if (!fullName || !targetRole || !careerHistory || !jobDescription) return alert("Please fill out all mandatory builder parameters.");
    setLoading(true); setResults(null);
    const formData = new FormData();
    formData.append('full_name', fullName); formData.append('target_role', targetRole);
    formData.append('linkedin_profile', linkedin); formData.append('interview_duration', duration);
    formData.append('total_questions_requested', totalQuestions.toString());
    formData.append('interview_type', interviewType); formData.append('career_history', careerHistory);
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

  const handleJobSearch = async () => {
    if (!targetCity) return alert("Please specify a target City or state parameter location.");
    setJobSearchLoading(true); setJobResults(null);
    const formData = new FormData();
    formData.append('target_city', targetCity);
    if (resumeFile) formData.append('resume_file', resumeFile);
    try {
      const res = await fetch('https://onrender.com', { method: 'POST', body: formData });
      if (!res.ok) throw new Error();
      setJobResults(await res.json());
    } catch {
      alert("Job execution routing vectors interrupted. Check cloud connection profiles.");
    } finally { setJobSearchLoading(false); }
  };

  if (!mounted) return <div className="min-h-screen bg-[#FAF8F5] dark:bg-stone-950 animate-pulse" />;
  return (
    <main className={`min-h-screen p-4 md:p-8 font-sans antialiased transition-colors duration-300 ${darkMode ? 'bg-stone-950 text-slate-100' : 'bg-[#FAF8F5] text-slate-900'}`}>
      <div className="max-w-5xl mx-auto space-y-6">
        
        <header className="relative flex flex-col items-center text-center space-y-3 py-4 border-b border-dashed border-amber-900/20 dark:border-slate-800">
          <button type="button" onClick={() => setDarkMode(!darkMode)} className={`absolute top-2 right-2 p-2 rounded-xl border flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider cursor-pointer shadow-sm transition-all ${darkMode ? 'bg-stone-900 border-stone-800 text-amber-500' : 'bg-white border-stone-200 text-stone-800'}`}>
            {darkMode ? <><Sun className="w-3.5 h-3.5"/> Light Theme</> : <><Moon className="w-3.5 h-3.5"/> Dark Theme</>}
          </button>
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold border ${darkMode ? 'bg-indigo-500/10 border-slate-800 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}><Sparkles className="w-3 h-3 text-indigo-500" /> Matrix Configuration Platform Active</div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">AI Career Intelligence Matrix</h1>
        </header>

        <div className={`flex flex-wrap border p-1.5 gap-1.5 backdrop-blur-md rounded-2xl shadow-sm overflow-x-auto ${darkMode ? 'bg-stone-900/80 border-slate-800' : 'bg-white border-amber-900/10'}`}>
          <button onClick={() => setTab('builder')} className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 cursor-pointer text-xxs tracking-wide ${tab === 'builder' ? 'bg-amber-900 text-white' : 'text-stone-500'}`}><Sparkles className="w-3.5 h-3.5"/> Pipeline Builder</button>
          <button onClick={() => setTab('job_hunter')} className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 cursor-pointer text-xxs tracking-wide ${tab === 'job_hunter' ? 'bg-amber-900 text-white' : 'text-stone-500'}`}><Briefcase className="w-3.5 h-3.5"/> Realtime Job Tracker</button>
          {results && (
            <>
              <button onClick={() => setTab('validation')} className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 cursor-pointer text-xxs tracking-wide ${tab === 'validation' ? 'bg-amber-900 text-white' : 'text-stone-500'}`}><ClipboardCheck className="w-3.5 h-3.5"/> Resume Validation</button>
              <button onClick={() => setTab('updated_resume')} className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 cursor-pointer text-xxs tracking-wide ${tab === 'updated_resume' ? 'bg-amber-900 text-white' : 'text-stone-500'}`}><FileText className="w-3.5 h-3.5"/> Tailored Output</button>
              <button onClick={() => setTab('prep')} className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 cursor-pointer text-xxs tracking-wide ${tab === 'prep' ? 'bg-amber-900 text-white' : 'text-stone-500'}`}><User className="w-3.5 h-3.5"/> Interview Vectors</button>
            </>
          )}
        </div>

        {tab === 'builder' && (
          <div className={`border p-6 rounded-2xl shadow-sm space-y-6 ${darkMode ? 'bg-stone-900/40 border-slate-800/60 shadow-2xl' : 'bg-white border-amber-900/10'}`}>
            <h2 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-amber-900 dark:text-amber-400"><ArrowLeftRight className="w-4 h-4"/> Core Variable Mapping</h2>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input type="text" className="w-full border p-3 rounded-xl dark:bg-stone-950 text-xs font-medium" placeholder="Applicant Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                <input type="text" className="w-full border p-3 rounded-xl dark:bg-stone-950 text-xs font-medium" placeholder="Target Role Objective" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 py-2">
                <input type="url" className="w-full border p-3 rounded-xl dark:bg-stone-950 text-xs font-medium" placeholder="LinkedIn Profile URL" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
                <select className="w-full border p-3 rounded-xl dark:bg-stone-950 text-xs font-medium" value={duration} onChange={(e) => setDuration(e.target.value)}>
                  <option value="30 minutes">30 Minutes</option><option value="45 minutes">45 Minutes</option><option value="60 minutes">60 Minutes</option>
                </select>
                <select className="w-full border p-3 rounded-xl dark:bg-stone-950 text-xs font-medium" value={interviewType} onChange={(e) => { setInterviewType(e.target.value as 'hr' | 'technical'); setResults(null); }}>
                  <option value="technical">Technical Track</option><option value="hr">HR/Behavioral Track</option>
                </select>
                <div className="flex flex-col space-y-1"><span className="text-[10px] uppercase font-bold text-slate-400">Questions Needed: {totalQuestions}</span>
                  <input type="range" min="5" max="25" className="w-full accent-amber-800" value={totalQuestions} onChange={(e) => setTotalQuestions(parseInt(e.target.value))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <textarea rows={5} className="w-full border p-3 rounded-xl font-mono text-[11px] dark:bg-stone-950" placeholder="Legacy Career Profile history..." value={careerHistory} onChange={(e) => setCareerHistory(e.target.value)} />
                <textarea rows={5} className="w-full border p-3 rounded-xl font-mono text-[11px] dark:bg-stone-950" placeholder="Job Description Checklist text..." value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
              </div>
              <button type="button" onClick={handleGenerate} disabled={loading} className="w-full bg-amber-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-xxs uppercase tracking-widest disabled:opacity-50">
                {loading ? <RefreshCw className="animate-spin w-4 h-4" /> : 'Execute Optimization Cycle'}
              </button>
            </form>
          </div>
        )}
        {tab === 'job_hunter' && (
          <div className={`border p-6 rounded-2xl shadow-sm space-y-6 ${darkMode ? 'bg-stone-900/40 border-slate-800/60 shadow-2xl' : 'bg-white border-amber-900/10'}`}>
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-amber-900 dark:text-amber-400"><Briefcase className="w-4 h-4"/> Realtime Global Opening Discovery</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3"/> Destination City or Remote</label>
                <input type="text" className="w-full border p-3 rounded-xl dark:bg-stone-950 text-xs font-semibold" placeholder="e.g. San Francisco, New York, or Remote" value={targetCity} onChange={(e) => setTargetCity(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1"><FileText className="w-3 h-3"/> Background Profile Context Document</label>
                <input type="file" accept=".pdf,.docx,.txt" className="w-full border p-2 rounded-xl dark:bg-stone-950 text-xs text-slate-400 font-medium" onChange={(e) => setResumeFile(e.target.files?.[0] || null)} />
              </div>
            </div>
            <button type="button" onClick={handleJobSearch} disabled={jobSearchLoading} className="w-full bg-indigo-700 hover:bg-indigo-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-xxs uppercase tracking-widest disabled:opacity-50 transition-all">
              {jobSearchLoading ? <><RefreshCw className="animate-spin w-4 h-4" /> Crawling Matrix Infrastructure Nodes...</> : <><Search className="w-4 h-4" /> Crawl & Verify Matching Jobs</>}
            </button>

            {jobResults && (
              <div className="space-y-4 border-t border-dashed border-slate-200 dark:border-slate-800 pt-4 animate-fadeIn">
                <div className="overflow-x-auto rounded-xl border border-amber-900/10 dark:border-slate-800 shadow-inner">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={`${darkMode ? 'bg-slate-900 text-slate-300' : 'bg-amber-50/50 text-amber-950'} text-[10px] font-black uppercase tracking-wider border-b border-amber-900/10 dark:border-slate-800`}>
                        <th className="p-3">Job Title</th><th className="p-3">Company</th><th className="p-3">Location</th><th className="p-3">Salary Range</th><th className="p-3">Required Skills</th><th className="p-3 text-right">Application Action Link</th>
                      </tr>
                    </thead>
                    <tbody className="text-xxs font-medium divide-y divide-slate-100 dark:divide-slate-900">
                      {jobResults.jobs?.map((job: any, index: number) => (
                        <tr key={index} className="hover:bg-amber-50/10 dark:hover:bg-stone-900/50 transition-colors">
                          <td className="p-3 font-bold text-slate-900 dark:text-white max-w-[150px] truncate">{job.title}</td>
                          <td className="p-3 font-semibold text-indigo-600 dark:text-indigo-400">{job.company}</td>
                          <td className="p-3"><span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-bold uppercase tracking-wide">{job.location}</span></td>
                          <td className="p-3 text-emerald-600 dark:text-emerald-400 font-mono font-bold">{job.salary}</td>
                          <td className="p-3 max-w-[200px] truncate text-slate-400">{Array.isArray(job.skills) ? job.skills.join(', ') : job.skills}</td>
                          <td className="p-3 text-right">
                            {String(job.link).startsWith('http') ? (
                              <a href={job.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 bg-amber-900 text-white font-extrabold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wide hover:bg-amber-800 shadow-sm transition-all">Apply Link <Link className="w-3 h-3" /></a>
                            ) : (
                              <span className="text-stone-400 font-bold italic border border-dashed border-stone-200 dark:border-stone-800 px-2 py-1 rounded-lg bg-stone-50 dark:bg-stone-950/20">{job.link}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {jobResults.summary && (
                  <div className={`p-4 rounded-xl border text-xs font-semibold leading-relaxed shadow-sm ${darkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-indigo-50/40 border-indigo-100 text-slate-800'}`}>
                    <span className="text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-wider block mb-1">🎯 Strategical Match Intelligence Analysis Summary:</span>
                    <p className="italic">{jobResults.summary}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {tab === 'validation' && results && (
          <div className="border p-6 rounded-2xl space-y-4 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">Resume Validation Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border text-center dark:border-slate-800"><span className="text-4xl font-black">{results.match_score}%</span><p className="text-[10px] text-slate-400 uppercase font-bold mt-1">ATS Match Rating</p></div>
              <div className="p-4 rounded-xl border dark:border-slate-800"><span className="text-[10px] font-bold uppercase text-amber-600 block mb-2">Isolated Keyword Gaps</span>
                <div className="flex flex-wrap gap-1">{results.missing_skills?.map((s: string, i: number) => <span key={i} className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-[10px] font-bold">{s}</span>)}</div>
              </div>
              <div className="p-4 rounded-xl border dark:border-slate-800"><span className="text-[10px] font-bold uppercase text-indigo-500 block mb-2">Strategy Advice</span>
                <ul className="text-[10px] space-y-1 list-disc pl-4 text-slate-400">{results.tailoring_tips?.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul>
              </div>
            </div>
          </div>
        )}

        {tab === 'updated_resume' && results && (
          <div className="border p-6 rounded-2xl space-y-4 dark:border-slate-800">
            <div className="bg-amber-800 p-4 rounded-xl text-white flex justify-between items-center">
              <span className="text-xxs font-black uppercase tracking-widest">Tailored Resume Output</span>
              <button onClick={handleCopyLink} className="bg-white text-amber-900 px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase">{copied ? "Copied Link!" : "Copy PDF Link"}</button>
            </div>
            <div className="border p-6 rounded-xl space-y-3 max-h-[400px] overflow-y-auto dark:border-slate-800 text-xs">
              <h2 className="text-lg font-black">{results.resume?.full_name}</h2><p className="italic text-slate-400">{results.resume?.professional_summary}</p>
              <div className="space-y-3 pt-2">
                {results.resume?.experience?.map((exp: any, i: number) => (
                  <div key={i} className="border-l border-amber-900/20 pl-3">
                    <h4 className="font-bold text-xxs">{exp.role} at {exp.company} ({exp.duration})</h4>
                    <ul className="list-disc pl-4 text-[11px] text-slate-400 mt-1">{exp.bullet_points?.map((b: string, idx: number) => <li key={idx}>{b}</li>)}</ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {tab === 'prep' && results && (
          <div className="border p-6 rounded-2xl space-y-4 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600">Interview Training Matrix</h3>
            {results.tell_me_about_yourself && (
              <div className="p-4 rounded-xl border dark:border-slate-800 text-xs leading-relaxed italic text-slate-400 bg-stone-50/40 dark:bg-stone-900/20">
                <span className="font-black text-indigo-500 uppercase tracking-wider block text-[10px] mb-1">Elevator Pitch summary:</span> {results.tell_me_about_yourself}
              </div>
            )}
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {results.interview_questions?.map((item: any, i: number) => (
                <div key={i} className="p-4 rounded-xl border dark:border-slate-800 space-y-2">
                  <div className="font-bold text-xs flex items-start gap-1.5"><span>Q{i+1}: {item.question}</span></div>
                  <div className="text-[11px] pl-5 space-y-1.5 leading-relaxed text-slate-400 font-medium">
                    {String(item.response || '').split('\n').map((line, lineIdx) => {
                      // ✅ REGEX FIXED: Avoids escaping strings using string pattern testing instead of loose regex literals
                      const cleanLine = line.replace(/<[^>]*>/g, "").trim();
                      if (!cleanLine) return null;
                      
                      const lower = cleanLine.toLowerCase();
                      if (lower.includes('situation:') || lower.startsWith('- situation:')) {
                        return <div key={lineIdx} className="pt-0.5"><strong className="text-slate-900 dark:text-white font-black">Situation:</strong> {cleanLine.replace(/^(-\s*)?situation:\s*/i, '')}</div>;
                      }
                      if (lower.includes('task:') || lower.startsWith('- task:')) {
                        return <div key={lineIdx}><strong className="text-slate-900 dark:text-white font-black">Task:</strong> {cleanLine.replace(/^(-\s*)?task:\s*/i, '')}</div>;
                      }
                      if (lower.includes('action:') || lower.startsWith('- action:')) {
                        return <div key={lineIdx}><strong className="text-slate-900 dark:text-white font-black">Action:</strong> {cleanLine.replace(/^(-\s*)?action:\s*/i, '')}</div>;
                      }
                      if (lower.includes('result:') || lower.startsWith('- result:')) {
                        return <div key={lineIdx} className="pb-0.5"><strong className="text-slate-900 dark:text-white font-black">Result:</strong> {cleanLine.replace(/^(-\s*)?result:\s*/i, '')}</div>;
                      }
                      return <div key={lineIdx} className="text-stone-500 font-normal">{cleanLine}</div>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="w-full text-center py-6 mt-12 border-t border-dashed border-amber-900/20 dark:border-slate-800">
        <p className="text-[11px] font-bold tracking-widest text-stone-400 dark:text-stone-500 uppercase flex items-center justify-center gap-1.5">
          Crafted with <Heart className="w-3.5 h-3.5 text-rose-600 fill-rose-600 animate-pulse" /> & Developed by <span className="text-amber-900 dark:text-indigo-400 font-extrabold font-mono">Kuldeep Sharma</span>
        </p>
      </footer>
    </main>
  );
}
