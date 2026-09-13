import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { validateJobsForSearch } from '../job-trust';
import { persistValidatedMarketRun, type IndexedMarketJob } from '../job-market-index';
import { loadDueMarketSources, saveSourceRefreshOutcomes, type MarketCompanySource } from '../job-source-registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_SOURCES_PER_RUN = 25;
const MAX_JOBS_PER_SOURCE = 300;
const MAX_PERSISTED_JOBS_PER_RUN = 750;
const SUPPORTED_PROVIDERS = new Set(['greenhouse', 'ashby', 'lever']);

function clean(value: unknown, limit = 4000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function stripHtml(value: unknown, limit = 3000) {
  return clean(
    String(value ?? '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'"),
    limit,
  );
}

function secureTokenMatch(supplied: string, expected: string) {
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function providerFor(source: MarketCompanySource) {
  return clean(source.metadata?.provider, 80).toLowerCase();
}

function assertSupportedSourceUrl(source: MarketCompanySource, provider: string) {
  let parsed: URL;
  try {
    parsed = new URL(source.source_url);
  } catch {
    throw new Error('invalid_source_url');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('invalid_source_url');
  const host = parsed.hostname.toLowerCase();
  const allowed = provider === 'greenhouse'
    ? host === 'boards-api.greenhouse.io'
    : provider === 'ashby'
      ? host === 'api.ashbyhq.com'
      : provider === 'lever'
        ? host === 'api.lever.co' || host === 'api.eu.lever.co'
        : false;
  if (!allowed) throw new Error('source_host_not_allowed');
}

async function fetchJson(source: MarketCompanySource, provider: string) {
  assertSupportedSourceUrl(source, provider);
  const response = await fetch(source.source_url, {
    headers: { Accept: 'application/json', 'User-Agent': 'CogniTwist-MarketIndexer/1.0' },
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`source_http_${response.status}`);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > 8 * 1024 * 1024) throw new Error('source_payload_too_large');
  return response.json();
}

function salaryFromText(text: string) {
  const match = text.match(/£\s?\d{2,3}(?:,\d{3})?(?:\s*(?:-|–|to)\s*£?\s?\d{2,3}(?:,\d{3})?)?/i);
  return match ? match[0].replace(/\s+/g, ' ') : 'Not disclosed';
}

async function fetchGreenhouse(source: MarketCompanySource): Promise<IndexedMarketJob[]> {
  const payload = await fetchJson(source, 'greenhouse') as { jobs?: Array<Record<string, unknown>> };
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
  return jobs.slice(0, MAX_JOBS_PER_SOURCE).map((item) => {
    const content = stripHtml(item.content, 2600);
    const locationObject = item.location && typeof item.location === 'object' ? item.location as { name?: unknown } : {};
    const departments = Array.isArray(item.departments) ? item.departments : [];
    return {
      title: clean(item.title, 300),
      company: source.company_name,
      location: clean(locationObject.name, 240) || 'Location not confirmed',
      salary: salaryFromText(content),
      posted: clean(item.updated_at, 160),
      description: content,
      skills: departments
        .map((entry) => entry && typeof entry === 'object' ? clean((entry as { name?: unknown }).name, 120) : '')
        .filter(Boolean)
        .slice(0, 12),
      link: clean(item.absolute_url, 1800),
      remote: /remote/i.test(`${clean(locationObject.name, 240)} ${content.slice(0, 1000)}`),
      source: `Registry · Greenhouse · ${source.company_name}`,
      source_type: 'ats',
      direct: true,
    };
  }).filter((job) => job.title && job.link);
}

async function fetchAshby(source: MarketCompanySource): Promise<IndexedMarketJob[]> {
  const payload = await fetchJson(source, 'ashby') as { jobs?: Array<Record<string, unknown>> };
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
  return jobs
    .filter((item) => item.isListed !== false)
    .slice(0, MAX_JOBS_PER_SOURCE)
    .map((item) => {
      const description = clean(item.descriptionPlain || stripHtml(item.descriptionHtml, 2600), 2600);
      const compensation = item.compensation && typeof item.compensation === 'object'
        ? item.compensation as { scrapeableCompensationSalarySummary?: unknown; compensationTierSummary?: unknown }
        : {};
      const location = clean(item.location, 240) || 'Location not confirmed';
      return {
        title: clean(item.title, 300),
        company: source.company_name,
        location,
        salary: clean(compensation.scrapeableCompensationSalarySummary || compensation.compensationTierSummary, 240) || salaryFromText(description),
        posted: clean(item.publishedAt, 160),
        description,
        skills: [item.department, item.team, item.employmentType, item.workplaceType]
          .map((value) => clean(value, 120))
          .filter(Boolean),
        link: clean(item.applyUrl || item.jobUrl, 1800),
        remote: Boolean(item.isRemote) || /remote/i.test(`${location} ${clean(item.workplaceType, 120)}`),
        source: `Registry · Ashby · ${source.company_name}`,
        source_type: 'ats',
        direct: true,
      };
    })
    .filter((job) => job.title && job.link);
}

async function fetchLever(source: MarketCompanySource): Promise<IndexedMarketJob[]> {
  const payload = await fetchJson(source, 'lever') as Array<Record<string, unknown>>;
  if (!Array.isArray(payload)) return [];
  return payload.slice(0, MAX_JOBS_PER_SOURCE).map((item) => {
    const categories = item.categories && typeof item.categories === 'object'
      ? item.categories as { location?: unknown; team?: unknown; department?: unknown; commitment?: unknown }
      : {};
    const description = clean(item.descriptionPlain || stripHtml(item.description, 2600), 2600);
    const salary = item.salaryRange && typeof item.salaryRange === 'object'
      ? item.salaryRange as { currency?: unknown; min?: unknown; max?: unknown; interval?: unknown }
      : {};
    const minimum = Number(salary.min || 0);
    const maximum = Number(salary.max || 0);
    const currency = clean(salary.currency, 20);
    const salaryText = minimum && maximum
      ? `${currency || ''} ${Math.round(minimum).toLocaleString()}–${Math.round(maximum).toLocaleString()}${salary.interval ? ` / ${clean(salary.interval, 40).toLowerCase()}` : ''}`.trim()
      : salaryFromText(description);
    const createdAt = Number(item.createdAt || 0);
    const posted = createdAt > 0
      ? new Date(createdAt > 10_000_000_000 ? createdAt : createdAt * 1000).toISOString()
      : '';
    const location = clean(categories.location, 240) || 'Location not confirmed';
    return {
      title: clean(item.text, 300),
      company: source.company_name,
      location,
      salary: salaryText,
      posted,
      description,
      skills: [categories.team, categories.department, categories.commitment]
        .map((value) => clean(value, 120))
        .filter(Boolean),
      link: clean(item.applyUrl || item.hostedUrl, 1800),
      remote: /remote/i.test(`${location} ${clean(item.workplaceType, 120)}`),
      source: `Registry · Lever · ${source.company_name}`,
      source_type: 'ats',
      direct: true,
    };
  }).filter((job) => job.title && job.link);
}

async function fetchRegisteredSource(source: MarketCompanySource) {
  const provider = providerFor(source);
  if (provider === 'greenhouse') return fetchGreenhouse(source);
  if (provider === 'ashby') return fetchAshby(source);
  if (provider === 'lever') return fetchLever(source);
  throw new Error('unsupported_provider');
}

export async function GET(request: NextRequest) {
  const expectedSecret = clean(process.env.CRON_SECRET, 500);
  if (!expectedSecret) {
    return NextResponse.json({ detail: 'Market refresh authentication is not configured.' }, { status: 503 });
  }
  const authorization = request.headers.get('authorization') || '';
  const expectedHeader = `Bearer ${expectedSecret}`;
  if (!secureTokenMatch(authorization, expectedHeader)) {
    return NextResponse.json({ detail: 'Unauthorized.' }, { status: 401 });
  }

  const startedAt = Date.now();
  const runId = crypto.randomUUID();
  const registry = await loadDueMarketSources(MAX_SOURCES_PER_RUN);
  if (registry.status !== 'ok') {
    return NextResponse.json(
      { detail: 'Market source registry is not available.', registry_status: registry.status },
      { status: registry.status === 'not_configured' ? 503 : 424 },
    );
  }

  const structuredSources = registry.sources.filter((source) => SUPPORTED_PROVIDERS.has(providerFor(source)));
  const skippedUnsupported = registry.sources.length - structuredSources.length;
  const settled = await Promise.allSettled(structuredSources.map(async (source) => ({ source, jobs: await fetchRegisteredSource(source) })));

  const rawJobs: IndexedMarketJob[] = [];
  const outcomes = settled.map((result, index) => {
    const source = structuredSources[index];
    if (result.status === 'fulfilled') {
      rawJobs.push(...result.value.jobs);
      return { source, ok: true, jobsObserved: result.value.jobs.length };
    }
    const message = result.reason instanceof Error ? result.reason.message : 'source_failed';
    return { source, ok: false, jobsObserved: 0, errorCode: clean(message, 120) };
  });

  const trustGate = validateJobsForSearch(rawJobs, { query: '', location: 'UK', freshnessDays: 0 });
  const jobs = trustGate.accepted.slice(0, MAX_PERSISTED_JOBS_PER_RUN);
  const failedSources = outcomes.filter((outcome) => !outcome.ok).length;
  const sourceHealth = jobs.length === 0 && failedSources === 0 ? 'no_results' : failedSources ? 'degraded' : 'healthy';
  const coverageNote = `Scheduled registry refresh checked ${structuredSources.length} structured ATS source${structuredSources.length === 1 ? '' : 's'}, validated ${jobs.length} UK vacancy observations, rejected ${trustGate.rejected.length} untrusted observations, and skipped ${skippedUnsupported} source${skippedUnsupported === 1 ? '' : 's'} awaiting crawler/browser support.`;

  const persistence = await persistValidatedMarketRun({
    runId,
    lane: 'scheduled',
    query: '__registry_refresh__',
    location: 'UK',
    freshnessDays: 0,
    startedAt,
    completedAt: Date.now(),
    jobs,
    rolesReceived: rawJobs.length,
    rolesRejected: trustGate.rejected.length,
    sourceHealth,
    sourceErrorCount: failedSources,
    coverageConfidence: 'registry_structured_sources',
    coverageNote,
    metadata: {
      sources_due: registry.sources.length,
      structured_sources_checked: structuredSources.length,
      unsupported_sources_skipped: skippedUnsupported,
      result_cap: MAX_PERSISTED_JOBS_PER_RUN,
    },
  });

  await saveSourceRefreshOutcomes(outcomes);

  return NextResponse.json({
    ok: persistence.status === 'persisted',
    run_id: runId,
    duration_ms: Date.now() - startedAt,
    registry_status: registry.status,
    sources_due: registry.sources.length,
    structured_sources_checked: structuredSources.length,
    sources_failed: failedSources,
    unsupported_sources_skipped: skippedUnsupported,
    roles_received: rawJobs.length,
    roles_validated: jobs.length,
    roles_rejected: trustGate.rejected.length,
    persistence_status: persistence.status,
    coverage_note: coverageNote,
  });
}
