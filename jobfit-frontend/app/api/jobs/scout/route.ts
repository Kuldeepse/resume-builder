import { NextResponse } from 'next/server';
import { GET as runBrowse } from '../browse/route';

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
  direct?: boolean;
};

type BrowsePayload = {
  jobs?: Job[];
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

function normalizeEmployer(value: unknown) {
  return cleanText(value, 240)
    .toLowerCase()
    .replace(/\b(limited|ltd|plc|incorporated|inc|llc|corp|corporation)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function roleVariants(value: string) {
  const base = cleanText(value, 160);
  if (!base) return [];

  const variants = [base];
  const add = (candidate: string) => {
    const cleaned = cleanText(candidate, 160);
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

function jobKey(job: Job) {
  const link = cleanText(job.link, 2000);
  if (link) {
    try {
      const parsed = new URL(link);
      parsed.hash = '';
      return `url::${parsed.toString().replace(/\/$/, '').toLowerCase()}`;
    } catch {
      // Fall through to semantic identity.
    }
  }
  const norm = (input: unknown) => cleanText(input, 300).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return `job::${norm(job.company)}::${norm(job.title)}::${norm(job.location).replace(/\b(remote|hybrid|united kingdom|uk)\b/g, '').trim()}`;
}

function mergePayloads(payloads: BrowsePayload[], variants: string[], timedOut = false): BrowsePayload {
  const jobs = new Map<string, Job>();
  const errors: string[] = [];
  const strategies: string[] = [];
  let partial = timedOut;

  for (const payload of payloads) {
    if (Array.isArray(payload.jobs)) {
      for (const job of payload.jobs) {
        const key = jobKey(job);
        const existing = jobs.get(key);
        if (!existing || (job.direct === true && existing.direct !== true)) jobs.set(key, job);
      }
    }
    if (Array.isArray(payload.source_errors)) errors.push(...payload.source_errors.map((item) => cleanText(item, 300)));
    if (payload.search_strategy) strategies.push(cleanText(payload.search_strategy, 300));
    partial = partial || Boolean(payload.partial);
  }

  if (timedOut) errors.push('configured_lane_soft_timeout');

  return {
    jobs: Array.from(jobs.values()),
    partial,
    source_errors: unique(errors),
    search_strategy: `${unique(strategies).join(' | ') || 'configured-source search'}; role variants: ${variants.join(' | ')}`,
  };
}

function degradedBaseline(reason: string): BrowsePayload {
  return {
    jobs: [],
    partial: true,
    source_errors: [reason],
    search_strategy: 'configured-source lane degraded; expanded employer/ATS discovery should continue independently',
  };
}

async function runFastConfiguredSearch(request: Request, variants: string[]): Promise<BrowsePayload> {
  if (!variants.length) return degradedBaseline('missing_query');

  return new Promise((resolve) => {
    const payloads: BrowsePayload[] = [];
    let completed = 0;
    let settled = false;

    const finish = (timedOut: boolean) => {
      if (settled) return;
      settled = true;
      resolve(mergePayloads(payloads, variants, timedOut));
    };

    const timer = setTimeout(() => finish(true), 12000);

    for (const variant of variants) {
      const url = new URL(request.url);
      url.searchParams.set('q', variant);
      const aliasRequest = new Request(url.toString(), { method: 'GET', headers: { Accept: 'application/json' } });

      runBrowse(aliasRequest)
        .then(async (response) => {
          if (!response.ok) return degradedBaseline(`configured_lane_${response.status}`);
          return (await response.json().catch(() => degradedBaseline('configured_lane_invalid_response'))) as BrowsePayload;
        })
        .catch(() => degradedBaseline('configured_lane_unavailable'))
        .then((payload) => {
          payloads.push(payload);
          completed += 1;
          if (completed === variants.length) {
            clearTimeout(timer);
            finish(false);
          }
        });
    }
  });
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const incoming = new URL(request.url);
  const variants = roleVariants(incoming.searchParams.get('q') || '');
  const browse = await runFastConfiguredSearch(request, variants);
  const jobs = Array.isArray(browse.jobs) ? browse.jobs : [];
  const directJobs = jobs.filter((job) => job.direct === true);
  const fallbackJobs = jobs.filter((job) => job.direct !== true);
  const sources = unique(jobs.map((job) => cleanText(job.source, 160)));
  const directSources = unique(directJobs.map((job) => cleanText(job.source, 160)));
  const fallbackSources = unique(fallbackJobs.map((job) => cleanText(job.source, 160)));
  const employers = unique(jobs.map((job) => normalizeEmployer(job.company)));
  const sourceErrorCount = Array.isArray(browse.source_errors) ? browse.source_errors.length : 0;
  const partial = Boolean(browse.partial) || sourceErrorCount > 0;

  const fallbackReasons: string[] = [];
  if (!jobs.length) fallbackReasons.push('The fast source pass has not produced a verified role yet; expanded employer/ATS discovery is continuing automatically.');
  if (partial) fallbackReasons.push('At least one configured discovery source was incomplete or exceeded the fast-response budget.');
  if (jobs.length > 0 && directJobs.length === 0) fallbackReasons.push('No direct employer/ATS vacancies were returned yet.');
  if (jobs.length > 0 && employers.length <= 1) fallbackReasons.push('Employer diversity is narrow; expanded discovery is required.');

  return NextResponse.json({
    jobs,
    total: jobs.length,
    sources,
    direct_count: directJobs.length,
    fallback_count: fallbackJobs.length,
    partial,
    source_errors: sourceErrorCount
      ? [`${sourceErrorCount} configured discovery component${sourceErrorCount === 1 ? '' : 's'} were incomplete for the fast pass.`]
      : [],
    search_strategy: cleanText(browse.search_strategy, 500),
    query_variants: variants,
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
      fallback_recommended: true,
      fallback_reasons: fallbackReasons.length
        ? fallbackReasons
        : ['Expanded employer/ATS discovery is running separately to improve market recall.'],
      coverage_confidence: 'configured_sources_only',
      coverage_note: 'The fast lane now searches equivalent program/programme/project manager role-family variants before the expanded market stage. A zero first-pass result still does not mean the wider market has no matching vacancies.',
      configured_lane_roles: jobs.length,
      expanded_lane_roles: 0,
    },
  });
}
