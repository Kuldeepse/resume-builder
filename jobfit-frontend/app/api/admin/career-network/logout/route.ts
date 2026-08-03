import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME } from '@/app/admin/career-network/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL('/admin/career-network/login?logged_out=1', request.url), 303);
  response.headers.set('Cache-Control', 'no-store');
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
