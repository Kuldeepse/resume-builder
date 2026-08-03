import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCareerNetworkConfirmationEmail,
  renderAdminAlertEmail,
  renderRegistrantConfirmationEmail,
  renderRegistrantStatusUpdateEmail,
} from './career-network-email.mjs';
import { deriveEmailDeliveryState } from './career-network-email-status.mjs';

test('renders registrant confirmation email with tracking code and status url', () => {
  const result = renderRegistrantConfirmationEmail({
    fullName: 'Alice Smith',
    role: 'candidate',
    statusLookupCode: 'AB12CD34EF56',
    statusUrl: 'https://cognitwistai.duckdns.org/career-network/status',
    groupName: 'CogniTwist AI IT Jobs referrals UK',
  });

  assert.match(result.subject, /registration is in review/i);
  assert.match(result.html, /AB12CD34EF56/);
  assert.match(result.html, /career-network\/status/);
  assert.match(result.text, /Alice Smith/);
});

test('renders admin alert email with registration details', () => {
  const result = renderAdminAlertEmail({
    fullName: 'Alice Smith',
    email: 'alice@example.com',
    role: 'candidate',
    professionalArea: 'Cloud engineering',
    currentCompany: 'Contoso',
    whatsappGroupConsent: true,
    adminUrl: 'https://cognitwistai.duckdns.org/admin/career-network',
  });

  assert.match(result.subject, /Alice Smith/);
  assert.match(result.html, /Cloud engineering/);
  assert.match(result.html, /admin dashboard/i);
  assert.match(result.text, /WhatsApp consent: Yes/);
});

test('renders status update email with registration and whatsapp statuses', () => {
  const result = renderRegistrantStatusUpdateEmail({
    fullName: 'Alice Smith',
    role: 'candidate',
    registrationStatus: 'verified',
    whatsappStatus: 'approved',
    statusUrl: 'https://cognitwistai.duckdns.org/career-network/status',
  });

  assert.match(result.subject, /status has changed/i);
  assert.match(result.html, /verified/);
  assert.match(result.html, /approved/);
  assert.match(result.text, /career-network\/status/);
});

test('builds a confirmation email from a registration record', () => {
  const result = buildCareerNetworkConfirmationEmail({
    registration: {
      full_name: 'Alice Smith',
      email: 'alice@example.com',
      role: 'candidate',
      status_lookup_code: 'ZX98YU76TR54',
    },
    siteUrl: 'https://cognitwistai.duckdns.org',
    groupName: 'RoleCraft IT Jobs referrals UK',
  });

  assert.match(result.html, /ZX98YU76TR54/);
  assert.match(result.text, /RoleCraft IT Jobs referrals UK/);
});

test('derives sent email status from a fulfilled email result', () => {
  const result = deriveEmailDeliveryState({ status: 'fulfilled', value: { ok: true, skipped: false } });

  assert.equal(result.status, 'sent');
  assert.equal(result.error, null);
});

test('derives skipped email status from a skipped email result', () => {
  const result = deriveEmailDeliveryState(
    { status: 'fulfilled', value: { ok: false, skipped: true } },
    'Config missing',
  );

  assert.equal(result.status, 'skipped');
  assert.equal(result.error, 'Config missing');
});

test('derives failed email status from a rejected email result', () => {
  const result = deriveEmailDeliveryState({ status: 'rejected', reason: new Error('Resend failed') });

  assert.equal(result.status, 'failed');
  assert.match(result.error || '', /Resend failed/);
});
