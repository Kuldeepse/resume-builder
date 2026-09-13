import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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
  direct?: boolean;
};

type BrowsePayload = {
  jobs?: Job[];
  total?: number;
  sources?: string[];
  direct_count?: number;
  fallback_count?: number;
  partial?: boolean;
  source_errors?: string[];
  search_strategy?: string;
};

function cleanText(value: unknown, limit = 500) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeEmployer(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(limited|ltd|plc|incorporated|inc|llc|corp|corporation)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const incoming = new URL(request.url);
  const browseUrl = new URL('/api/jobs/browse', incoming.origin);

  for (const key of ['q', 'location', 'remote', 'days', 'source']) {
    const value = incoming.searchParams.get(key);
    if (value !== null) browseUrl.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(browseUrl, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  } catch {
    return NextResponse.json(
      { detail: 'Job Scout discovery sources are temporarily unavailable.' },
      { status: 502 },
    );
  }

  const payload = (await response.json().catch(() => null)) as BrowsePayload | { detail?: string } | null;
  if (!response.ok) {
    return NextResponse.json(
      { detail: 'Job Scout discovery sources are temporarily unavailable.' },
      { status: response.status >= 400 && response.status < 600 ? response.status : 502 },
    );
  }

  const browse = (payload || {}) as BrowsePayload;
  const jobs = Array.isArray(browse.jobs) ? browse.jobs : [];
  const directJobs = jobs.filter((job) => job.direct === true);
  const fallbackJobs = jobs.filter((job) => job.direct !== true);
  const observedSources = unique(jobs.map((job) => cleanText(job.source, 120)));
  const directSources = unique(directJobs.map((job) => cleanText(job.source, 120)));
  const fallbackSources = unique(fallbackJobs.map((job) => cleanText(job.source, 120)));
  const employers = unique(
    jobs
      .map((job) => normalizeEmployer(cleanText(job.company, 240)))
      .filter(Boolean),
  );

  const sourceErrorCount = Array.isArray(browse.source_errors) ? browse.source_errors.length : 0;
  const partial = Boolean(browse.partial) || sourceErrorCount > 0;
  const directShare = jobs.length ? Math.round((directJobs.length / jobs.length) * 100) : 0;

  const fallbackReasons: string[] = [];
  if (!jobs.length) fallbackReasons.push('No jobs were returned for this search.');
  if (partial) fallbackReasons.push('At least one configured discovery source did not respond successfully.');
  if (jobs.length > 0 && directJobs.length === 0) fallbackReasons.push('No direct employer/ATS roles were returned.');
  if (jobs.length > 0 && employers.length <= 1) fallbackReasons.push('Employer diversity is unusually narrow for this result set.');

  const sourceHealth: 'healthy' | 'degraded' | 'no_results' =
    !jobs.length ? 'no_results' : partial ? 'degraded' : 'healthy';

  return NextResponse.json({
    jobs,
    total: jobs.length,
    sources: observedSources,
    direct_count: directJobs.length,
    fallback_count: fallbackJobs.length,
    partial,
    source_errors: sourceErrorCount ? [`${sourceErrorCount} configured source${sourceErrorCount === 1 ? '' : 's'} unavailable for this run.`] : [],
    search_strategy: cleanText(browse.search_strategy, 500),
    telemetry: {
      run_id: crypto.randomUUID(),
      duration_ms: Date.now() - startedAt,
      roles_returned: jobs.length,
      unique_employers: employers.length,
      sources_observed: observedSources.length,
      direct_sources_observed: directSources.length,
      fallback_sources_observed: fallbackSources.length,
      direct_roles: directJobs.length,
      fallback_roles: fallbackJobs.length,
      direct_share_percent: directShare,
      source_error_count: sourceErrorCount,
      source_health: sourceHealth,
      fallback_recommended: fallbackReasons.length > 0,
      fallback_reasons: fallbackReasons,
      coverage_confidence: 'not_measured',
      coverage_note:
        'This telemetry measures the configured discovery run only. It does not claim complete market coverage or detect all false negatives yet.',
    },
  });
}
