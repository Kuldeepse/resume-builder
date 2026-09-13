const STOP_WORDS = new Set([
  'about','after','again','because','being','could','explain','from','have','into','please','role','should','that','their','there','these','they','this','through','what','when','where','which','while','with','would','your','you','tell','describe','example','time','were','been','also','more','than','interview','candidate','question','answer','team','work','working','job'
]);

const ACTION_PATTERN = /\b(i led|i owned|i created|i established|i introduced|i decided|i negotiated|i coordinated|i analysed|i analyzed|i implemented|i proposed|i challenged|i escalated|i prioritised|i prioritized|i facilitated|i delivered|i designed|i reduced|i improved|i configured|i validated|i tested|i automated|i managed|i drove)\b/i;
const RESULT_PATTERN = /\b(result|outcome|achieved|delivered|reduced|increased|improved|saved|adoption|availability|incident|on time|under budget|benefit|revenue|cost|risk|latency|uptime|defect|performance)\b/i;
const METRIC_PATTERN = /\b\d+(?:\.\d+)?\s*(?:%|percent|users?|weeks?|months?|days?|hours?|minutes?|million|billion|m|k|applications?|countries?|regions?|vendors?|ms|seconds?)?\b/i;

const QUESTION_BANKS = {
  hr: [
    'Why are you interested in this specific opportunity, and why now?',
    'Which parts of your background are most relevant to this role?',
    'Why do you want to join this organisation rather than another employer?',
    'What working environment helps you perform at your best?',
    'What are your verified availability, location and working-pattern requirements?',
  ],
  behavioural: [
    'Tell me about a major dependency or risk that threatened delivery. What did you personally do?',
    'Describe a stakeholder disagreement you resolved. How did you reach the decision?',
    'Tell me about a difficult decision you made with incomplete information.',
    'Describe a delivery setback. What did you change afterwards?',
    'Give an example of how you used data, automation or AI to improve an outcome.',
  ],
  technical: [
    'Walk me through the architecture of a complex platform or transformation you delivered.',
    'Describe a serious technical risk you identified and how you validated the mitigation.',
    'How did you manage security, resilience, performance and observability requirements?',
    'Explain a technical trade-off you made between speed, cost, quality and risk.',
    'How did you move a complex solution from design through deployment and operational handover?',
  ],
};

function clean(value, limit = 6000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function clamp(value, min = 0, max = 20) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function sentences(value) {
  return String(value ?? '')
    .replace(/\r/g, '\n')
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((item) => clean(item, 900))
    .filter(Boolean);
}

function keywords(value) {
  return Array.from(new Set((clean(value, 20000).toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) || []).filter((word) => !STOP_WORDS.has(word))));
}

function scoreLabel(total) {
  if (total >= 90) return 'Outstanding';
  if (total >= 80) return 'Strong';
  if (total >= 70) return 'Good';
  if (total >= 60) return 'Developing';
  return 'Needs stronger evidence';
}

function roleRelevance(question, role, jobDescription, answer) {
  const answerTokens = new Set(keywords(answer));
  const expected = keywords(`${question} ${role} ${jobDescription}`).slice(0, 50);
  const hits = expected.filter((word) => answerTokens.has(word));
  return { hits, score: clamp(7 + Math.min(13, hits.length * 2)) };
}

function pickNextQuestion(type, history, currentQuestion) {
  const used = new Set([...history.map((item) => clean(item.question, 900).toLowerCase()), clean(currentQuestion, 900).toLowerCase()]);
  return (QUESTION_BANKS[type] || QUESTION_BANKS.behavioural).find((question) => !used.has(question.toLowerCase()))
    || 'What is one important capability for this role that we have not yet tested, and what verified example demonstrates it?';
}

function safeRevision(answer, type) {
  const parts = sentences(answer);
  const situation = parts.find((item) => /\b(context|challenge|problem|during|programme|program|project|platform|system|organisation|organization)\b/i.test(item)) || parts[0] || '';
  const action = parts.find((item) => ACTION_PATTERN.test(item)) || '';
  const result = parts.find((item) => RESULT_PATTERN.test(item) || METRIC_PATTERN.test(item)) || '';

  if (type === 'hr') {
    return [
      situation || '[state the verified part of your background most relevant to this question]',
      action || '[state what you personally contributed]',
      result || '[add a verified outcome or reason this matters to the employer]',
    ].join(' ');
  }

  if (type === 'technical') {
    return [
      `Context: ${situation || '[describe the verified platform, scale and constraint]'}`,
      `Your decision/action: ${action || '[state the technical decision or action you personally took]'}`,
      `Trade-off/control: [state the verified trade-off, control or validation mechanism]`,
      `Outcome: ${result || '[add a verified performance, security, resilience or delivery outcome]'}`,
    ].join('\n');
  }

  return [
    `Situation: ${situation || '[state the verified context and why it mattered]'}`,
    'Task: [state your verified objective, accountability and decision rights]',
    `Action: ${action || '[state the two or three actions you personally took]'}`,
    `Result: ${result || '[add a verified metric or outcome]'}`,
  ].join('\n');
}

export function normaliseCoachInput(raw = {}) {
  const interviewType = ['hr', 'behavioural', 'technical'].includes(raw.interview_type) ? raw.interview_type : 'behavioural';
  return {
    role: clean(raw.role, 240),
    company: clean(raw.company, 240),
    job_description: clean(raw.job_description, 12000),
    interview_type: interviewType,
    question: clean(raw.question, 900),
    answer: clean(raw.answer, 6000),
    candidate_evidence: Array.isArray(raw.candidate_evidence) ? raw.candidate_evidence.map((item) => clean(item, 1200)).filter(Boolean).slice(0, 30) : [],
    history: Array.isArray(raw.history) ? raw.history.map((item) => ({
      question: clean(item?.question, 900),
      answer: clean(item?.answer, 6000),
      score: Number.isFinite(Number(item?.score)) ? Math.max(0, Math.min(100, Math.round(Number(item.score)))) : undefined,
    })).filter((item) => item.question && item.answer).slice(-8) : [],
  };
}

export function validateCoachInput(input) {
  if (!input.role) return 'Enter the target role before starting coaching.';
  if (!input.question) return 'An interview question is required.';
  if (!input.answer || input.answer.length < 8) return 'Give a fuller answer before requesting coaching.';
  return '';
}

export function buildFallbackCoachTurn(raw) {
  const input = normaliseCoachInput(raw);
  const validationError = validateCoachInput(input);
  if (validationError) throw new Error(validationError);

  const answer = input.answer;
  const lower = answer.toLowerCase();
  const words = answer.split(/\s+/).filter(Boolean);
  const sentenceList = sentences(answer);
  const hasAction = ACTION_PATTERN.test(answer);
  const hasResult = RESULT_PATTERN.test(answer);
  const hasMetric = METRIC_PATTERN.test(answer);
  const iCount = (lower.match(/\bi\b/g) || []).length;
  const weCount = (lower.match(/\bwe\b/g) || []).length;
  const fillerCount = (lower.match(/\b(um|uh|basically|actually|obviously|you know|sort of|kind of)\b/g) || []).length;
  const relevance = roleRelevance(input.question, input.role, input.job_description, answer);
  const clarity = clamp((words.length >= 55 && words.length <= 230 ? 17 : words.length >= 35 && words.length <= 300 ? 13 : 8) + (sentenceList.length >= 3 ? 2 : 0) - Math.min(6, fillerCount * 2));
  let dimensions;

  if (input.interview_type === 'technical') {
    const depth = clamp(4 + (/\b(architecture|api|integration|security|data|cloud|network|identity|database|service|platform|design|protocol|encryption|resilience|observability)\b/.test(lower) ? 8 : 0) + (hasAction ? 5 : 0) + (words.length >= 80 ? 3 : 0));
    const tradeOffs = clamp(4 + (/\b(trade-off|option|decision|constraint|latency|cost|performance|scalability|resilience|availability)\b/.test(lower) ? 10 : 0) + (hasResult ? 4 : 0));
    const controls = clamp(4 + (/\b(control|test|monitor|rollback|security|risk|compliance|observability|logging|alert|gate|review|validation)\b/.test(lower) ? 10 : 0) + (hasMetric ? 4 : 0));
    const evidence = clamp(3 + (hasResult ? 7 : 0) + (hasMetric ? 8 : 0) + (hasAction ? 2 : 0));
    dimensions = [
      ['relevance', 'Role relevance', relevance.score, relevance.hits.length ? `Matched role/question signals: ${relevance.hits.slice(0, 6).join(', ')}.` : 'Few explicit role or question signals were present.'],
      ['technical_depth', 'Technical depth', depth, 'Checks architecture/domain detail and the candidate’s own technical contribution.'],
      ['tradeoffs', 'Design and trade-offs', tradeOffs, 'Checks options, constraints and decision rationale.'],
      ['controls', 'Controls and readiness', controls, 'Checks validation, risk, security and operational readiness.'],
      ['evidence', 'Evidence and outcomes', evidence, 'Checks verified actions, outcomes and measurable evidence.'],
    ];
  } else if (input.interview_type === 'hr') {
    const motivation = clamp(5 + (/\b(interested|motivated|join|opportunity|purpose|values|growth|contribute)\b/.test(lower) ? 8 : 0) + (relevance.hits.length >= 2 ? 5 : 0));
    const credibility = clamp(4 + (hasAction ? 6 : 0) + (hasResult ? 5 : 0) + (hasMetric ? 5 : 0));
    const readiness = clamp(6 + (/\b(available|notice|salary|location|hybrid|travel|flexible|immediate)\b/.test(lower) ? 8 : 0) + (words.length >= 45 ? 4 : 0));
    dimensions = [
      ['relevance', 'Role relevance', relevance.score, 'Checks whether the answer addresses this role and question.'],
      ['motivation', 'Motivation and fit', motivation, 'Checks specific motivation rather than generic interest.'],
      ['credibility', 'Credibility', credibility, 'Checks whether claims are supported by personal actions and outcomes.'],
      ['communication', 'Communication', clarity, 'Checks focus, length and filler.'],
      ['readiness', 'Readiness and expectations', readiness, 'Checks practical expectations when relevant.'],
    ];
  } else {
    const situation = /\b(situation|context|challenge|problem|when i|during|at the time)\b/.test(lower);
    const task = /\b(task|objective|goal|responsible|accountable|needed to|mandate)\b/.test(lower);
    const structure = clamp(2 + (situation ? 4 : 0) + (task ? 4 : 0) + (hasAction ? 6 : 0) + (hasResult ? 4 : 0));
    const ownership = clamp(4 + Math.min(8, iCount * 2) + (hasAction ? 6 : 0) - (weCount > iCount ? 5 : 0));
    const evidence = clamp(3 + (hasResult ? 7 : 0) + (hasMetric ? 8 : 0) + (/\b(user|customer|business|risk|cost|quality|revenue|adoption|availability)\b/.test(lower) ? 2 : 0));
    const judgement = clamp(5 + (/\b(decision|stakeholder|trade-off|priority|risk|option|challenge|negotiat|influence|escalat)\b/.test(lower) ? 9 : 0) + (hasAction ? 4 : 0));
    dimensions = [
      ['relevance', 'Role relevance', relevance.score, 'Checks whether the example answers the actual question.'],
      ['structure', 'STAR structure', structure, 'Checks context, accountability, action and result.'],
      ['ownership', 'Personal ownership', ownership, 'Checks what the candidate personally decided or delivered.'],
      ['evidence', 'Evidence and outcomes', evidence, 'Checks outcomes and verified metrics.'],
      ['judgement', 'Judgement and stakeholder leadership', judgement, 'Checks decisions, trade-offs and stakeholder handling.'],
    ];
  }

  const mappedDimensions = dimensions.map(([key, label, score, rationale]) => ({ key, label, score, rationale }));
  const total = mappedDimensions.reduce((sum, item) => sum + item.score, 0);
  const weakest = [...mappedDimensions].sort((a, b) => a.score - b.score)[0];
  const strongest = [...mappedDimensions].sort((a, b) => b.score - a.score)[0];
  const improvements = [`Strengthen ${weakest.label.toLowerCase()} with a more direct and evidenced response.`];
  if (!hasAction) improvements.push('State exactly what you personally did, decided or changed.');
  if (!hasMetric) improvements.push('Add a verified metric or concrete outcome if one exists; do not estimate one.');
  if (clarity < 14) improvements.push('Reduce filler and keep the answer focused on the interviewer’s intent.');

  let followUp = `Can you strengthen ${weakest.label.toLowerCase()} with a specific verified example?`;
  if (!hasAction) followUp = 'What did you personally do or decide that changed the outcome?';
  else if (!hasMetric) followUp = 'What verified measurable result did your actions produce?';
  else if (input.interview_type === 'technical' && weakest.key === 'tradeoffs') followUp = 'What options did you evaluate, and why did you choose that technical approach?';

  const findings = [];
  if (hasAction) findings.push({ status: 'confirmed', claim: 'Personal action is explicit in the answer.', evidence: sentenceList.find((item) => ACTION_PATTERN.test(item)) || '' });
  else findings.push({ status: 'unknown', claim: 'Personal action is not yet explicit.', evidence: '' });
  if (hasMetric) findings.push({ status: 'confirmed', claim: 'A measurable data point is present in the answer.', evidence: sentenceList.find((item) => METRIC_PATTERN.test(item)) || '' });
  else findings.push({ status: 'unknown', claim: 'No verified metric is explicit in this answer.', evidence: '' });

  return {
    mode: 'fallback',
    agent: { provider: 'deterministic', model: 'local-fallback-v1', version: 'fallback-v1', adaptive: true, evidence_guard: true },
    assessment: {
      question: input.question,
      answer: input.answer,
      total,
      rating: Math.max(1, Math.min(5, Math.ceil(total / 20))),
      label: scoreLabel(total),
      dimensions: mappedDimensions,
      strengths: [`${strongest.label} is currently the strongest part of the answer.`],
      improvements: improvements.slice(0, 4),
      evidence_findings: findings,
      credibility_flags: [],
      follow_up: followUp,
      next_question: pickNextQuestion(input.interview_type, input.history, input.question),
      coaching_message: `Fallback coaching identified ${weakest.label.toLowerCase()} as the priority area to strengthen.`,
      revised_answer: safeRevision(input.answer, input.interview_type),
    },
  };
}
