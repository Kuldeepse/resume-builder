import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

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

function cleanText(value: unknown, limit = 1000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
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
    .slice(0, 60);
}

async function runCompatibilityGrounded(backendBase: string, role: string, location: string) {
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
    signal: AbortSignal.timeout(12000),
    body: form,
    headers: { Accept: 'application/json' },
  });

  const payload = (await response.json().catch(() => null)) as CompatibilityPayload | null;
  if (!response.ok || !payload) throw new Error('compatibility_unavailable');
  return sanitiseJobs(payload.jobs, 'Grounded · Compatibility Search');
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const incoming = new URL(request.url);
  const role = cleanText(incoming.searchParams.get('q'), 300);
  const location = cleanText(incoming.searchParams.get('location'), 200);
  const days = Math.max(1, Math.min(90, Number(incoming.searchParams.get('days') || 14) || 14));

  if (!role) return NextResponse.json({ detail: 'Enter a role, skill or company.' }, { status: 400 });

  const backendBase = (process.env.JOBFIT_BACKEND_URL || 'https://resume-builder-backend-ph7b.onrender.com').replace(/\/$/, '');
  const form = new FormData();
  form.append('target_role', role);
  form.append('location_city', location);
  form.append('freshness_days', String(days));
  form.append('max_jobs', '60');

  let dedicatedStatus = 'not_attempted';

  try {
    const response = await fetch(`${backendBase}/discover-market-jobs`, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
      body: form,
      headers: { Accept: 'application/json' },
    });

    const payload = (await response.json().catch(() => null)) as ExpandedPayload | null;
    dedicatedStatus = response.ok && payload ? 'completed' : `http_${response.status}`;

    if (response.ok && payload) {
      const jobs = sanitiseJobs(payload.jobs);
      if (jobs.length) {
        return NextResponse.json({
          jobs,
          total: jobs.length,
          partial: Array.isArray(payload.failed_passes) && payload.failed_passes.length > 0,
          status: 'completed',
          duration_ms: Date.now() - startedAt,
          passes_completed: Array.isArray(payload.passes) ? payload.passes : [],
          passes_failed: Array.isArray(payload.failed_passes) ? payload.failed_passes : [],
          search_strategy: cleanText(payload.search_strategy, 500),
          coverage_note: cleanText(payload.coverage_note, 800) || 'Expanded employer/ATS discovery completed.',
        });
      }
      dedicatedStatus = 'completed_zero_results';
    }
  } catch {
    dedicatedStatus = 'timeout_or_unavailable';
  }

  try {
    const compatibilityJobs = await runCompatibilityGrounded(backendBase, role, location);
    if (compatibilityJobs.length) {
      return NextResponse.json({
        jobs: compatibilityJobs,
        total: compatibilityJobs.length,
        partial: true,
        status: 'compatibility_completed',
        duration_ms: Date.now() - startedAt,
        passes_completed: ['compatibility_grounded'],
        passes_failed: dedicatedStatus === 'completed_zero_results' ? [] : ['expanded_market'],
        search_strategy: 'grounded compatibility market discovery after dedicated expanded lane was unavailable or returned no verified roles',
        coverage_note: `Expanded fallback found ${compatibilityJobs.length} grounded roles. Wider market coverage is still being improved and should not be treated as exhaustive.`,
      });
    }
  } catch {
    // Return a safe empty result below. The fast configured lane remains independent.
  }

  return NextResponse.json({
    jobs: [],
    total: 0,
    partial: true,
    status: 'expanded_no_verified_results',
    duration_ms: Date.now() - startedAt,
    passes_completed: [],
    passes_failed: ['expanded_market'],
    coverage_note: 'No additional roles could be verified by the expanded discovery stage in this run. This does not mean no matching vacancies exist; retry or broaden the search while coverage continues to improve.',
  });
}
