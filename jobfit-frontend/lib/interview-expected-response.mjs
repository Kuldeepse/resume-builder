const STOP = new Set(['the','and','for','with','that','this','from','your','you','our','are','was','were','have','has','had','into','about','tell','describe','explain','example','time','role','job','question','what','when','where','which','while','would','could','should','how','why','did','does','doing','done','their','they','them','then','than','more','most','some','any']);

function clean(value, limit = 6000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function tokens(value) {
  return Array.from(new Set((clean(value, 20000).toLowerCase().match(/[a-z0-9+#.-]{2,}/g) || []).filter((word) => !STOP.has(word) && !/^\d+$/.test(word))));
}

function rankEvidence(question, role, jobDescription, evidence) {
  const intentTokens = new Set(tokens(`${question} ${role} ${jobDescription}`).slice(0, 80));
  return (Array.isArray(evidence) ? evidence : [])
    .map((item) => clean(item, 1200))
    .filter(Boolean)
    .map((item) => {
      const itemTokens = tokens(item);
      const overlap = itemTokens.filter((token) => intentTokens.has(token)).length;
      const metricBoost = /\b\d+(?:[.,]\d+)?\s*(?:%|users?|weeks?|months?|days?|hours?|minutes?|apps?|applications?|vendors?|regions?|countries?|million|m|k)?\b/i.test(item) ? 2 : 0;
      return { item, score: overlap + metricBoost };
    })
    .sort((a, b) => b.score - a.score || b.item.length - a.item.length)
    .slice(0, 3)
    .map((entry) => entry.item);
}

function classify(question, type) {
  const q = clean(question, 1500).toLowerCase();
  if (/introduce yourself|tell me about yourself|walk me through your background/.test(q)) return 'introduction';
  if (/why .*role|why .*opportun|why .*join|why .*company|why .*organisation|why .*organization|interested in/.test(q)) return 'motivation';
  if (/salary|notice period|availability|location preference|working pattern|hybrid|travel/.test(q)) return 'practical';
  if (/stakeholder|disagreement|conflict|influence|difficult stakeholder/.test(q)) return 'stakeholder';
  if (/risk|dependency|blocked|threatened|setback|failure|incident/.test(q)) return 'risk';
  if (/decision.*incomplete|incomplete information|ambiguity|uncertain/.test(q)) return 'decision';
  if (/data|automation|ai|artificial intelligence/.test(q) && type !== 'technical') return 'innovation';
  if (/architecture|design.*platform|system architecture|solution architecture/.test(q)) return 'architecture';
  if (/trade-off|tradeoff|options.*evaluate|why did you choose|technical approach/.test(q)) return 'tradeoff';
  if (/security|resilience|performance|observability|non-functional|nonfunctional/.test(q)) return 'nfr';
  if (/deployment|production|release|service transition|operational handover|go-live|go live/.test(q)) return 'release';
  return type === 'technical' ? 'technical' : type === 'hr' ? 'hr' : 'behavioural';
}

function verifiedEvidenceBlock(items) {
  if (!items.length) return '[Choose one verified example from your experience that directly answers this question.]';
  return items.map((item, index) => `Evidence ${index + 1}: ${item}`).join('\n');
}

function output(intent, title, testing, structure, response, evidence, missing) {
  return {
    intent,
    title,
    interviewer_testing: testing,
    structure,
    expected_response: response,
    relevant_evidence: evidence,
    missing_evidence: missing,
    evidence_safe: true,
  };
}

export function buildExpectedInterviewResponse(raw = {}) {
  const role = clean(raw.role, 240) || 'target role';
  const company = clean(raw.company, 240);
  const question = clean(raw.question, 1200);
  const type = ['hr','behavioural','technical'].includes(raw.interview_type) ? raw.interview_type : 'behavioural';
  const jobDescription = clean(raw.job_description, 12000);
  const evidence = rankEvidence(question, role, jobDescription, raw.candidate_evidence).slice(0, 3);
  const evidenceText = verifiedEvidenceBlock(evidence);
  const intent = classify(question, type);
  const employer = company ? ` at ${company}` : '';

  if (intent === 'introduction') {
    return output(intent, 'Expected response for this question', ['seniority and role fit','career narrative','credible evidence','motivation'], 'Present → strongest relevant experience → 1–2 proof points → why this role now', `I am a ${role} professional with [verified years/scope if you want to state it]. My background is strongest in [2–3 capabilities relevant to this vacancy]. A representative proof point is:\n${evidenceText}\nI am interested in this ${role}${employer} opportunity because [verified reason linked to the role/company], and I would bring [specific capability evidenced above].`, evidence, evidence.length ? ['Add only a verified motivation/reason for this specific opportunity.'] : ['A verified career example is needed before using a concrete achievement.']);
  }

  if (intent === 'motivation') {
    return output(intent, 'Expected response for this question', ['specific motivation','understanding of the role/company','fit','credibility'], 'Why this role/company → why now → evidence of fit → value you can bring', `I am interested in the ${role}${employer} opportunity because [specific verified reason from the role/company]. The part that aligns most strongly with my background is [requirement/capability]. My evidence is:\n${evidenceText}\nThat is why this role is a logical next step for me rather than a generic job move.`, evidence, ['Do not invent company facts or values; use only information you have verified.']);
  }

  if (intent === 'practical') {
    return output(intent, 'Expected response for this question', ['clarity','realistic expectations','availability','flexibility without overpromising'], 'Answer directly → give exact verified facts → state flexibility boundaries', `My verified position is: [state exact availability/notice period]. My location/working-pattern requirement is [state verified preference]. For compensation, [state your verified expectation or explain that you are open to the overall package]. I can be flexible on [only what is genuinely flexible].`, evidence, ['Use exact personal facts; this answer should not be inferred from the job description.']);
  }

  if (intent === 'stakeholder') {
    return output(intent, 'Expected response for this question', ['stakeholder judgement','influence','conflict resolution','decision quality','outcome'], 'Situation → disagreement and stakes → your decision/influence actions → resolution → measurable outcome/learning', `Situation: Use one relevant verified example:\n${evidenceText}\nTask: Explain what you were personally accountable for and why the disagreement mattered.\nAction: State how you understood each position, what evidence/options you brought, how you challenged or negotiated, and what decision mechanism you used.\nResult: [state only the verified outcome/metric].\nLearning: [what you changed or would repeat].`, evidence, ['Your exact accountability and the verified resolution/outcome must come from your real example.']);
  }

  if (intent === 'risk') {
    return output(intent, 'Expected response for this question', ['risk identification','ownership','dependency management','decision making','measurable recovery'], 'Situation/risk → impact if unmanaged → your actions/decision → controls → verified outcome', `Situation: Anchor the answer in a verified delivery risk or dependency:\n${evidenceText}\nTask: State your personal accountability and what was at risk.\nAction: Explain how you identified root cause/dependencies, prioritised the response, aligned stakeholders, introduced controls or rollback/contingency, and tracked closure.\nResult: [state the verified time, quality, incident, adoption, cost or risk outcome].`, evidence, ['Do not treat the existence of a risk as the result; add a real outcome only if verified.']);
  }

  if (intent === 'decision') {
    return output(intent, 'Expected response for this question', ['judgement under uncertainty','options analysis','risk management','decision ownership','outcome'], 'Context/unknowns → options → decision criteria → your decision → mitigation → result', `Context: Use a verified decision example:\n${evidenceText}\nI did not have complete information about [verified unknown]. I identified the viable options, compared them using [risk/value/time/cost/technical criteria], and I decided [your actual decision]. I reduced uncertainty through [POC/data/escalation/control/review if true]. The verified outcome was [actual result].`, evidence, ['The chosen option and outcome must come from your evidence; keep placeholders if they are not available.']);
  }

  if (intent === 'innovation') {
    return output(intent, 'Expected response for this question', ['problem definition','why automation/AI was appropriate','governance','adoption','measured value'], 'Problem → baseline → solution choice → controls → adoption → verified value', `Problem: Start with a verified operational or user problem.\n${evidenceText}\nExplain the baseline, why data/automation/AI was the right intervention, what you personally designed or delivered, how you controlled quality/security/governance, and the verified benefit [time/cost/adoption/quality metric].`, evidence, ['State the technology and measured benefit only if you actually used and measured them.']);
  }

  if (intent === 'architecture') {
    return output(intent, 'Expected response for this question', ['technical fluency','architecture understanding','dependencies','non-functional requirements','delivery ownership'], 'Business context → components/data flow → dependencies → controls/NFRs → your decisions → outcome', `Context: Use the most relevant platform example:\n${evidenceText}\nDescribe the users/scale and the architecture at a level appropriate for a ${role}: entry points, core services/components, integrations/APIs, identity/security, data flows and infrastructure. Then explain the key dependency or design decision you personally drove, the NFRs you validated, and the verified operational/delivery outcome.`, evidence, ['Do not claim hands-on implementation if your role was delivery/technical leadership; state your actual decision and validation scope.']);
  }

  if (intent === 'tradeoff') {
    return output(intent, 'Expected response for this question', ['options analysis','technical judgement','trade-offs','risk controls','decision outcome'], 'Constraint → options → evaluation criteria → choice → mitigation → verified outcome', `Use a verified technical decision:\n${evidenceText}\nThe constraint was [verified constraint]. I evaluated [actual options] against security, resilience, performance, cost, delivery time and operability as relevant. I chose [actual option] because [verified rationale], mitigated the downside through [control/test/rollback/monitoring], and the verified outcome was [actual result].`, evidence, ['Options, rationale and result must be factual; leave placeholders rather than inventing them.']);
  }

  if (intent === 'nfr') {
    return output(intent, 'Expected response for this question', ['security/resilience/performance thinking','measurable acceptance criteria','testing','observability','operational readiness'], 'NFRs → measurable criteria → design/control → testing → monitoring → evidence of readiness', `For this example:\n${evidenceText}\nI would explain the relevant NFRs as measurable requirements: security/access control, resilience/failover, performance/latency/capacity and observability. Then state which controls/tests you actually used, what evidence was required for release readiness, how failures were handled, and the verified service outcome.`, evidence, ['Add specific SLOs/thresholds only if they were genuinely used in the example.']);
  }

  if (intent === 'release') {
    return output(intent, 'Expected response for this question', ['end-to-end delivery control','testing','release readiness','rollback','service transition'], 'Plan/dependencies → test evidence → go/no-go → deployment/rollback → BAU handover → outcome', `Use a real release example:\n${evidenceText}\nExplain how you moved from design/build into integration/UAT/security/NFR validation, what evidence drove the go/no-go decision, how rollback/contingency was prepared, how telemetry/support/runbooks were handed to BAU, and the verified result after release.`, evidence, ['Do not claim zero incidents or successful rollback unless that was actually true for the chosen example.']);
  }

  if (intent === 'technical') {
    return output(intent, 'Expected response for this question', ['technical depth','decision ownership','controls','operational outcome'], 'Context → technical approach → your decision/actions → controls/testing → verified outcome', `Use the most relevant verified technical example:\n${evidenceText}\nSet the context and constraints, explain the technical approach and dependencies, state what you personally decided/drove/validated, cover the relevant controls and testing, and finish with the verified service or delivery outcome.`, evidence, ['Keep implementation claims aligned to your actual role.']);
  }

  if (intent === 'hr') {
    return output(intent, 'Expected response for this question', ['directness','role fit','credibility','communication'], 'Direct answer → relevant proof → link back to this role', `Answer the question directly, then support it with one relevant verified proof point:\n${evidenceText}\nFinish by linking that evidence back to what the ${role}${employer} role needs.`, evidence, ['Use personal facts only where the question asks for them.']);
  }

  return output(intent, 'Expected response for this question', ['STAR structure','personal ownership','judgement','measurable outcome'], 'Situation → Task → Action → Result → learning if useful', `Situation: Choose one verified example:\n${evidenceText}\nTask: State your personal objective/accountability.\nAction: Give 2–3 specific “I” actions or decisions, including how you handled stakeholders/risks.\nResult: [verified measurable outcome].\nLearning: [briefly state what you learned or changed if relevant].`, evidence, ['A measurable result should only be added if it is verified.']);
}
