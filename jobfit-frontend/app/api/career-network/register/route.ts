import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LINKEDIN_PATTERN = /^https:\/\/(www\.)?linkedin\.com\//i;
const ALLOWED_ROLES = new Set(['candidate', 'referrer', 'mentor']);

const configuredOrigins = (process.env.CAREER_NETWORK_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const defaultOrigins = [
  'https://rolecraftai.duckdns.org',
  'https://resume-builder-ha5ykxvh9-resume-builder-s-projects.vercel.app',
];

function isAllowedOrigin(origin: string | null) {
  if (!origin) return false;
  const normalised = origin.replace(/\/$/, '');
  if ([...defaultOrigins, ...configuredOrigins].includes(normalised)) return true;

  try {
    const host = new URL(normalised).hostname;
    return host.startsWith('resume-builder-') && host.endsWith('-resume-builder-s-projects.vercel.app');
  } catch {
    return false;
  }
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json({ detail: 'Origin is not allowed.' }, { status: 403 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ detail: 'Private registration storage is not configured.' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: 'Invalid registration request.' }, { status: 400 });
  }

  // Honeypot field. Return a generic success response to discourage automation.
  if (cleanText(body.website, 200)) {
    return NextResponse.json({ status: 'received' }, { status: 201 });
  }

  const fullName = cleanText(body.full_name, 120);
  const email = cleanText(body.email, 254).toLowerCase();
  const role = cleanText(body.role, 20);
  const linkedinProfile = cleanText(body.linkedin_profile, 500);
  const currentCompany = cleanText(body.current_company, 160);
  const professionalArea = cleanText(body.professional_area, 160);
  const privacyNoticeVersion = cleanText(body.privacy_notice_version, 40);
  const termsAccepted = body.terms_accepted === true;
  const ageConfirmed = body.age_confirmed === true;
  const marketingOptIn = body.marketing_opt_in === true;

  if (fullName.length < 2 || !EMAIL_PATTERN.test(email) || !ALLOWED_ROLES.has(role) || !professionalArea) {
    return NextResponse.json({ detail: 'Complete all required registration fields.' }, { status: 400 });
  }

  if (linkedinProfile && !LINKEDIN_PATTERN.test(linkedinProfile)) {
    return NextResponse.json({ detail: 'LinkedIn profile must use a linkedin.com URL.' }, { status: 400 });
  }

  if (role === 'referrer' && !currentCompany) {
    return NextResponse.json({ detail: 'Current company is required for referrer registration.' }, { status: 400 });
  }

  if (!termsAccepted || !ageConfirmed || !privacyNoticeVersion) {
    return NextResponse.json({ detail: 'Privacy acceptance and age confirmation are required.' }, { status: 400 });
  }

  const record = {
    full_name: fullName,
    email,
    role,
    linkedin_profile: linkedinProfile || null,
    current_company: currentCompany || null,
    professional_area: professionalArea,
    privacy_notice_version: privacyNoticeVersion,
    terms_accepted: termsAccepted,
    age_confirmed: ageConfirmed,
    marketing_opt_in: marketingOptIn,
    status: 'pending_verification',
    updated_at: new Date().toISOString(),
  };

  const storageResponse = await fetch(
    `${supabaseUrl.replace(/\/$/, '')}/rest/v1/career_network_registrations?on_conflict=email,role`,
    {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(record),
      cache: 'no-store',
    },
  );

  if (!storageResponse.ok) {
    return NextResponse.json(
      { detail: 'Registration could not be stored securely. Please try again later.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const stored = (await storageResponse.json().catch(() => [])) as Array<{ id?: string }>;
  return NextResponse.json(
    {
      status: 'pending_verification',
      registration_id: stored[0]?.id || null,
      message: 'Registration received. Your details remain private and are not published.',
    },
    {
      status: 201,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    },
  );
}
