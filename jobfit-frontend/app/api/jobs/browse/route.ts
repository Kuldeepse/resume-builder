import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ARBEITNOW_API = 'https://www.arbeitnow.com/api/job-board-api';
const REMOTE_OK_API = 'https://remoteok.com/api';
const MAX_RESULTS = 40;

type UnifiedJob = {
  title: string;
  company: string;
  location: string;
  salary: string;
  posted: string;
  description: string;
  skills: string[];
  link: string;
  remote: boolean;
  source: string;
  created_at?: number;
};

type ArbeitnowJob = {
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number;
};

type ArbeitnowResponse = { data?: ArbeitnowJob[] };

type RemoteOkJob = {
  id?: string | number;
  date_epoch?: number;
  company?: string;
  position?: string;
  description?: string;
  location?: string;
  url?: string;
  tags?: string[];
  salary?: string;
};

function cleanText(value: unknown, limit = 5000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function stripHtml(value: string) {
  return cleanText(value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '), 5000);
}

function postedLabel(createdAt?: number) {
  if (!createdAt) return '';
  const ageDays = Math.max(0, Math.floor((Date.now() / 1000 - createdAt) / 86400));
  if (ageDays === 0) return 'Today';
  if (ageDays === 1) return '1 day ago';
  return `${ageDays} days ago`;
}

function salaryFrom(text: string) {
  const match = text.match(/£\s?\d{2,3}(?:,\d{3})?(?:\s*(?:-|–|to)\s*£?\s?\d{2,3}(?:,\d{3})?)?/i);
  return match ? match[0].replace(/\s+/g, ' ') : 'Not disclosed';
}

function isUkRelevant(location: string, description: string, remote: boolean) {
  if (remote) return true;
  const text = `${location} ${description}`.toLowerCase();
  return ['united kingdom',' uk','uk ','england','scotland','wales','northern ireland','london','manchester','birmingham','bristol','leeds','liverpool','cardiff','edinburgh','glasgow','belfast','southampton','reading','cambridge','oxford','newcastle','nottingham','sheffield'].some((signal) => text.includes(signal));
}

async function fetchArbeitnow(): Promise<UnifiedJob[]> {
  const pages = await Promise.allSettled([1, 2, 3].map(async (page) => {
    const response = await fetch(`${ARBEITNOW_API}?page=${page}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 900 },
    });
    if (!response.ok) throw new Error(`Arbeitnow ${response.status}`);
    const payload = await response.json() as ArbeitnowResponse;
    return Array.isArray(payload.data) ? payload.data : [];
  }));

  return pages
    .filter((result): result is PromiseFulfilledResult<ArbeitnowJob[]> => result.status === 'fulfilled')
    .flatMap((result) => result.value)
    .map((job) => {
      const description = stripHtml(job.description || '');
      const location = cleanText(job.location || (job.remote ? 'Remote' : 'Europe'), 200);
      return {
        title: cleanText(job.title, 240),
        company: cleanText(job.company_name, 240),
        location,
        salary: salaryFrom(description),
        posted: postedLabel(job.created_at),
        description: description.slice(0, 2200),
        skills: Array.from(new Set([...(job.tags || []), ...(job.job_types || [])])).slice(0, 12),
        link: cleanText(job.url, 1600),
        remote: Boolean(job.remote),
        source: 'Arbeitnow',
        created_at: job.created_at,
      } satisfies UnifiedJob;
    })
    .filter((job) => job.title && job.company && job.link && isUkRelevant(job.location, job.description, job.remote));
}

async function fetchRemoteOk(): Promise<UnifiedJob[]> {
  const response = await fetch(REMOTE_OK_API, {
    headers: { Accept: 'application/json', 'User-Agent': 'CogniTwist/1.0' },
    next: { revalidate: 900 },
  });
  if (!response.ok) throw new Error(`Remote OK ${response.status}`);
  const payload = await response.json() as RemoteOkJob[];
  if (!Array.isArray(payload)) return [];

  return payload
    .filter((item) => item && item.position && item.company && item.url)
    .map((job) => {
      const description = stripHtml(job.description || '');
      return {
        title: cleanText(job.position, 240),
        company: cleanText(job.company, 240),
        location: cleanText(job.location || 'Remote / Worldwide', 200),
        salary: cleanText(job.salary, 240) || 'Not disclosed',
        posted: postedLabel(Number(job.date_epoch) || undefined),
        description: description.slice(0, 2200),
        skills: Array.isArray(job.tags) ? job.tags.slice(0, 12) : [],
        link: cleanText(job.url, 1600),
        remote: true,
        source: 'Remote OK',
        created_at: Number(job.date_epoch) || undefined,
      } satisfies UnifiedJob;
    });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = cleanText(url.searchParams.get('q'), 160).toLowerCase();
  const locationQuery = cleanText(url.searchParams.get('location'), 120).toLowerCase();
  const remoteOnly = url.searchParams.get('remote') === 'true';
  const sourceFilter = cleanText(url.searchParams.get('source'), 40).toLowerCase();
  const postedDays = Math.max(0, Math.min(90, Number(url.searchParams.get('days') || 0) || 0));

  const settled = await Promise.allSettled([fetchArbeitnow(), fetchRemoteOk()]);
  const sourceErrors = settled
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));

  const merged = settled
    .filter((result): result is PromiseFulfilledResult<UnifiedJob[]> => result.status === 'fulfilled')
    .flatMap((result) => result.value);

  const unique = new Map<string, UnifiedJob>();
  for (const job of merged) {
    const key = job.link || `${job.company}::${job.title}::${job.location}`.toLowerCase();
    if (!unique.has(key)) unique.set(key, job);
  }

  const now = Date.now() / 1000;
  const jobs = Array.from(unique.values())
    .filter((job) => {
      const haystack = `${job.title} ${job.company} ${job.description} ${job.skills.join(' ')}`.toLowerCase();
      if (query && !query.split(/\s+/).every((token) => haystack.includes(token))) return false;
      if (locationQuery && !job.remote && !job.location.toLowerCase().includes(locationQuery)) return false;
      if (remoteOnly && !job.remote) return false;
      if (sourceFilter && job.source.toLowerCase() !== sourceFilter) return false;
      if (postedDays && job.created_at && (now - job.created_at) / 86400 > postedDays) return false;
      return true;
    })
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
    .slice(0, MAX_RESULTS)
    .map(({ created_at, ...job }) => job);

  if (!jobs.length && merged.length === 0) {
    return NextResponse.json({ detail: `All free job sources are temporarily unavailable${sourceErrors.length ? `: ${sourceErrors.join(' | ')}` : '.'}` }, { status: 502 });
  }

  return NextResponse.json({
    jobs,
    total: jobs.length,
    sources: Array.from(new Set(merged.map((job) => job.source))),
    partial: sourceErrors.length > 0,
    source_errors: sourceErrors,
  });
}
