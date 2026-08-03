import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSupabaseRestHeaders, isSupabaseSecretKey } from './supabase-rest.mjs';

test('recognises sb_secret keys', () => {
  assert.equal(isSupabaseSecretKey('sb_secret_123'), true);
  assert.equal(isSupabaseSecretKey('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example'), false);
});

test('builds headers for legacy JWT service_role keys', () => {
  const headers = buildSupabaseRestHeaders('legacy-jwt-key', {
    accept: 'application/json',
    contentType: 'application/json',
    prefer: 'resolution=merge-duplicates,return=representation',
  });

  assert.equal(headers.apikey, 'legacy-jwt-key');
  assert.equal(headers.Authorization, 'Bearer legacy-jwt-key');
  assert.equal(headers.Accept, 'application/json');
  assert.equal(headers['Content-Type'], 'application/json');
  assert.equal(headers.Prefer, 'resolution=merge-duplicates,return=representation');
});

test('omits Authorization header for sb_secret keys', () => {
  const headers = buildSupabaseRestHeaders('sb_secret_123', {
    accept: 'application/json',
  });

  assert.equal(headers.apikey, 'sb_secret_123');
  assert.equal('Authorization' in headers, false);
  assert.equal(headers.Accept, 'application/json');
});
