import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cleanText,
  getAllowedOrigins,
  isAllowedOrigin,
  validateRegistrationPayload,
} from './policy.mjs';

test('cleanText trims, collapses whitespace, and truncates', () => {
  assert.equal(cleanText('  Alice   Smith  ', 20), 'Alice Smith');
  assert.equal(cleanText('abcdef', 3), 'abc');
  assert.equal(cleanText(null, 10), '');
});

test('allows default, configured, and matching vercel preview origins', () => {
  assert.equal(isAllowedOrigin('https://rolecraftai.duckdns.org'), true);
  assert.equal(isAllowedOrigin('https://custom.rolecraft.ai', 'https://custom.rolecraft.ai'), true);
  assert.equal(
    isAllowedOrigin('https://resume-builder-feature-resume-builder-s-projects.vercel.app'),
    true,
  );
  assert.equal(isAllowedOrigin('https://example.com'), false);
});

test('deduplicates configured origins', () => {
  assert.deepEqual(getAllowedOrigins('https://rolecraftai.duckdns.org, https://custom.rolecraft.ai'), [
    'https://rolecraftai.duckdns.org',
    'https://resume-builder-ha5ykxvh9-resume-builder-s-projects.vercel.app',
    'https://custom.rolecraft.ai',
  ]);
});

test('accepts a valid candidate registration payload', () => {
  const result = validateRegistrationPayload({
    full_name: ' Alice Smith ',
    email: ' ALICE@EXAMPLE.COM ',
    role: 'candidate',
    linkedin_profile: 'https://www.linkedin.com/in/alice-smith',
    current_company: '',
    professional_area: 'Cybersecurity',
    privacy_notice_version: '2026-08-02',
    terms_accepted: true,
    age_confirmed: true,
    marketing_opt_in: false,
    website: '',
  });

  assert.equal(result.ok, true);
  assert.equal(result.honeypotTriggered, false);
  assert.equal(result.record.email, 'alice@example.com');
  assert.equal(result.record.role, 'candidate');
  assert.equal(result.record.status, 'pending_verification');
});

test('rejects invalid linkedin URLs and missing referrer company', () => {
  const linkedinResult = validateRegistrationPayload({
    full_name: 'Alice Smith',
    email: 'alice@example.com',
    role: 'candidate',
    linkedin_profile: 'https://example.com/alice',
    professional_area: 'Cybersecurity',
    privacy_notice_version: '2026-08-02',
    terms_accepted: true,
    age_confirmed: true,
    website: '',
  });
  assert.equal(linkedinResult.ok, false);
  assert.equal(linkedinResult.detail, 'LinkedIn profile must use a linkedin.com URL.');

  const referrerResult = validateRegistrationPayload({
    full_name: 'Alice Smith',
    email: 'alice@example.com',
    role: 'referrer',
    linkedin_profile: '',
    current_company: '',
    professional_area: 'Cybersecurity',
    privacy_notice_version: '2026-08-02',
    terms_accepted: true,
    age_confirmed: true,
    website: '',
  });
  assert.equal(referrerResult.ok, false);
  assert.equal(referrerResult.detail, 'Current company is required for referrer registration.');
});

test('treats honeypot submissions as silently accepted', () => {
  const result = validateRegistrationPayload({
    website: 'spam.example',
  });

  assert.equal(result.ok, true);
  assert.equal(result.honeypotTriggered, true);
  assert.equal(Object.hasOwn(result, 'record'), false);
});
