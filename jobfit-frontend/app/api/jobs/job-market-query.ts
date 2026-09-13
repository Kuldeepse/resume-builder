import { buildSupabaseRestHeaders } from '@/lib/supabase-rest.mjs';
import type { IndexedMarketJob } from './job-market-index';

export type MarketIndexQueryResult = {
  status: 'ok' | 'not_configured' | 'schema_unavailable' | 'failed';
  jobs: IndexedMarketJob[];
};

function clean(value: unknown, limit = 4000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

export async function queryMarketIndex(input: {
  query: string;
  location?: string;
  freshnessDays?: number;
  limit?: number;
}): Promise<MarketIndexQueryResult> {
  const supabaseUrl = clean(process.env.SUPABASE_URL, 1000).replace(/\/$/, '');
  const serviceKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY, 5000);
  if (!supabaseUrl || !serviceKey) return { status: 'not_configured', jobs: [] };

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/search_market_jobs`, {
      method: 'POST',
      headers: buildSupabaseRestHeaders(serviceKey, {
        accept: 'application/json',
        contentType: 'application/json',
      }),
      body: JSON.stringify({
        p_query: clean(input.query, 300),
        p_location: clean(input.location, 200) || null,
        p_freshness_days: Number.isFinite(Number(input.freshnessDays)) ? Math.max(0, Math.min(90, Number(input.freshnessDays))) : 14,
        p_limit: Math.max(1, Math.min(200, Number(input.limit) || 100)),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(1800),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      if (response.status === 404 || /42P01|42883|PGRST202|PGRST205|schema cache|does not exist/i.test(body)) {
        return { status: 'schema_unavailable', jobs: [] };
      }
      return { status: 'failed', jobs: [] };
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
    const jobs = (Array.isArray(rows) ? rows : []).map((row) => ({
      title: clean(row.title, 300),
      company: clean(row.company, 300),
      location: clean(row.location, 240) || 'Location not confirmed',
      salary: clean(row.salary, 240) || 'Not disclosed',
      posted: clean(row.posted, 160),
      description: clean(row.description, 2400),
      skills: [],
      link: clean(row.link, 1800),
      remote: Boolean(row.remote),
      source: `Index · ${clean(row.source, 140) || 'CogniTwist'}`,
      source_type: clean(row.source_type, 80) || 'market_index',
      direct: Boolean(row.direct),
    })).filter((job) => job.title && job.company && job.link);

    return { status: 'ok', jobs };
  } catch {
    return { status: 'failed', jobs: [] };
  }
}
