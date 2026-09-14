import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const port = 3197;
const base = `http://127.0.0.1:${port}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function json(response) {
  const body = await response.text();
  try { return JSON.parse(body); } catch { throw new Error(`Expected JSON from ${response.url}, got: ${body.slice(0, 300)}`); }
}

async function waitForServer() {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${base}/live-interview`, { redirect: 'manual' });
      if (response.ok) return response;
      lastError = new Error(`Live Interview returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw lastError || new Error('Live Interview server did not become ready.');
}

const server = spawn('npm', ['run', 'start', '--', '-p', String(port)], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    PORT: String(port),
    NEXT_TELEMETRY_DISABLED: '1',
    // Force the deterministic production fallback path for repeatable CI testing.
    JOBFIT_BACKEND_URL: 'http://127.0.0.1:9',
  },
});

let stdout = '';
let stderr = '';
server.stdout.on('data', (chunk) => { stdout += String(chunk); process.stdout.write(chunk); });
server.stderr.on('data', (chunk) => { stderr += String(chunk); process.stderr.write(chunk); });

try {
  const pageResponse = await waitForServer();
  const page = await pageResponse.text();
  assert.match(page, /Interview Coach|Live Interview|Configure the simulation/i, 'Live Interview page did not render expected UI text.');

  const healthResponse = await fetch(`${base}/api/interview-coach`, { cache: 'no-store' });
  assert.equal(healthResponse.status, 200, 'Interview coach health proxy should remain available even when adaptive backend is unavailable.');
  const health = await json(healthResponse);
  assert.equal(health.fallback_available, true);
  assert.equal(health.persistent_memory, true);
  assert.equal(health.specialist_panel, true);

  const progress = [{
    role: 'Technical Programme Manager',
    at: '2026-09-14T10:00:00Z',
    turns: 5,
    contentAverage: 72,
    deliveryAverage: 70,
    readinessAverage: 71,
    evidenceScore: 12,
    structureScore: 10,
    technicalDepthScore: 13,
    communicationScore: 14,
    contentDimensions: [{ key: 'structure', label: 'Structure', score: 10 }],
    deliveryDimensions: [{ key: 'pace', label: 'Pace', score: 11 }],
  }];
  const { buildInterviewMemoryCookieValue } = await import('../lib/interview-agent-context.mjs');
  const memoryCookie = buildInterviewMemoryCookieValue(progress);

  const turnResponse = await fetch(`${base}/api/interview-coach`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `cognitwist_interview_memory=${memoryCookie}`,
    },
    body: JSON.stringify({
      role: 'Technical Programme Manager',
      company: 'Example Bank',
      job_description: 'Lead secure platform delivery.\n\nInterview simulation: Hiring Manager. Balanced evidence-led hiring-manager style.',
      interview_type: 'behavioural',
      question: 'Tell me about a major delivery risk you managed.',
      answer: 'I assessed the dependency impact, led the recovery plan, aligned security and architecture, and delivered the remediation in 3 weeks with zero critical incidents.',
      candidate_evidence: ['I led a 3-week remediation with zero critical incidents.'],
      history: [],
    }),
  });
  assert.equal(turnResponse.status, 200);
  const turn = await json(turnResponse);
  assert.equal(turn.mode, 'fallback');
  assert.equal(turn.degraded_reason, 'adaptive_ai_unavailable');
  assert.equal(turn.assessment.dimensions.length, 5);
  assert.equal(turn.agent_context.persistent_memory, true);
  assert.equal(turn.agent_context.memory_sessions, 1);
  assert.equal(turn.agent_context.panel_agent, 'Hiring Manager');
  assert.equal(turn.agent_context.next_panel_agent, 'Principal Architect');
  assert.match(turn.assessment.next_question, /architecture|technical|resilience|security|performance|non-functional/i, 'Panel hand-off should generate a Principal Architect question.');
  assert.ok(turn.assessment.evidence_findings.some((item) => item.status === 'confirmed'), 'Evidence-safe fallback should retain confirmed evidence findings.');

  const expectedResponse = await fetch(`${base}/api/interview-coach/expected`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `cognitwist_interview_memory=${memoryCookie}`,
    },
    body: JSON.stringify({
      role: 'Technical Programme Manager',
      company: 'Example Bank',
      job_description: 'Lead secure platform delivery.',
      interview_type: 'technical',
      question: 'How did you manage security, resilience, performance and observability requirements?',
      candidate_evidence: ['I led a 3-week remediation with zero critical incidents.'],
      history: [],
    }),
  });
  assert.equal(expectedResponse.status, 200);
  const expected = await json(expectedResponse);
  assert.equal(expected.mode, 'fallback');
  assert.equal(expected.agent_context.persistent_memory, true);
  assert.equal(expected.agent_context.memory_sessions, 1);
  assert.equal(expected.question, 'How did you manage security, resilience, performance and observability requirements?');
  assert.ok(String(expected.expected_response || '').length > 40);

  console.log('\nLive Interview E2E smoke passed: page, health, stateful panel turn, persistent memory and expected-response fallback.');
} catch (error) {
  console.error('\nLive Interview E2E smoke failed.');
  console.error(error);
  if (stdout) console.error(`\nServer stdout:\n${stdout.slice(-4000)}`);
  if (stderr) console.error(`\nServer stderr:\n${stderr.slice(-4000)}`);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => server.once('exit', resolve)),
    sleep(2500),
  ]);
  if (!server.killed) server.kill('SIGKILL');
}
