import {
  buildFallbackCoachTurn as buildBaseFallbackCoachTurn,
  normaliseCoachInput,
  validateCoachInput,
} from './interview-coach-core.mjs';

const VERIFIED_OUTCOME_PATTERN = /\b(result|outcome|achieved|delivered|reduced|increased|improved|saved|adoption|availability|incident|on time|under budget|benefit|revenue|cost|latency|uptime|defect|performance)\b/i;
const METRIC_PATTERN = /\b\d+(?:\.\d+)?\s*(?:%|percent|users?|weeks?|months?|days?|hours?|minutes?|million|billion|m|k|applications?|countries?|regions?|vendors?|ms|seconds?)?\b/i;
const EVALUATED_ACTION_PATTERN = /\bi (?:evaluated|assessed|reviewed|compared)\b/i;

export { normaliseCoachInput, validateCoachInput };

export function buildFallbackCoachTurn(raw) {
  const input = normaliseCoachInput(raw);
  const result = buildBaseFallbackCoachTurn(input);
  const answer = input.answer;
  const hasVerifiedOutcome = VERIFIED_OUTCOME_PATTERN.test(answer) || METRIC_PATTERN.test(answer);

  // A risk, dependency or constraint is context/control evidence, not proof of an outcome.
  // Keep the stronger-answer template honest when no result was actually supplied.
  if (!hasVerifiedOutcome) {
    if (input.interview_type === 'behavioural') {
      result.assessment.revised_answer = result.assessment.revised_answer.replace(
        /Result:\s*[^\n]*/i,
        'Result: [add a verified metric or outcome]',
      );
    } else if (input.interview_type === 'technical') {
      result.assessment.revised_answer = result.assessment.revised_answer.replace(
        /Outcome:\s*[^\n]*/i,
        'Outcome: [add a verified performance, security, resilience or delivery outcome]',
      );
    }
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
