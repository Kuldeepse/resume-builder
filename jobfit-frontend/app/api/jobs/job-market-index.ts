import { createHash } from 'node:crypto';
import { buildSupabaseRestHeaders } from '@/lib/supabase-rest.mjs';

export type IndexedMarketJob = {
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
  external_job_id?: string;
};

export type MarketRunPersistenceInput = {
  runId: string;
  lane: 'configured' | 'expanded' | 'crawler' | 'scheduled' | 'bootstrap' | 'other';
  query: string;
  location?: string;
  freshnessDays?: number;
  startedAt: number;
  completedAt?: number;
  jobs: IndexedMarketJob[];
  rolesReceived?: number;
  rolesRejected?: number;
  sourceHealth?: 'healthy' | 'degraded' | 'no_results' | 'unknown';
  sourceErrorCount?: number;
  coverageConfidence?: string;
  coverageNote?: string;
  metadata?: Record<string, unknown>;
};

export type MarketRunPersistenceResult = {
  status: 'persisted' | 'not_configured' | 'schema_unavailable' | 'failed';
  companies: number;
  canonicalJobs: number;
  observations: number;
  runId: string;
};

type SupabaseRow = Record<string, unknown>;

function clean(value: unknown, limit = 4000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function normalize(value: unknown) {
  return clean(value, 1000)
    .toLowerCase()
    .replace(/\b(limited|ltd|plc|incorporated|inc|llc|corp|corporation)\b/g, '')
    .replace(/\bprogramme\b/g, 'program')
    .replace(/\bcentre\b/g, 'center')
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLocation(value: unknown) {
  return normalize(value)
    .replace(/\b(remote|hybrid|onsite|on site|on-site)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hash(value: string, length = 40) {
  return createHash('sha256').update(value).digest('hex').slice(0, length);
}

function canonicalUrl(value: unknown) {
  const candidate = clean(value, 2000);
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

const SHARED_ATS_HOSTS = [
  'greenhouse.io',
  'lever.co',
  'ashbyhq.com',
  'myworkdayjobs.com',
  'smartrecruiters.com',
  'workable.com',
  'icims.com',
  'successfactors.com',
  'oraclecloud.com',
  'taleo.net',
  'indeed.com',
  'indeed.co.uk',
  'linkedin.com',
  'remoteok.com',
  'arbeitnow.com',
];

function canonicalCompanyDomain(link: unknown) {
  const url = canonicalUrl(link);
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    if (SHARED_ATS_HOSTS.some((atsHost) => host === atsHost || host.endsWith(`.${atsHost}`))) return null;
    return host;
  } catch {
    return null;
  }
}

function parseAbsolutePostedAt(value: unknown) {
  const posted = clean(value, 160);
  if (!posted || /\b(today|yesterday|ago|just posted)\b/i.test(posted)) return null;
  const parsed = Date.parse(posted);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function inferSourceType(job: IndexedMarketJob) {
  const explicit = clean(job.source_type, 80).toLowerCase();
  if (explicit) return explicit;
  const source = clean(job.source, 160).toLowerCase();
  if (source.includes('greenhouse') || source.includes('lever') || source.includes('ashby') || source.includes('ats')) return 'ats';
  if (job.direct) return 'employer_career';
  if (source.includes('fallback') || source.includes('remote ok') || source.includes('arbeitnow')) return 'aggregator';
  if (source.includes('grounded')) return 'indexed_job_source';
  return 'other';
}

function inferSourceName(job: IndexedMarketJob) {
  return clean(job.source, 160) || inferSourceType(job);
}

function companyIdentityKey(company: unknown) {
  const normalized = normalize(company);
  return normalized ? `company:${hash(normalized, 32)}` : '';
}

function vacancyFingerprint(job: IndexedMarketJob) {
  const link = canonicalUrl(job.link).toLowerCase();
  const employer = normalize(job.company);
  const title = normalize(job.title);
  const location = normalizeLocation(job.location) || 'location not confirmed';
  // Do not collapse independent requisitions just because employer/title/location match.
  // Source URLs/requisition URLs remain distinct canonical records. Cross-source semantic
  // clustering is intentionally a later, reversible search/ranking concern.
  return hash(`${employer}|${title}|${location}|${link}`, 48);
}

function observationIdentity(job: IndexedMarketJob) {
  const link = canonicalUrl(job.link).toLowerCase();
  const sourceType = inferSourceType(job);
  const sourceName = inferSourceName(job).toLowerCase();
  const externalId = clean(job.external_job_id, 300).toLowerCase();
  return hash(`${sourceType}|${sourceName}|${externalId || link}`, 48);
}

async function postRows(
  baseUrl: string,
  serviceKey: string,
  table: string,
  rows: SupabaseRow[],
  onConflict?: string,
) {
  if (!rows.length) return [] as SupabaseRow[];
  const params = new URLSearchParams({ select: '*' });
  if (onConflict) params.set('on_conflict', onConflict);
  const response = await fetch(`${baseUrl}/rest/v1/${table}?${params.toString()}`, {
    method: 'POST',
    headers: buildSupabaseRestHeaders(serviceKey, {
      accept: 'application/json',
      contentType: 'application/json',
      prefer: `${onConflict ? 'resolution=merge-duplicates,' : ''}return=representation`,
    }),
    body: JSON.stringify(rows),
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = new Error(`market_index_${table}_${response.status}`) as Error & { status?: number; detail?: string };
    error.status = response.status;
    error.detail = body.slice(0, 300);
    throw error;
  }

  const payload = (await response.json().catch(() => [])) as SupabaseRow[];
  return Array.isArray(payload) ? payload : [];
}

function isoFromEpochMs(value: number | undefined) {
  const epoch = Number(value || 0);
  return new Date(epoch > 0 ? epoch : Date.now()).toISOString();
}

export async function persistValidatedMarketRun(input: MarketRunPersistenceInput): Promise<MarketRunPersistenceResult> {
  const supabaseUrl = clean(process.env.SUPABASE_URL, 1000).replace(/\/$/, '');
  const serviceKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY, 5000);
  const emptyResult: MarketRunPersistenceResult = {
    status: 'not_configured',
    companies: 0,
    canonicalJobs: 0,
    observations: 0,
    runId: input.runId,
  };

  if (!supabaseUrl || !serviceKey) return emptyResult;

  const jobs = (Array.isArray(input.jobs) ? input.jobs : [])
    .map((job) => ({ ...job, link: canonicalUrl(job.link) }))
    .filter((job) => clean(job.company, 300) && clean(job.title, 300) && job.link);

  try {
    const employerGroups = new Map<string, { identityKey: string; canonicalName: string; normalizedName: string; canonicalDomain: string | null }>();
    for (const job of jobs) {
      const canonicalName = clean(job.company, 300);
      const normalizedName = normalize(canonicalName);
      if (!normalizedName) continue;
      const identityKey = companyIdentityKey(canonicalName);
      const existing = employerGroups.get(identityKey);
      employerGroups.set(identityKey, {
        identityKey,
        canonicalName: existing?.canonicalName || canonicalName,
        normalizedName,
        canonicalDomain: existing?.canonicalDomain || canonicalCompanyDomain(job.link),
      });
    }

    const nowIso = new Date().toISOString();
    const companyRows = Array.from(employerGroups.values()).map((company) => ({
      identity_key: company.identityKey,
      canonical_name: company.canonicalName,
      normalized_name: company.normalizedName,
      canonical_domain: company.canonicalDomain,
      status: 'active',
      last_seen_at: nowIso,
      metadata: { ingestion: 'job_scout_validated' },
    }));

    const companies = await postRows(supabaseUrl, serviceKey, 'market_companies', companyRows, 'identity_key');
    const companyIdByIdentity = new Map(
      companies
        .map((row) => [String(row.identity_key || ''), String(row.id || '')] as const)
        .filter(([identityKey, id]) => identityKey && id),
    );

    const uniqueEmployers = new Set(jobs.map((job) => normalize(job.company)).filter(Boolean));
    const runRows = await postRows(
      supabaseUrl,
      serviceKey,
      'market_discovery_runs',
      [{
        run_id: input.runId,
        lane: input.lane,
        query: clean(input.query, 300),
        location: clean(input.location, 200) || null,
        freshness_days: Number.isFinite(Number(input.freshnessDays)) ? Math.max(0, Math.min(90, Number(input.freshnessDays))) : null,
        status: (input.sourceErrorCount || 0) > 0 ? 'partial' : 'completed',
        started_at: isoFromEpochMs(input.startedAt),
        completed_at: isoFromEpochMs(input.completedAt || Date.now()),
        roles_received: Math.max(0, Number(input.rolesReceived ?? jobs.length) || 0),
        roles_validated: jobs.length,
        roles_rejected: Math.max(0, Number(input.rolesRejected || 0) || 0),
        unique_employers: uniqueEmployers.size,
        source_health: input.sourceHealth || (jobs.length ? 'healthy' : 'no_results'),
        source_error_count: Math.max(0, Number(input.sourceErrorCount || 0) || 0),
        coverage_confidence: clean(input.coverageConfidence, 160) || null,
        coverage_note: clean(input.coverageNote, 1000) || null,
        metadata: input.metadata || {},
      }],
      'run_id',
    );
    const discoveryRunId = String(runRows[0]?.id || '');

    const canonicalCandidates = new Map<string, SupabaseRow>();
    for (const job of jobs) {
      const employerCanonical = clean(job.company, 300);
      const fingerprint = vacancyFingerprint(job);
      const companyIdentity = companyIdentityKey(employerCanonical);
      const link = canonicalUrl(job.link);
      const sourceType = inferSourceType(job);
      const sourceName = inferSourceName(job);

      const existing = canonicalCandidates.get(fingerprint);
      if (existing && !job.direct) continue;

      canonicalCandidates.set(fingerprint, {
        fingerprint,
        company_id: companyIdByIdentity.get(companyIdentity) || null,
        employer_canonical: employerCanonical,
        title_canonical: clean(job.title, 300),
        location_canonical: clean(job.location, 240) || 'Location not confirmed',
        canonical_url: link,
        remote: Boolean(job.remote),
        salary_raw: clean(job.salary, 240) || null,
        description_excerpt: clean(job.description, 1400) || null,
        source_posted_at: parseAbsolutePostedAt(job.posted),
        last_seen_at: nowIso,
        last_validated_at: nowIso,
        status: 'active',
        freshness_reason: parseAbsolutePostedAt(job.posted) ? 'source_posted_at_confirmed' : 'validated_live_observation',
        latest_source_type: sourceType,
        latest_source_name: sourceName,
        metadata: {
          persisted_from: input.lane,
          direct: Boolean(job.direct),
          requisition_identity: clean(job.external_job_id, 300) || null,
          skills: Array.isArray(job.skills) ? job.skills.map((item) => clean(item, 120)).filter(Boolean).slice(0, 12) : [],
        },
      });
    }

    const canonicalJobs = await postRows(
      supabaseUrl,
      serviceKey,
      'market_canonical_jobs',
      Array.from(canonicalCandidates.values()),
      'fingerprint',
    );
    const canonicalIdByFingerprint = new Map(
      canonicalJobs
        .map((row) => [String(row.fingerprint || ''), String(row.id || '')] as const)
        .filter(([fingerprint, id]) => fingerprint && id),
    );

    const observationRows: SupabaseRow[] = [];
    for (const job of jobs) {
      const employerCanonical = clean(job.company, 300);
      const fingerprint = vacancyFingerprint(job);
      const canonicalJobId = canonicalIdByFingerprint.get(fingerprint);
      if (!canonicalJobId) continue;

      const link = canonicalUrl(job.link);
      const sourceType = inferSourceType(job);
      const sourceName = inferSourceName(job);
      const observationKey = observationIdentity(job);
      const companyIdentity = companyIdentityKey(employerCanonical);

      observationRows.push({
        observation_key: observationKey,
        canonical_job_id: canonicalJobId,
        company_source_id: null,
        discovery_run_id: discoveryRunId || null,
        source_type: sourceType,
        source_name: sourceName,
        source_url: link,
        external_job_id: clean(job.external_job_id, 300) || hash(link.toLowerCase(), 32),
        employer_raw: employerCanonical,
        employer_canonical: employerCanonical,
        title_raw: clean(job.title, 300),
        title_canonical: clean(job.title, 300),
        location_raw: clean(job.location, 240) || null,
        location_canonical: clean(job.location, 240) || 'Location not confirmed',
        job_url: link,
        salary_raw: clean(job.salary, 240) || null,
        posted_raw: clean(job.posted, 160) || null,
        source_posted_at: parseAbsolutePostedAt(job.posted),
        last_seen_at: nowIso,
        last_validated_at: nowIso,
        status: 'validated',
        validation_confidence: job.direct ? 1 : 0.9,
        rejection_reasons: [],
        metadata: {
          company_identity_key: companyIdentity,
          remote: Boolean(job.remote),
          direct: Boolean(job.direct),
        },
      });
    }

    const observations = await postRows(
      supabaseUrl,
      serviceKey,
      'market_job_source_observations',
      observationRows,
      'observation_key',
    );

    const sourceCounts = new Map<string, { sourceType: string; sourceName: string; count: number }>();
    for (const job of jobs) {
      const sourceType = inferSourceType(job);
      const sourceName = inferSourceName(job);
      const key = `${sourceType}|${sourceName}`;
      const current = sourceCounts.get(key);
      sourceCounts.set(key, { sourceType, sourceName, count: (current?.count || 0) + 1 });
    }

    await postRows(
      supabaseUrl,
      serviceKey,
      'market_source_health_events',
      Array.from(sourceCounts.values()).map((source) => ({
        discovery_run_id: discoveryRunId || null,
        source_type: source.sourceType,
        source_name: source.sourceName,
        status: input.sourceHealth === 'degraded' ? 'degraded' : source.count ? 'healthy' : 'no_results',
        jobs_observed: source.count,
        metadata: { lane: input.lane },
      })),
    );

    return {
      status: 'persisted',
      companies: companies.length,
      canonicalJobs: canonicalJobs.length,
      observations: observations.length,
      runId: input.runId,
    };
  } catch (error) {
    const typed = error as Error & { status?: number; detail?: string };
    const schemaUnavailable = typed.status === 404 || /42P01|PGRST205|schema cache|does not exist/i.test(typed.detail || typed.message || '');
    console.warn('Job market index persistence skipped:', typed.message);
    return {
      status: schemaUnavailable ? 'schema_unavailable' : 'failed',
      companies: 0,
      canonicalJobs: 0,
      observations: 0,
      runId: input.runId,
    };
  }
}
