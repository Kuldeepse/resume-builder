import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE_NAME = 'cognitwist_admin_session';

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function getExpectedPassword() {
  return process.env.CAREER_NETWORK_ADMIN_PASSWORD || '';
}

function getSessionToken() {
  const password = getExpectedPassword();
  return password ? sha256(password) : '';
}

export function isAdminSessionValue(value: string | undefined) {
  const expected = getSessionToken();
  if (!value || !expected) return false;

  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return isAdminSessionValue(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
}

export async function requireAdminAuth() {
  const authenticated = await isAdminAuthenticated();
  if (!authenticated) {
    redirect('/admin/career-network/login');
  }
}

export function validateAdminPassword(password: string) {
  const expected = getExpectedPassword();
  if (!password || !expected) return false;

  const actualBuffer = Buffer.from(password);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function buildAdminSessionCookie() {
  return {
    name: ADMIN_COOKIE_NAME,
    value: getSessionToken(),
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 12,
  };
}
