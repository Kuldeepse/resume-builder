import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicateRegistrationResponse, isDuplicateRegistration } from './registration-security.mjs';

test('only a confirmed uniqueness conflict is treated as duplicate', () => {
  assert.equal(isDuplicateRegistration(409, '23505'), true);
  assert.equal(isDuplicateRegistration(409, 'other'), false);
  assert.equal(isDuplicateRegistration(500, '23505'), false);
});

test('duplicate response never returns existing tracking code, registration ID or private data', () => {
  const response = duplicateRegistrationResponse();
  assert.equal(response.status_lookup_code, null);
  assert.equal(response.registration_id, null);
  assert.ok(!('email' in response));
  assert.ok(!('full_name' in response));
  assert.match(response.message, /existing registration details have not been changed/i);
});
