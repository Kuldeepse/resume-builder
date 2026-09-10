'use client';

import { useMemo, useState } from 'react';
import { Bookmark, BookmarkCheck, BriefcaseBusiness, ExternalLink, Filter, MapPin, RefreshCw, Search, ShieldCheck, Sparkles, Target } from 'lucide-react';

type Job = {
  title: string;
  company: string;
  location: string;
  salary: string;
  posted: string;
  description: string;
  skills: string[];
  link: string;
  remote: boolean;
  source: string;
};

type BrowseResult = {
  jobs: Job[];
  total: number;
  sources: string[];
  partial?: boolean;
  source_errors?: string[];
};

const SAVED_KEY = 'cognitwist-job-search-saved';

const COMPANY_DOMAINS: Record<string, string> = {
  rightmove: 'rightmove.co.uk',
  bondsmith: 'bondsmith.com',
  'capital on tap': 'capitalontap.com',
  modulr: 'modulrfinance.com',
  blacklane: 'blacklane.com',
  speechmatics: 'speechmatics.com',
  capco: 'capco.com',
  yondr: 'yondrgroup.com',
  partly: 'partly.com',
  orbital: 'orbital.com',
  'heron data': 'herondata.io',
  freetrade: 'freetrade.io',
  elliptic: 'elliptic.co',
  ema: 'ema.co',
  swap: 'swap-commerce.com',
  antithesis: 'antithesis.com',
  'lyra health': 'lyrahealth.com',
  openpayd: 'openpayd.com',
  serverfarm: 'serverfarmllc.com',
  equinix: 'equinix.com',
};

function keyOf(job: Job) {
  return `${job.company}::${job.title}::${job.location}::${job.link}`;
}

function companyInitials(company: string) {
  return company.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CO';
}

function CompanyMark({ company, size = 'md' }: { company: string; size?: 'sm' | 'md' | 'lg' }) {
  const [failed, setFailed] = useState(false);
  const domain = COMPANY_DOMAINS[company.trim().toLowerCase()];
  const dimensions = size === 'lg' ? 'h-14 w-14 text-base' : size === 'sm' ? 'h-9 w-9 text-[10px]' : 'h-11 w-11 text-xs';
  const logoSrc = domain ? `/api/company-logo?domain=${encodeURIComponent(domain)}` : '';

  return (
    <div className={`${dimensions} flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--surface-border)] bg-white font-black text-[var(--accent-strong)] shadow-sm`} aria-label={`${company} logo`}>
      {logoSrc && !failed ? (
        <img
          src={logoSrc}
          alt={`${company} logo`}
          className="h-[76%] w-[76%] object-contain"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : companyInitials(company)}
    </div>
  );
}

export default function JobsPage() {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('UK');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [postedDays, setPostedDays] = useState('14');
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BrowseResult | null>(null);
  const [selectedKey, setSelectedKey] = useState('');
  const [saved, setSaved] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(SAVED_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const selected = useMemo(() => {
    if (!result?.jobs.length) return null;
    return result.jobs.find((job) => keyOf(job) === selectedKey) || result.jobs[0];
  }, [result, selectedKey]);

  const persistSaved = (next: string[]) => {
    setSaved(next);
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  };

  const toggleSaved = (job: Job) => {
    const key = keyOf(job);
    persistSaved(saved.includes(key) ? saved.filter((item) => item !== key) : [...saved, key]);
  };

  const selectJob = (job: Job) => {
    setSelectedKey(keyOf(job));
    if (typeof window !== 'undefined' && window.innerWidth < 1280) {
      window.setTimeout(() => {
        document.getElementById('job-detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  };

  const searchJobs = async () => {
    setLoading(true);
    setError('');
    setSelectedKey('');
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (location.trim()) params.set('location', location.trim());
      if (remoteOnly) params.set('remote', 'true');
      if (postedDays) params.set('days', postedDays);
      if (source) params.set('source', source);

      const response = await fetch(`/api/jobs/browse?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.detail || `Job search failed (${response.status}).`);
      const next = data as BrowseResult;
      setResult(next);
      if (next.jobs[0]) setSelectedKey(keyOf(next.jobs[0]));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Job search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const analyseFit = (job: Job) => {
    window.sessionStorage.setItem('cognitwist-job-intelligence-prefill', JSON.stringify({
      targetRole: job.title,
      location: job.location || 'UK',
      jobDescription: [
        `${job.title} at ${job.company}`,
        job.location ? `Location: ${job.location}` : '',
        job.description,
        job.skills.length ? `Role signals: ${job.skills.join(', ')}` : '',
      ].filter(Boolean).join('\n\n'),
    }));
    window.location.href = '/job-intelligence';
  };

  const inputClass = 'w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]';
  const panelClass = 'rounded-[1.75rem] border border-[var(--surface-border)] bg-[var(--surface)] shadow-[var(--shadow-xl)]';

  return (
    <main className="min-h-screen px-3 pb-48 pt-6 text-[var(--foreground)] md:px-8 xl:pb-12 xl:pt-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[2.2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xl)] md:p-9">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--accent-soft)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]"><BriefcaseBusiness className="h-3.5 w-3.5" /> Job Search</div>
            <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">Find cleaner jobs. Go straight to the source.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-soft)] md:text-base">Browse current vacancies without uploading a CV. CogniTwist combines direct ATS and public job sources, removes duplicates, preserves the original job link, and lets you analyse fit when you want deeper intelligence.</p>
            <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black"><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-900"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" /> No CV required</span><span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-strong)] px-3 py-1.5">Direct job links</span><span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-strong)] px-3 py-1.5">Company identity</span></div>
          </div>
        </section>

        <section className={`${panelClass} p-5 md:p-7`}>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_auto]">
            <label className="text-xs font-black">Role / skill / company<input className={`${inputClass} mt-2`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. Product Manager, IAM, Barclays" /></label>
            <label className="text-xs font-black">Location<input className={`${inputClass} mt-2`} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="UK / London / Remote" /></label>
            <button type="button" onClick={searchJobs} disabled={loading} className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--highlight))] px-6 text-sm font-black text-white shadow-[var(--shadow-xl)] disabled:opacity-55 lg:mt-6">{loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{loading ? 'Searching…' : 'Search'}</button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3"><div className="flex items-center gap-2 text-xs font-black"><Filter className="h-4 w-4" /> Filters</div><label className="flex items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-3 py-2 text-xs font-bold"><input type="checkbox" checked={remoteOnly} onChange={(event) => setRemoteOnly(event.target.checked)} /> Remote only</label><select value={postedDays} onChange={(event) => setPostedDays(event.target.value)} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-3 py-2 text-xs font-bold"><option value="0">Any date</option><option value="3">Last 3 days</option><option value="7">Last 7 days</option><option value="14">Last 14 days</option><option value="30">Last 30 days</option></select><select value={source} onChange={(event) => setSource(event.target.value)} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-3 py-2 text-xs font-bold"><option value="">All sources</option><option value="direct">Direct ATS</option><option value="fallback">Fallback sources</option></select></div>
          {error && <div role="alert" className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-900">{error}</div>}
        </section>

        {result && <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 text-xs"><div><span className="font-black">{result.total} jobs</span> · sources: {result.sources.join(', ') || 'none'}{result.partial ? ' · partial results' : ''}</div><a href="/job-intelligence" className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 font-black text-white"><Target className="h-4 w-4" /> Open Job Intelligence</a></div>

          <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
            <div className="space-y-3">
              {result.jobs.length ? result.jobs.map((job) => {
                const key = keyOf(job);
                const active = selected ? keyOf(selected) === key : false;
                return (
                  <button key={key} type="button" onClick={() => selectJob(job)} className={`w-full rounded-2xl border p-4 text-left transition ${active ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-[var(--shadow-lg)]' : 'border-[var(--surface-border)] bg-[var(--surface)] hover:border-[var(--accent)]'}`}>
                    <div className="flex items-start gap-3">
                      <CompanyMark company={job.company} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0"><p className="truncate text-[10px] font-black uppercase tracking-wide text-[var(--accent-strong)]">{job.company}</p><h2 className="mt-1 text-sm font-black md:text-base">{job.title}</h2></div>
                          {saved.includes(key) ? <BookmarkCheck className="h-4 w-4 shrink-0 text-[var(--accent-strong)]" /> : null}
                        </div>
                        <p className="mt-2 flex items-center gap-1 text-[11px] text-[var(--ink-soft)]"><MapPin className="h-3.5 w-3.5" /> {job.location || 'Location not stated'}</p>
                        <p className="mt-1 text-[11px] text-[var(--ink-soft)]">{job.salary || 'Not disclosed'} {job.posted ? `• ${job.posted}` : ''}</p>
                        <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full border border-[var(--surface-border)] px-2.5 py-1 text-[9px] font-black">{job.source}</span>{job.remote ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-900">Remote</span> : null}</div>
                      </div>
                    </div>
                  </button>
                );
              }) : <div className={`${panelClass} p-8 text-center text-sm text-[var(--ink-soft)]`}>No jobs matched these filters. Try a broader role title or remove the date/location filter.</div>}
            </div>

            <div id="job-detail-panel" className="scroll-mt-24 xl:sticky xl:top-28 xl:self-start">{selected ? <article className={`${panelClass} overflow-hidden`}>
              <div className="border-b border-[var(--surface-border)] p-5 md:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-4"><CompanyMark company={selected.company} size="lg" /><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wide text-[var(--accent-strong)]">{selected.company}</p><h2 className="mt-1 text-2xl font-black">{selected.title}</h2><p className="mt-2 text-xs text-[var(--ink-soft)]">{selected.location} {selected.posted ? `• ${selected.posted}` : ''}</p><p className="mt-1 text-xs font-bold">{selected.salary || 'Not disclosed'}</p></div></div><div className="flex gap-2"><button type="button" onClick={() => toggleSaved(selected)} className="flex items-center gap-2 rounded-xl border border-[var(--surface-border)] px-3 py-2.5 text-xs font-black">{saved.includes(keyOf(selected)) ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />} Save</button><a href={selected.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-xs font-black text-white">View job <ExternalLink className="h-4 w-4" /></a></div></div></div>
              <div className="space-y-5 p-5 md:p-6"><div className="flex flex-wrap gap-2 text-[10px] font-black"><span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-strong)] px-3 py-1.5">Source: {selected.source}</span>{selected.remote ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-900">Remote</span> : null}</div><div><h3 className="text-sm font-black">Role overview</h3><p className="mt-2 text-xs leading-7 text-[var(--ink-soft)]">{selected.description || 'Open the original job page for full details.'}</p></div>{selected.skills.length ? <div><h3 className="text-sm font-black">Role signals</h3><div className="mt-3 flex flex-wrap gap-2">{selected.skills.map((skill) => <span key={skill} className="rounded-full border border-[var(--surface-border)] bg-[var(--accent-soft)] px-3 py-1.5 text-[10px] font-black text-[var(--accent-strong)]">{skill}</span>)}</div></div> : null}<div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => analyseFit(selected)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-xs font-black text-white"><Sparkles className="h-4 w-4" /> Analyse my fit</button><a href={selected.link} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--surface-border)] px-4 text-xs font-black">Apply on source <ExternalLink className="h-4 w-4" /></a></div></div>
            </article> : null}</div>
          </section>
        </>}
      </div>

      {selected ? (
        <div className="fixed inset-x-3 bottom-[5.25rem] z-40 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-xl)] backdrop-blur xl:hidden">
          <div className="mb-2 flex items-center gap-2 px-1">
            <CompanyMark company={selected.company} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-black uppercase tracking-wide text-[var(--accent-strong)]">{selected.company}</p>
              <p className="truncate text-xs font-black">{selected.title}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a href={selected.link} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-3 text-xs font-black text-white">View job <ExternalLink className="h-4 w-4" /></a>
            <button type="button" onClick={() => analyseFit(selected)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-3 text-xs font-black"><Sparkles className="h-4 w-4" /> Analyse fit</button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
