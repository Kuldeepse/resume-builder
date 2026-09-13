import { NextResponse } from 'next/server';
import { inflateRawSync } from 'node:zlib';
import { analyseCandidateFit, cleanText, vacancyConfidence } from '../../../../lib/job-intelligence-core.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_PROFILE_CHARS = 30000;
const MAX_DESCRIPTION_CHARS = 12000;
const MAX_DOCX_BYTES = 5 * 1024 * 1024;
const MAX_DOCX_XML_BYTES = 3 * 1024 * 1024;

type VacancyInput = {
  title?: unknown;
  company?: unknown;
  location?: unknown;
  salary?: unknown;
  posted?: unknown;
  description?: unknown;
  skills?: unknown;
  link?: unknown;
  remote?: unknown;
  source?: unknown;
  direct?: unknown;
  handoff_version?: unknown;
};

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

function extractDocxText(buffer: Buffer) {
  const eocdSignature = 0x06054b50;
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (buffer.readUInt32LE(i) === eocdSignature) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('invalid_docx');

  const centralOffset = buffer.readUInt32LE(eocd + 16);
  const entries = buffer.readUInt16LE(eocd + 10);
  if (entries > 2000) throw new Error('docx_too_complex');
  let cursor = centralOffset;

  for (let n = 0; n < entries && cursor + 46 <= buffer.length; n += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + fileNameLength).toString('utf8');

    if (name === 'word/document.xml') {
      if (uncompressedSize > MAX_DOCX_XML_BYTES) throw new Error('docx_xml_too_large');
      if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('invalid_docx_entry');
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      const xmlBuffer = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : Buffer.alloc(0);
      if (!xmlBuffer.length || xmlBuffer.length > MAX_DOCX_XML_BYTES) throw new Error('unsupported_docx');
      return decodeEntities(
        xmlBuffer.toString('utf8')
          .replace(/<w:tab\b[^>]*\/>/g, '\t')
          .replace(/<w:br\b[^>]*\/>/g, '\n')
          .replace(/<\/w:p>/g, '\n')
          .replace(/<[^>]+>/g, ''),
      ).replace(/\n{3,}/g, '\n\n').trim();
    }

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }
  throw new Error('docx_text_missing');
}

function safeHttpsUrl(value: unknown) {
  const candidate = cleanText(value, 1600);
  if (!candidate) return '';
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function sanitiseVacancy(raw: VacancyInput) {
  const title = cleanText(raw.title, 240);
  const company = cleanText(raw.company, 240) || 'Selected employer';
  const location = cleanText(raw.location, 240) || 'Location not confirmed';
  const description = cleanText(raw.description, MAX_DESCRIPTION_CHARS);
  if (!title || description.length < 30) return null;
  const skills = Array.isArray(raw.skills)
    ? raw.skills.map((item) => cleanText(item, 120)).filter(Boolean).slice(0, 20)
    : [];
  return {
    title,
    company,
    location,
    salary: cleanText(raw.salary, 240),
    posted: cleanText(raw.posted, 160),
    description,
    skills,
    link: safeHttpsUrl(raw.link),
    remote: Boolean(raw.remote),
    source: cleanText(raw.source, 160) || 'Job Scout verified selection',
    direct: Boolean(raw.direct),
    handoff_version: cleanText(raw.handoff_version, 40) || 'unknown',
  };
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const rawVacancy = String(form.get('vacancy_json') || '');
    if (!rawVacancy || rawVacancy.length > 30000) {
      return NextResponse.json({ detail: 'Select a vacancy in Job Scout before running Job Intelligence.' }, { status: 400 });
    }

    let parsedVacancy: VacancyInput;
    try {
      parsedVacancy = JSON.parse(rawVacancy) as VacancyInput;
    } catch {
      return NextResponse.json({ detail: 'The selected vacancy context is invalid. Return to Job Scout and select the role again.' }, { status: 400 });
    }

    const vacancy = sanitiseVacancy(parsedVacancy);
    if (!vacancy) {
      return NextResponse.json({ detail: 'The selected vacancy does not contain enough verified job-description evidence to analyse.' }, { status: 400 });
    }

    let profile = cleanText(form.get('resume_skills'), MAX_PROFILE_CHARS);
    const resume = form.get('resume_file');
    if (resume instanceof File && resume.size > 0) {
      if (resume.size > MAX_DOCX_BYTES) return NextResponse.json({ detail: 'Uploaded CV must be 5 MB or smaller.' }, { status: 413 });
      if (!resume.name.toLowerCase().endsWith('.docx')) {
        return NextResponse.json({ detail: 'Job Intelligence currently accepts DOCX CVs. You can also paste a career summary.' }, { status: 400 });
      }
      try {
        const extracted = extractDocxText(Buffer.from(await resume.arrayBuffer()));
        profile = cleanText(extracted, MAX_PROFILE_CHARS) || profile;
      } catch {
        if (!profile) {
          return NextResponse.json({ detail: 'This DOCX could not be read safely. Paste a career summary and try again.' }, { status: 400 });
        }
      }
    }

    if (!profile) {
      return NextResponse.json({ detail: 'Upload a DOCX CV or paste a career summary so Job Intelligence can map evidence.' }, { status: 400 });
    }

    const assessment = analyseCandidateFit(vacancy, profile);
    const vacancyConfidenceResult = vacancyConfidence(vacancy);

    return NextResponse.json({
      engine: 'evidence-v1',
      vacancy,
      vacancy_confidence: vacancyConfidenceResult,
      assessment,
      safeguards: {
        exact_selected_vacancy: true,
        independent_market_search: false,
        freshness_excluded_from_candidate_fit: true,
        unknown_kept_separate_from_gap: true,
      },
    });
  } catch {
    return NextResponse.json({ detail: 'Job Intelligence could not complete this analysis. Please try again.' }, { status: 500 });
  }
}
