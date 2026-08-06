import { NextRequest, NextResponse } from 'next/server';
import { buildAdminSessionCookie, validateAdminAccessCode } from '@/app/admin/career-network/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

function getClientKey(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: NextRequest) {
  const clientKey = getClientKey(request);
  const now = Date.now();
  const current = attempts.get(clientKey);

  if (current && current.resetAt > now && current.count >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { detail: 'Too many access attempts. Try again later.' },
      { status: 429, headers: { ...NO_STORE_HEADERS, 'Retry-After': String(Math.ceil((current.resetAt - now) / 1000)) } },
    );
  }

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: 'Invalid access request.' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const accessCode = typeof body.accessCode === 'string' ? body.accessCode : '';
  if (!validateAdminAccessCode(accessCode)) {
    const next = current && current.resetAt > now
      ? { count: current.count + 1, resetAt: current.resetAt }
      : { count: 1, resetAt: now + WINDOW_MS };
    attempts.set(clientKey, next);

    return NextResponse.json({ detail: 'Incorrect administrator access code.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  attempts.delete(clientKey);
  const response = NextResponse.json({ status: 'ok' }, { status: 200, headers: NO_STORE_HEADERS });
  response.cookies.set(buildAdminSessionCookie());
  return response;
}
