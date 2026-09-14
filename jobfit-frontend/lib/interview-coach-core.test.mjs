import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFallbackCoachTurn, normaliseCoachInput, validateCoachInput } from './interview-coach-runtime.mjs';

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

test('weak answer returns a complete question-specific model response, not STAR placeholders', () => {
  const result = buildFallbackCoachTurn({
    ...base,
    answer: 'I have done this only, thanks.',
  });
  assert.equal(result.mode, 'fallback');
  assert.match(result.assessment.revised_answer, /Illustrative model answer/i);
  assert.match(result.assessment.revised_answer, /critical dependency|delivery/i);
  assert.doesNotMatch(result.assessment.revised_answer, /Task:\s*\[/i);
  assert.doesNotMatch(result.assessment.revised_answer, /Action:\s*\[/i);
  assert.doesNotMatch(result.assessment.revised_answer, /Result:\s*\[/i);
});

test('candidate evidence is used in the expected response when available', () => {
  const evidence = 'I led a remediation plan across security and architecture teams and recovered the release in 3 weeks with zero critical incidents.';
  const result = buildFallbackCoachTurn({
    ...base,
    answer: 'I managed a major delivery risk.',
    candidate_evidence: [evidence],
  });
  assert.equal(result.assessment.response_basis, 'verified_evidence');
  assert.match(result.assessment.revised_answer, /remediation plan/i);
  assert.match(result.assessment.revised_answer, /3 weeks/i);
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
  assert.ok(result.assessment.dimensions.some((item) => /options considered|decision criteria|downside mitigation/i.test(item.label)));
});

test('risk and prioritisation questions use materially different fallback rubrics', () => {
  const answer = 'I assessed the impact, compared the options, aligned stakeholders and delivered the agreed plan in 3 weeks.';
  const risk = buildFallbackCoachTurn({
    ...base,
    question: 'Tell me about a major dependency or risk that threatened delivery.',
    answer,
  });
  const priority = buildFallbackCoachTurn({
    ...base,
    question: 'How did you prioritise competing stakeholder requests with a tight deadline and limited resources?',
    answer,
  });
  const riskLabels = risk.assessment.dimensions.map((item) => item.label).join('|');
  const priorityLabels = priority.assessment.dimensions.map((item) => item.label).join('|');
  assert.notEqual(riskLabels, priorityLabels);
  assert.match(riskLabels, /Risk and impact diagnosis|Recovery and control/i);
  assert.match(priorityLabels, /Competing-demand|Prioritisation criteria|Trade-off quality/i);
});

test('quality defect question scores release decision and remediation rather than generic STAR only', () => {
  const result = buildFallbackCoachTurn({
    ...base,
    question: 'What would you do if a significant software bug was found the day before release?',
    answer: 'I would assess severity and customer impact, make the go/no-go decision with engineering, validate the remediation and keep rollback ready.',
  });
  const labels = result.assessment.dimensions.map((item) => item.label).join('|');
  assert.match(labels, /Defect severity|Release decision|Remediation/i);
});
