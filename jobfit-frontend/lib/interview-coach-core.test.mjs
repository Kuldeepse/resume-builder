import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFallbackCoachTurn, normaliseCoachInput, validateCoachInput } from './interview-coach-core.mjs';

const base = {
  role: 'Technical Project Manager',
  company: 'Example Bank',
  job_description: 'Lead secure mobile and digital delivery across engineering, architecture, security, risk and release management.',
  interview_type: 'behavioural',
  question: 'Tell me about a major delivery risk you managed.',
  history: [],
};

test('rejects empty answers before coaching', () => {
  const input = normaliseCoachInput({ ...base, answer: ' ' });
  assert.match(validateCoachInput(input), /fuller answer/i);
});

test('keeps missing metrics as a visible placeholder instead of inventing one', () => {
  const result = buildFallbackCoachTurn({
    ...base,
    answer: 'During a platform migration I owned the delivery risk. I coordinated architecture and security teams and introduced a rollback gate before release.',
  });
  assert.equal(result.mode, 'fallback');
  assert.match(result.assessment.revised_answer, /\[add a verified metric or outcome\]/i);
  assert.ok(!/\b\d+%\b/.test(result.assessment.revised_answer));
});

test('recognises personal action and a supplied metric as explicit evidence', () => {
  const result = buildFallbackCoachTurn({
    ...base,
    answer: 'I led the remediation plan and coordinated security, architecture and release teams. I delivered the recovery in 3 weeks and reduced open defects by 40%.',
  });
  assert.ok(result.assessment.evidence_findings.some((item) => item.status === 'confirmed' && /Personal action/i.test(item.claim)));
  assert.ok(result.assessment.evidence_findings.some((item) => item.status === 'confirmed' && /measurable/i.test(item.claim)));
});

test('adaptive next question avoids questions already used in history', () => {
  const first = 'Tell me about a major dependency or risk that threatened delivery. What did you personally do?';
  const result = buildFallbackCoachTurn({
    ...base,
    question: first,
    answer: 'I led the recovery plan and delivered a verified service improvement in 4 weeks.',
    history: [{ question: first, answer: 'Earlier answer', score: 70 }],
  });
  assert.notEqual(result.assessment.next_question, first);
});

test('technical coaching always returns five bounded dimensions summing to total', () => {
  const result = buildFallbackCoachTurn({
    ...base,
    interview_type: 'technical',
    question: 'Explain a technical trade-off you made.',
    answer: 'I evaluated two deployment options and chose a phased rollout because it reduced rollback risk. I tested failover, monitored latency and delivered the release with zero critical incidents.',
  });
  assert.equal(result.assessment.dimensions.length, 5);
  assert.ok(result.assessment.dimensions.every((item) => item.score >= 0 && item.score <= 20));
  assert.equal(result.assessment.total, result.assessment.dimensions.reduce((sum, item) => sum + item.score, 0));
});
