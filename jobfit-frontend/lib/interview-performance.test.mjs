import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyseInterviewDelivery,
  buildInterviewSessionReport,
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

test('session report returns content, delivery and readiness averages plus strongest and weakest turns', () => {
  const report = buildInterviewSessionReport([
    { question: 'Q1', content_score: 80, delivery_score: 60, readiness_score: 74 },
    { question: 'Q2', content_score: 90, delivery_score: 80, readiness_score: 87 },
    { question: 'Q3', content_score: 70, delivery_score: 70, readiness_score: 70 },
  ]);
  assert.equal(report.turns, 3);
  assert.equal(report.content_average, 80);
  assert.equal(report.delivery_average, 70);
  assert.equal(report.readiness_average, 77);
  assert.equal(report.strongest_turn.question, 'Q2');
  assert.equal(report.weakest_turn.question, 'Q3');
});
