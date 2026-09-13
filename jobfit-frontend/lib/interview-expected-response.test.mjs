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

test('risk question gets a risk-specific expected response', () => {
  const result = buildExpectedInterviewResponse({ ...base, interview_type: 'behavioural', question: 'Tell me about a major dependency or risk that threatened delivery.' });
  assert.equal(result.intent, 'risk');
  assert.match(result.expected_response, /what was at risk/i);
  assert.match(result.expected_response, /verified/i);
});

test('architecture question gets technical architecture structure', () => {
  const result = buildExpectedInterviewResponse({ ...base, interview_type: 'technical', question: 'Walk me through the architecture of a complex platform you delivered.' });
  assert.equal(result.intent, 'architecture');
  assert.match(result.expected_response, /components|integrations|data flows/i);
});

test('available candidate evidence is surfaced without inventing metrics', () => {
  const result = buildExpectedInterviewResponse({ ...base, interview_type: 'behavioural', question: 'Describe a delivery risk you managed.' });
  assert.ok(result.relevant_evidence.length > 0);
  assert.ok(result.expected_response.includes(result.relevant_evidence[0]));
  assert.ok(!/\b99%\b/.test(result.expected_response));
});

test('missing candidate evidence stays as a placeholder', () => {
  const result = buildExpectedInterviewResponse({ role: 'Product Manager', interview_type: 'behavioural', question: 'Tell me about a stakeholder disagreement.', candidate_evidence: [] });
  assert.match(result.expected_response, /\[Choose one verified example/i);
  assert.equal(result.evidence_safe, true);
});
