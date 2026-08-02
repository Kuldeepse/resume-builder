import { NextRequest, NextResponse } from 'next/server';
import { isAllowedOrigin, validateRegistrationPayload } from './policy.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
};

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!isAllowedOrigin(origin, process.env.CAREER_NETWORK_ALLOWED_ORIGINS || '')) {
    return NextResponse.json({ detail: 'Origin is not allowed.' }, { status: 403, headers: NO_STORE_HEADERS });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { detail: 'Private registration storage is not configured.' },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: 'Invalid registration request.' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const validation = validateRegistrationPayload(body);
  if (validation.ok && validation.honeypotTriggered) {
    return NextResponse.json({ status: 'received' }, { status: 201, headers: NO_STORE_HEADERS });
  }

  if (!validation.ok) {
    return NextResponse.json({ detail: validation.detail }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const storageResponse = await fetch(
    `${supabaseUrl.replace(/\/$/, '')}/rest/v1/career_network_registrations?on_conflict=email,role`,
    {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(validation.record),
      cache: 'no-store',
    },
  );

  if (!storageResponse.ok) {
    return NextResponse.json(
      { detail: 'Registration could not be stored securely. Please try again later.' },
      { status: 503, headers: NO_STORE_HEADERS },
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
      headers: NO_STORE_HEADERS,
    },
  );
}
