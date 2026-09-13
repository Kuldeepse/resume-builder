import test from 'node:test';
import assert from 'node:assert/strict';

import { buildExpectedInterviewResponse } from './interview-expected-response.mjs';

const base = {
  role: 'Technical Project Manager',
  company: 'Example Bank',
  job_description: 'Lead secure mobile and digital delivery, manage risk, architecture, security and release readiness.',
  candidate_evidence: [
    'I led a domain controller technology refresh across data centres and validated failover before BAU handover.',
    'I remediated 150 non-AWS applications in 3 months and all passed validation.',
  ],
};

test('risk question gets a risk-specific evidence-grounded response', () => {
  const question = 'Tell me about a major dependency or risk that threatened delivery.';
  const result = buildExpectedInterviewResponse({ ...base, interview_type: 'behavioural', question });
  assert.equal(result.intent, 'risk');
  assert.equal(result.basis, 'verified_evidence');
  assert.match(result.structure, /risk|impact|controls/i);
  assert.ok(result.expected_response.includes(question));
  assert.match(result.expected_response, /what was at risk|root-cause|dependency/i);
});

test('architecture question gets technical architecture structure', () => {
  const question = 'Walk me through the architecture of a complex platform you delivered.';
  const result = buildExpectedInterviewResponse({ ...base, interview_type: 'technical', question });
  assert.equal(result.intent, 'architecture');
  assert.match(result.structure, /components|data flow|dependencies/i);
  assert.ok(result.expected_response.includes(question));
  assert.match(result.expected_response, /architecture subject|dependencies|NFR/i);
});

test('available candidate evidence is surfaced without inventing metrics', () => {
  const result = buildExpectedInterviewResponse({ ...base, interview_type: 'behavioural', question: 'Describe a delivery risk you managed.' });
  assert.ok(result.relevant_evidence.length > 0);
  assert.ok(result.expected_response.includes(result.relevant_evidence[0]));
  assert.ok(!/\b99%\b/.test(result.expected_response));
});

test('missing candidate evidence returns a complete illustrative model answer, not empty STAR placeholders', () => {
  const result = buildExpectedInterviewResponse({ role: 'Product Manager', interview_type: 'behavioural', question: 'Tell me about a stakeholder disagreement.', candidate_evidence: [] });
  assert.equal(result.basis, 'illustrative_model');
  assert.match(result.expected_response, /Illustrative model answer/i);
  assert.match(result.expected_response, /stakeholder|decision|disagreement/i);
  assert.doesNotMatch(result.expected_response, /Task:\s*\[/i);
  assert.doesNotMatch(result.expected_response, /Action:\s*\[/i);
  assert.doesNotMatch(result.expected_response, /Result:\s*\[/i);
  assert.equal(result.evidence_safe, true);
});

test('different behavioural questions produce materially different expected responses', () => {
  const pace = buildExpectedInterviewResponse({
    role: 'Technical Project Manager',
    interview_type: 'behavioural',
    question: 'How do you deliver quality work when a project has a very tight deadline and limited resources?',
    candidate_evidence: [],
  });
  const priority = buildExpectedInterviewResponse({
    role: 'Technical Project Manager',
    interview_type: 'behavioural',
    question: 'Tell me about a time you had to prioritise two competing stakeholder requests.',
    candidate_evidence: [],
  });
  const quality = buildExpectedInterviewResponse({
    role: 'Technical Project Manager',
    interview_type: 'behavioural',
    question: 'What would you do if a significant software bug was found the day before release?',
    candidate_evidence: [],
  });

  assert.equal(pace.intent, 'pace');
  assert.equal(priority.intent, 'stakeholder');
  assert.equal(quality.intent, 'quality');
  assert.notEqual(pace.expected_response, priority.expected_response);
  assert.notEqual(priority.expected_response, quality.expected_response);
  assert.match(pace.expected_response, /critical path|deadline|quality/i);
  assert.match(priority.expected_response, /stakeholder|decision|positions/i);
  assert.match(quality.expected_response, /defect|release decision|remediation/i);
});

test('fallback keeps the exact question visible even for unclassified behavioural prompts', () => {
  const questionA = 'Tell me about a time you improved communication across distributed teams.';
  const questionB = 'Tell me about a time you challenged an assumption made by a senior leader.';
  const a = buildExpectedInterviewResponse({ role: 'Delivery Manager', interview_type: 'behavioural', question: questionA, candidate_evidence: [] });
  const b = buildExpectedInterviewResponse({ role: 'Delivery Manager', interview_type: 'behavioural', question: questionB, candidate_evidence: [] });
  assert.ok(a.expected_response.includes(questionA));
  assert.ok(b.expected_response.includes(questionB));
  assert.notEqual(a.expected_response, b.expected_response);
});
