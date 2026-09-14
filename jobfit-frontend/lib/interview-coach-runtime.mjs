import {
  buildFallbackCoachTurn as buildBaseFallbackCoachTurn,
  normaliseCoachInput,
  validateCoachInput,
} from './interview-coach-core.mjs';
import { buildExpectedInterviewResponse } from './interview-expected-response.mjs';

const VERIFIED_OUTCOME_PATTERN = /\b(result|outcome|achieved|delivered|reduced|increased|improved|saved|adoption|availability|incident|on time|under budget|benefit|revenue|cost|latency|uptime|defect|performance)\b/i;
const METRIC_PATTERN = /\b\d+(?:\.\d+)?\s*(?:%|percent|users?|weeks?|months?|days?|hours?|minutes?|million|billion|m|k|applications?|countries?|regions?|vendors?|ms|seconds?)?\b/i;
const EVALUATED_ACTION_PATTERN = /\bi (?:evaluated|assessed|reviewed|compared)\b/i;
const PERSONAL_ACTION_PATTERN = /\bi (?:led|owned|decided|created|introduced|changed|managed|drove|validated|tested|escalated|prioritised|prioritized|negotiated|facilitated|coordinated|evaluated|assessed|reviewed|compared)\b/i;

export { normaliseCoachInput, validateCoachInput };

function clamp20(value) {
  return Math.max(0, Math.min(20, Math.round(Number(value) || 0)));
}

function keywordScore(answer, pattern, base = 5, hit = 9) {
  return clamp20(base + (pattern.test(answer) ? hit : 0) + (PERSONAL_ACTION_PATTERN.test(answer) ? 3 : 0) + (METRIC_PATTERN.test(answer) ? 2 : 0));
}

function baseScore(result, keys, fallbackIndex = 0) {
  const dimensions = result.assessment.dimensions || [];
  const found = dimensions.find((item) => keys.includes(String(item.key || '').toLowerCase()));
  return clamp20(found?.score ?? dimensions[fallbackIndex]?.score ?? 8);
}

function questionIntent(question, interviewType) {
  const q = String(question || '').toLowerCase();
  if (/risk|dependency|blocked|threat|incident|setback|failure/.test(q)) return 'risk';
  if (/prioriti[sz]|competing|limited resources|tight deadline|deliver.*pace|deadline/.test(q)) return 'priority';
  if (/stakeholder|conflict|disagree|influence|challeng.*leader/.test(q)) return 'stakeholder';
  if (/bug|defect|quality|release.*tomorrow|release.*next day/.test(q)) return 'quality';
  if (/architecture|system design|platform design/.test(q)) return 'architecture';
  if (/trade.?off|options|why.*choose|technical approach/.test(q)) return 'tradeoff';
  if (/security|resilien|performance|observability|non.?functional/.test(q)) return 'nfr';
  if (/release|deployment|production|go.?live|service transition|handover/.test(q)) return 'release';
  if (/why.*role|why.*company|why.*join|interested in|motivat/.test(q)) return 'motivation';
  if (/availability|notice|salary|location|hybrid|travel|working pattern/.test(q)) return 'practical';
  if (/introduce yourself|tell me about yourself|background/.test(q)) return 'introduction';
  return interviewType === 'technical' ? 'technical' : interviewType === 'hr' ? 'hr' : 'behavioural';
}

function makeDimension(key, label, score, rationale) {
  return { key, label, score: clamp20(score), rationale };
}

function exactQuestionDimensions(input, result) {
  const answer = input.answer;
  const intent = questionIntent(input.question, input.interview_type);
  const relevance = baseScore(result, ['relevance'], 0);
  const ownership = baseScore(result, ['ownership', 'credibility'], 2);
  const evidence = baseScore(result, ['evidence'], 3);
  const judgement = baseScore(result, ['judgement', 'tradeoffs'], 4);
  const controls = baseScore(result, ['controls'], 3);

  if (intent === 'risk') return [
    makeDimension('risk_intent', 'Risk and impact diagnosis', Math.max(relevance, keywordScore(answer, /\b(risk|dependency|impact|root cause|critical path|blast radius)\b/i)), 'Checks whether the answer identifies the risk, cause and consequence that the question asks about.'),
    makeDimension('ownership', 'Personal ownership', ownership, 'Checks what the candidate personally owned, decided or changed.'),
    makeDimension('recovery_controls', 'Recovery and control decisions', Math.max(controls, keywordScore(answer, /\b(control|mitigation|rollback|contingency|test|validation|recovery|remediation)\b/i)), 'Checks the concrete mitigation, contingency or validation decisions used to control the risk.'),
    makeDimension('stakeholder_alignment', 'Stakeholder alignment', Math.max(judgement, keywordScore(answer, /\b(stakeholder|engineering|architecture|security|business|vendor|escalat|align)\b/i)), 'Checks how dependencies and decision-makers were aligned through the risk.'),
    makeDimension('recovery_outcome', 'Verified recovery outcome', evidence, 'Checks whether the answer closes with a supported recovery, service or delivery result.'),
  ];

  if (intent === 'priority') return [
    makeDimension('competing_demands', 'Competing-demand framing', Math.max(relevance, keywordScore(answer, /\b(competing|deadline|resource|capacity|priority|urgent|constraint)\b/i)), 'Checks whether the answer makes the competing demands, constraints and stakes clear.'),
    makeDimension('prioritisation_criteria', 'Prioritisation criteria', keywordScore(answer, /\b(value|risk|impact|urgency|effort|cost|rice|critical path|must have|priority)\b/i), 'Checks whether prioritisation used explicit evidence or criteria rather than preference.'),
    makeDimension('tradeoff_quality', 'Trade-off quality', Math.max(judgement, keywordScore(answer, /\b(trade.?off|option|defer|sequence|scope|decision|constraint)\b/i)), 'Checks how the candidate balanced time, scope, value, quality and risk.'),
    makeDimension('stakeholder_alignment', 'Stakeholder alignment', keywordScore(answer, /\b(stakeholder|agree|align|communicat|escalat|negotia|decision)\b/i), 'Checks how competing stakeholders were brought to a clear decision.'),
    makeDimension('delivery_outcome', 'Delivery and quality outcome', evidence, 'Checks the verified result and whether quality was protected.'),
  ];

  if (intent === 'stakeholder') return [
    makeDimension('conflict_context', 'Conflict and stakes', Math.max(relevance, keywordScore(answer, /\b(conflict|disagree|different view|stakeholder|priority|position)\b/i)), 'Checks whether the disagreement and why it mattered are clear.'),
    makeDimension('influence', 'Influence approach', Math.max(ownership, keywordScore(answer, /\b(influence|facilitat|listen|evidence|workshop|negotia|challenge)\b/i)), 'Checks the candidate’s specific influence actions rather than generic collaboration.'),
    makeDimension('decision_quality', 'Decision quality', Math.max(judgement, keywordScore(answer, /\b(decision|criteria|option|trade.?off|evidence|recommend)\b/i)), 'Checks whether the resolution was based on clear criteria and judgement.'),
    makeDimension('alignment', 'Stakeholder alignment', keywordScore(answer, /\b(align|agree|commit|owner|action|governance|escalat)\b/i), 'Checks whether the decision translated into alignment, ownership and action.'),
    makeDimension('outcome', 'Verified outcome', evidence, 'Checks the supported delivery, relationship or business result.'),
  ];

  if (intent === 'quality') return [
    makeDimension('severity', 'Defect severity and blast radius', Math.max(relevance, keywordScore(answer, /\b(severity|critical|defect|bug|impact|customer|blast radius|production)\b/i)), 'Checks whether the issue is triaged before making a release decision.'),
    makeDimension('release_decision', 'Release decision quality', Math.max(judgement, keywordScore(answer, /\b(go.?no.?go|delay|release|rollback|accept|decision|risk)\b/i)), 'Checks evidence-based judgement on whether to proceed, pause or roll back.'),
    makeDimension('remediation', 'Remediation and validation', Math.max(controls, keywordScore(answer, /\b(fix|remediat|test|regression|validation|rollback|monitor)\b/i)), 'Checks the corrective action, retest and rollback/monitoring plan.'),
    makeDimension('communication', 'Stakeholder communication', keywordScore(answer, /\b(stakeholder|customer|business|engineering|communicat|escalat|owner)\b/i), 'Checks transparent communication and decision ownership under time pressure.'),
    makeDimension('quality_outcome', 'Quality and service outcome', evidence, 'Checks the verified production, incident or customer outcome.'),
  ];

  if (intent === 'architecture') return [
    makeDimension('architecture_clarity', 'Architecture clarity', Math.max(relevance, keywordScore(answer, /\b(component|service|platform|api|integration|data flow|architecture)\b/i)), 'Checks whether the architecture and system boundaries are explained clearly.'),
    makeDimension('dependencies', 'Dependencies and integrations', keywordScore(answer, /\b(dependency|integration|api|interface|data|identity|network|database)\b/i), 'Checks critical integrations, dependencies and data/service flows.'),
    makeDimension('nfrs', 'Security and non-functional requirements', Math.max(controls, keywordScore(answer, /\b(security|resilien|availability|performance|capacity|observability|latency)\b/i)), 'Checks measurable security, resilience, performance and operational concerns.'),
    makeDimension('architecture_tradeoffs', 'Architecture decisions and trade-offs', Math.max(judgement, keywordScore(answer, /\b(option|decision|trade.?off|constraint|choose|selected|cost)\b/i)), 'Checks the candidate’s technical judgement and rationale.'),
    makeDimension('operational_outcome', 'Operational outcome', evidence, 'Checks whether architecture decisions connect to a supported service or delivery outcome.'),
  ];

  if (intent === 'tradeoff') return [
    makeDimension('constraint', 'Constraint clarity', Math.max(relevance, keywordScore(answer, /\b(constraint|problem|requirement|limit|deadline|cost|performance)\b/i)), 'Checks the constraint that created the trade-off.'),
    makeDimension('options', 'Options considered', keywordScore(answer, /\b(option|alternative|compared|evaluated|approach|choice)\b/i), 'Checks whether multiple viable options were genuinely evaluated.'),
    makeDimension('criteria', 'Decision criteria', keywordScore(answer, /\b(security|resilien|performance|cost|time|risk|operability|scale)\b/i), 'Checks the evidence and criteria used to compare options.'),
    makeDimension('mitigation', 'Downside mitigation', Math.max(controls, keywordScore(answer, /\b(mitigat|test|monitor|rollback|stage|pilot|control)\b/i)), 'Checks how downsides of the chosen option were controlled.'),
    makeDimension('outcome', 'Verified decision outcome', evidence, 'Checks the supported result of the technical decision.'),
  ];

  if (intent === 'nfr') return [
    makeDimension('nfr_scope', 'NFR coverage', Math.max(relevance, keywordScore(answer, /\b(security|resilien|performance|capacity|observability|availability)\b/i)), 'Checks whether the relevant non-functional requirements are explicit.'),
    makeDimension('criteria', 'Measurable acceptance criteria', keywordScore(answer, /\b(threshold|slo|sla|latency|availability|capacity|metric|target)\b/i), 'Checks whether NFRs are measurable rather than generic.'),
    makeDimension('validation', 'Test and validation evidence', Math.max(controls, keywordScore(answer, /\b(test|failover|load|performance|penetration|validation|chaos)\b/i)), 'Checks how requirements were validated before release.'),
    makeDimension('observability', 'Observability and operational control', keywordScore(answer, /\b(monitor|alert|logging|telemetry|dashboard|observability|runbook)\b/i), 'Checks how operational health and failures would be detected.'),
    makeDimension('service_outcome', 'Verified service outcome', evidence, 'Checks the supported reliability, performance or operational result.'),
  ];

  if (intent === 'release') return [
    makeDimension('readiness_scope', 'Readiness scope and dependencies', Math.max(relevance, keywordScore(answer, /\b(dependency|readiness|integration|uat|security|operational)\b/i)), 'Checks whether release readiness covers the full path to production.'),
    makeDimension('evidence_gates', 'Evidence and go/no-go gates', Math.max(judgement, keywordScore(answer, /\b(go.?no.?go|evidence|gate|acceptance|sign.?off|criteria)\b/i)), 'Checks evidence-based release decisions rather than date-driven delivery.'),
    makeDimension('rollback_controls', 'Deployment and rollback controls', Math.max(controls, keywordScore(answer, /\b(rollback|deployment|cutover|monitor|contingency|recovery)\b/i)), 'Checks controls for safe deployment and recovery.'),
    makeDimension('handover', 'Operational handover', keywordScore(answer, /\b(runbook|support|bau|handover|on.?call|monitoring|ownership)\b/i), 'Checks sustainable transition to operations.'),
    makeDimension('production_outcome', 'Verified production outcome', evidence, 'Checks post-release stability, adoption or incident evidence.'),
  ];

  if (intent === 'motivation') return [
    makeDimension('specific_motivation', 'Specific motivation', Math.max(relevance, keywordScore(answer, /\b(interested|motivat|because|opportunity|purpose|mission)\b/i)), 'Checks why this exact role or organisation is attractive.'),
    makeDimension('role_understanding', 'Role understanding', keywordScore(answer, /\b(role|responsibility|challenge|delivery|product|technical|customer)\b/i), 'Checks understanding of what the opportunity actually requires.'),
    makeDimension('evidence_of_fit', 'Evidence of fit', Math.max(ownership, evidence), 'Checks whether motivation is supported by relevant experience rather than generic enthusiasm.'),
    makeDimension('value_proposition', 'Value proposition', keywordScore(answer, /\b(bring|contribute|value|experience|strength|impact)\b/i), 'Checks what the candidate can contribute to this employer.'),
    makeDimension('credibility', 'Credibility and specificity', evidence, 'Checks concrete, believable reasons and proof points.'),
  ];

  if (intent === 'practical') return [
    makeDimension('directness', 'Direct answer', relevance, 'Checks whether the practical question is answered directly.'),
    makeDimension('accuracy', 'Specific verified facts', keywordScore(answer, /\b(available|notice|salary|location|hybrid|travel|remote|flexible|immediate)\b/i), 'Checks clear factual expectations rather than vague positioning.'),
    makeDimension('constraints', 'Constraints and boundaries', keywordScore(answer, /\b(require|prefer|cannot|can|days|travel|location|notice)\b/i), 'Checks transparent boundaries and constraints.'),
    makeDimension('flexibility', 'Realistic flexibility', keywordScore(answer, /\b(flexible|open|discuss|depending|prefer|consider)\b/i), 'Checks flexibility without overcommitting.'),
    makeDimension('credibility', 'Credibility', Math.max(ownership, evidence), 'Checks consistency and realism of practical expectations.'),
  ];

  // For less easily classified questions preserve the base scores, but label them around exact intent.
  return (result.assessment.dimensions || []).map((item, index) => makeDimension(
    `question_${index + 1}_${item.key}`,
    index === 0 ? 'Exact question coverage' : item.label,
    item.score,
    index === 0 ? `Checks whether the answer directly addresses: ${input.question}` : item.rationale,
  ));
}

export function buildFallbackCoachTurn(raw) {
  const input = normaliseCoachInput(raw);
  const result = buildBaseFallbackCoachTurn(input);
  const answer = input.answer;
  const hasVerifiedOutcome = VERIFIED_OUTCOME_PATTERN.test(answer) || METRIC_PATTERN.test(answer);

  const exactDimensions = exactQuestionDimensions(input, result);
  result.assessment.dimensions = exactDimensions;
  result.assessment.total = exactDimensions.reduce((sum, item) => sum + item.score, 0);
  result.assessment.rating = Math.max(1, Math.min(5, Math.ceil(result.assessment.total / 20)));

  // Never recycle a weak candidate answer into a fake STAR rewrite. Instead show
  // the question-specific expected/model response built from verified evidence
  // when available, or an explicitly illustrative model answer otherwise.
  const expected = buildExpectedInterviewResponse({
    role: input.role,
    company: input.company,
    job_description: input.job_description,
    interview_type: input.interview_type,
    question: input.question,
    candidate_evidence: input.candidate_evidence,
  });
  result.assessment.revised_answer = expected.expected_response;
  result.assessment.response_basis = expected.basis || (expected.relevant_evidence?.length ? 'verified_evidence' : 'illustrative_model');
  result.assessment.expected_response_title = expected.title;

  // A risk, dependency or constraint is context/control evidence, not proof of an outcome.
  if (!hasVerifiedOutcome) {
    result.assessment.improvements = Array.from(new Set([
      ...result.assessment.improvements,
      'Your submitted answer did not include a verified outcome. Use the model response as structure, then replace any illustrative detail with your real evidence.',
    ])).slice(0, 4);
  }

  // Technical candidates often describe judgement with "I evaluated/assessed/reviewed".
  // Surface that as explicit personal action without fabricating any new evidence.
  if (EVALUATED_ACTION_PATTERN.test(answer)
      && result.assessment.evidence_findings.every((item) => !/Personal action is explicit/i.test(item.claim))) {
    result.assessment.evidence_findings.unshift({
      status: 'confirmed',
      claim: 'Personal evaluation or assessment is explicit in the answer.',
      evidence: answer.split(/(?<=[.!?])\s+/).find((item) => EVALUATED_ACTION_PATTERN.test(item)) || '',
    });
  }

  return result;
}
