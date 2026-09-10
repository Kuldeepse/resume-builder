'use client';

import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  CheckCircle2,
  ExternalLink,
  FileText,
  Filter,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';

type JobMatch = {
  title: string;
  company: string;
  location: string;
  salary: string;
  posted?: string;
  description?: string;
  skills: string[];
  link: string;
  match_score: number;
  matched_requirements: string[];
  missing_requirements: string[];
  recommendation: 'Apply' | 'Apply after tailoring' | 'Review carefully';
};

type JobResults = {
  jobs: JobMatch[];
  best_match_summary?: string;
  search_mode?: string;
  source?: string;
};

type RecommendationFilter = 'all' | JobMatch['recommendation'];

const SAVED_KEY = 'cognitwist-job-intelligence-saved';

function jobKey(job: JobMatch) {
  return `${job.company}::${job.title}::${job.location}::${job.link}`;
}

function scoreLabel(score: number) {
  if (score >= 90) return 'Excellent fit';
  if (score >= 80) return 'Strong fit';
  if (score >= 70) return 'Worth applying';
  if (score >= 60) return 'Apply selectively';
  return 'Low priority';
}

function recommendationTone(recommendation: JobMatch['recommendation']) {
  if (recommendation === 'Apply') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (recommendation === 'Apply after tailoring') return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export default function JobsPage() {
  const [targetRole, setTargetRole] = useState('');
  const [location, setLocation] = useState('UK');
  const [profileText, setProfileText] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchStatus, setSearchStatus] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState<JobResults | null>(null);
  const [selectedKey, setSelectedKey] = useState('');
  const [minimumFit, setMinimumFit] = useState(0);
  const [recommendationFilter, setRecommendationFilter] = useState<RecommendationFilter>('all');
  const [saved, setSaved] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(SAVED_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
    } catch {
      return [];
    }
  });
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const persistSaved = (next: string[]) => {
    setSaved(next);
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  };

  const toggleSaved = (job: JobMatch) => {
    const key = jobKey(job);
    persistSaved(saved.includes(key) ? saved.filter((item) => item !== key) : [...saved, key]);
  };

  const filteredJobs = useMemo(() => {
    return [...(results?.jobs || [])]
      .sort((a, b) => b.match_score - a.match_score)
      .filter((job) => {
        if (job.match_score < minimumFit) return false;
        if (recommendationFilter !== 'all' && job.recommendation !== recommendationFilter) return false;
        if (showSavedOnly && !saved.includes(jobKey(job))) return false;
        return true;
      });
  }, [results, minimumFit, recommendationFilter, showSavedOnly, saved]);

  const selectedJob = useMemo(() => {
    if (!filteredJobs.length) return null;
    return filteredJobs.find((job) => jobKey(job) === selectedKey) || filteredJobs[0];
  }, [filteredJobs, selectedKey]);

  const cancelSearch = () => controllerRef.current?.abort();

  const handleSearch = async () => {
    if (!targetRole.trim() || !location.trim()) {
      setError('Enter a target role and location.');
      return;
    }
    if (!resumeFile && !profileText.trim()) {
      setError('Upload a DOCX CV or paste a short career profile so CogniTwist can score each job.');
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError('');
    setSelectedKey('');
    setSearchStatus('Loading the latest UK vacancies and calculating your CogniTwist fit score…');

    const formData = new FormData();
    formData.append('target_role', targetRole.trim());
    formData.append('location_city', location.trim());
    formData.append('resume_skills', profileText.trim());
    if (resumeFile) formData.append('resume_file', resumeFile);

    const statusTimer = window.setTimeout(() => {
      setSearchStatus('Still working — the free UK feed is being ranked against your CV. You can keep waiting or cancel.');
    }, 12000);

    try {
      const response = await fetch('/api/jobs/search', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.detail || `Job search failed (${response.status}).`);
      const next = data as JobResults;
      next.jobs = (next.jobs || []).sort((a, b) => b.match_score - a.match_score);
      setResults(next);
      if (next.jobs[0]) setSelectedKey(jobKey(next.jobs[0]));
      setSearchStatus('');
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') {
        setError('Search cancelled. Your CV and search criteria are still available.');
      } else {
        setError(requestError instanceof Error ? requestError.message : 'Job search failed. Please try again.');
      }
      setSearchStatus('');
    } finally {
      window.clearTimeout(statusTimer);
      if (controllerRef.current === controller) controllerRef.current = null;
      setLoading(false);
    }
  };

  const openInStudio = (job: JobMatch) => {
    window.sessionStorage.setItem(
      'cognitwist-career-studio-context',
      JSON.stringify({
        targetRole: job.title,
        jobDescription: [
          `${job.title} at ${job.company}`,
          job.location ? `Location: ${job.location}` : '',
          job.description || '',
          job.skills?.length ? `Role signals: ${job.skills.join(', ')}` : '',
        ].filter(Boolean).join('\n\n'),
      }),
    );
    window.location.href = '/';
  };

  const openInterview = (job: JobMatch) => {
    const description = [
      job.description || '',
      job.skills?.length ? `Role signals: ${job.skills.join(', ')}` : '',
    ].filter(Boolean).join('\n\n');

    window.sessionStorage.setItem(
      'cognitwist-live-interview-context',
      JSON.stringify({ role: job.title, jobDescription: description, interviewType: 'behavioural' }),
    );
    window.location.href = `/live-interview?role=${encodeURIComponent(job.title)}&type=behavioural`;
  };

  const inputClass = 'w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]';
  const panelClass = 'rounded-[1.75rem] border border-[var(--surface-border)] bg-[var(--surface)] shadow-[var(--shadow-xl)]';

  return (
    <main className="min-h-screen px-3 pb-28 pt-6 text-[var(--foreground)] md:px-8 md:pb-12 md:pt-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[2.2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xl)] md:p-9">
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[var(--accent-soft)] blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--accent-soft)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                <BriefcaseBusiness className="h-3.5 w-3.5" /> Job Intelligence
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">Know which jobs deserve your time.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-soft)] md:text-base">Search current UK vacancies without waiting for the Render AI engine, rank them against your CV, see the evidence behind every score, and continue into CV tailoring or interview practice.</p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-900"><ShieldCheck className="h-3.5 w-3.5" /> Free serverless search · no paid job-search API</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
              <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 py-3"><div className="text-lg font-black">Fit</div><div className="text-[10px] text-[var(--ink-soft)]">Deterministic score</div></div>
              <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 py-3"><div className="text-lg font-black">Evidence</div><div className="text-[10px] text-[var(--ink-soft)]">Matches & gaps</div></div>
              <div className="col-span-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 py-3 sm:col-span-1"><div className="text-lg font-black">Action</div><div className="text-[10px] text-[var(--ink-soft)]">Apply / tailor / practise</div></div>
            </div>
          </div>
        </section>

        <section className={`${panelClass} p-5 md:p-7`}>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <label className="text-xs font-black">Target role<input className={`${inputClass} mt-2`} value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="e.g. Product Manager" /></label>
            <label className="text-xs font-black">Location<input className={`${inputClass} mt-2`} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. UK / London / Remote" /></label>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4">
              <input id="jobs-cv" type="file" accept=".pdf,.docx" className="hidden" onChange={(event) => setResumeFile(event.target.files?.[0] || null)} />
              <label htmlFor="jobs-cv" className="flex min-h-24 cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--surface-border)] px-4 text-center text-xs font-black hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">
                <Upload className="h-5 w-5 text-[var(--accent-strong)]" />{resumeFile ? resumeFile.name : 'Upload CV (DOCX recommended)'}
              </label>
              <p className="mt-2 text-[10px] leading-5 text-[var(--ink-soft)]">DOCX is parsed by CogniTwist directly. For PDF, paste a short career summary alongside the file for this free search path.</p>
            </div>
            <label className="text-xs font-black">Or paste a career summary<textarea className={`${inputClass} mt-2 min-h-24 resize-y text-xs leading-6`} value={profileText} onChange={(event) => setProfileText(event.target.value)} placeholder="Experience, core skills, seniority, certifications…" /></label>
          </div>

          {error && <div role="alert" className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-900">{error}</div>}
          {loading && searchStatus && (
            <div className="mt-4 flex items-start justify-between gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--accent-soft)] p-4 text-xs font-bold text-[var(--accent-strong)]">
              <div className="flex items-start gap-3"><RefreshCw className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /><span>{searchStatus}</span></div>
              <button type="button" onClick={cancelSearch} className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2.5 py-1.5 text-[10px] font-black text-[var(--foreground)]"><X className="h-3.5 w-3.5" /> Cancel</button>
            </div>
          )}

          <button type="button" onClick={handleSearch} disabled={loading} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--highlight))] px-5 text-sm font-black text-white shadow-[var(--shadow-xl)] disabled:opacity-55">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{loading ? 'Finding and scoring jobs…' : 'Find and rank matching jobs'}
          </button>
        </section>

        {results && (
          <>
            <div className="flex items-start gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--accent-soft)] p-4 text-xs leading-6"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-strong)]" /><div>{results.best_match_summary || 'Search completed.'}{results.source ? <div className="mt-1 text-[10px] font-black uppercase tracking-wide">Source: {results.source}</div> : null}</div></div>

            <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
              <div className="space-y-4">
                <div className={`${panelClass} p-4`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-xs font-black"><Filter className="h-4 w-4" /> Filters</div>
                    <select value={minimumFit} onChange={(event) => setMinimumFit(Number(event.target.value))} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-3 py-2 text-xs font-bold"><option value={0}>Any fit</option><option value={60}>60%+</option><option value={70}>70%+</option><option value={80}>80%+</option><option value={90}>90%+</option></select>
                    <select value={recommendationFilter} onChange={(event) => setRecommendationFilter(event.target.value as RecommendationFilter)} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-3 py-2 text-xs font-bold"><option value="all">All recommendations</option><option value="Apply">Apply</option><option value="Apply after tailoring">Apply after tailoring</option><option value="Review carefully">Review carefully</option></select>
                    <button type="button" onClick={() => setShowSavedOnly((value) => !value)} className={`rounded-xl border px-3 py-2 text-xs font-black ${showSavedOnly ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]' : 'border-[var(--surface-border)]'}`}>Saved ({saved.length})</button>
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredJobs.length ? filteredJobs.map((job) => {
                    const key = jobKey(job);
                    const active = selectedJob ? jobKey(selectedJob) === key : false;
                    const isSaved = saved.includes(key);
                    return (
                      <button key={key} type="button" onClick={() => setSelectedKey(key)} className={`w-full rounded-2xl border p-4 text-left transition ${active ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-[var(--shadow-lg)]' : 'border-[var(--surface-border)] bg-[var(--surface)] hover:border-[var(--accent)]'}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wide text-[var(--accent-strong)]">{job.company}</p><h2 className="mt-1 text-sm font-black md:text-base">{job.title}</h2><p className="mt-2 flex items-center gap-1 text-[11px] text-[var(--ink-soft)]"><MapPin className="h-3.5 w-3.5" /> {job.location || 'Location not stated'}</p><p className="mt-1 text-[11px] text-[var(--ink-soft)]">{job.salary || 'Salary not disclosed'} {job.posted ? `• ${job.posted}` : ''}</p></div>
                          <div className="shrink-0 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-[var(--accent)] bg-[var(--surface-strong)] text-base font-black">{job.match_score}%</div><p className="mt-1 text-[9px] font-black text-[var(--accent-strong)]">{scoreLabel(job.match_score)}</p></div>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${recommendationTone(job.recommendation)}`}>{job.recommendation}</span>{isSaved ? <BookmarkCheck className="h-4 w-4 text-[var(--accent-strong)]" /> : <ArrowRight className="h-4 w-4 text-[var(--ink-soft)]" />}</div>
                      </button>
                    );
                  }) : <div className={`${panelClass} p-6 text-center text-sm text-[var(--ink-soft)]`}>No jobs match the current filters/search.</div>}
                </div>
              </div>

              <div className="xl:sticky xl:top-28 xl:self-start">
                {selectedJob ? (
                  <article className={`${panelClass} overflow-hidden`}>
                    <div className="border-b border-[var(--surface-border)] p-5 md:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-wide text-[var(--accent-strong)]">{selectedJob.company}</p><h2 className="mt-1 text-2xl font-black">{selectedJob.title}</h2><p className="mt-2 text-xs text-[var(--ink-soft)]">{selectedJob.location} {selectedJob.posted ? `• ${selectedJob.posted}` : ''}</p><p className="mt-1 text-xs font-bold">{selectedJob.salary || 'Salary not disclosed'}</p></div><div className="flex gap-2"><button type="button" onClick={() => toggleSaved(selectedJob)} className="flex items-center gap-2 rounded-xl border border-[var(--surface-border)] px-3 py-2.5 text-xs font-black">{saved.includes(jobKey(selectedJob)) ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />} Save</button>{selectedJob.link?.startsWith('http') && <a href={selectedJob.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-xs font-black text-white">Open <ExternalLink className="h-4 w-4" /></a>}</div></div></div>

                    <div className="space-y-5 p-5 md:p-6">
                      <div className="grid gap-4 md:grid-cols-[0.34fr_0.66fr]"><div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-5 text-center"><Target className="h-5 w-5 text-[var(--accent-strong)]" /><div className="mt-2 text-5xl font-black">{selectedJob.match_score}%</div><div className="mt-1 text-xs font-black text-[var(--accent-strong)]">{scoreLabel(selectedJob.match_score)}</div><p className="mt-2 text-[10px] leading-5 text-[var(--ink-soft)]">Deterministic CogniTwist CV-to-job fit score.</p></div><div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-5"><p className="text-xs font-black">Should you apply?</p><div className={`mt-3 inline-flex rounded-full border px-3 py-1.5 text-xs font-black ${recommendationTone(selectedJob.recommendation)}`}>{selectedJob.recommendation}</div><p className="mt-4 text-xs leading-6 text-[var(--ink-soft)]">Score combines role alignment, CV evidence overlap, location and freshness. Review the job page before applying.</p></div></div>

                      {selectedJob.description && <div><h3 className="text-sm font-black">Role overview</h3><p className="mt-2 text-xs leading-7 text-[var(--ink-soft)]">{selectedJob.description}</p></div>}

                      <div className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /><h3 className="text-xs font-black">Why this job fits</h3></div><ul className="mt-3 space-y-2 text-[11px] leading-5">{selectedJob.matched_requirements?.length ? selectedJob.matched_requirements.map((item) => <li key={item}>• {item}</li>) : <li>No strong evidence matches identified.</li>}</ul></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /><h3 className="text-xs font-black">Potential gaps</h3></div><ul className="mt-3 space-y-2 text-[11px] leading-5">{selectedJob.missing_requirements?.length ? selectedJob.missing_requirements.map((item) => <li key={item}>• {item}</li>) : <li>No material job signals missing from the profile.</li>}</ul></div></div>

                      {selectedJob.skills?.length ? <div><h3 className="text-sm font-black">Role signals</h3><div className="mt-3 flex flex-wrap gap-2">{selectedJob.skills.map((skill) => <span key={skill} className="rounded-full border border-[var(--surface-border)] bg-[var(--accent-soft)] px-3 py-1.5 text-[10px] font-black text-[var(--accent-strong)]">{skill}</span>)}</div></div> : null}

                      <div className="grid gap-3 sm:grid-cols-3"><button type="button" onClick={() => openInStudio(selectedJob)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-xs font-black text-white"><FileText className="h-4 w-4" /> Tailor CV</button><button type="button" onClick={() => openInterview(selectedJob)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--surface-border)] px-4 text-xs font-black"><UserCheck className="h-4 w-4" /> Interview prep</button>{selectedJob.link?.startsWith('http') ? <a href={selectedJob.link} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--surface-border)] px-4 text-xs font-black"><ExternalLink className="h-4 w-4" /> View job</a> : <div className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--surface-border)] px-4 text-xs text-[var(--ink-soft)]"><ShieldCheck className="h-4 w-4" /> Link unavailable</div>}</div>
                    </div>
                  </article>
                ) : null}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
