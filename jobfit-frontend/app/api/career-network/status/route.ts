import { NextRequest, NextResponse } from 'next/server';
import { buildSupabaseRestHeaders } from '@/lib/supabase-rest.mjs';
import { cleanText, EMAIL_PATTERN } from '@/app/api/career-network/register/policy.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
};

const STATUS_COPY: Record<string, string> = {
  pending_verification: 'Your registration has been received and is waiting for manual review.',
  verified: 'Your registration has been verified and network access can be coordinated.',
  declined: 'Your registration was reviewed but cannot be approved at this time.',
  deleted: 'This registration record is no longer active.',
};

const WHATSAPP_COPY: Record<string, string> = {
  not_requested: 'No WhatsApp invite was requested.',
  pending_approval: 'Your WhatsApp invite request is waiting for manual approval.',
  approved: 'Your WhatsApp invite request has been approved and is waiting to be sent.',
  invited: 'Your WhatsApp invite has been sent.',
  declined: 'Your WhatsApp invite request was reviewed but not approved.',
  withdrawn: 'Your WhatsApp invite request has been withdrawn.',
};

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { detail: 'Private registration status storage is not configured.' },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: 'Invalid status request.' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const email = cleanText(body.email, 254).toLowerCase();
  const statusLookupCode = cleanText(body.status_lookup_code, 24).toUpperCase();

  if (!EMAIL_PATTERN.test(email) || statusLookupCode.length < 6) {
    return NextResponse.json(
      { detail: 'Enter the same email address and tracking code used for registration.' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, '')}/rest/v1/career_network_registrations?select=full_name,email,role,status,whatsapp_group_consent,whatsapp_group_status,created_at,updated_at,status_lookup_code&email=eq.${encodeURIComponent(email)}&status_lookup_code=eq.${encodeURIComponent(statusLookupCode)}&limit=1`,
    {
      method: 'GET',
      headers: buildSupabaseRestHeaders(serviceRoleKey, {
        accept: 'application/json',
      }),
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    return NextResponse.json(
      { detail: 'Registration status could not be loaded securely. Please try again later.' },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const records = (await response.json().catch(() => [])) as Array<{
    full_name: string;
    role: 'candidate' | 'referrer' | 'mentor';
    status: string;
    whatsapp_group_consent: boolean;
    whatsapp_group_status: string;
    created_at: string;
    updated_at: string;
  }>;

  if (!records.length) {
    return NextResponse.json(
      { detail: 'No registration matched that email address and tracking code.' },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  const record = records[0];
  return NextResponse.json(
    {
      full_name: record.full_name,
      role: record.role,
      status: record.status,
      status_message: STATUS_COPY[record.status] || 'Your registration status is available.',
      whatsapp_group_consent: record.whatsapp_group_consent,
      whatsapp_group_status: record.whatsapp_group_status,
      whatsapp_message: WHATSAPP_COPY[record.whatsapp_group_status] || 'WhatsApp invite status is available.',
      submitted_at: record.created_at,
      updated_at: record.updated_at,
    },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}
