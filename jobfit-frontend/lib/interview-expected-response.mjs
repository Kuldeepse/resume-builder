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

function output(intent, testing, structure, response, evidence, note) {
  return {
    intent,
    title: evidence.length ? 'Evidence-grounded expected response' : 'Illustrative model response',
    interviewer_testing: testing,
    structure,
    expected_response: response,
    relevant_evidence: evidence,
    missing_evidence: evidence.length ? [] : [note || 'No verified candidate evidence was available for this question.'],
    evidence_safe: true,
    basis: evidence.length ? 'verified_evidence' : 'illustrative_model',
  };
}

function evidenceLead(evidence) {
  if (!evidence.length) return '';
  if (evidence.length === 1) return `The verified example I would use is: ${evidence[0]}`;
  return `The verified evidence I would build the answer around is: ${evidence.map((item, index) => `${index + 1}) ${item}`).join(' ')}`;
}

function illustrative(intent, role, employer) {
  const companyPhrase = employer ? ` at ${employer}` : '';
  const examples = {
    introduction: `Illustrative model answer — adapt this to your real experience: “I’m a ${role} with experience leading complex technology delivery across product, engineering, architecture, security and operations. I normally start by setting clear outcomes, dependencies and delivery controls, then keep stakeholders aligned through evidence-based decisions and release readiness. A strong example would show the scale of the programme, what I personally owned, the most difficult dependency I resolved, and the measurable outcome. I’m interested in this ${role}${companyPhrase} opportunity because it needs exactly that combination of delivery leadership, technical fluency and stakeholder management.”`,
    motivation: `Illustrative model answer — adapt this to your real reasons: “I’m interested in this ${role}${companyPhrase} opportunity because the role combines complex technology delivery with cross-functional leadership. That aligns with the kind of work I perform best in: turning ambiguous requirements into a clear delivery plan, managing technical and organisational dependencies, and getting a service safely into production. I’d connect that motivation to one verified example from my background, then explain why this role is a logical next step rather than a generic move.”`,
    practical: `Illustrative model answer — replace with your real facts: “I would answer this directly and precisely: my availability is [your real availability], my location or working-pattern preference is [your real preference], and my compensation expectation is [your real range or position]. I would then state where I am flexible and where I am not, without overcommitting.”`,
    stakeholder: `Illustrative model answer — adapt to a real example: “In a complex delivery, two senior stakeholder groups disagreed on priority and release scope, creating a risk to the committed date. I was accountable for getting to a decision without losing control of quality or risk. I clarified each position, brought the decision back to agreed outcomes and evidence, compared the options and consequences, and facilitated a decision with clear ownership. I then converted that decision into actions, dates and follow-up controls. The result should close with the real delivery or stakeholder outcome from your example.”`,
    risk: `Illustrative model answer — adapt to a real example: “On a complex programme, a critical dependency emerged that threatened the planned release. I was accountable for protecting the delivery outcome and service stability. I first established the root cause and blast radius, identified the teams and decisions on the critical path, and separated must-fix items from lower-priority work. I aligned engineering, architecture, security and business stakeholders on a recovery plan, introduced clear validation and rollback criteria, and tracked the risk through to closure. I would finish with the real measurable result from my example, such as recovery time, avoided incidents, delivery acceleration or improved service stability.”`,
    decision: `Illustrative model answer — adapt to a real example: “I had to make a delivery decision before all information was available. I made the uncertainty explicit, defined the viable options and agreed the decision criteria around value, risk, time, cost and technical impact. I used the best available evidence, identified what could be validated quickly through a proof point or control, and made the decision with a documented contingency if the assumptions proved wrong. I would close with the real outcome and what the decision enabled.”`,
    innovation: `Illustrative model answer — adapt to a real example: “I started with the operational problem rather than the technology. I quantified the baseline, identified where manual effort or poor visibility was creating delay or risk, and then assessed whether automation or AI was appropriate. I defined the controls, data quality and human-review points, delivered the change in a measurable way, and tracked adoption and business value after launch. I would finish with the verified improvement from my own example.”`,
    architecture: `Illustrative model answer — adapt to a system you actually delivered: “I would first set the business context, users, scale and constraints. Then I’d walk through the architecture from entry point to core services, integrations or APIs, identity and security, data flow, infrastructure and operational monitoring. I’d focus on the decisions I personally drove or validated, especially around dependencies, resilience, performance and release readiness. I would close with the real service or delivery outcome rather than claiming implementation work I did not personally perform.”`,
    tradeoff: `Illustrative model answer — adapt to a real technical decision: “The key constraint forced us to choose between multiple viable approaches. I compared the options against security, resilience, performance, operability, cost and delivery time. I selected the approach that best protected the critical outcomes, then mitigated its downsides through testing, monitoring, rollback and staged delivery. I would finish by stating the verified outcome and what evidence showed the decision was correct.”`,
    nfr: `Illustrative model answer — adapt to a real platform: “I treated non-functional requirements as measurable release criteria, not generic statements. I worked with engineering and architecture to define the security, resilience, performance, capacity and observability expectations, then made sure the relevant tests, monitoring and failure scenarios were evidenced before go-live. Where a threshold was not met, I expected a clear decision, remediation or rollback path. I would close with the real operational outcome from the service.”`,
    release: `Illustrative model answer — adapt to a real release: “I managed release readiness as an evidence decision rather than a date. I tracked integration, UAT, security and non-functional validation, made dependencies and residual risks visible, defined go/no-go criteria and rollback, and ensured support, monitoring, runbooks and ownership were ready for BAU. I would close with the actual post-release outcome, including stability, incidents, adoption or recovery evidence.”`,
    technical: `Illustrative model answer — adapt to a technical example you genuinely know: “I would set the context and constraints, explain the technical approach and the major dependencies, then be explicit about the decisions I personally drove or validated. I would cover the relevant security, resilience, performance, testing and operational controls and close with the real service or delivery outcome.”`,
    hr: `Illustrative model answer — adapt to your real background: “I would answer the question directly, give one concise proof point that is clearly relevant to the ${role}, explain what I personally contributed and the outcome, then link that evidence back to what this role needs.”`,
    behavioural: `Illustrative model answer — adapt to a real example: “I would give a concise situation and explain why it mattered, state exactly what I was accountable for, spend most of the answer on the decisions and actions I personally took, and finish with the real measurable outcome and one learning point. The strongest version avoids generic ‘we’ statements and makes my judgement and impact explicit.”`,
  };
  return examples[intent] || examples.behavioural;
}

function evidenceGrounded(intent, role, employer, evidence) {
  const lead = evidenceLead(evidence);
  const companyPhrase = employer ? ` at ${employer}` : '';
  const endings = {
    introduction: `I would turn that evidence into a 60–90 second introduction: establish my current ${role} profile, use the evidence above as the proof point, explain what I personally owned and the verified outcome already contained in the evidence, then link it to why this ${role}${companyPhrase} opportunity is relevant.`,
    motivation: `I would use the evidence above to prove fit, then explain the specific part of the ${role}${companyPhrase} role it demonstrates and why that makes the opportunity a logical next step.`,
    stakeholder: `I would use the evidence above as the factual STAR core: set the disagreement and stakes, state my accountability, explain the influence/decision actions actually supported by the evidence, and close with the verified outcome already present in that evidence.`,
    risk: `I would use the evidence above as the factual STAR core: identify what was at risk, state my accountability, explain the root-cause/dependency work, stakeholder alignment, controls or contingency I actually used, and close with the verified recovery or service outcome contained in the evidence.`,
    decision: `I would use the evidence above to explain the uncertainty, options and decision criteria, what I personally decided, how I reduced risk, and the verified outcome.`,
    innovation: `I would use the evidence above to explain the baseline problem, why automation or AI was appropriate, what I personally delivered, the controls used, and the verified value achieved.`,
    architecture: `I would use the evidence above to describe the platform context, components and dependencies at the level expected of a ${role}, then focus on the technical decisions or validation I personally drove and the verified operational outcome.`,
    tradeoff: `I would use the evidence above to explain the constraint, options, evaluation criteria, chosen approach, mitigations and the verified result.`,
    nfr: `I would use the evidence above to explain the measurable security, resilience, performance and observability expectations, how readiness was tested, and the verified service outcome.`,
    release: `I would use the evidence above to show how I moved from build through validation, go/no-go, rollback readiness and BAU handover, closing with the verified production outcome.`,
    technical: `I would use the evidence above as the factual core, then explain the technical approach, my decision/validation scope, controls and the verified outcome without overstating hands-on implementation.`,
    hr: `I would answer directly, use the evidence above as the proof point, and link it back to the capability this ${role}${companyPhrase} role needs.`,
    behavioural: `I would convert the evidence above into STAR: concise context, clear personal accountability, two or three specific “I” actions, and the verified result already supported by the evidence.`,
    practical: `For practical questions I would still use exact personal facts rather than infer them from career evidence.`,
  };
  return `${lead}\n\n${endings[intent] || endings.behavioural}`;
}

export function buildExpectedInterviewResponse(raw = {}) {
  const role = clean(raw.role, 240) || 'target role';
  const company = clean(raw.company, 240);
  const question = clean(raw.question, 1200);
  const type = ['hr','behavioural','technical'].includes(raw.interview_type) ? raw.interview_type : 'behavioural';
  const jobDescription = clean(raw.job_description, 12000);
  const evidence = rankEvidence(question, role, jobDescription, raw.candidate_evidence).slice(0, 3);
  const intent = classify(question, type);

  const testingByIntent = {
    introduction: ['seniority and role fit','career narrative','credible evidence','motivation'],
    motivation: ['specific motivation','understanding of the role/company','fit','credibility'],
    practical: ['clarity','realistic expectations','availability','flexibility without overpromising'],
    stakeholder: ['stakeholder judgement','influence','conflict resolution','decision quality','outcome'],
    risk: ['risk identification','ownership','dependency management','decision making','measurable recovery'],
    decision: ['judgement under uncertainty','options analysis','risk management','decision ownership','outcome'],
    innovation: ['problem definition','solution choice','governance','adoption','measured value'],
    architecture: ['technical fluency','architecture understanding','dependencies','non-functional requirements','delivery ownership'],
    tradeoff: ['options analysis','technical judgement','trade-offs','risk controls','decision outcome'],
    nfr: ['security/resilience/performance thinking','measurable acceptance criteria','testing','observability','operational readiness'],
    release: ['end-to-end delivery control','testing','release readiness','rollback','service transition'],
    technical: ['technical depth','decision ownership','controls','operational outcome'],
    hr: ['directness','role fit','credibility','communication'],
    behavioural: ['STAR structure','personal ownership','judgement','measurable outcome'],
  };

  const structures = {
    introduction: 'Present role/profile → strongest relevant experience → proof point → why this role now',
    motivation: 'Why this role/company → why now → evidence of fit → value you can bring',
    practical: 'Answer directly → exact facts → flexibility boundaries',
    stakeholder: 'Situation → disagreement/stakes → your influence/decision actions → resolution → outcome',
    risk: 'Situation/risk → impact if unmanaged → your ownership/actions → controls → verified outcome',
    decision: 'Context/unknowns → options → decision criteria → your decision → mitigation → result',
    innovation: 'Problem/baseline → solution choice → controls → adoption → verified value',
    architecture: 'Business context → architecture/data flow → dependencies → controls/NFRs → your decisions → outcome',
    tradeoff: 'Constraint → options → evaluation criteria → choice → mitigation → verified outcome',
    nfr: 'NFRs → measurable criteria → control/test evidence → monitoring → readiness outcome',
    release: 'Plan/dependencies → test evidence → go/no-go → deployment/rollback → BAU handover → outcome',
    technical: 'Context → technical approach → your decision/actions → controls/testing → verified outcome',
    hr: 'Direct answer → relevant proof → link back to this role',
    behavioural: 'Situation → Task → Action → Result → learning if useful',
  };

  const response = evidence.length
    ? evidenceGrounded(intent, role, company, evidence)
    : illustrative(intent, role, company);

  return output(
    intent,
    testingByIntent[intent] || testingByIntent.behavioural,
    structures[intent] || structures.behavioural,
    response,
    evidence,
    'No verified candidate evidence was available, so CogniTwist is showing an illustrative model answer that must be adapted before use.',
  );
}
