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
  const result = buildExpectedInterviewResponse({ ...base, interview_type: 'behavioural', question: 'Tell me about a major dependency or risk that threatened delivery.' });
  assert.equal(result.intent, 'risk');
  assert.equal(result.basis, 'verified_evidence');
  assert.match(result.structure, /risk|impact|controls/i);
  assert.match(result.expected_response, /verified example|factual STAR core/i);
});

test('architecture question gets technical architecture structure', () => {
  const result = buildExpectedInterviewResponse({ ...base, interview_type: 'technical', question: 'Walk me through the architecture of a complex platform you delivered.' });
  assert.equal(result.intent, 'architecture');
  assert.match(result.structure, /architecture|data flow|dependencies/i);
  assert.match(result.expected_response, /platform context|components|dependencies/i);
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
  assert.match(result.expected_response, /stakeholder|decision|disagreed/i);
  assert.doesNotMatch(result.expected_response, /\[Choose one verified example/i);
  assert.doesNotMatch(result.expected_response, /Task:\s*\[/i);
  assert.doesNotMatch(result.expected_response, /Action:\s*\[/i);
  assert.doesNotMatch(result.expected_response, /Result:\s*\[/i);
  assert.equal(result.evidence_safe, true);
});
