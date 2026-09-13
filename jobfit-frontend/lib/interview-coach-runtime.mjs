import {
  buildFallbackCoachTurn as buildBaseFallbackCoachTurn,
  normaliseCoachInput,
  validateCoachInput,
} from './interview-coach-core.mjs';
import { buildExpectedInterviewResponse } from './interview-expected-response.mjs';

const VERIFIED_OUTCOME_PATTERN = /\b(result|outcome|achieved|delivered|reduced|increased|improved|saved|adoption|availability|incident|on time|under budget|benefit|revenue|cost|latency|uptime|defect|performance)\b/i;
const METRIC_PATTERN = /\b\d+(?:\.\d+)?\s*(?:%|percent|users?|weeks?|months?|days?|hours?|minutes?|million|billion|m|k|applications?|countries?|regions?|vendors?|ms|seconds?)?\b/i;
const EVALUATED_ACTION_PATTERN = /\bi (?:evaluated|assessed|reviewed|compared)\b/i;

export { normaliseCoachInput, validateCoachInput };

export function buildFallbackCoachTurn(raw) {
  const input = normaliseCoachInput(raw);
  const result = buildBaseFallbackCoachTurn(input);
  const answer = input.answer;
  const hasVerifiedOutcome = VERIFIED_OUTCOME_PATTERN.test(answer) || METRIC_PATTERN.test(answer);

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
