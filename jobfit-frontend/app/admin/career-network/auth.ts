import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE_NAME = 'cognitwist_admin_session';

const SESSION_VERSION = 'v1';
const SESSION_TTL_SECONDS = 60 * 60 * 4;
const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

function getExpectedAccessCode() {
  return process.env.CAREER_NETWORK_ADMIN_ACCESS_CODE || process.env.CAREER_NETWORK_ADMIN_PASSWORD || '';
}

function getSessionSigningKey() {
  const accessCode = getExpectedAccessCode();
  if (!accessCode) return null;

  // Bind sessions to the current admin access code so rotating that code also
  // invalidates all existing sessions. A separate server-only secret adds
  // independent entropy without being required for backward-compatible deploys.
  const sessionSecret = process.env.CAREER_NETWORK_ADMIN_SESSION_SECRET || '';
  return createHash('sha256')
    .update(`cognitwist-admin-session\0${accessCode}\0${sessionSecret}`)
    .digest();
}

function signSessionPayload(payload: string) {
  const signingKey = getSessionSigningKey();
  if (!signingKey) return '';
  return createHmac('sha256', signingKey).update(payload).digest('base64url');
}

function safeEqualBase64Url(actual: string, expected: string) {
  try {
    const actualBuffer = Buffer.from(actual, 'base64url');
    const expectedBuffer = Buffer.from(expected, 'base64url');
    if (!actualBuffer.length || actualBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(actualBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export function isAdminSessionValue(value: string | undefined) {
  if (!value || !getSessionSigningKey()) return false;

  const parts = value.split('.');
  if (parts.length !== 5) return false;

  const [version, issuedAtRaw, expiresAtRaw, nonce, signature] = parts;
  if (version !== SESSION_VERSION || !nonce || nonce.length < 16) return false;

  const issuedAt = Number(issuedAtRaw);
  const expiresAt = Number(expiresAtRaw);
  const now = Math.floor(Date.now() / 1000);

  if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt)) return false;
  if (issuedAt > now + MAX_CLOCK_SKEW_SECONDS) return false;
  if (expiresAt <= now) return false;
  if (expiresAt <= issuedAt || expiresAt - issuedAt > SESSION_TTL_SECONDS + MAX_CLOCK_SKEW_SECONDS) return false;

  const payload = `${version}.${issuedAtRaw}.${expiresAtRaw}.${nonce}`;
  const expectedSignature = signSessionPayload(payload);
  return Boolean(expectedSignature) && safeEqualBase64Url(signature, expectedSignature);
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
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + SESSION_TTL_SECONDS;
  const nonce = randomBytes(18).toString('base64url');
  const payload = `${SESSION_VERSION}.${issuedAt}.${expiresAt}.${nonce}`;
  const signature = signSessionPayload(payload);

  if (!signature) {
    throw new Error('Administrator session signing is not configured.');
  }

  return {
    name: ADMIN_COOKIE_NAME,
    value: `${payload}.${signature}`,
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: true,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}
