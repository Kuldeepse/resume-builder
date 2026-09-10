import { NextResponse } from 'next/server';
import { inflateRawSync } from 'node:zlib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ARBEITNOW_UK_API = 'https://www.arbeitnow.co.uk/api/job-board-api';
const MAX_PROFILE_CHARS = 30000;
const MAX_JOBS = 20;
const STOP_WORDS = new Set([
  'the','and','for','with','that','this','from','your','you','our','are','will','have','has','into','job','role','work','working','team','teams','within','across','their','they','who','what','where','when','using','use','used','can','all','not','but','about','more','than','years','year','experience','skills','skill','required','requirements','responsibilities','responsibility','including','such','other','also','would','should','could','able','been','being','make','well','strong','good','new','day','business','company','candidate','position','people','support','delivery'
]);

type ArbeitnowJob = {
  slug?: string;
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
  return cleanText(decodeEntities(value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')), 7000);
}

function tokens(value: string) {
  return Array.from(new Set(value.toLowerCase().match(/[a-z0-9+#.]{3,}/g) || []))
    .filter((word) => !STOP_WORDS.has(word) && !/^\d+$/.test(word));
}

function extractDocxText(buffer: Buffer) {
  const eocdSignature = 0x06054b50;
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (buffer.readUInt32LE(i) === eocdSignature) { eocd = i; break; }
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
        xml.replace(/<w:tab\b[^>]*\/>/g, '\t').replace(/<w:br\b[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')
      ).replace(/\n{3,}/g, '\n\n').trim();
    }

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }
  throw new Error('DOCX document text was not found.');
}

function salaryFrom(text: string) {
  const match = text.match(/£\s?\d{2,3}(?:,\d{3})?(?:\s*(?:-|–|to)\s*£?\s?\d{2,3}(?:,\d{3})?)?/i);
  return match ? match[0].replace(/\s+/g, ' ') : 'Not disclosed';
}

function postedLabel(createdAt?: number) {
  if (!createdAt) return '';
  const ageDays = Math.max(0, Math.floor((Date.now() / 1000 - createdAt) / 86400));
  if (ageDays === 0) return 'Today';
  if (ageDays === 1) return '1 day ago';
  return `${ageDays} days ago`;
}

function scoreJob(job: ArbeitnowJob, targetRole: string, requestedLocation: string, profile: string) {
  const title = cleanText(job.title, 240);
  const company = cleanText(job.company_name, 240);
  const location = cleanText(job.location || (job.remote ? 'Remote, UK' : 'United Kingdom'), 240);
  const description = stripHtml(job.description || '');
  const jobText = `${title} ${description} ${(job.tags || []).join(' ')}`.toLowerCase();
  const titleText = title.toLowerCase();
  const roleTokens = tokens(targetRole).slice(0, 8);
  const profileTokens = tokens(profile).slice(0, 160);

  const titleRoleHits = roleTokens.filter((word) => titleText.includes(word));
  const bodyRoleHits = roleTokens.filter((word) => jobText.includes(word));
  const evidenceHits = profileTokens.filter((word) => jobText.includes(word));

  const roleScore = roleTokens.length ? Math.min(45, Math.round((titleRoleHits.length / roleTokens.length) * 34 + (bodyRoleHits.length / roleTokens.length) * 11)) : 0;
  const evidenceScore = Math.min(35, evidenceHits.length * 2.5);
  const requested = requestedLocation.toLowerCase();
  const locationScore = requested.includes('uk') || requested.includes('united kingdom') || location.toLowerCase().includes(requested) || job.remote ? 10 : 4;
  const ageDays = job.created_at ? Math.max(0, (Date.now() / 1000 - job.created_at) / 86400) : 30;
  const freshnessScore = ageDays <= 3 ? 10 : ageDays <= 7 ? 8 : ageDays <= 14 ? 5 : 2;
  const matchScore = Math.max(0, Math.min(100, Math.round(roleScore + evidenceScore + locationScore + freshnessScore)));

  const matched = evidenceHits.slice(0, 7).map((word) => `CV evidence matches job signal: ${word}`);
  if (titleRoleHits.length) matched.unshift(`Target-role alignment: ${titleRoleHits.join(', ')}`);
  if (job.remote) matched.push('Remote working is indicated for this vacancy.');

  const jobSignals = Array.from(new Set([...(job.tags || []).flatMap(tokens), ...roleTokens.filter((w) => jobText.includes(w))]));
  const profileSet = new Set(profileTokens);
  const missing = jobSignals.filter((word) => !profileSet.has(word)).slice(0, 6).map((word) => `Job signal not explicit in CV/profile: ${word}`);

  const recommendation = matchScore >= 78 ? 'Apply' : matchScore >= 62 ? 'Apply after tailoring' : 'Review carefully';
  return {
    title: title || 'Role',
    company: company || 'Company',
    location,
    salary: salaryFrom(description),
    posted: postedLabel(job.created_at),
    description: description.slice(0, 1800),
    skills: Array.from(new Set([...(job.tags || []), ...(job.job_types || [])])).slice(0, 12),
    link: cleanText(job.url, 1600),
    match_score: matchScore,
    matched_requirements: matched.slice(0, 8),
    missing_requirements: missing,
    recommendation,
    _roleScore: roleScore,
  };
}

async function fetchUkJobs() {
  const pages = await Promise.all([1, 2, 3].map(async (page) => {
    const response = await fetch(`${ARBEITNOW_UK_API}?page=${page}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'CogniTwist-Job-Intelligence/2.0' },
      next: { revalidate: 900 },
    });
    if (!response.ok) throw new Error(`UK job source returned ${response.status}.`);
    const payload = await response.json() as ArbeitnowResponse;
    return Array.isArray(payload.data) ? payload.data : [];
  }));
  return pages.flat();
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const targetRole = cleanText(form.get('target_role'), 200);
    const location = cleanText(form.get('location_city'), 160);
    let profile = cleanText(form.get('resume_skills'), MAX_PROFILE_CHARS);
    const resume = form.get('resume_file');

    if (!targetRole || !location) return NextResponse.json({ detail: 'Enter a target role and location.' }, { status: 400 });

    if (resume instanceof File && resume.size > 0) {
      const name = resume.name.toLowerCase();
      if (resume.size > 5 * 1024 * 1024) return NextResponse.json({ detail: 'Uploaded CV must be 5 MB or smaller.' }, { status: 413 });
      if (name.endsWith('.docx')) {
        try {
          profile = cleanText(extractDocxText(Buffer.from(await resume.arrayBuffer())), MAX_PROFILE_CHARS) || profile;
        } catch {
          if (!profile) return NextResponse.json({ detail: 'This DOCX could not be read. Please paste a career summary and search again.' }, { status: 400 });
        }
      } else if (name.endsWith('.pdf') && !profile) {
        return NextResponse.json({ detail: 'For the new free fast-search engine, please use a DOCX CV or paste your career summary. PDF parsing will remain available in Career Studio.' }, { status: 400 });
      }
    }

    if (!profile) return NextResponse.json({ detail: 'Upload a DOCX CV or paste a career summary so CogniTwist can calculate fit.' }, { status: 400 });

    const rawJobs = await fetchUkJobs();
    const scored = rawJobs
      .map((job) => scoreJob(job, targetRole, location, profile))
      .filter((job) => job._roleScore >= 7)
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, MAX_JOBS)
      .map(({ _roleScore, ...job }) => job);

    return NextResponse.json({
      jobs: scored,
      best_match_summary: scored.length
        ? `Found ${scored.length} current UK vacancies from a free ATS-backed source and ranked them using CogniTwist's deterministic CV-to-job fit engine.`
        : `No sufficiently relevant vacancies were found in the latest UK feed for “${targetRole}”. Try a broader title such as Product Manager, Programme Manager, Delivery Manager or Technical Project Manager.`,
      search_mode: 'free_uk_index',
      source: 'Arbeitnow UK',
    });
  } catch (error) {
    return NextResponse.json({
      detail: error instanceof Error ? `Free UK job search is temporarily unavailable: ${error.message}` : 'Free UK job search is temporarily unavailable.',
    }, { status: 502 });
  }
}
