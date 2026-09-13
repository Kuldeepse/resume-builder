import { buildSupabaseRestHeaders } from '@/lib/supabase-rest.mjs';

export type MarketCompanySource = {
  id: string;
  company_id: string | null;
  source_key: string;
  source_type: string;
  source_name: string;
  source_url: string;
  source_host: string;
  external_source_key: string | null;
  coverage_scope: string | null;
  refresh_interval_minutes: number;
  status: string;
  last_scan_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  next_scan_at: string | null;
  consecutive_failures: number;
  metadata: Record<string, unknown>;
  company_name: string;
};

export type SourceRefreshOutcome = {
  source: MarketCompanySource;
  ok: boolean;
  jobsObserved: number;
  errorCode?: string;
};

function clean(value: unknown, limit = 3000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function config() {
  const supabaseUrl = clean(process.env.SUPABASE_URL, 1000).replace(/\/$/, '');
  const serviceKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY, 5000);
  return { supabaseUrl, serviceKey };
}

export async function loadDueMarketSources(limit = 25): Promise<{
  status: 'ok' | 'not_configured' | 'schema_unavailable' | 'failed';
  sources: MarketCompanySource[];
}> {
  const { supabaseUrl, serviceKey } = config();
  if (!supabaseUrl || !serviceKey) return { status: 'not_configured', sources: [] };

  const cappedLimit = Math.max(1, Math.min(50, Number(limit) || 25));
  const select = [
    'id',
    'company_id',
    'source_key',
    'source_type',
    'source_name',
    'source_url',
    'source_host',
    'external_source_key',
    'coverage_scope',
    'refresh_interval_minutes',
    'status',
    'last_scan_at',
    'last_success_at',
    'last_failure_at',
    'next_scan_at',
    'consecutive_failures',
    'metadata',
    'market_companies(canonical_name)',
  ].join(',');

  const params = new URLSearchParams({
    select,
    status: 'in.(active,degraded,unknown)',
    order: 'next_scan_at.asc.nullsfirst,created_at.asc',
    limit: String(cappedLimit),
  });

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/market_company_sources?${params.toString()}`, {
      method: 'GET',
      headers: buildSupabaseRestHeaders(serviceKey, { accept: 'application/json' }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      if (response.status === 404 || /42P01|PGRST205|schema cache|does not exist/i.test(body)) {
        return { status: 'schema_unavailable', sources: [] };
      }
      return { status: 'failed', sources: [] };
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
    const now = Date.now();
    const sources = rows
      .map((row) => {
        const companyRelation = row.market_companies as { canonical_name?: unknown } | null | undefined;
        return {
          id: clean(row.id, 80),
          company_id: clean(row.company_id, 80) || null,
          source_key: clean(row.source_key, 240),
          source_type: clean(row.source_type, 80),
          source_name: clean(row.source_name, 160),
          source_url: clean(row.source_url, 1800),
          source_host: clean(row.source_host, 300),
          external_source_key: clean(row.external_source_key, 300) || null,
          coverage_scope: clean(row.coverage_scope, 160) || null,
          refresh_interval_minutes: Math.max(15, Math.min(10080, Number(row.refresh_interval_minutes) || 360)),
          status: clean(row.status, 80),
          last_scan_at: clean(row.last_scan_at, 100) || null,
          last_success_at: clean(row.last_success_at, 100) || null,
          last_failure_at: clean(row.last_failure_at, 100) || null,
          next_scan_at: clean(row.next_scan_at, 100) || null,
          consecutive_failures: Math.max(0, Number(row.consecutive_failures) || 0),
          metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {},
          company_name: clean(companyRelation?.canonical_name, 300),
        } satisfies MarketCompanySource;
      })
      .filter((source) => source.source_key && source.source_url && source.company_name)
      .filter((source) => {
        if (!source.next_scan_at) return true;
        const next = Date.parse(source.next_scan_at);
        return !Number.isFinite(next) || next <= now;
      });

    return { status: 'ok', sources };
  } catch {
    return { status: 'failed', sources: [] };
  }
}

export async function saveSourceRefreshOutcomes(outcomes: SourceRefreshOutcome[]) {
  const { supabaseUrl, serviceKey } = config();
  if (!supabaseUrl || !serviceKey || !outcomes.length) return;

  const now = new Date();
  const rows = outcomes.map((outcome) => {
    const source = outcome.source;
    const failures = outcome.ok ? 0 : source.consecutive_failures + 1;
    const retryMinutes = outcome.ok
      ? source.refresh_interval_minutes
      : Math.min(source.refresh_interval_minutes, Math.max(30, 30 * Math.min(failures, 6)));
    const nextScan = new Date(now.getTime() + retryMinutes * 60_000).toISOString();

    return {
      company_id: source.company_id,
      source_key: source.source_key,
      source_type: source.source_type,
      source_name: source.source_name,
      source_url: source.source_url,
      source_host: source.source_host,
      external_source_key: source.external_source_key,
      coverage_scope: source.coverage_scope,
      refresh_interval_minutes: source.refresh_interval_minutes,
      status: outcome.ok ? 'active' : 'degraded',
      last_scan_at: now.toISOString(),
      last_success_at: outcome.ok ? now.toISOString() : source.last_success_at,
      last_failure_at: outcome.ok ? source.last_failure_at : now.toISOString(),
      next_scan_at: nextScan,
      consecutive_failures: failures,
      metadata: {
        ...source.metadata,
        last_jobs_observed: outcome.jobsObserved,
        last_error_code: outcome.errorCode || null,
      },
    };
  });

  try {
    await fetch(`${supabaseUrl}/rest/v1/market_company_sources?on_conflict=source_key`, {
      method: 'POST',
      headers: buildSupabaseRestHeaders(serviceKey, {
        accept: 'application/json',
        contentType: 'application/json',
        prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify(rows),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Source health is operational telemetry. A failed health write must not fail ingestion itself.
  }
}
