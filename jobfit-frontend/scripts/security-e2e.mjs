import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

const appPort = 3198;
const dbPort = 3199;
const app = `http://127.0.0.1:${appPort}`;
let mode = 'duplicate';
let inserts = 0;
let updates = 0;

const database = createServer(async (request, response) => {
  if (request.method === 'POST' && request.url?.startsWith('/rest/v1/career_network_registrations')) {
    inserts += 1;
    const url = new URL(request.url, `http://127.0.0.1:${dbPort}`);
    assert.equal(url.searchParams.has('on_conflict'), false, 'Registration must not upsert existing records');
    assert.doesNotMatch(String(request.headers.prefer || ''), /merge-duplicates/i);
    for await (const _ of request) { /* consume the inserted test data */ }
    response.setHeader('Content-Type', 'application/json');
    if (mode === 'duplicate') {
      response.writeHead(409);
      response.end(JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint' }));
    } else if (mode === 'error') {
      response.writeHead(409);
      response.end(JSON.stringify({ code: 'XX000', message: 'other database failure' }));
    } else {
      response.writeHead(201);
      response.end(JSON.stringify([{ id: 'new-test-id', status_lookup_code: 'NEWTESTCODE1' }]));
    }
    return;
  }
  if (request.method === 'PATCH' && request.url?.startsWith('/rest/v1/career_network_registrations')) {
    updates += 1;
    for await (const _ of request) { /* no real database */ }
    response.writeHead(204).end();
    return;
  }
  response.writeHead(404).end();
});

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForApp() {
  for (let attempt = 0; attempt < 70; attempt += 1) {
    try {
      const response = await fetch(`${app}/live-interview`, { signal: AbortSignal.timeout(3000) });
      if (response.ok) return response;
    } catch { /* server not listening yet */ }
    await sleep(250);
  }
  throw new Error('Local Next.js server failed to start');
}

await new Promise((resolve, reject) => {
  database.once('error', reject);
  database.listen(dbPort, '127.0.0.1', resolve);
});

const server = spawn(process.execPath, ['./node_modules/next/dist/bin/next', 'start', '-p', String(appPort)], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: '1',
    SUPABASE_URL: `http://127.0.0.1:${dbPort}`,
    SUPABASE_SERVICE_ROLE_KEY: 'test-only-fake-key-not-a-real-secret',
    CAREER_NETWORK_ALLOWED_ORIGINS: app,
    // Explicitly disable real notification sending in the isolated test.
    RESEND_API_KEY: '',
    CAREER_NETWORK_EMAIL_FROM: '',
  },
});
let output = '';
server.stdout.on('data', (chunk) => { output += String(chunk); });
server.stderr.on('data', (chunk) => { output += String(chunk); });

const registration = {
  full_name: 'Test Impersonator',
  email: 'victim@example.test',
  role: 'candidate',
  professional_area: 'Cloud security',
  privacy_notice_version: '2026-09',
  terms_accepted: true,
  age_confirmed: true,
  whatsapp_group_consent: false,
  website: '',
};

async function postRegistration() {
  const response = await fetch(`${app}/api/career-network/register`, {
    method: 'POST',
    signal: AbortSignal.timeout(7000),
    headers: { Origin: app, 'Content-Type': 'application/json' },
    body: JSON.stringify(registration),
  });
  return { status: response.status, body: await response.json() };
}

try {
  const page = await waitForApp();
  assert.match(page.headers.get('permissions-policy') || '', /camera=\(self\)/);
  const invalidLogo = await fetch(`${app}/api/company-logo?domain=127.0.0.1`, { signal: AbortSignal.timeout(3000) });
  assert.equal(invalidLogo.status, 404, 'Proxy must reject attacker-supplied/non-allowlisted targets');

  mode = 'duplicate';
  const duplicate = await postRegistration();
  assert.equal(duplicate.status, 202);
  assert.equal(duplicate.body.registration_id, null);
  assert.equal(duplicate.body.status_lookup_code, null);
  assert.equal(updates, 0, 'Duplicate cannot update any existing private registration');

  mode = 'error';
  const nonDuplicateError = await postRegistration();
  assert.equal(nonDuplicateError.status, 503, 'Unrelated persistence failures must not be treated as duplicates');
  assert.equal(nonDuplicateError.body.status_lookup_code, undefined);

  mode = 'created';
  const newlyCreated = await postRegistration();
  assert.equal(newlyCreated.status, 201);
  assert.equal(newlyCreated.body.status_lookup_code, 'NEWTESTCODE1');
  assert.equal(inserts, 3);

  console.log('Security HTTP smoke passed: origin-safe logo, duplicate-registration privacy, error handling and new registration.');
} catch (error) {
  console.error('Security HTTP smoke failed:', error);
  console.error(output.slice(-4000));
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => server.once('exit', resolve)), sleep(2500)]);
  if (server.exitCode == null) server.kill('SIGKILL');
  await new Promise((resolve) => database.close(resolve));
}
