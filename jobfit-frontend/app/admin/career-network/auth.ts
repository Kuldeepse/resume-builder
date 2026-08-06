import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE_NAME = 'cognitwist_admin_session';

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function getExpectedAccessCode() {
  return process.env.CAREER_NETWORK_ADMIN_ACCESS_CODE || process.env.CAREER_NETWORK_ADMIN_PASSWORD || '';
}

function getSessionToken() {
  const accessCode = getExpectedAccessCode();
  return accessCode ? sha256(accessCode) : '';
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

export function validateAdminAccessCode(accessCode: string) {
  const expected = getExpectedAccessCode();
  if (!accessCode || !expected) return false;

  const actualBuffer = Buffer.from(accessCode);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function buildAdminSessionCookie() {
  return {
    name: ADMIN_COOKIE_NAME,
    value: getSessionToken(),
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: true,
    path: '/admin/career-network',
    maxAge: 60 * 60 * 4,
  };
}
