import { NextRequest, NextResponse } from 'next/server';
import { buildAdminSessionCookie, validateAdminPassword } from '@/app/admin/career-network/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
};

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: 'Invalid login request.' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (!validateAdminPassword(password)) {
    return NextResponse.json({ detail: 'Incorrect admin password.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const response = NextResponse.json({ status: 'ok' }, { status: 200, headers: NO_STORE_HEADERS });
  response.cookies.set(buildAdminSessionCookie());
  return response;
}
