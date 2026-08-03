import test from 'node:test';
import assert from 'node:assert/strict';

import {
  renderAdminAlertEmail,
  renderRegistrantConfirmationEmail,
} from './career-network-email.mjs';

test('renders registrant confirmation email with tracking code and status url', () => {
  const result = renderRegistrantConfirmationEmail({
    fullName: 'Alice Smith',
    role: 'candidate',
    statusLookupCode: 'AB12CD34EF56',
    statusUrl: 'https://rolecraftai.duckdns.org/career-network/status',
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
    adminUrl: 'https://rolecraftai.duckdns.org/admin/career-network',
  });

  assert.match(result.subject, /Alice Smith/);
  assert.match(result.html, /Cloud engineering/);
  assert.match(result.html, /admin dashboard/i);
  assert.match(result.text, /WhatsApp consent: Yes/);
});
