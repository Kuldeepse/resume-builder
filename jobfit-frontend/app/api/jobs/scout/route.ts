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

type WorkerObservation = {
  title?: string;
  company?: string;
  location?: string;
  salary?: string;
  posted?: string;
  description?: string;
  skills?: string[];
  link?: string;
  remote?: boolean;
  source_type?: string;
  source_name?: string;
  source_url?: string;
  external_job_id?: string;
  confidence?: number;
};

type WorkerPayload = {
  observations?: WorkerObservation[];
  pages_scanned?: number;
  candidate_pages?: number;
  crawl_errors?: number;
  duration_ms?: number;
  coverage_confidence?: string;
  note?: string;
};

type WorkerSeed = { url: string; employer?: string };

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

function buildWorkerSeeds(jobs: Job[]): WorkerSeed[] {
  const seeds = new Map<string, WorkerSeed>();
  for (const job of jobs) {
    if (job.direct !== true || !job.link) continue;
    try {
      const parsed = new URL(job.link);
      if (parsed.protocol !== 'https:') continue;
      const origin = parsed.origin;
      if (!seeds.has(origin)) {
        seeds.set(origin, { url: origin, employer: cleanText(job.company, 240) || undefined });
      }
    } catch {
      continue;
    }
    if (seeds.size >= 5) break;
  }
  return Array.from(seeds.values());
}

async function runFallbackWorker(input: {
  targetRole: string;
  location: string;
  days: number;
  seeds: WorkerSeed[];
  shouldRun: boolean;
}) {
  const workerBase = (process.env.MARKET_DISCOVERY_WORKER_URL || '').trim();
  const workerToken = (process.env.MARKET_DISCOVERY_WORKER_TOKEN || '').trim();
  const configured = Boolean(workerBase && workerToken);

  if (!input.shouldRun) {
    return { configured, invoked: false, status: 'not_required', observations: [] as WorkerObservation[] };
  }
  if (!configured) {
    return { configured: false, invoked: false, status: 'not_configured', observations: [] as WorkerObservation[] };
  }
  if (!input.seeds.length) {
    return { configured: true, invoked: false, status: 'no_safe_seed', observations: [] as WorkerObservation[] };
  }

  let endpoint: URL;
  try {
    const base = new URL(workerBase.endsWith('/') ? workerBase : `${workerBase}/`);
    if (base.protocol !== 'https:' || base.username || base.password) {
      return { configured: true, invoked: false, status: 'invalid_worker_url', observations: [] as WorkerObservation[] };
    }
    endpoint = new URL('discover', base);
  } catch {
    return { configured: true, invoked: false, status: 'invalid_worker_url', observations: [] as WorkerObservation[] };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(25000),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${workerToken}`,
      },
      body: JSON.stringify({
        target_role: input.targetRole,
        location: input.location,
        freshness_days: Math.max(1, Math.min(90, input.days || 14)),
        seeds: input.seeds,
        max_pages: 12,
        max_depth: 1,
      }),
    });

    if (!response.ok) {
      return { configured: true, invoked: true, status: `worker_http_${response.status}`, observations: [] as WorkerObservation[] };
    }

    const payload = (await response.json().catch(() => null)) as WorkerPayload | null;
    const observations = Array.isArray(payload?.observations) ? payload.observations.slice(0, 100) : [];
    return {
      configured: true,
      invoked: true,
      status: 'completed',
      observations,
      pages_scanned: Number(payload?.pages_scanned || 0),
      candidate_pages: Number(payload?.candidate_pages || observations.length),
      crawl_errors: Number(payload?.crawl_errors || 0),
      duration_ms: Number(payload?.duration_ms || 0),
      note: cleanText(payload?.note, 600),
    };
  } catch {
    return { configured: true, invoked: true, status: 'worker_unavailable', observations: [] as WorkerObservation[] };
  }
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
  const employers = unique(jobs.map((job) => normalizeEmployer(cleanText(job.company, 240))).filter(Boolean));

  const sourceErrorCount = Array.isArray(browse.source_errors) ? browse.source_errors.length : 0;
  const partial = Boolean(browse.partial) || sourceErrorCount > 0;
  const directShare = jobs.length ? Math.round((directJobs.length / jobs.length) * 100) : 0;

  const fallbackReasons: string[] = [];
  if (!jobs.length) fallbackReasons.push('No jobs were returned for this search.');
  if (partial) fallbackReasons.push('At least one configured discovery source did not respond successfully.');
  if (jobs.length > 0 && directJobs.length === 0) fallbackReasons.push('No direct employer/ATS roles were returned.');
  if (jobs.length > 0 && employers.length <= 1) fallbackReasons.push('Employer diversity is unusually narrow for this result set.');

  const sourceHealth: 'healthy' | 'degraded' | 'no_results' = !jobs.length ? 'no_results' : partial ? 'degraded' : 'healthy';
  const targetRole = cleanText(incoming.searchParams.get('q'), 300);
  const location = cleanText(incoming.searchParams.get('location'), 200);
  const days = Math.max(1, Math.min(90, Number(incoming.searchParams.get('days') || 14) || 14));
  const workerSeeds = buildWorkerSeeds(directJobs);
  const fallbackWorker = await runFallbackWorker({
    targetRole,
    location,
    days,
    seeds: workerSeeds,
    shouldRun: fallbackReasons.length > 0,
  });

  return NextResponse.json({
    jobs,
    total: jobs.length,
    sources: observedSources,
    direct_count: directJobs.length,
    fallback_count: fallbackJobs.length,
    partial,
    source_errors: sourceErrorCount ? [`${sourceErrorCount} configured source${sourceErrorCount === 1 ? '' : 's'} unavailable for this run.`] : [],
    search_strategy: cleanText(browse.search_strategy, 500),
    fallback_observations: fallbackWorker.observations,
    fallback_worker: {
      configured: fallbackWorker.configured,
      invoked: fallbackWorker.invoked,
      status: fallbackWorker.status,
      seed_count: workerSeeds.length,
      pages_scanned: 'pages_scanned' in fallbackWorker ? fallbackWorker.pages_scanned : 0,
      candidate_pages: 'candidate_pages' in fallbackWorker ? fallbackWorker.candidate_pages : 0,
      crawl_errors: 'crawl_errors' in fallbackWorker ? fallbackWorker.crawl_errors : 0,
      duration_ms: 'duration_ms' in fallbackWorker ? fallbackWorker.duration_ms : 0,
      note: 'note' in fallbackWorker ? fallbackWorker.note : '',
    },
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
        'This telemetry measures the configured discovery run only. Crawl4AI observations, when enabled, remain unverified candidates until canonicalisation, deduplication and freshness validation are complete.',
    },
  });
}
