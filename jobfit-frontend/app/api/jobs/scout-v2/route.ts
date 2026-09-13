import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Job = {
  title?: string;
  company?: string;
  location?: string;
  salary?: string;
  posted?: string;
  description?: string;
  skills?: string[];
  link?: string;
  remote?: boolean;
  source?: string;
  source_type?: string;
  direct?: boolean;
};

type BaselinePayload = {
  jobs?: Job[];
  partial?: boolean;
  source_errors?: string[];
  search_strategy?: string;
};

type ExpandedPayload = {
  jobs?: Job[];
  total?: number;
  role_variants?: string[];
  passes?: string[];
  failed_passes?: string[];
  search_strategy?: string;
  coverage_confidence?: string;
  coverage_note?: string;
};

function cleanText(value: unknown, limit = 1000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function normalize(value: unknown) {
  return cleanText(value, 500)
    .toLowerCase()
    .replace(/\b(limited|ltd|plc|incorporated|inc|llc|corp|corporation)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalUrl(value: unknown) {
  const candidate = cleanText(value, 2000);
  if (!candidate) return '';
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return '';
    parsed.hash = '';
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (/^(utm_|gad_|gclid|gbraid|wbraid|source|src|ref)/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function jobKey(job: Job) {
  const url = canonicalUrl(job.link);
  if (url) return `url::${url.toLowerCase()}`;
  return `job::${normalize(job.company)}::${normalize(job.title)}::${normalize(job.location).replace(/\b(remote|hybrid)\b/g, '').trim()}`;
}

function semanticKey(job: Job) {
  return `${normalize(job.company)}::${normalize(job.title)}::${normalize(job.location).replace(/\b(remote|hybrid|united kingdom|uk)\b/g, '').trim()}`;
}

function sourcePriority(job: Job) {
  const sourceType = cleanText(job.source_type, 80).toLowerCase();
  const source = cleanText(job.source, 160).toLowerCase();
  if (sourceType === 'direct_employer' || source.includes('direct employer')) return 5;
  if (sourceType === 'ats' || source.includes('direct ·')) return 4;
  if (job.direct) return 3;
  if (source.includes('grounded')) return 2;
  return 1;
}

function sanitiseJob(job: Job): Job | null {
  const link = canonicalUrl(job.link);
  const title = cleanText(job.title, 300);
  const company = cleanText(job.company, 300);
  if (!link || !title || !company) return null;
  return {
    title,
    company,
    location: cleanText(job.location, 240) || 'Location not confirmed',
    salary: cleanText(job.salary, 240) || 'Not disclosed',
    posted: cleanText(job.posted, 160),
    description: cleanText(job.description, 2400),
    skills: Array.isArray(job.skills) ? job.skills.map((item) => cleanText(item, 120)).filter(Boolean).slice(0, 12) : [],
    link,
    remote: Boolean(job.remote),
    source: cleanText(job.source, 160) || 'Market discovery',
    source_type: cleanText(job.source_type, 80),
    direct: Boolean(job.direct),
  };
}

function mergeJobs(...sets: Job[][]) {
  const byExact = new Map<string, Job>();
  const bySemantic = new Map<string, string>();

  for (const raw of sets.flat()) {
    const job = sanitiseJob(raw);
    if (!job) continue;
    const exact = jobKey(job);
    const semantic = semanticKey(job);
    const existingExact = byExact.get(exact);
    if (existingExact) {
      if (sourcePriority(job) > sourcePriority(existingExact)) byExact.set(exact, job);
      continue;
    }

    const semanticExact = semantic ? bySemantic.get(semantic) : undefined;
    if (semanticExact) {
      const existing = byExact.get(semanticExact);
      if (existing && sourcePriority(job) > sourcePriority(existing)) {
        byExact.delete(semanticExact);
        byExact.set(exact, job);
        bySemantic.set(semantic, exact);
      }
      continue;
    }

    byExact.set(exact, job);
    if (semantic) bySemantic.set(semantic, exact);
  }
  return Array.from(byExact.values()).slice(0, 140);
}

function distinct(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function fetchBaseline(origin: string, search: string) {
  const response = await fetch(`${origin}/api/jobs/browse?${search}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(25000),
    headers: { Accept: 'application/json' },
  });
  const payload = (await response.json().catch(() => null)) as BaselinePayload | { detail?: string } | null;
  if (!response.ok) throw new Error('baseline_unavailable');
  return (payload || {}) as BaselinePayload;
}

async function fetchCompatibilityGrounded(backendBase: string, input: { role: string; location: string }) {
  const form = new FormData();
  form.append('target_role', input.role);
  form.append('location_city', input.location);
  form.append(
    'resume_skills',
    'MARKET DISCOVERY ONLY. No candidate profile is supplied. Discover relevant current vacancies broadly for the requested role and location; do not use candidate evidence to narrow discovery.',
  );

  const response = await fetch(`${backendBase}/search-jobs`, {
    method: 'POST',
    cache: 'no-store',
    signal: AbortSignal.timeout(35000),
    body: form,
    headers: { Accept: 'application/json' },
  });
  const payload = (await response.json().catch(() => null)) as { jobs?: Job[] } | null;
  if (!response.ok) throw new Error('compatibility_grounded_unavailable');
  const jobs = Array.isArray(payload?.jobs)
    ? payload.jobs.map((job) => ({
        ...job,
        source: 'Grounded · Compatibility Search',
        source_type: 'indexed_job_source',
        direct: false,
      }))
    : [];
  return {
    jobs,
    total: jobs.length,
    passes: ['compatibility_grounded'],
    failed_passes: [],
    search_strategy: 'compatibility grounded web discovery',
    coverage_confidence: 'expanded_compatibility',
    coverage_note: 'Compatibility grounded discovery expanded beyond configured feeds while the dedicated multi-pass market endpoint was unavailable.',
  } as ExpandedPayload;
}

async function fetchExpanded(input: { role: string; location: string; days: number }) {
  const backendBase = (process.env.JOBFIT_BACKEND_URL || 'https://resume-builder-backend-ph7b.onrender.com').replace(/\/$/, '');
  const form = new FormData();
  form.append('target_role', input.role);
  form.append('location_city', input.location);
  form.append('freshness_days', String(input.days));
  form.append('max_jobs', '120');

  try {
    const response = await fetch(`${backendBase}/discover-market-jobs`, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(50000),
      body: form,
      headers: { Accept: 'application/json' },
    });
    const payload = (await response.json().catch(() => null)) as ExpandedPayload | null;
    if (response.ok && payload) return payload;
  } catch {
    // Fall through to the already-deployed grounded-search compatibility path.
  }

  return fetchCompatibilityGrounded(backendBase, input);
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const incoming = new URL(request.url);
  const role = cleanText(incoming.searchParams.get('q'), 300);
  const location = cleanText(incoming.searchParams.get('location'), 200);
  const requestedDays = Number(incoming.searchParams.get('days') || 14);
  const days = requestedDays === 0 ? 90 : Math.max(1, Math.min(90, requestedDays || 14));

  if (!role) return NextResponse.json({ detail: 'Enter a role, skill or company.' }, { status: 400 });

  const forwarded = new URLSearchParams();
  for (const key of ['q', 'location', 'remote', 'days', 'source']) {
    const value = incoming.searchParams.get(key);
    if (value !== null) forwarded.set(key, value);
  }

  const [baselineResult, expandedResult] = await Promise.allSettled([
    fetchBaseline(incoming.origin, forwarded.toString()),
    fetchExpanded({ role, location, days }),
  ]);

  if (baselineResult.status === 'rejected' && expandedResult.status === 'rejected') {
    return NextResponse.json({ detail: 'Job Scout discovery sources are temporarily unavailable.' }, { status: 502 });
  }

  const baseline = baselineResult.status === 'fulfilled' ? baselineResult.value : ({} as BaselinePayload);
  const expanded = expandedResult.status === 'fulfilled' ? expandedResult.value : ({} as ExpandedPayload);
  const baselineJobs = Array.isArray(baseline.jobs) ? baseline.jobs : [];
  const expandedJobs = Array.isArray(expanded.jobs) ? expanded.jobs : [];
  const jobs = mergeJobs(baselineJobs, expandedJobs);

  const directJobs = jobs.filter((job) => job.direct === true);
  const fallbackJobs = jobs.filter((job) => job.direct !== true);
  const employers = distinct(jobs.map((job) => normalize(job.company)));
  const sources = distinct(jobs.map((job) => cleanText(job.source, 160)));
  const directSources = distinct(directJobs.map((job) => cleanText(job.source, 160)));
  const fallbackSources = distinct(fallbackJobs.map((job) => cleanText(job.source, 160)));
  const expandedFailedPasses = Array.isArray(expanded.failed_passes) ? expanded.failed_passes : [];
  const baselineErrors = Array.isArray(baseline.source_errors) ? baseline.source_errors : [];
  const sourceErrorCount = baselineErrors.length + expandedFailedPasses.length + (baselineResult.status === 'rejected' ? 1 : 0) + (expandedResult.status === 'rejected' ? 1 : 0);
  const partial = sourceErrorCount > 0;

  const coverageConfidence = expandedJobs.length
    ? (partial ? 'expanded_partial' : 'expanded')
    : 'configured_sources_only';

  const coverageNote = expandedJobs.length
    ? `Dynamic market discovery contributed ${expandedJobs.length} grounded observations before cross-lane deduplication. Role-family variants and four independent market lanes were searched.`
    : `Dynamic market discovery did not add results in this run. Coverage is limited to the configured feeds/ATS sources that responded.`;

  return NextResponse.json({
    jobs,
    total: jobs.length,
    sources,
    direct_count: directJobs.length,
    fallback_count: fallbackJobs.length,
    partial,
    source_errors: sourceErrorCount ? [`${sourceErrorCount} discovery component${sourceErrorCount === 1 ? '' : 's'} were unavailable or incomplete in this run.`] : [],
    search_strategy: 'parallel discovery: configured ATS/feeds + four-pass grounded employer/ATS/indexed-market discovery; role-family expansion; merged before candidate fit',
    expanded_discovery: {
      available: expandedResult.status === 'fulfilled',
      jobs_before_merge: expandedJobs.length,
      role_variants: Array.isArray(expanded.role_variants) ? expanded.role_variants : [],
      passes_completed: Array.isArray(expanded.passes) ? expanded.passes : [],
      passes_failed: expandedFailedPasses,
    },
    telemetry: {
      run_id: crypto.randomUUID(),
      duration_ms: Date.now() - startedAt,
      roles_returned: jobs.length,
      unique_employers: employers.length,
      sources_observed: sources.length,
      direct_sources_observed: directSources.length,
      fallback_sources_observed: fallbackSources.length,
      direct_roles: directJobs.length,
      fallback_roles: fallbackJobs.length,
      direct_share_percent: jobs.length ? Math.round((directJobs.length / jobs.length) * 100) : 0,
      source_error_count: sourceErrorCount,
      source_health: !jobs.length ? 'no_results' : partial ? 'degraded' : 'healthy',
      fallback_recommended: !jobs.length || partial || directJobs.length === 0 || employers.length <= 1,
      fallback_reasons: [
        ...(!jobs.length ? ['No jobs were returned after both discovery lanes.'] : []),
        ...(partial ? ['One or more discovery components were incomplete.'] : []),
        ...(jobs.length && directJobs.length === 0 ? ['No direct employer/ATS vacancies were returned.'] : []),
        ...(jobs.length && employers.length <= 1 ? ['Employer diversity remains unusually narrow.'] : []),
      ],
      coverage_confidence: coverageConfidence,
      coverage_note: coverageNote,
      configured_lane_roles: baselineJobs.length,
      expanded_lane_roles: expandedJobs.length,
    },
  });
}
