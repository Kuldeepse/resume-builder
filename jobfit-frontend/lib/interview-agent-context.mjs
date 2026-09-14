const COOKIE_NAME = 'cognitwist_interview_memory';
const MAX_COOKIE_CHARS = 3000;
const MAX_CONTEXT_CHARS = 12000;

const PANEL_SEQUENCE = ['Hiring Manager', 'Principal Architect', 'Product Director', 'Risk Lead'];

const PANEL_PROFILES = {
  'Hiring Manager': 'Test delivery ownership, leadership judgement, prioritisation, stakeholder influence and measurable outcomes. Push for what the candidate personally decided or changed.',
  'Principal Architect': 'Test architecture boundaries, integrations, dependencies, security and non-functional requirements, technical trade-offs, observability and operational readiness.',
  'Product Director': 'Test user and business outcomes, discovery, prioritisation criteria, roadmap trade-offs, adoption, value measurement and product judgement.',
  'Risk Lead': 'Test risk identification, control design, assurance evidence, resilience, compliance, go/no-go judgement, escalation and residual-risk ownership.',
};

const PANEL_QUESTIONS = {
  'Hiring Manager': [
    'Tell me about a difficult delivery decision you personally owned. What options did you consider and what measurable outcome followed?',
    'Describe a stakeholder conflict that could have derailed delivery. How did you create alignment and what changed because of your intervention?',
  ],
  'Principal Architect': [
    'Walk me through a significant architecture decision you influenced. What dependencies, non-functional requirements and trade-offs shaped the decision?',
    'Describe a technical risk that could have affected resilience, security or performance. How was the mitigation validated before production?',
  ],
  'Product Director': [
    'How did you prioritise competing user, business and technical demands when capacity was constrained, and what evidence drove the decision?',
    'Give an example where discovery or user evidence changed the roadmap or delivery approach. How did you measure the outcome?',
  ],
  'Risk Lead': [
    'Describe a material delivery or operational risk. What control, assurance evidence and residual-risk decision did you personally drive?',
    'Tell me about a go/no-go decision where schedule pressure conflicted with control or readiness evidence. How did you decide and what happened next?',
  ],
};

function clean(value, limit = 1000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function normaliseRole(value) {
  return clean(value, 160).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function compactDimensions(values) {
  if (!Array.isArray(values)) return [];
  return values.slice(0, 8).map((item) => ({
    k: clean(item?.key, 50),
    l: clean(item?.label, 90),
    s: finite(item?.score),
  })).filter((item) => item.l);
}

export function compactInterviewProgress(progress = []) {
  if (!Array.isArray(progress)) return [];
  return progress
    .filter((item) => item && typeof item === 'object' && clean(item.role, 160))
    .slice(0, 12)
    .map((item) => ({
      r: clean(item.role, 160),
      a: clean(item.at, 40),
      q: finite(item.turns),
      c: finite(item.contentAverage),
      d: finite(item.deliveryAverage),
      rd: finite(item.readinessAverage),
      e: finite(item.evidenceScore),
      st: item.structureScore == null ? null : finite(item.structureScore),
      td: item.technicalDepthScore == null ? null : finite(item.technicalDepthScore),
      cm: finite(item.communicationScore),
      cd: compactDimensions(item.contentDimensions),
      dd: compactDimensions(item.deliveryDimensions),
    }));
}

export function buildInterviewMemoryCookieValue(progress = []) {
  const sessions = compactInterviewProgress(progress);
  let retained = [...sessions];
  let encoded = encodeURIComponent(JSON.stringify({ v: 1, s: retained }));
  while (encoded.length > MAX_COOKIE_CHARS && retained.length > 1) {
    retained = retained.slice(0, -1);
    encoded = encodeURIComponent(JSON.stringify({ v: 1, s: retained }));
  }
  return encoded.length <= MAX_COOKIE_CHARS ? encoded : encodeURIComponent(JSON.stringify({ v: 1, s: [] }));
}

function cookieValue(cookieHeader, name = COOKIE_NAME) {
  return String(cookieHeader || '').split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}

export function parseInterviewMemoryCookie(cookieHeader = '') {
  const value = cookieValue(cookieHeader);
  if (!value) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    return Array.isArray(parsed?.s) ? parsed.s : [];
  } catch {
    return [];
  }
}

function aggregatePriorities(sessions, key) {
  const scores = new Map();
  for (const session of sessions) {
    for (const dimension of Array.isArray(session?.[key]) ? session[key] : []) {
      const label = clean(dimension?.l, 90);
      if (!label) continue;
      const mapKey = label.toLowerCase();
      const entry = scores.get(mapKey) || { label, total: 0, count: 0 };
      entry.total += finite(dimension?.s);
      entry.count += 1;
      scores.set(mapKey, entry);
    }
  }
  return [...scores.values()]
    .map((item) => ({ label: item.label, score: Math.round(item.total / Math.max(1, item.count)) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
}

export function buildRolePracticeMemory(sessions = [], role = '') {
  const wanted = normaliseRole(role);
  if (!wanted || !Array.isArray(sessions)) return null;
  const matches = sessions.filter((item) => normaliseRole(item?.r) === wanted).slice(0, 6);
  if (!matches.length) return null;

  const latest = matches[0];
  const oldest = matches[matches.length - 1];
  const best = Math.max(...matches.map((item) => finite(item?.rd)));
  const delta = finite(latest?.rd) - finite(oldest?.rd);
  const contentPriorities = aggregatePriorities(matches, 'cd');
  const deliveryPriorities = aggregatePriorities(matches, 'dd');
  const priorities = [...contentPriorities, ...deliveryPriorities]
    .sort((a, b) => a.score - b.score)
    .slice(0, 4);

  const priorityText = priorities.length
    ? priorities.map((item) => `${item.label} ${item.score}/20`).join('; ')
    : 'No recurring dimension-level weakness recorded yet';

  const summary = [
    `${matches.length} prior practice session${matches.length === 1 ? '' : 's'} for this role`,
    `latest readiness ${finite(latest?.rd)}/100`,
    `best ${best}/100`,
    `trend ${delta >= 0 ? '+' : ''}${delta}`,
    `latest content ${finite(latest?.c)}/100`,
    `latest delivery ${finite(latest?.d)}/100`,
    `coaching priorities: ${priorityText}`,
  ].join('. ');

  return {
    sessions: matches.length,
    latestReadiness: finite(latest?.rd),
    bestReadiness: best,
    readinessDelta: delta,
    priorities,
    summary,
  };
}

export function parsePanelPersona(jobDescription = '') {
  const match = String(jobDescription || '').match(/Interview simulation:\s*([^\n.]{2,80})/i);
  if (!match) return null;
  const candidate = clean(match[1], 80);
  return PANEL_SEQUENCE.find((label) => label.toLowerCase() === candidate.toLowerCase()) || null;
}

export function buildPanelAgentContext(jobDescription = '') {
  const label = parsePanelPersona(jobDescription);
  if (!label) return null;
  const index = PANEL_SEQUENCE.indexOf(label);
  const nextLabel = PANEL_SEQUENCE[(index + 1) % PANEL_SEQUENCE.length];
  return {
    label,
    nextLabel,
    focus: PANEL_PROFILES[label],
    instruction: [
      'SIMULATION CONTROL — PANEL SPECIALIST. This is not a vacancy requirement and must never be treated as candidate evidence.',
      `Current specialist: ${label}. ${PANEL_PROFILES[label]}`,
      'Use earlier turns from the other panel specialists as shared interview context. Do not repeat a competency that has already been demonstrated unless a material gap remains.',
      `The interface hands the next generated question to the next specialist: ${nextLabel}. Make next_question suitable for that specialist and use follow_up only for a material unresolved gap that justifies a panel challenge.`,
    ].join(' '),
  };
}

export function buildPanelFallbackQuestion(panelLabel, history = []) {
  const questions = PANEL_QUESTIONS[panelLabel] || [];
  if (!questions.length) return '';
  const used = new Set((Array.isArray(history) ? history : []).map((item) => clean(item?.question, 900).toLowerCase()));
  return questions.find((question) => !used.has(question.toLowerCase())) || questions[0];
}

export function buildInterviewAgentContext({ jobDescription = '', role = '', cookieHeader = '' } = {}) {
  const memory = buildRolePracticeMemory(parseInterviewMemoryCookie(cookieHeader), role);
  const panel = buildPanelAgentContext(jobDescription);
  const blocks = [];

  if (panel) blocks.push(panel.instruction);
  if (memory) {
    blocks.push([
      'CROSS-SESSION PRACTICE MEMORY — PERFORMANCE ANALYTICS ONLY. This is not career evidence and must never be used to create, confirm or revise factual candidate claims.',
      `Use it only to tune question difficulty, select coaching focus and avoid repeating already-mastered areas. ${memory.summary}`,
    ].join(' '));
  }

  const suffix = blocks.length ? `\n\n${blocks.join('\n\n')}` : '';
  const budget = Math.max(0, MAX_CONTEXT_CHARS - suffix.length);
  const base = String(jobDescription || '').slice(0, budget).trim();
  return {
    jobDescription: `${base}${suffix}`.trim().slice(0, MAX_CONTEXT_CHARS),
    memory,
    panel,
  };
}

export const INTERVIEW_MEMORY_COOKIE = COOKIE_NAME;
