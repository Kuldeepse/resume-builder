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
  assert.equal(isAllowedOrigin('https://cognitwistai.duckdns.org'), true);
  assert.equal(isAllowedOrigin('https://custom.cognitwist.ai', 'https://custom.cognitwist.ai'), true);
  assert.equal(
    isAllowedOrigin('https://resume-builder-feature-resume-builder-s-projects.vercel.app'),
    true,
  );
  assert.equal(isAllowedOrigin('https://example.com'), false);
});

test('deduplicates configured origins', () => {
  assert.deepEqual(getAllowedOrigins('https://cognitwistai.duckdns.org, https://custom.cognitwist.ai'), [
    'https://cognitwistai.duckdns.org',
    'https://resume-builder-ha5ykxvh9-resume-builder-s-projects.vercel.app',
    'https://custom.cognitwist.ai',
  ]);
});

test('accepts a valid candidate registration payload', () => {
  const result = validateRegistrationPayload({
    full_name: ' Alice Smith ',
    email: ' ALICE@EXAMPLE.COM ',
    role: 'candidate',
    linkedin_profile: 'https://www.linkedin.com/in/alice-smith',
    whatsapp_number: '+44 7700 900123',
    current_company: '',
    professional_area: 'Cybersecurity',
    privacy_notice_version: '2026-08-02',
    terms_accepted: true,
    age_confirmed: true,
    marketing_opt_in: false,
    whatsapp_group_consent: true,
    website: '',
  });

  assert.equal(result.ok, true);
  assert.equal(result.honeypotTriggered, false);
  assert.equal(result.record.email, 'alice@example.com');
  assert.equal(result.record.role, 'candidate');
  assert.equal(result.record.status, 'pending_verification');
  assert.equal(result.record.whatsapp_group_consent, true);
  assert.equal(result.record.whatsapp_group_status, 'pending_approval');
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

test('rejects whatsapp consent without a number and rejects malformed numbers', () => {
  const missingNumberResult = validateRegistrationPayload({
    full_name: 'Alice Smith',
    email: 'alice@example.com',
    role: 'candidate',
    linkedin_profile: '',
    professional_area: 'Cybersecurity',
    privacy_notice_version: '2026-08-02',
    terms_accepted: true,
    age_confirmed: true,
    whatsapp_group_consent: true,
    whatsapp_number: '',
    website: '',
  });
  assert.equal(missingNumberResult.ok, false);
  assert.equal(missingNumberResult.detail, 'Enter a WhatsApp number if you want group-invite consent recorded.');

  const malformedNumberResult = validateRegistrationPayload({
    full_name: 'Alice Smith',
    email: 'alice@example.com',
    role: 'candidate',
    linkedin_profile: '',
    professional_area: 'Cybersecurity',
    privacy_notice_version: '2026-08-02',
    terms_accepted: true,
    age_confirmed: true,
    whatsapp_group_consent: false,
    whatsapp_number: 'not-a-number',
    website: '',
  });
  assert.equal(malformedNumberResult.ok, false);
  assert.equal(malformedNumberResult.detail, 'WhatsApp number must look like a valid phone number.');
});

test('treats honeypot submissions as silently accepted', () => {
  const result = validateRegistrationPayload({
    website: 'spam.example',
  });

  assert.equal(result.ok, true);
  assert.equal(result.honeypotTriggered, true);
  assert.equal(Object.hasOwn(result, 'record'), false);
});
