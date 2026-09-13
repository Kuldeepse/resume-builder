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

function degradedBaseline(reason: string): BrowsePayload {
  return {
    jobs: [],
    partial: true,
    source_errors: [reason],
    search_strategy: 'configured-source lane degraded; expanded employer/ATS discovery should continue independently',
  };
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  const browsePromise = runBrowse(request)
    .then(async (response) => {
      if (!response.ok) return degradedBaseline('configured_lane_unavailable');
      return (await response.json().catch(() => degradedBaseline('configured_lane_invalid_response'))) as BrowsePayload;
    })
    .catch(() => degradedBaseline('configured_lane_unavailable'));

  const timeoutPromise = new Promise<BrowsePayload>((resolve) => {
    setTimeout(() => resolve(degradedBaseline('configured_lane_soft_timeout')), 12000);
  });

  const browse = await Promise.race([browsePromise, timeoutPromise]);
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
  if (!jobs.length) fallbackReasons.push('The fast configured-source pass returned no roles; expanded employer/ATS discovery is the next stage.');
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
      coverage_note: 'Fast configured-source results are returned within a bounded response window. A zero result from this first pass is not evidence that the wider market has no matching vacancies; CogniTwist expands employer and ATS coverage separately.',
      configured_lane_roles: jobs.length,
      expanded_lane_roles: 0,
    },
  });
}
