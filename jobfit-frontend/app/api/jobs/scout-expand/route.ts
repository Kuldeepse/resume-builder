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

type ExpandedPayload = {
  jobs?: Job[];
  total?: number;
  passes?: string[];
  failed_passes?: string[];
  search_strategy?: string;
  coverage_confidence?: string;
  coverage_note?: string;
};

type CompatibilityPayload = {
  jobs?: Job[];
  search_mode?: string;
};

type DiscoveryBranch = {
  jobs: Job[];
  status: string;
  passesCompleted: string[];
  passesFailed: string[];
  partial: boolean;
  note: string;
  strategy: string;
};

function cleanText(value: unknown, limit = 1000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function roleVariants(value: string) {
  const base = cleanText(value, 300);
  if (!base) return [];

  const variants = [base];
  const add = (candidate: string) => {
    const cleaned = cleanText(candidate, 300);
    if (cleaned && !variants.some((item) => item.toLowerCase() === cleaned.toLowerCase())) variants.push(cleaned);
  };

  if (/\bprogram\b/i.test(base)) {
    add(base.replace(/\bprogram\b/i, 'programme'));
    add(base.replace(/\bprogram\b/i, 'project'));
  } else if (/\bprogramme\b/i.test(base)) {
    add(base.replace(/\bprogramme\b/i, 'program'));
    add(base.replace(/\bprogramme\b/i, 'project'));
  } else if (/\bproject\b/i.test(base)) {
    add(base.replace(/\bproject\b/i, 'program'));
    add(base.replace(/\bproject\b/i, 'programme'));
  }

  if (/^tpm$/i.test(base)) {
    add('Technical Program Manager');
    add('Technical Programme Manager');
    add('Technical Project Manager');
  }

  return variants.slice(0, 3);
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

function semanticKey(job: Job) {
  const norm = (value: unknown) => cleanText(value, 300).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return `${norm(job.company)}::${norm(job.title)}::${norm(job.location).replace(/\b(remote|hybrid|united kingdom|uk)\b/g, '').trim()}`;
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
    source: cleanText(job.source, 160) || 'Grounded · Expanded discovery',
    source_type: cleanText(job.source_type, 80),
    direct: Boolean(job.direct),
  };
}

function sanitiseJobs(jobs: Job[] | undefined, sourceOverride?: string) {
  return (Array.isArray(jobs) ? jobs : [])
    .map((job) => sanitiseJob(sourceOverride ? { ...job, source: sourceOverride, source_type: 'indexed_job_source', direct: false } : job))
    .filter((job): job is Job => Boolean(job))
    .slice(0, 120);
}

function mergeJobs(...sets: Job[][]) {
  const byUrl = new Map<string, Job>();
  const bySemantic = new Map<string, string>();

  for (const job of sets.flat()) {
    const url = canonicalUrl(job.link);
    if (!url) continue;
    const exactKey = url.toLowerCase();
    const semantic = semanticKey(job);
    const existing = byUrl.get(exactKey);
    if (existing) {
      if (job.direct && !existing.direct) byUrl.set(exactKey, job);
      continue;
    }

    const semanticUrl = semantic ? bySemantic.get(semantic) : undefined;
    if (semanticUrl) {
      const prior = byUrl.get(semanticUrl);
      if (prior && job.direct && !prior.direct) {
        byUrl.delete(semanticUrl);
        byUrl.set(exactKey, job);
        bySemantic.set(semantic, exactKey);
      }
      continue;
    }

    byUrl.set(exactKey, job);
    if (semantic) bySemantic.set(semantic, exactKey);
  }

  return Array.from(byUrl.values()).slice(0, 140);
}

async function runDedicated(backendBase: string, role: string, location: string, days: number): Promise<DiscoveryBranch> {
  const form = new FormData();
  form.append('target_role', role);
  form.append('location_city', location);
  form.append('freshness_days', String(days));
  form.append('max_jobs', '120');

  const response = await fetch(`${backendBase}/discover-market-jobs`, {
    method: 'POST',
    cache: 'no-store',
    signal: AbortSignal.timeout(45000),
    body: form,
    headers: { Accept: 'application/json' },
  });

  const payload = (await response.json().catch(() => null)) as ExpandedPayload | null;
  if (!response.ok || !payload) throw new Error(`dedicated_http_${response.status}`);
  const jobs = sanitiseJobs(payload.jobs);
  const failed = Array.isArray(payload.failed_passes) ? payload.failed_passes : [];

  return {
    jobs,
    status: jobs.length ? 'completed' : 'completed_zero_results',
    passesCompleted: Array.isArray(payload.passes) ? payload.passes : [],
    passesFailed: failed,
    partial: failed.length > 0,
    note: cleanText(payload.coverage_note, 800) || 'Expanded employer/ATS discovery completed.',
    strategy: cleanText(payload.search_strategy, 500) || 'dedicated expanded market discovery',
  };
}

async function runCompatibilityVariant(backendBase: string, role: string, location: string): Promise<Job[]> {
  const form = new FormData();
  form.append('target_role', role);
  form.append('location_city', location);
  form.append(
    'resume_skills',
    'MARKET DISCOVERY ONLY. No candidate profile is supplied. Discover current relevant vacancies broadly for the requested role and location. Do not narrow discovery using candidate evidence.',
  );

  const response = await fetch(`${backendBase}/search-jobs`, {
    method: 'POST',
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
    body: form,
    headers: { Accept: 'application/json' },
  });

  const payload = (await response.json().catch(() => null)) as CompatibilityPayload | null;
  if (!response.ok || !payload) throw new Error(`compatibility_http_${response.status}`);
  return sanitiseJobs(payload.jobs, 'Grounded · Compatibility Search');
}

async function runCompatibility(backendBase: string, role: string, location: string): Promise<DiscoveryBranch> {
  const variants = roleVariants(role);
  const settled = await Promise.allSettled(
    variants.map((variant) => runCompatibilityVariant(backendBase, variant, location)),
  );

  const jobs = mergeJobs(
    ...settled
      .filter((result): result is PromiseFulfilledResult<Job[]> => result.status === 'fulfilled')
      .map((result) => result.value),
  );
  const failedCount = settled.filter((result) => result.status === 'rejected').length;

  return {
    jobs,
    status: jobs.length ? 'compatibility_completed' : 'compatibility_zero_results',
    passesCompleted: variants.filter((_, index) => settled[index]?.status === 'fulfilled').map((variant) => `compatibility:${variant}`),
    passesFailed: variants.filter((_, index) => settled[index]?.status === 'rejected').map((variant) => `compatibility:${variant}`),
    partial: failedCount > 0,
    note: jobs.length
      ? `Compatibility discovery found ${jobs.length} grounded roles across equivalent role-title variants.`
      : 'Compatibility discovery completed without a verified additional role.',
    strategy: `grounded compatibility discovery across role variants: ${variants.join(' | ')}`,
  };
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const incoming = new URL(request.url);
  const role = cleanText(incoming.searchParams.get('q'), 300);
  const location = cleanText(incoming.searchParams.get('location'), 200);
  const requestedDays = Number(incoming.searchParams.get('days') || 14);
  const days = requestedDays === 0 ? 90 : Math.max(1, Math.min(90, requestedDays || 14));

  if (!role) return NextResponse.json({ detail: 'Enter a role, skill or company.' }, { status: 400 });

  const backendBase = (process.env.JOBFIT_BACKEND_URL || 'https://resume-builder-backend-ph7b.onrender.com').replace(/\/$/, '');
  const [dedicatedResult, compatibilityResult] = await Promise.allSettled([
    runDedicated(backendBase, role, location, days),
    runCompatibility(backendBase, role, location),
  ]);

  const dedicated = dedicatedResult.status === 'fulfilled' ? dedicatedResult.value : null;
  const compatibility = compatibilityResult.status === 'fulfilled' ? compatibilityResult.value : null;
  const jobs = mergeJobs(dedicated?.jobs || [], compatibility?.jobs || []);
  const passesCompleted = [...(dedicated?.passesCompleted || []), ...(compatibility?.passesCompleted || [])];
  const passesFailed = [
    ...(dedicated?.passesFailed || []),
    ...(compatibility?.passesFailed || []),
    ...(dedicatedResult.status === 'rejected' ? ['expanded_market'] : []),
    ...(compatibilityResult.status === 'rejected' ? ['compatibility_grounded'] : []),
  ];
  const partial = passesFailed.length > 0 || Boolean(dedicated?.partial) || Boolean(compatibility?.partial);

  if (jobs.length) {
    const dedicatedCount = dedicated?.jobs.length || 0;
    const compatibilityCount = compatibility?.jobs.length || 0;
    return NextResponse.json({
      jobs,
      total: jobs.length,
      partial,
      status: dedicatedCount ? 'completed' : 'compatibility_completed',
      duration_ms: Date.now() - startedAt,
      passes_completed: passesCompleted,
      passes_failed: passesFailed,
      search_strategy: [dedicated?.strategy, compatibility?.strategy].filter(Boolean).join(' | '),
      coverage_note: `Expanded discovery found ${jobs.length} verified role observations (${dedicatedCount} dedicated-market, ${compatibilityCount} compatibility before deduplication). Public Greenhouse, Lever and Ashby boards discovered by the dedicated lane are enumerated before results are returned.`,
    });
  }

  return NextResponse.json({
    jobs: [],
    total: 0,
    partial: true,
    status: 'expanded_no_verified_results',
    duration_ms: Date.now() - startedAt,
    passes_completed: passesCompleted,
    passes_failed: passesFailed.length ? passesFailed : ['expanded_market'],
    coverage_note: 'No additional role could be verified by the expanded stages in this run. This is not evidence that no matching vacancies exist.',
  });
}
