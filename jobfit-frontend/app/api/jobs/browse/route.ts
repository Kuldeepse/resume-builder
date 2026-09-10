import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ARBEITNOW_API = 'https://www.arbeitnow.com/api/job-board-api';
const REMOTE_OK_API = 'https://remoteok.com/api';
const EQUINIX_UK_API = 'https://careers.equinix.com/operations-UK';
const MAX_RESULTS = 60;

const GREENHOUSE_BOARDS = [
  ['Rightmove', 'rightmovecareers'],
  ['Bondsmith', 'bondsmith'],
  ['Capital on Tap', 'capitalontap'],
  ['Modulr', 'modulrfinance'],
  ['Blacklane', 'blacklane'],
  ['Speechmatics', 'speechmatics'],
  ['Capco', 'capco'],
  ['Yondr', 'yondrgroup'],
] as const;

const ASHBY_BOARDS = [
  ['Partly', 'partly.com'],
  ['Orbital', 'orbital'],
  ['Heron Data', 'herondata'],
  ['Freetrade', 'freetrade'],
  ['Elliptic', 'Elliptic'],
  ['Ema', 'ema'],
  ['Swap', 'swap'],
  ['Antithesis', 'antithesis'],
] as const;

const LEVER_SITES = [
  ['Lyra Health', 'lyrahealth'],
  ['OpenPayd', 'OpenPayd'],
  ['Serverfarm', 'serverfarm'],
] as const;

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
  direct: boolean;
  created_at?: number;
  priority: number;
};

type GreenhouseJob = {
  title?: string;
  content?: string;
  absolute_url?: string;
  updated_at?: string;
  location?: { name?: string };
  departments?: Array<{ name?: string }>;
};

type AshbyJob = {
  title?: string;
  location?: string;
  isRemote?: boolean;
  workplaceType?: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
  publishedAt?: string;
  employmentType?: string;
  department?: string;
  team?: string;
  jobUrl?: string;
  applyUrl?: string;
  isListed?: boolean;
  compensation?: {
    compensationTierSummary?: string;
    scrapeableCompensationSalarySummary?: string;
  };
};

type LeverJob = {
  text?: string;
  descriptionPlain?: string;
  description?: string;
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  categories?: {
    location?: string;
    commitment?: string;
    team?: string;
    department?: string;
  };
  workplaceType?: string;
  salaryRange?: {
    currency?: string;
    min?: number;
    max?: number;
    interval?: string;
  };
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
  return cleanText(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'"),
    5000,
  );
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/data\s*centre/g, 'data center')
    .replace(/datacentre/g, 'data center')
    .replace(/datacenter/g, 'data center')
    .replace(/\s+/g, ' ')
    .trim();
}

function toEpoch(value?: string | number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value > 10_000_000_000 ? Math.floor(value / 1000) : value;
  if (!value) return undefined;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : undefined;
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

function leverSalary(range?: LeverJob['salaryRange']) {
  if (!range || !range.min || !range.max) return 'Not disclosed';
  const symbol = range.currency === 'GBP' ? '£' : `${range.currency || ''} `;
  return `${symbol}${Math.round(range.min).toLocaleString()}–${symbol}${Math.round(range.max).toLocaleString()}${range.interval ? ` / ${range.interval.toLowerCase()}` : ''}`;
}

const UK_LOCATION_SIGNALS = [
  'united kingdom',' uk','uk ','england','scotland','wales','northern ireland','london','manchester','birmingham','bristol','leeds','liverpool','cardiff','edinburgh','glasgow','belfast','southampton','reading','cambridge','oxford','newcastle','nottingham','sheffield','milton keynes','slough','farnborough','portsmouth','guildford','croydon','watford','maidenhead','woking','york','derby','coventry','exeter','bath','brighton','chester','aberdeen','dundee','swansea','newport','feltham','crawley'
];

const REMOTE_UK_COMPATIBLE = ['remote','worldwide','global','europe','emea','united kingdom',' uk','uk ','england','scotland','wales','northern ireland'];
const US_LOCATION_SIGNALS = [' usa','usa ','united states',' u.s.',' us ','california','new york','texas','virginia','florida','washington','massachusetts','illinois','colorado','georgia','arizona','north carolina','south carolina','pennsylvania','ohio','michigan','oregon','maryland','tennessee'];
const US_STATE_CODES = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC']);

function containsAny(text: string, signals: string[]) {
  const padded = ` ${text.toLowerCase()} `;
  return signals.some((signal) => padded.includes(signal));
}

function hasUsStateCode(location: string) {
  const matches = location.toUpperCase().match(/(?:^|,|\s)([A-Z]{2})(?=\s|,|$)/g) || [];
  return matches.some((match) => US_STATE_CODES.has(match.replace(/[^A-Z]/g, '')));
}

function isUsLocation(location: string) {
  return containsAny(location, US_LOCATION_SIGNALS) || hasUsStateCode(location);
}

function isUkRelevant(location: string, description: string, remote: boolean) {
  const locationText = location.toLowerCase();
  if (containsAny(locationText, UK_LOCATION_SIGNALS)) return true;
  if (isUsLocation(locationText)) return false;
  if (remote) return true;
  const descriptionText = description.toLowerCase();
  return containsAny(descriptionText, UK_LOCATION_SIGNALS);
}

function locationMatches(job: UnifiedJob, requestedLocation: string) {
  const requested = normalizeSearch(requestedLocation);
  if (!requested) return true;
  const location = normalizeSearch(job.location);

  if (requested === 'uk' || requested === 'united kingdom') {
    if (containsAny(location, UK_LOCATION_SIGNALS)) return true;
    if (isUsLocation(job.location)) return false;
    if (job.remote && containsAny(location || 'remote', REMOTE_UK_COMPATIBLE)) return true;
    return false;
  }

  if (location.includes(requested)) return true;
  if (job.remote && requested === 'remote') return true;
  return false;
}

const DATA_CENTER_TITLE_SIGNALS = [
  'facility','facilities','infrastructure','operations','engineer','engineering','technician','technical','electrical','mechanical','controls','site','shift','construction','commissioning','project','programme','program','capacity','network','security','manager','director','supervisor'
];
const DATA_CENTER_EMPLOYERS = new Set(['yondr','serverfarm','equinix']);

function queryRelevance(job: UnifiedJob, rawQuery: string) {
  const query = normalizeSearch(rawQuery);
  if (!query) return 1;

  const title = normalizeSearch(job.title);
  const company = normalizeSearch(job.company);
  const skills = normalizeSearch(job.skills.join(' '));
  const description = normalizeSearch(job.description);
  const tokens = query.split(/\s+/).filter(Boolean);
  const titleSkill = `${title} ${skills}`;
  const titleHits = tokens.filter((token) => title.includes(token)).length;
  const titleSkillHits = tokens.filter((token) => titleSkill.includes(token)).length;
  const descriptionHits = tokens.filter((token) => description.includes(token)).length;

  let score = 0;
  if (title.includes(query)) score += 120;
  if (company.includes(query)) score += 110;
  if (skills.includes(query)) score += 80;
  if (tokens.length && titleHits === tokens.length) score += 90;
  else if (tokens.length > 1 && titleHits >= Math.ceil(tokens.length * 0.67)) score += 55;
  if (tokens.length && titleSkillHits === tokens.length) score += 45;

  const dataCenterQuery = query.includes('data center');
  if (dataCenterQuery) {
    const domainText = `${title} ${skills} ${description}`;
    const explicitDomain = /(data center|critical facilities|data hall|hyperscale|colocation|mission critical)/.test(domainText);
    const roleSignal = DATA_CENTER_TITLE_SIGNALS.some((signal) => title.includes(signal));
    const requestedRoleTokens = tokens.filter((token) => !['data','center','centre'].includes(token));
    const requestedRoleMatch = requestedRoleTokens.length === 0 || requestedRoleTokens.some((token) => title.includes(token));

    if (/(data center|critical facilities|data hall)/.test(title)) score += 160;
    else if (explicitDomain && roleSignal && requestedRoleMatch) score += 85;
    else if (DATA_CENTER_EMPLOYERS.has(company) && roleSignal && requestedRoleMatch) score += 65;
  }

  if (score === 0 && tokens.length === 1 && (title.includes(tokens[0]) || skills.includes(tokens[0]))) score = 50;
  if (score > 0 && descriptionHits === tokens.length) score += 10;

  return score;
}

async function fetchGreenhouse(company: string, board: string): Promise<UnifiedJob[]> {
  const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`, { headers: { Accept: 'application/json' }, next: { revalidate: 1800 } });
  if (!response.ok) throw new Error(`Greenhouse ${company} ${response.status}`);
  const payload = await response.json() as { jobs?: GreenhouseJob[] };
  return (payload.jobs || []).map((job) => {
    const description = stripHtml(job.content || '');
    const location = cleanText(job.location?.name || 'Location not stated', 200);
    const createdAt = toEpoch(job.updated_at);
    return {
      title: cleanText(job.title, 240), company, location,
      salary: salaryFrom(description), posted: postedLabel(createdAt), description: description.slice(0, 2400),
      skills: (job.departments || []).map((item) => cleanText(item.name, 120)).filter(Boolean).slice(0, 8),
      link: cleanText(job.absolute_url, 1600), remote: /remote/i.test(location), source: 'Direct · Greenhouse', direct: true,
      created_at: createdAt, priority: 3,
    };
  }).filter((job) => job.title && job.link && isUkRelevant(job.location, job.description, job.remote));
}

async function fetchAshby(company: string, board: string): Promise<UnifiedJob[]> {
  const response = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}?includeCompensation=true`, { headers: { Accept: 'application/json' }, next: { revalidate: 1800 } });
  if (!response.ok) throw new Error(`Ashby ${company} ${response.status}`);
  const payload = await response.json() as { jobs?: AshbyJob[] };
  return (payload.jobs || []).filter((job) => job.isListed !== false).map((job) => {
    const description = cleanText(job.descriptionPlain || stripHtml(job.descriptionHtml || ''), 2400);
    const location = cleanText(job.location || 'Location not stated', 200);
    const createdAt = toEpoch(job.publishedAt);
    const salary = cleanText(job.compensation?.scrapeableCompensationSalarySummary || job.compensation?.compensationTierSummary, 240) || salaryFrom(description);
    return {
      title: cleanText(job.title, 240), company, location, salary, posted: postedLabel(createdAt), description,
      skills: [job.department, job.team, job.employmentType, job.workplaceType].map((item) => cleanText(item, 120)).filter(Boolean),
      link: cleanText(job.applyUrl || job.jobUrl, 1600), remote: Boolean(job.isRemote) || job.workplaceType === 'Remote',
      source: 'Direct · Ashby', direct: true, created_at: createdAt, priority: 3,
    };
  }).filter((job) => job.title && job.link && isUkRelevant(job.location, job.description, job.remote));
}

async function fetchLever(company: string, site: string): Promise<UnifiedJob[]> {
  const response = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(site)}?mode=json`, { headers: { Accept: 'application/json' }, next: { revalidate: 1800 } });
  if (!response.ok) throw new Error(`Lever ${company} ${response.status}`);
  const payload = await response.json() as LeverJob[];
  if (!Array.isArray(payload)) return [];
  return payload.map((job) => {
    const description = cleanText(job.descriptionPlain || stripHtml(job.description || ''), 2400);
    const location = cleanText(job.categories?.location || 'Location not stated', 200);
    const createdAt = toEpoch(job.createdAt);
    const remote = job.workplaceType === 'remote' || /remote/i.test(location);
    return {
      title: cleanText(job.text, 240), company, location, salary: leverSalary(job.salaryRange), posted: postedLabel(createdAt), description,
      skills: [job.categories?.department, job.categories?.team, job.categories?.commitment, job.workplaceType].map((item) => cleanText(item, 120)).filter(Boolean),
      link: cleanText(job.applyUrl || job.hostedUrl, 1600), remote, source: 'Direct · Lever', direct: true,
      created_at: createdAt, priority: 3,
    };
  }).filter((job) => job.title && job.link && isUkRelevant(job.location, job.description, job.remote));
}

async function fetchEquinixUk(): Promise<UnifiedJob[]> {
  const response = await fetch(EQUINIX_UK_API, {
    headers: { Accept: 'text/html', 'User-Agent': 'CogniTwist/1.0 (+job-search)' },
    next: { revalidate: 1800 },
  });
  if (!response.ok) throw new Error(`Equinix UK ${response.status}`);
  const html = await response.text();
  const jobs = new Map<string, UnifiedJob>();
  const anchorPattern = /<a\b[^>]*href=["']([^"']*\/jobs\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html)) !== null) {
    const title = stripHtml(match[2] || '');
    if (!title || title.length < 5 || /search|apply now|learn more|view all/i.test(title)) continue;
    let link = match[1];
    if (link.startsWith('/')) link = `https://careers.equinix.com${link}`;
    if (!link.startsWith('http')) continue;

    const contextStart = Math.max(0, match.index - 700);
    const contextEnd = Math.min(html.length, match.index + match[0].length + 900);
    const context = stripHtml(html.slice(contextStart, contextEnd));
    const city = ['Slough','Manchester','London','Crawley'].find((candidate) => context.toLowerCase().includes(candidate.toLowerCase()));
    const location = city ? `${city}, United Kingdom` : 'United Kingdom';
    const description = cleanText(`Equinix UK data center operations. ${context}`, 2200);
    const key = `${title.toLowerCase()}::${location.toLowerCase()}`;

    jobs.set(key, {
      title,
      company: 'Equinix',
      location,
      salary: salaryFrom(description),
      posted: '',
      description,
      skills: ['Data Center Operations', 'Critical Facilities'],
      link,
      remote: false,
      source: 'Direct · Employer',
      direct: true,
      priority: 4,
    });
  }

  return Array.from(jobs.values());
}

async function fetchDirectJobs(): Promise<UnifiedJob[]> {
  const calls: Array<Promise<UnifiedJob[]>> = [
    ...GREENHOUSE_BOARDS.map(([company, board]) => fetchGreenhouse(company, board)),
    ...ASHBY_BOARDS.map(([company, board]) => fetchAshby(company, board)),
    ...LEVER_SITES.map(([company, site]) => fetchLever(company, site)),
    fetchEquinixUk(),
  ];
  const settled = await Promise.allSettled(calls);
  return settled.filter((result): result is PromiseFulfilledResult<UnifiedJob[]> => result.status === 'fulfilled').flatMap((result) => result.value);
}

async function fetchArbeitnow(): Promise<UnifiedJob[]> {
  const pagesToScan = [1, 2, 3, 4, 5, 6, 7, 8];
  const pages = await Promise.allSettled(pagesToScan.map(async (page) => {
    const response = await fetch(`${ARBEITNOW_API}?page=${page}`, { headers: { Accept: 'application/json' }, next: { revalidate: 1800 } });
    if (!response.ok) throw new Error(`Arbeitnow ${response.status}`);
    const payload = await response.json() as ArbeitnowResponse;
    return Array.isArray(payload.data) ? payload.data : [];
  }));
  return pages.filter((result): result is PromiseFulfilledResult<ArbeitnowJob[]> => result.status === 'fulfilled').flatMap((result) => result.value).map((job) => {
    const description = stripHtml(job.description || '');
    const location = cleanText(job.location || (job.remote ? 'Remote' : 'Europe'), 200);
    return {
      title: cleanText(job.title, 240), company: cleanText(job.company_name, 240), location, salary: salaryFrom(description),
      posted: postedLabel(job.created_at), description: description.slice(0, 2200),
      skills: Array.from(new Set([...(job.tags || []), ...(job.job_types || [])])).slice(0, 12),
      link: cleanText(job.url, 1600), remote: Boolean(job.remote), source: 'Fallback · Arbeitnow', direct: false,
      created_at: job.created_at, priority: 1,
    };
  }).filter((job) => job.title && job.company && job.link && isUkRelevant(job.location, job.description, job.remote));
}

async function fetchRemoteOk(): Promise<UnifiedJob[]> {
  const response = await fetch(REMOTE_OK_API, { headers: { Accept: 'application/json', 'User-Agent': 'CogniTwist/1.0' }, next: { revalidate: 1800 } });
  if (!response.ok) throw new Error(`Remote OK ${response.status}`);
  const payload = await response.json() as RemoteOkJob[];
  if (!Array.isArray(payload)) return [];
  return payload.filter((item) => item && item.position && item.company && item.url).map((job) => {
    const description = stripHtml(job.description || '');
    const location = cleanText(job.location || 'Remote / Worldwide', 200);
    return {
      title: cleanText(job.position, 240), company: cleanText(job.company, 240), location,
      salary: cleanText(job.salary, 240) || 'Not disclosed', posted: postedLabel(toEpoch(job.date_epoch)), description: description.slice(0, 2200),
      skills: Array.isArray(job.tags) ? job.tags.slice(0, 12) : [], link: cleanText(job.url, 1600), remote: true,
      source: 'Fallback · Remote OK', direct: false, created_at: toEpoch(job.date_epoch), priority: 1,
    };
  }).filter((job) => !isUsLocation(job.location));
}

function dedupeKey(job: UnifiedJob) {
  const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return `${normalized(job.company)}::${normalized(job.title)}::${normalized(job.location).replace(/remote|hybrid/g, '').trim()}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = cleanText(url.searchParams.get('q'), 160);
  const locationQuery = cleanText(url.searchParams.get('location'), 120);
  const remoteOnly = url.searchParams.get('remote') === 'true';
  const sourceFilter = cleanText(url.searchParams.get('source'), 40).toLowerCase();
  const postedDays = Math.max(0, Math.min(90, Number(url.searchParams.get('days') || 0) || 0));

  const settled = await Promise.allSettled([fetchDirectJobs(), fetchArbeitnow(), fetchRemoteOk()]);
  const sourceErrors = settled.filter((result): result is PromiseRejectedResult => result.status === 'rejected').map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));
  const merged = settled.filter((result): result is PromiseFulfilledResult<UnifiedJob[]> => result.status === 'fulfilled').flatMap((result) => result.value);

  const unique = new Map<string, UnifiedJob>();
  for (const job of merged) {
    const key = dedupeKey(job);
    const existing = unique.get(key);
    if (!existing || job.priority > existing.priority || (job.priority === existing.priority && (job.created_at || 0) > (existing.created_at || 0))) unique.set(key, job);
  }

  const now = Date.now() / 1000;
  const ranked = Array.from(unique.values())
    .map((job) => ({ job, relevance: queryRelevance(job, query) }))
    .filter(({ job, relevance }) => {
      if (query && relevance < 40) return false;
      if (!locationMatches(job, locationQuery)) return false;
      if (remoteOnly && !job.remote) return false;
      if (sourceFilter === 'direct' && !job.direct) return false;
      if (sourceFilter === 'fallback' && job.direct) return false;
      if (postedDays && job.created_at && (now - job.created_at) / 86400 > postedDays) return false;
      return true;
    })
    .sort((a, b) => (b.relevance - a.relevance) || (b.job.priority - a.job.priority) || ((b.job.created_at || 0) - (a.job.created_at || 0)))
    .slice(0, MAX_RESULTS);

  const jobs = ranked.map(({ job }) => {
    const { created_at, priority, ...publicJob } = job;
    return publicJob;
  });

  if (!jobs.length && merged.length === 0) {
    return NextResponse.json({ detail: `All job sources are temporarily unavailable${sourceErrors.length ? `: ${sourceErrors.join(' | ')}` : '.'}` }, { status: 502 });
  }

  return NextResponse.json({
    jobs,
    total: jobs.length,
    sources: Array.from(new Set(merged.map((job) => job.source))),
    direct_count: merged.filter((job) => job.direct).length,
    fallback_count: merged.filter((job) => !job.direct).length,
    partial: sourceErrors.length > 0,
    source_errors: sourceErrors,
    search_strategy: 'domain-aware relevance; direct ATS/employer preferred; strict requested-location eligibility',
  });
}
