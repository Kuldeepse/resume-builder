import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInterviewAgentContext,
  buildInterviewMemoryCookieValue,
  buildPanelAgentContext,
  buildPanelFallbackQuestion,
  buildRolePracticeMemory,
  compactInterviewProgress,
  parseInterviewMemoryCookie,
  parsePanelPersona,
} from './interview-agent-context.mjs';

const progress = [
  {
    role: 'Technical Programme Manager',
    at: '2026-09-14T10:00:00Z',
    turns: 6,
    contentAverage: 78,
    deliveryAverage: 74,
    readinessAverage: 77,
    evidenceScore: 15,
    structureScore: 13,
    technicalDepthScore: 14,
    communicationScore: 15,
    contentDimensions: [
      { key: 'structure', label: 'Structure', score: 13 },
      { key: 'evidence', label: 'Evidence', score: 15 },
    ],
    deliveryDimensions: [
      { key: 'pace', label: 'Pace', score: 12 },
      { key: 'fluency', label: 'Fluency', score: 15 },
    ],
  },
  {
    role: 'Technical Programme Manager',
    at: '2026-09-13T10:00:00Z',
    turns: 5,
    contentAverage: 70,
    deliveryAverage: 68,
    readinessAverage: 69,
    evidenceScore: 12,
    structureScore: 10,
    technicalDepthScore: 12,
    communicationScore: 13,
    contentDimensions: [
      { key: 'structure', label: 'Structure', score: 10 },
      { key: 'evidence', label: 'Evidence', score: 12 },
    ],
    deliveryDimensions: [
      { key: 'pace', label: 'Pace', score: 10 },
      { key: 'fluency', label: 'Fluency', score: 13 },
    ],
  },
  {
    role: 'Product Manager',
    at: '2026-09-12T10:00:00Z',
    turns: 4,
    contentAverage: 90,
    deliveryAverage: 90,
    readinessAverage: 90,
    contentDimensions: [{ key: 'product', label: 'Product judgement', score: 19 }],
    deliveryDimensions: [],
  },
];

test('compacts interview progress without candidate evidence or answer text', () => {
  const compact = compactInterviewProgress(progress);
  assert.equal(compact.length, 3);
  assert.equal(compact[0].r, 'Technical Programme Manager');
  assert.equal(compact[0].rd, 77);
  assert.equal('candidateEvidence' in compact[0], false);
  assert.equal('answer' in compact[0], false);
  assert.equal('company' in compact[0], false);
});

test('memory cookie round-trips a compact bounded payload', () => {
  const value = buildInterviewMemoryCookieValue(progress);
  assert.ok(value.length < 3100);
  const parsed = parseInterviewMemoryCookie(`other=x; cognitwist_interview_memory=${value}; Path=/`);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].r, 'Technical Programme Manager');
});

test('role practice memory stays role-specific and identifies recurring weakness', () => {
  const compact = compactInterviewProgress(progress);
  const memory = buildRolePracticeMemory(compact, 'Technical Programme Manager');
  assert.equal(memory.sessions, 2);
  assert.equal(memory.latestReadiness, 77);
  assert.equal(memory.bestReadiness, 77);
  assert.equal(memory.readinessDelta, 8);
  assert.match(memory.summary, /Structure|Pace/i);
  assert.doesNotMatch(memory.summary, /Product judgement/i);
});

test('panel persona is parsed from the existing simulation context and hands off in sequence', () => {
  const description = 'Role requirements.\n\nInterview simulation: Principal Architect. Architecture and controls.';
  assert.equal(parsePanelPersona(description), 'Principal Architect');
  const context = buildPanelAgentContext(description);
  assert.equal(context.label, 'Principal Architect');
  assert.equal(context.nextLabel, 'Product Director');
  assert.match(context.instruction, /not.*candidate evidence/i);
  assert.match(context.instruction, /shared interview context/i);
});

test('panel fallback question is specialist-specific and avoids an already-used question when possible', () => {
  const first = buildPanelFallbackQuestion('Risk Lead', []);
  const second = buildPanelFallbackQuestion('Risk Lead', [{ question: first }]);
  assert.match(first, /risk|control|go\/no-go/i);
  assert.notEqual(first, second);
});

test('agent context adds panel and cross-session memory while keeping memory non-evidential', () => {
  const cookie = buildInterviewMemoryCookieValue(progress);
  const result = buildInterviewAgentContext({
    role: 'Technical Programme Manager',
    jobDescription: 'Lead complex technical delivery.\n\nInterview simulation: Hiring Manager. Balanced evidence-led hiring-manager style.',
    cookieHeader: `cognitwist_interview_memory=${cookie}`,
  });
  assert.equal(result.panel.label, 'Hiring Manager');
  assert.equal(result.panel.nextLabel, 'Principal Architect');
  assert.equal(result.memory.sessions, 2);
  assert.match(result.jobDescription, /PANEL SPECIALIST/i);
  assert.match(result.jobDescription, /PERFORMANCE ANALYTICS ONLY/i);
  assert.match(result.jobDescription, /must never be used to create, confirm or revise factual candidate claims/i);
  assert.ok(result.jobDescription.length <= 12000);
});

test('invalid memory cookie fails closed without affecting the interview context', () => {
  const result = buildInterviewAgentContext({
    role: 'Technical Programme Manager',
    jobDescription: 'Lead delivery.',
    cookieHeader: 'cognitwist_interview_memory=%E0%A4%A',
  });
  assert.equal(result.memory, null);
  assert.equal(result.jobDescription, 'Lead delivery.');
});
