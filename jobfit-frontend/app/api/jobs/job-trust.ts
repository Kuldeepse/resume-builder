export type TrustJob = {
  title?: string;
  company?: string;
  location?: string;
  posted?: string;
  description?: string;
  skills?: string[];
  link?: string;
  remote?: boolean;
  source?: string;
  source_type?: string;
  direct?: boolean;
};

export type SearchTrustContext = {
  query: string;
  location?: string;
  freshnessDays?: number;
};

type Validation = {
  accepted: boolean;
  reasons: string[];
};

const SOFT_ROLE_WORDS = new Set([
  'senior', 'sr', 'junior', 'jr', 'lead', 'principal', 'technical', 'technology', 'global',
  'head', 'associate', 'staff', 'the', 'and', 'for', 'with', 'of', 'a', 'an', 'role', 'job', 'jobs',
]);

const ROLE_WORDS = new Set([
  'manager', 'management', 'engineer', 'engineering', 'architect', 'architecture', 'analyst',
  'developer', 'director', 'coordinator', 'specialist', 'consultant', 'owner', 'officer',
  'administrator', 'technician', 'scientist', 'designer', 'programme', 'program', 'project',
  'delivery', 'product', 'operations', 'operation', 'scrum', 'portfolio', 'service',
]);

const UK_SIGNALS = [
  'united kingdom', 'uk', 'england', 'scotland', 'wales', 'northern ireland', 'london',
  'manchester', 'birmingham', 'bristol', 'leeds', 'liverpool', 'cardiff', 'edinburgh',
  'glasgow', 'belfast', 'southampton', 'reading', 'cambridge', 'oxford', 'newcastle',
  'nottingham', 'sheffield', 'milton keynes', 'slough', 'portsmouth', 'guildford',
  'brighton', 'aberdeen', 'crawley', 'woking', 'watford', 'maidenhead', 'farnborough',
];

const US_SIGNALS = [
  'united states', 'usa', 'california', 'new york', 'texas', 'virginia', 'florida',
  'massachusetts', 'illinois', 'colorado', 'georgia', 'arizona', 'north carolina',
  'south carolina', 'pennsylvania', 'ohio', 'michigan', 'oregon', 'maryland', 'tennessee',
];

function clean(value: unknown, limit = 4000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function canonical(value: unknown) {
  return clean(value, 4000)
    .toLowerCase()
    .replace(/\bprogramme\b/g, 'program')
    .replace(/\bcentre\b/g, 'center')
    .replace(/\bsr\.?\b/g, 'senior')
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value: unknown) {
  return canonical(value).split(' ').filter((token) => token.length >= 2);
}

function includesToken(text: string, token: string) {
  return (` ${text} `).includes(` ${token} `);
}

function containsAny(text: string, values: string[]) {
  const padded = ` ${canonical(text)} `;
  return values.some((value) => padded.includes(` ${canonical(value)} `));
}

function isLikelyVacancyUrl(value: unknown) {
  const candidate = clean(value, 2000);
  if (!candidate) return false;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, '').toLowerCase();
    if (!path || path === '/') return false;

    if (host.endsWith('linkedin.com')) return /^\/jobs\/view\//.test(path);
    if (host.endsWith('indeed.com') || host.endsWith('indeed.co.uk')) return path.includes('/viewjob');

    const genericPaths = new Set([
      '/jobs', '/careers', '/career', '/vacancies', '/vacancy', '/search', '/job-search',
      '/jobs/search', '/careers/search', '/opportunities', '/open-roles',
    ]);
    if (genericPaths.has(path)) return false;
    return true;
  } catch {
    return false;
  }
}

function roleFamilyConflict(query: string, title: string) {
  const q = canonical(query);
  const t = canonical(title);
  if (includesToken(q, 'program') && includesToken(t, 'project') && !includesToken(t, 'program')) return true;
  if (includesToken(q, 'project') && includesToken(t, 'program') && !includesToken(t, 'project')) return true;
  if (includesToken(q, 'product') && (includesToken(t, 'project') || includesToken(t, 'program')) && !includesToken(t, 'product')) return true;
  return false;
}

function roleOrKeywordMatches(job: TrustJob, query: string) {
  const queryText = canonical(query);
  if (!queryText) return true;

  const title = canonical(job.title);
  const company = canonical(job.company);
  const skills = canonical((job.skills || []).join(' '));
  const description = canonical(job.description);

  if (!title || !company) return false;
  if (company.includes(queryText) || title.includes(queryText)) return true;

  const queryTokens = tokens(queryText);
  if (!queryTokens.length) return false;

  const roleShaped = queryTokens.some((token) => ROLE_WORDS.has(token));
  if (roleShaped) {
    if (roleFamilyConflict(queryText, title)) return false;

    const core = queryTokens.filter((token) => !SOFT_ROLE_WORDS.has(token));
    const required = core.length <= 2 ? core.length : Math.ceil(core.length * 0.67);
    const titleHits = core.filter((token) => includesToken(title, token)).length;
    if (core.length && titleHits >= Math.max(1, required)) return true;

    // Acronym-safe exception for TPM. It still requires the title to be a Program/Programme Manager role.
    if (queryText === 'tpm' && includesToken(title, 'program') && includesToken(title, 'manager')) return true;
    return false;
  }

  const searchable = `${title} ${skills}`.trim();
  const searchableHits = queryTokens.filter((token) => includesToken(searchable, token)).length;
  if (searchableHits === queryTokens.length) return true;

  // Keyword/technology searches may legitimately match the description, but never on description alone
  // unless at least one query token is also present in the title or structured skill signals.
  const combined = `${searchable} ${description}`.trim();
  const combinedHits = queryTokens.filter((token) => includesToken(combined, token)).length;
  return searchableHits >= 1 && combinedHits === queryTokens.length;
}

function locationMatches(job: TrustJob, requestedLocation: string) {
  const requested = canonical(requestedLocation);
  if (!requested) return true;

  const location = canonical(job.location);
  const description = canonical(job.description).slice(0, 2500);
  const combined = `${location} ${description}`;

  if (requested === 'remote') return Boolean(job.remote) || includesToken(location, 'remote');

  if (requested === 'uk' || requested === 'united kingdom') {
    if (containsAny(combined, US_SIGNALS) && !containsAny(combined, UK_SIGNALS)) return false;
    if (containsAny(combined, UK_SIGNALS)) return true;
    if (Boolean(job.remote) || includesToken(location, 'remote')) {
      return /\b(europe|emea|worldwide|global)\b/.test(combined);
    }
    return false;
  }

  if (location.includes(requested)) return true;
  return false;
}

function parsePostedAgeDays(value: unknown): number | null {
  const posted = clean(value, 160).toLowerCase();
  if (!posted) return null;
  if (posted === 'today' || posted.includes('just posted')) return 0;
  if (posted === 'yesterday') return 1;
  const relative = posted.match(/(\d+)\s*(?:day|days|d)\s*ago/);
  if (relative) return Number(relative[1]);
  const parsed = Date.parse(posted);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, (Date.now() - parsed) / 86_400_000);
}

function freshnessMatches(job: TrustJob, days?: number) {
  const freshnessDays = Number(days || 0);
  if (!freshnessDays || freshnessDays <= 0) return true;
  const age = parsePostedAgeDays(job.posted);
  if (age === null) return true;
  return age <= freshnessDays + 1;
}

export function validateJobForSearch(job: TrustJob, context: SearchTrustContext): Validation {
  const reasons: string[] = [];
  if (!isLikelyVacancyUrl(job.link)) reasons.push('not_job_detail_url');
  if (!roleOrKeywordMatches(job, context.query)) reasons.push('query_mismatch');
  if (!locationMatches(job, context.location || '')) reasons.push('location_mismatch');
  if (!freshnessMatches(job, context.freshnessDays)) reasons.push('outside_freshness_window');
  return { accepted: reasons.length === 0, reasons };
}

export function validateJobsForSearch<T extends TrustJob>(jobs: T[], context: SearchTrustContext) {
  const accepted: T[] = [];
  const rejected: Array<{ job: T; reasons: string[] }> = [];

  for (const job of jobs) {
    const validation = validateJobForSearch(job, context);
    if (validation.accepted) accepted.push(job);
    else rejected.push({ job, reasons: validation.reasons });
  }

  return { accepted, rejected };
}
