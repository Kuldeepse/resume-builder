import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyseInterviewDelivery,
  buildInterviewSessionReport,
  buildMicroDrills,
  buildProgressInsights,
  buildTargetedRetry,
  combineInterviewReadiness,
} from './interview-performance.mjs';

test('strong measured delivery scores well with controlled pace and few fillers', () => {
  const text = 'I led the recovery plan after a critical dependency threatened the release. I clarified the root cause, aligned architecture and security, introduced a rollback gate and validated the release evidence. I then tracked the actions through closure and communicated the decision clearly to stakeholders. The release completed successfully and I captured the lessons for the next deployment.';
  const result = analyseInterviewDelivery({ text, duration_sec: 33, source: 'speech', segments: [{ at_ms: 0 }, { at_ms: 8000 }, { at_ms: 15000 }, { at_ms: 24000 }] });
  assert.ok(result.wpm >= 90 && result.wpm <= 185);
  assert.ok(result.score >= 70);
  assert.equal(result.filler_count, 0);
  assert.equal(result.duration_source, 'speech_measured');
});

test('fast filler-heavy repetitive answer receives targeted delivery coaching', () => {
  const text = 'Um basically I led the team and you know I led the team and basically we moved fast. I led the team and like we moved fast and um we just delivered it.';
  const result = analyseInterviewDelivery({ text, duration_sec: 8, source: 'speech', segments: [{ at_ms: 0 }, { at_ms: 3500 }, { at_ms: 7600 }] });
  assert.ok(result.wpm > 185);
  assert.ok(result.filler_count >= 5);
  assert.ok(result.repetitions.length > 0);
  assert.ok(result.coaching.some((item) => /Slow|filler|repetition/i.test(item)));
});

test('long transcript segment gaps are counted as long pauses', () => {
  const result = analyseInterviewDelivery({
    text: 'I identified the issue. I reviewed the options. I made the decision.',
    duration_sec: 20,
    source: 'speech',
    segments: [{ at_ms: 1000 }, { at_ms: 4500 }, { at_ms: 9000 }, { at_ms: 12000 }],
  });
  assert.equal(result.long_pause_count, 3);
});

test('readiness weights content more heavily than delivery', () => {
  assert.equal(combineInterviewReadiness(90, 60), 81);
  assert.equal(combineInterviewReadiness(60, 90), 69);
});

test('targeted retry combines weakest content and delivery targets', () => {
  const targets = buildTargetedRetry({
    content_dimensions: [
      { key: 'relevance', label: 'Role relevance', score: 18 },
      { key: 'ownership', label: 'Personal ownership', score: 9 },
    ],
    delivery: {
      wpm: 194,
      filler_count: 6,
      ownership: { i_count: 1, we_count: 4, i_ratio_pct: 20 },
      dimensions: { pace: 55, fillers: 62, conciseness: 80, ownership: 48, fluency: 75 },
    },
  });
  assert.ok(targets.some((item) => /personal ownership/i.test(item)));
  assert.ok(targets.some((item) => /pace/i.test(item)));
});

test('micro drills turn retry weaknesses into short measurable practice', () => {
  const drills = buildMicroDrills({
    question: 'Tell me about a major delivery risk you managed.',
    retry_targets: ['Delivery: improve pace.', 'Filler target: fewer than 4 filler words.', 'Ownership target: make your personal decisions explicit.'],
  });
  assert.ok(drills.length >= 3);
  assert.ok(drills.some((item) => item.id === 'pace' && item.duration_minutes <= 4));
  assert.ok(drills.some((item) => /fewer than 4/i.test(item.success_criteria)));
  assert.ok(drills.some((item) => /personal accountability/i.test(item.success_criteria)));
});

test('session report exposes content, delivery, evidence and competency detail', () => {
  const report = buildInterviewSessionReport([
    {
      question: 'Q1', content_score: 80, delivery_score: 60, readiness_score: 74,
      content_dimensions: [{ key: 'structure', label: 'STAR structure', score: 14 }, { key: 'evidence', label: 'Evidence', score: 16 }],
      delivery_dimensions: { pace: 70, fillers: 80, conciseness: 65 },
      evidence_findings: [{ status: 'confirmed' }, { status: 'partial' }],
    },
    {
      question: 'Q2', content_score: 90, delivery_score: 80, readiness_score: 87,
      content_dimensions: [{ key: 'structure', label: 'STAR structure', score: 18 }, { key: 'evidence', label: 'Evidence', score: 18 }],
      delivery_dimensions: { pace: 90, fillers: 90, conciseness: 85 },
      evidence_findings: [{ status: 'confirmed' }, { status: 'confirmed' }],
    },
    {
      question: 'Q3', content_score: 70, delivery_score: 70, readiness_score: 70,
      content_dimensions: [{ key: 'structure', label: 'STAR structure', score: 12 }, { key: 'evidence', label: 'Evidence', score: 13 }],
      delivery_dimensions: { pace: 75, fillers: 75, conciseness: 75 },
      evidence_findings: [{ status: 'unknown' }],
    },
  ]);
  assert.equal(report.turns, 3);
  assert.equal(report.content_average, 80);
  assert.equal(report.delivery_average, 70);
  assert.equal(report.readiness_average, 77);
  assert.ok(report.evidence_score > 0);
  assert.ok(report.structure_score > 0);
  assert.ok(report.communication_score > 0);
  assert.ok(report.content_dimensions.some((item) => item.key === 'structure'));
  assert.ok(report.delivery_dimensions.some((item) => item.key === 'pace'));
  assert.equal(report.strongest_turn.question, 'Q2');
  assert.equal(report.weakest_turn.question, 'Q3');
});

test('progress insights return first latest best and readiness delta for a role', () => {
  const sessions = [
    { at: '2026-09-01T10:00:00Z', role: 'TPM', readinessAverage: 62 },
    { at: '2026-09-03T10:00:00Z', role: 'Other', readinessAverage: 95 },
    { at: '2026-09-05T10:00:00Z', role: 'TPM', readinessAverage: 78 },
    { at: '2026-09-08T10:00:00Z', role: 'TPM', readinessAverage: 73 },
  ];
  const result = buildProgressInsights(sessions, 'TPM');
  assert.equal(result.sessions, 3);
  assert.equal(result.first.readinessAverage, 62);
  assert.equal(result.latest.readinessAverage, 73);
  assert.equal(result.best.readinessAverage, 78);
  assert.equal(result.readiness_delta, 11);
});
