import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { GET as runBrowse } from '../browse/route';
import { benchmarkJobo } from '../job-bootstrap-jobo';
import { queryMarketIndex } from '../job-market-query';
import { validateJobsForSearch } from '../job-trust';
import type { IndexedMarketJob } from '../job-market-index';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type BrowsePayload = {
  jobs?: IndexedMarketJob[];
  partial?: boolean;
};

function clean(value: unknown, limit = 1000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function secureTokenMatch(supplied: string, expected: string) {
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function normalize(value: unknown) {
  return clean(value, 500)
    .toLowerCase()
    .replace(/\b(limited|ltd|plc|incorporated|inc|llc|corp|corporation)\b/g, '')
    .replace(/\bprogramme\b/g, 'program')
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalUrl(value: unknown) {
  const candidate = clean(value, 1800);
  if (!candidate) return '';
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return '';
    parsed.hash = '';
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (/^(utm_|gad_|gclid|gbraid|wbraid|source|src|ref)/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return '';
  }
}

function semanticKey(job: IndexedMarketJob) {
  return [normalize(job.company), normalize(job.title), normalize(job.location).replace(/\b(remote|hybrid|united kingdom|uk)\b/g, '').trim()].join('::');
}

function jobIdentityKeys(job: IndexedMarketJob) {
  const keys = new Set<string>();
  const url = canonicalUrl(job.link);
  if (url) keys.add(`url::${url}`);
  const semantic = semanticKey(job);
  if (semantic.replace(/:/g, '')) keys.add(`semantic::${semantic}`);
  return keys;
}

function buildIdentitySet(jobs: IndexedMarketJob[]) {
  const identities = new Set<string>();
  for (const job of jobs) {
    for (const key of jobIdentityKeys(job)) identities.add(key);
  }
  return identities;
}

function uniqueJobs(jobs: IndexedMarketJob[]) {
  const seen = new Set<string>();
  const result: IndexedMarketJob[] = [];
  for (const job of jobs) {
    const keys = Array.from(jobIdentityKeys(job));
    if (keys.some((key) => seen.has(key))) continue;
    keys.forEach((key) => seen.add(key));
    result.push(job);
  }
  return result;
}

export async function GET(request: NextRequest) {
  const expectedSecret = clean(process.env.CRON_SECRET, 500);
  if (!expectedSecret) {
    return NextResponse.json({ detail: 'Benchmark authentication is not configured.' }, { status: 503 });
  }
  const authorization = request.headers.get('authorization') || '';
  if (!secureTokenMatch(authorization, `Bearer ${expectedSecret}`)) {
    return NextResponse.json({ detail: 'Unauthorized.' }, { status: 401 });
  }

  const query = clean(request.nextUrl.searchParams.get('q'), 300);
  const location = clean(request.nextUrl.searchParams.get('location'), 200) || 'UK';
  const rawDays = Number(request.nextUrl.searchParams.get('days') || 14);
  const freshnessDays = Math.max(1, Math.min(90, Number.isFinite(rawDays) ? rawDays : 14));
  const rawLimit = Number(request.nextUrl.searchParams.get('limit') || 100);
  const limit = Math.max(1, Math.min(100, Number.isFinite(rawLimit) ? rawLimit : 100));
  if (!query) return NextResponse.json({ detail: 'Query is required.' }, { status: 400 });

  const browseUrl = new URL(request.url);
  browseUrl.pathname = '/api/jobs/browse';
  browseUrl.search = '';
  browseUrl.searchParams.set('q', query);
  browseUrl.searchParams.set('location', location);
  browseUrl.searchParams.set('days', String(freshnessDays));
  const browseRequest = new Request(browseUrl.toString(), { headers: { Accept: 'application/json' } });

  const [browseResult, indexResult, providerResult] = await Promise.allSettled([
    runBrowse(browseRequest).then(async (response) => (response.ok ? await response.json() as BrowsePayload : ({ jobs: [] } as BrowsePayload))),
    queryMarketIndex({ query, location, freshnessDays, limit: 150 }),
    benchmarkJobo({ query, location: location === 'UK' ? 'United Kingdom' : location, freshnessDays, limit }),
  ]);

  const liveJobs = browseResult.status === 'fulfilled' && Array.isArray(browseResult.value.jobs) ? browseResult.value.jobs : [];
  const indexedJobs = indexResult.status === 'fulfilled' ? indexResult.value.jobs : [];
  const provider = providerResult.status === 'fulfilled'
    ? providerResult.value
    : { status: 'failed' as const, jobs: [], rawCount: 0, durationMs: 0, errorCode: 'benchmark_failed' };

  if (provider.status === 'not_configured') {
    return NextResponse.json({
      detail: 'APIFY_TOKEN is not configured; no external benchmark was executed.',
      provider_status: provider.status,
      baseline: {
        live_jobs: liveJobs.length,
        indexed_jobs: indexedJobs.length,
      },
    }, { status: 424 });
  }

  const context = { query, location, freshnessDays };
  const validatedLive = validateJobsForSearch(liveJobs, context).accepted;
  const validatedIndex = validateJobsForSearch(indexedJobs, context).accepted;
  const providerValidation = validateJobsForSearch(provider.jobs, context);
  const validatedProvider = uniqueJobs(providerValidation.accepted);
  const baselineJobs = uniqueJobs([...validatedLive, ...validatedIndex]);
  const baselineIdentities = buildIdentitySet(baselineJobs);
  const additiveJobs = validatedProvider.filter((job) => !Array.from(jobIdentityKeys(job)).some((key) => baselineIdentities.has(key)));
  const additiveEmployers = new Set(additiveJobs.map((job) => normalize(job.company)).filter(Boolean));
  const providerEmployers = new Set(validatedProvider.map((job) => normalize(job.company)).filter(Boolean));

  return NextResponse.json({
    query,
    location,
    freshness_days: freshnessDays,
    provider: 'jobo_apify',
    provider_status: provider.status,
    provider_duration_ms: provider.durationMs,
    provider_error_code: provider.errorCode || null,
    results: {
      baseline_validated_jobs: baselineJobs.length,
      provider_raw_jobs: provider.rawCount,
      provider_mapped_jobs: provider.jobs.length,
      provider_validated_jobs: validatedProvider.length,
      provider_rejected_jobs: providerValidation.rejected.length,
      provider_unique_employers: providerEmployers.size,
      incremental_validated_jobs: additiveJobs.length,
      incremental_unique_employers: additiveEmployers.size,
      incremental_share_percent: validatedProvider.length ? Math.round((additiveJobs.length / validatedProvider.length) * 100) : 0,
    },
    sample_incremental_jobs: additiveJobs.slice(0, 20).map((job) => ({
      title: job.title,
      company: job.company,
      location: job.location,
      posted: job.posted,
      link: job.link,
      source: job.source,
    })),
    decision_note: 'Benchmark only. Provider results are never persisted or shown to users by this route. Promote a provider into ingestion only after repeated UK benchmark runs show material validated incremental recall with acceptable stale/duplicate rates.',
  });
}
