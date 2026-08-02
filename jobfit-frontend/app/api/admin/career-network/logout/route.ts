import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME } from '@/app/admin/career-network/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ status: 'ok' }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 0,
  });
  return response;
}
