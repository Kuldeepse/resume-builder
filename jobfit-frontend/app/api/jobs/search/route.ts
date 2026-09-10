import { NextResponse } from 'next/server';
import { inflateRawSync } from 'node:zlib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ARBEITNOW_API = 'https://www.arbeitnow.com/api/job-board-api';
const REMOTE_OK_API = 'https://remoteok.com/api';
const MAX_PROFILE_CHARS = 30000;
const MAX_JOBS = 20;

const STOP_WORDS = new Set([
  'the','and','for','with','that','this','from','your','you','our','are','will','have','has','into','job','role','work','working','team','teams','within','across','their','they','who','what','where','when','using','use','used','can','all','not','but','about','more','than','years','year','experience','skills','skill','required','requirements','responsibilities','responsibility','including','such','other','also','would','should','could','able','been','being','make','well','strong','good','new','day','business','company','candidate','position','people','support','delivery'
]);

type UnifiedJob = {
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number;
  source?: string;
  salary?: string;
};

type ArbeitnowResponse = { data?: UnifiedJob[] };

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

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(value: string) {
  return cleanText(
    decodeEntities(
      value
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' '),
    ),
    7000,
  );
}

function tokens(value: string) {
  return Array.from(new Set(value.toLowerCase().match(/[a-z0-9+#.]{3,}/g) || []))
    .filter((word) => !STOP_WORDS.has(word) && !/^\d+$/.test(word));
}

function extractDocxText(buffer: Buffer) {
  const eocdSignature = 0x06054b50;
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (buffer.readUInt32LE(i) === eocdSignature) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Invalid DOCX archive.');

  const centralOffset = buffer.readUInt32LE(eocd + 16);
  const entries = buffer.readUInt16LE(eocd + 10);
  let cursor = centralOffset;

  for (let n = 0; n < entries && cursor + 46 <= buffer.length; n += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + fileNameLength).toString('utf8');

    if (name === 'word/document.xml') {
      if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('Invalid DOCX entry.');
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      const xml = (method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : Buffer.alloc(0)).toString('utf8');
      if (!xml) throw new Error('Unsupported DOCX compression.');
      return decodeEntities(
        xml
          .replace(/<w:tab\b[^>]*\/>/g, '\t')
          .replace(/<w:br\b[^>]*\/>/g, '\n')
          .replace(/<\/w:p>/g, '\n')
          .replace(/<[^>]+>/g, ''),
      )
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error('DOCX document text was not found.');
}

function salaryFrom(job: UnifiedJob, description: string) {
  if (cleanText(job.salary, 240)) return cleanText(job.salary, 240);
  const match = description.match(/£\s?\d{2,3}(?:,\d{3})?(?:\s*(?:-|–|to)\s*£?\s?\d{2,3}(?:,\d{3})?)?/i);
  return match ? match[0].replace(/\s+/g, ' ') : 'Not disclosed';
}

function postedLabel(createdAt?: number) {
  if (!createdAt) return '';
  const ageDays = Math.max(0, Math.floor((Date.now() / 1000 - createdAt) / 86400));
  if (ageDays === 0) return 'Today';
  if (ageDays === 1) return '1 day ago';
  return `${ageDays} days ago`;
}

function isUkOrAccessible(job: UnifiedJob) {
  const value = `${job.location || ''} ${job.description || ''}`.toLowerCase();
  const ukSignals = [
    'united kingdom',' uk','uk ','london','manchester','birmingham','bristol','leeds','liverpool','cardiff','edinburgh','glasgow','belfast','southampton','reading','cambridge','oxford','newcastle','nottingham','sheffield','england','scotland','wales','northern ireland','europe','worldwide',
  ];
  return Boolean(job.remote) || ukSignals.some((signal) => value.includes(signal));
}

function scoreJob(job: UnifiedJob, targetRole: string, requestedLocation: string, profile: string) {
  const title = cleanText(job.title, 240);
  const company = cleanText(job.company_name, 240);
  const location = cleanText(job.location || (job.remote ? 'Remote' : 'United Kingdom'), 240);
  const description = stripHtml(job.description || '');
  const jobText = `${title} ${description} ${(job.tags || []).join(' ')}`.toLowerCase();
  const titleText = title.toLowerCase();
  const roleTokens = tokens(targetRole).slice(0, 8);
  const profileTokens = tokens(profile).slice(0, 160);

  const titleRoleHits = roleTokens.filter((word) => titleText.includes(word));
  const bodyRoleHits = roleTokens.filter((word) => jobText.includes(word));
  const evidenceHits = profileTokens.filter((word) => jobText.includes(word));

  const roleScore = roleTokens.length
    ? Math.min(45, Math.round((titleRoleHits.length / roleTokens.length) * 34 + (bodyRoleHits.length / roleTokens.length) * 11))
    : 0;
  const evidenceScore = Math.min(35, evidenceHits.length * 2.5);
  const requested = requestedLocation.toLowerCase();
  const locationLower = location.toLowerCase();
  const locationScore =
    requested.includes('uk') ||
    requested.includes('united kingdom') ||
    locationLower.includes(requested) ||
    job.remote
      ? 10
      : 4;
  const ageDays = job.created_at ? Math.max(0, (Date.now() / 1000 - job.created_at) / 86400) : 30;
  const freshnessScore = ageDays <= 3 ? 10 : ageDays <= 7 ? 8 : ageDays <= 14 ? 5 : 2;
  const matchScore = Math.max(0, Math.min(100, Math.round(roleScore + evidenceScore + locationScore + freshnessScore)));

  const matched = evidenceHits.slice(0, 7).map((word) => `CV evidence matches job signal: ${word}`);
  if (titleRoleHits.length) matched.unshift(`Target-role alignment: ${titleRoleHits.join(', ')}`);
  if (job.remote) matched.push('Remote working is indicated for this vacancy.');

  const jobSignals = Array.from(
    new Set([...(job.tags || []).flatMap(tokens), ...roleTokens.filter((word) => jobText.includes(word))]),
  );
  const profileSet = new Set(profileTokens);
  const missing = jobSignals
    .filter((word) => !profileSet.has(word))
    .slice(0, 6)
    .map((word) => `Job signal not explicit in CV/profile: ${word}`);

  const recommendation = matchScore >= 78 ? 'Apply' : matchScore >= 62 ? 'Apply after tailoring' : 'Review carefully';
  const sourceNote = job.source === 'Remote OK' ? ' Source: Remote OK.' : '';

  return {
    title: title || 'Role',
    company: company || 'Company',
    location,
    salary: salaryFrom(job, description),
    posted: postedLabel(job.created_at),
    description: `${description.slice(0, 1750)}${sourceNote}`.trim(),
    skills: Array.from(new Set([...(job.tags || []), ...(job.job_types || [])])).slice(0, 12),
    link: cleanText(job.url, 1600),
    match_score: matchScore,
    matched_requirements: matched.slice(0, 8),
    missing_requirements: missing,
    recommendation,
    _roleScore: roleScore,
    _source: job.source || 'Unknown',
  };
}

async function fetchArbeitnowJobs() {
  const settled = await Promise.allSettled(
    [1, 2, 3].map(async (page) => {
      const response = await fetch(`${ARBEITNOW_API}?page=${page}`, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 900 },
      });
      if (!response.ok) throw new Error(`Arbeitnow returned ${response.status}.`);
      const payload = (await response.json()) as ArbeitnowResponse;
      return (Array.isArray(payload.data) ? payload.data : []).map((job) => ({ ...job, source: 'Arbeitnow' }));
    }),
  );

  return settled
    .filter((result): result is PromiseFulfilledResult<UnifiedJob[]> => result.status === 'fulfilled')
    .flatMap((result) => result.value)
    .filter(isUkOrAccessible);
}

async function fetchRemoteOkJobs() {
  const response = await fetch(REMOTE_OK_API, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 900 },
  });
  if (!response.ok) throw new Error(`Remote OK returned ${response.status}.`);
  const payload = (await response.json()) as RemoteOkJob[];
  if (!Array.isArray(payload)) return [];

  return payload
    .filter((item) => item && (item.position || item.company))
    .map<UnifiedJob>((item) => ({
      company_name: item.company,
      title: item.position,
      description: item.description,
      remote: true,
      url: item.url,
      tags: Array.isArray(item.tags) ? item.tags : [],
      job_types: ['Remote'],
      location: item.location || 'Remote / Worldwide',
      created_at: Number(item.date_epoch) || undefined,
      salary: item.salary,
      source: 'Remote OK',
    }))
    .filter(isUkOrAccessible);
}

async function fetchFreeJobs() {
  const sources = await Promise.allSettled([fetchArbeitnowJobs(), fetchRemoteOkJobs()]);
  const jobs = sources
    .filter((result): result is PromiseFulfilledResult<UnifiedJob[]> => result.status === 'fulfilled')
    .flatMap((result) => result.value);

  const unique = new Map<string, UnifiedJob>();
  for (const job of jobs) {
    const key = cleanText(job.url, 1600) || `${cleanText(job.company_name, 200)}::${cleanText(job.title, 200)}`.toLowerCase();
    if (key && !unique.has(key)) unique.set(key, job);
  }

  if (!unique.size) {
    const errors = sources
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason))
      .join(' | ');
    throw new Error(errors || 'All free job sources returned no usable jobs.');
  }

  return Array.from(unique.values());
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const targetRole = cleanText(form.get('target_role'), 200);
    const location = cleanText(form.get('location_city'), 160);
    let profile = cleanText(form.get('resume_skills'), MAX_PROFILE_CHARS);
    const resume = form.get('resume_file');

    if (!targetRole || !location) {
      return NextResponse.json({ detail: 'Enter a target role and location.' }, { status: 400 });
    }

    if (resume instanceof File && resume.size > 0) {
      const name = resume.name.toLowerCase();
      if (resume.size > 5 * 1024 * 1024) {
        return NextResponse.json({ detail: 'Uploaded CV must be 5 MB or smaller.' }, { status: 413 });
      }
      if (name.endsWith('.docx')) {
        try {
          profile = cleanText(extractDocxText(Buffer.from(await resume.arrayBuffer())), MAX_PROFILE_CHARS) || profile;
        } catch {
          if (!profile) {
            return NextResponse.json(
              { detail: 'This DOCX could not be read. Please paste a career summary and search again.' },
              { status: 400 },
            );
          }
        }
      } else if (name.endsWith('.pdf') && !profile) {
        return NextResponse.json(
          { detail: 'For the new free fast-search engine, please use a DOCX CV or paste your career summary. PDF parsing remains available in Career Studio.' },
          { status: 400 },
        );
      }
    }

    if (!profile) {
      return NextResponse.json(
        { detail: 'Upload a DOCX CV or paste a career summary so CogniTwist can calculate fit.' },
        { status: 400 },
      );
    }

    const rawJobs = await fetchFreeJobs();
    const scored = rawJobs
      .map((job) => scoreJob(job, targetRole, location, profile))
      .filter((job) => job._roleScore >= 7)
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, MAX_JOBS)
      .map(({ _roleScore, _source, ...job }) => job);

    const activeSources = Array.from(new Set(rawJobs.map((job) => job.source).filter(Boolean)));

    return NextResponse.json({
      jobs: scored,
      best_match_summary: scored.length
        ? `Found ${scored.length} relevant vacancies from ${activeSources.join(' + ')} and ranked them using CogniTwist's deterministic CV-to-job fit engine.`
        : `No sufficiently relevant vacancies were found for “${targetRole}” in the current free feeds. Try a broader title such as Product Manager, Programme Manager, Delivery Manager or Technical Project Manager.`,
      search_mode: 'free_multi_source',
      source: activeSources.join(' + '),
    });
  } catch (error) {
    return NextResponse.json(
      {
        detail: error instanceof Error
          ? `Free job search is temporarily unavailable: ${error.message}`
          : 'Free job search is temporarily unavailable.',
      },
      { status: 502 },
    );
  }
}
