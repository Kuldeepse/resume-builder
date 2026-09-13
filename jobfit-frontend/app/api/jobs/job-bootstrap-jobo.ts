import type { IndexedMarketJob } from './job-market-index';

const APIFY_ACTOR_URL = 'https://api.apify.com/v2/actors/jobo~ats-jobs-api/run-sync-get-dataset-items';
const MAX_BENCHMARK_RESULTS = 100;
const MAX_BENCHMARK_CHARGE_USD = 0.25;

type JoboLocation = {
  location?: unknown;
  city?: unknown;
  region?: unknown;
  country?: unknown;
};

type JoboCompany = {
  name?: unknown;
  website?: unknown;
};

type JoboCompensation = {
  min?: unknown;
  max?: unknown;
  currency?: unknown;
  period?: unknown;
};

type JoboSkill = {
  name?: unknown;
  type?: unknown;
};

type JoboQualifications = {
  must_have?: { skills?: JoboSkill[] };
  preferred?: { skills?: JoboSkill[] };
};

type JoboJob = {
  id?: unknown;
  title?: unknown;
  normalized_title?: unknown;
  company?: JoboCompany | string;
  locations?: JoboLocation[];
  compensation?: JoboCompensation;
  employment_type?: unknown;
  workplace_type?: unknown;
  qualifications?: JoboQualifications;
  summary?: unknown;
  description?: unknown;
  listing_url?: unknown;
  apply_url?: unknown;
  source?: unknown;
  date_posted?: unknown;
  updated_at?: unknown;
};

export type JoboBenchmarkResult = {
  status: 'ok' | 'not_configured' | 'failed';
  jobs: IndexedMarketJob[];
  rawCount: number;
  durationMs: number;
  errorCode?: string;
};

function clean(value: unknown, limit = 4000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function safeHttpsUrl(value: unknown) {
  const candidate = clean(value, 1800);
  if (!candidate) return '';
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function locationText(locations: JoboLocation[] | undefined) {
  const values = (Array.isArray(locations) ? locations : [])
    .map((location) => clean(location.location, 240) || [location.city, location.region, location.country].map((value) => clean(value, 120)).filter(Boolean).join(', '))
    .filter(Boolean);
  return Array.from(new Set(values)).join(' · ') || 'Location not confirmed';
}

function companyName(company: JoboJob['company']) {
  if (typeof company === 'string') return clean(company, 300);
  return clean(company?.name, 300);
}

function salaryText(compensation: JoboCompensation | undefined) {
  if (!compensation) return 'Not disclosed';
  const minimum = Number(compensation.min || 0);
  const maximum = Number(compensation.max || 0);
  const currency = clean(compensation.currency, 20);
  const period = clean(compensation.period, 40);
  if (minimum && maximum) return `${currency ? `${currency} ` : ''}${minimum.toLocaleString()}–${maximum.toLocaleString()}${period ? ` / ${period}` : ''}`;
  if (minimum || maximum) return `${currency ? `${currency} ` : ''}${(minimum || maximum).toLocaleString()}${period ? ` / ${period}` : ''}`;
  return 'Not disclosed';
}

function skillsFrom(job: JoboJob) {
  const values = [
    ...(job.qualifications?.must_have?.skills || []),
    ...(job.qualifications?.preferred?.skills || []),
  ].map((skill) => clean(skill?.name, 120)).filter(Boolean);
  return Array.from(new Set(values)).slice(0, 12);
}

function mapJob(job: JoboJob): IndexedMarketJob | null {
  const title = clean(job.title || job.normalized_title, 300);
  const company = companyName(job.company);
  const link = safeHttpsUrl(job.listing_url || job.apply_url);
  if (!title || !company || !link) return null;
  const location = locationText(job.locations);
  const workplace = clean(job.workplace_type, 80);
  const source = clean(job.source, 80) || 'unknown_ats';
  return {
    title,
    company,
    location,
    salary: salaryText(job.compensation),
    posted: clean(job.date_posted || job.updated_at, 160),
    description: clean(job.description || job.summary, 2600),
    skills: skillsFrom(job),
    link,
    remote: /remote/i.test(`${workplace} ${location}`),
    source: `Bootstrap benchmark · Jobo · ${source}`,
    source_type: 'ats',
    direct: true,
  };
}

export async function benchmarkJobo(input: {
  query: string;
  location?: string;
  freshnessDays?: number;
  limit?: number;
}): Promise<JoboBenchmarkResult> {
  const token = clean(process.env.APIFY_TOKEN, 5000);
  if (!token) return { status: 'not_configured', jobs: [], rawCount: 0, durationMs: 0 };

  const startedAt = Date.now();
  const limit = Math.max(1, Math.min(MAX_BENCHMARK_RESULTS, Number(input.limit) || 100));
  const freshnessDays = Math.max(1, Math.min(90, Number(input.freshnessDays) || 14));
  const query = clean(input.query, 300);
  const location = clean(input.location, 200) || 'United Kingdom';

  try {
    const url = new URL(APIFY_ACTOR_URL);
    url.searchParams.set('clean', 'true');
    url.searchParams.set('maxItems', String(limit));
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('maxTotalChargeUsd', String(MAX_BENCHMARK_CHARGE_USD));

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(55000),
      body: JSON.stringify({
        queries: [query],
        locations: [location],
        posted_after: `${freshnessDays} days ago`,
        page_size: limit,
        page: 1,
        search_description: false,
        include_company_details: false,
      }),
    });

    if (!response.ok) {
      return {
        status: 'failed',
        jobs: [],
        rawCount: 0,
        durationMs: Date.now() - startedAt,
        errorCode: `apify_http_${response.status}`,
      };
    }

    const payload = (await response.json().catch(() => [])) as JoboJob[];
    const rawJobs = Array.isArray(payload) ? payload : [];
    const jobs = rawJobs.map(mapJob).filter((job): job is IndexedMarketJob => Boolean(job));
    return {
      status: 'ok',
      jobs,
      rawCount: rawJobs.length,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const name = error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'request_failed';
    return {
      status: 'failed',
      jobs: [],
      rawCount: 0,
      durationMs: Date.now() - startedAt,
      errorCode: name,
    };
  }
}
