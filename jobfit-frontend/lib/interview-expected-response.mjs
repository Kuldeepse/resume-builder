const STOP = new Set([
  'the','and','for','with','that','this','from','your','you','our','are','was','were','have','has','had','into','about','tell','describe','explain','example','time','role','job','question','what','when','where','which','while','would','could','should','how','why','did','does','doing','done','their','they','them','then','than','more','most','some','any','give','walk','through','please'
]);

function clean(value, limit = 6000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function tokens(value) {
  return Array.from(new Set((clean(value, 20000).toLowerCase().match(/[a-z0-9+#.-]{2,}/g) || [])
    .filter((word) => !STOP.has(word) && !/^\d+$/.test(word))));
}

function focusTerms(question) {
  return tokens(question).slice(0, 7);
}

function rankEvidence(question, role, jobDescription, evidence) {
  const intentTokens = new Set(tokens(`${question} ${role} ${jobDescription}`).slice(0, 100));
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
  if (/salary|notice period|availability|location preference|working pattern|hybrid|travel|relocat/.test(q)) return 'practical';
  if (/stakeholder|disagreement|conflict|influence|difficult stakeholder|pushback/.test(q)) return 'stakeholder';
  if (/prioriti|competing|multiple demands|scope change|scope creep|trade off priorities/.test(q)) return 'prioritisation';
  if (/deadline|tight timeline|under pressure|deliver.*pace|fast pace|urgent|limited time/.test(q)) return 'pace';
  if (/quality|bug|defect|production issue|test failure|release blocker/.test(q)) return 'quality';
  if (/leadership|lead a team|managed a team|mentor|coach a team|develop.*people/.test(q)) return 'leadership';
  if (/change|changing|improv|transformation|new process|resistance to change/.test(q)) return 'change';
  if (/customer|user need|user feedback|client|service user/.test(q)) return 'customer';
  if (/agile|scrum|kanban|sprint|backlog|retrospective|product owner/.test(q)) return 'agile';
  if (/risk|dependency|blocked|threatened|setback|failure|incident/.test(q)) return 'risk';
  if (/decision.*incomplete|incomplete information|ambiguity|uncertain|uncertainty/.test(q)) return 'decision';
  if (/data|automation|ai|artificial intelligence/.test(q) && type !== 'technical') return 'innovation';
  if (/architecture|design.*platform|system architecture|solution architecture|components|data flow/.test(q)) return 'architecture';
  if (/trade-off|tradeoff|options.*evaluate|why did you choose|technical approach/.test(q)) return 'tradeoff';
  if (/security|resilience|performance|observability|non-functional|nonfunctional|availability|latency|capacity/.test(q)) return 'nfr';
  if (/deployment|production|release|service transition|operational handover|go-live|go live|rollback/.test(q)) return 'release';
  return type === 'technical' ? 'technical' : type === 'hr' ? 'hr' : 'behavioural';
}

const TESTING = {
  introduction: ['seniority and role fit','career narrative','credible evidence','motivation'],
  motivation: ['specific motivation','understanding of the opportunity','role fit','credibility'],
  practical: ['clarity','realistic expectations','availability','flexibility'],
  stakeholder: ['stakeholder judgement','influence','conflict resolution','decision quality','outcome'],
  prioritisation: ['prioritisation logic','trade-offs','value/risk judgement','stakeholder alignment','outcome'],
  pace: ['delivery under pressure','planning','dependency control','quality protection','outcome'],
  quality: ['quality judgement','release decision','root cause','risk control','customer/service protection'],
  leadership: ['leadership style','delegation','team effectiveness','coaching','outcome'],
  change: ['change leadership','adoption','resistance management','communication','measured improvement'],
  customer: ['user focus','problem understanding','evidence','trade-offs','customer outcome'],
  agile: ['Agile judgement','flow and prioritisation','ceremony purpose','impediment removal','delivery outcome'],
  risk: ['risk identification','ownership','dependency management','decision making','measurable recovery'],
  decision: ['judgement under uncertainty','options analysis','risk management','decision ownership','outcome'],
  innovation: ['problem definition','solution choice','governance','adoption','measured value'],
  architecture: ['technical fluency','architecture understanding','dependencies','non-functional requirements','delivery ownership'],
  tradeoff: ['options analysis','technical judgement','trade-offs','risk controls','decision outcome'],
  nfr: ['security/resilience/performance thinking','measurable acceptance criteria','testing','observability','operational readiness'],
  release: ['end-to-end delivery control','testing','release readiness','rollback','service transition'],
  technical: ['technical depth','decision ownership','controls','operational outcome'],
  hr: ['directness','role fit','credibility','communication'],
  behavioural: ['question relevance','personal ownership','judgement','evidence','measurable outcome'],
};

const STRUCTURES = {
  introduction: 'Present profile → strongest relevant experience → proof point → why this role now',
  motivation: 'Why this opportunity → why now → evidence of fit → value you can bring',
  practical: 'Direct answer → exact personal facts → flexibility boundaries',
  stakeholder: 'Context/disagreement → stakes → your influence/actions → decision → outcome',
  prioritisation: 'Competing demands → criteria → trade-off/decision → stakeholder alignment → outcome',
  pace: 'Urgency/deadline → plan/critical path → actions → quality/risk controls → outcome',
  quality: 'Defect/quality risk → impact → release decision → remediation/validation → outcome',
  leadership: 'Team context → leadership challenge → your actions → team behaviour/change → outcome',
  change: 'Why change was needed → resistance/constraints → engagement/actions → adoption → outcome',
  customer: 'User/customer problem → evidence → decision → delivery/change → measurable user outcome',
  agile: 'Delivery context → Agile problem → intervention → flow/ceremony/change → outcome',
  risk: 'Risk/dependency → impact if unmanaged → your ownership/actions → controls → outcome',
  decision: 'Unknowns → options → decision criteria → your decision → mitigation → result',
  innovation: 'Problem/baseline → solution choice → controls → adoption → verified value',
  architecture: 'Business context → components/data flow → dependencies → NFRs → your decisions → outcome',
  tradeoff: 'Constraint → options → evaluation criteria → choice → mitigation → outcome',
  nfr: 'NFRs → measurable criteria → controls/tests → monitoring → readiness outcome',
  release: 'Dependencies → test evidence → go/no-go → deployment/rollback → BAU handover → outcome',
  technical: 'Context → technical approach → your decision/actions → controls/testing → outcome',
  hr: 'Direct answer → relevant proof → link back to this role',
  behavioural: 'Answer the exact event/competency asked → your accountability → specific actions → outcome → learning',
};

function output(intent, question, testing, structure, response, evidence, focus) {
  return {
    intent,
    intent_summary: `This exact question is testing ${testing.slice(0, 3).join(', ')}. Question focus: ${focus.join(', ') || clean(question, 180)}.`,
    title: evidence.length ? 'Evidence-grounded expected response' : 'Illustrative model response',
    interviewer_testing: testing,
    structure,
    expected_response: response,
    relevant_evidence: evidence,
    missing_evidence: evidence.length ? [] : ['No verified candidate evidence was available for this exact question.'],
    evidence_safe: true,
    basis: evidence.length ? 'verified_evidence' : 'illustrative_model',
  };
}

function illustrative(intent, question, role, employer, focus) {
  const companyPhrase = employer ? ` at ${employer}` : '';
  const exactFocus = focus.length ? focus.join(', ') : clean(question, 180);
  const prefix = `Illustrative model answer for the exact question “${question}” — adapt it to your real experience. Focus specifically on ${exactFocus}.`;
  const bodies = {
    introduction: `I would open with a concise summary of my current ${role} profile, then select the two capabilities most relevant to this vacancy. I would support that with one concrete example showing what I personally owned, the scale or complexity, and the measurable outcome. I would close by explaining why those strengths make this ${role}${companyPhrase} opportunity the right next step.`,
    motivation: `I would explain the specific elements of this ${role}${companyPhrase} opportunity that attract me, connect them to the work I have already done, and give one proof point showing I can contribute in those areas. I would then explain why the move makes sense now, rather than giving a generic statement about wanting growth or a new challenge.`,
    practical: `I would answer directly with my real availability or notice period, location and working-pattern constraints, and compensation position if asked. I would state exactly where I am flexible and avoid implying flexibility that is not genuine.`,
    stakeholder: `I would describe a real disagreement where the positions and stakes were clear. I would explain what I was accountable for, how I understood each stakeholder’s concern, what evidence or options I brought into the discussion, how I influenced the decision, and what changed afterwards. I would finish with the actual delivery or relationship outcome.`,
    prioritisation: `I would describe the competing demands, then explain the criteria I used to prioritise them—such as user value, regulatory or operational risk, dependency impact, effort and strategic urgency. I would show the trade-off I made, how I aligned stakeholders on what would not be done immediately, and the measurable result of that decision.`,
    pace: `I would explain the deadline and why it mattered, then show how I identified the critical path, removed or escalated blockers, sequenced work, and protected essential quality and control gates rather than simply asking people to work faster. I would close with the actual delivery result and any impact on quality, incidents or stakeholder confidence.`,
    quality: `I would make the quality risk concrete: what defect or failure was found, who or what could be affected, and how close the release was. I would explain the evidence used for the release decision, the remediation or rollback options, who I involved, and why I chose to proceed, delay or roll back. I would finish with the verified service or customer outcome.`,
    leadership: `I would describe the team situation and the leadership challenge, then focus on how I set direction, clarified ownership, delegated decisions, coached or challenged individuals, removed obstacles and created accountability. I would close with how team performance, delivery confidence or capability changed as a result.`,
    change: `I would explain why the change was necessary and what resistance or uncertainty existed. I would show how I involved affected users or teams, used evidence to shape the change, communicated the impact, created feedback loops and measured adoption. I would finish with the verified improvement rather than simply saying the change was implemented.`,
    customer: `I would start with the specific user or customer problem and the evidence that showed it mattered. I would explain how I translated that evidence into a delivery or product decision, what trade-offs I made, and how I validated the change. I would finish with a measurable customer, usability, adoption or service outcome.`,
    agile: `I would describe the delivery problem rather than reciting Agile ceremonies. I would explain which Agile mechanism I changed—backlog quality, sprint planning, dependency management, WIP, retrospectives or stakeholder review—why that intervention addressed the problem, and what changed in flow, predictability, quality or outcomes.`,
    risk: `I would describe the specific risk or dependency and its potential impact. I would explain how I identified the root cause and critical path, what I personally owned, how I aligned the necessary teams, what contingency or control I put in place, and how I tracked the risk to closure. I would finish with the verified recovery, stability, time or cost outcome.`,
    decision: `I would make the uncertainty explicit, define the viable options and decision criteria, explain what evidence I had and what remained unknown, then show the decision I made and how I limited downside risk through a proof point, contingency, staged rollout or review gate. I would close with the actual outcome and what I learned.`,
    innovation: `I would start with the operational or user problem and baseline, explain why automation or AI was appropriate rather than using it for novelty, describe what I personally designed or delivered, include data quality, security, governance and human-review controls, and finish with measured adoption or business value.`,
    architecture: `I would walk from the business context and users through the main components, integrations or APIs, identity/security, data flow and infrastructure. I would then focus on the architecture decisions and dependencies I personally drove or validated, the relevant resilience/performance/security constraints, and the verified service or delivery outcome.`,
    tradeoff: `I would state the technical constraint and the realistic options, compare them against the criteria that mattered for this question, explain why I chose one approach, make the downside explicit, and show how I mitigated it through testing, monitoring, rollback, staged delivery or another control. I would close with evidence that the decision worked.`,
    nfr: `I would translate the specific non-functional concern in the question into measurable acceptance criteria, explain the controls and tests used to prove it, describe monitoring and failure handling, and show how that evidence influenced release readiness. I would close with the actual operational outcome.`,
    release: `I would explain how I managed the exact release concern in the question through dependency tracking, integration/UAT/security/NFR evidence, go/no-go criteria, rollback readiness, monitoring, runbooks and BAU ownership. I would close with the verified post-release stability, adoption or incident outcome.`,
    technical: `I would answer the exact technical subject in the question first, explain the approach and dependencies, make my own decision or validation scope clear, cover the relevant controls or tests, and close with the verified operational or delivery result without overstating hands-on implementation.`,
    hr: `I would answer the exact HR question directly, support the answer with one concise proof point from my background, and link that proof to what this ${role}${companyPhrase} opportunity requires.`,
    behavioural: `I would choose an example that directly matches the wording of this question—not just any STAR story. I would establish the event and why it mattered, state my own accountability, spend most of the answer on the decisions and actions that address ${exactFocus}, and close with the real measurable outcome and one learning point if useful.`,
  };
  return `${prefix}\n\n${bodies[intent] || bodies.behavioural}`;
}

function evidenceGrounded(intent, question, role, employer, evidence, focus) {
  const exactFocus = focus.length ? focus.join(', ') : clean(question, 180);
  const evidenceText = evidence.map((item, index) => `${index + 1}. ${item}`).join('\n');
  const actionGuides = {
    stakeholder: 'Use this evidence only if it demonstrates the disagreement, your influence/decision actions and the resolution.',
    prioritisation: 'Use it to explain the competing demands, your prioritisation criteria, the trade-off you made and the outcome.',
    pace: 'Use it to show the deadline, critical path, acceleration actions, quality protections and actual result.',
    quality: 'Use it to show the defect or quality risk, release decision, validation/remediation and service outcome.',
    leadership: 'Use it to show how your leadership changed team behaviour, capability or delivery performance.',
    change: 'Use it to show why change was needed, how you handled resistance, how adoption was driven and what improved.',
    customer: 'Use it to show the user problem, evidence, decision, validation and customer outcome.',
    agile: 'Use it to show the delivery problem, the Agile intervention you changed and the resulting improvement in flow or outcomes.',
    risk: 'Use it to show what was at risk, your ownership, root-cause/dependency work, controls and verified recovery.',
    decision: 'Use it to show uncertainty, options, criteria, your decision, mitigation and outcome.',
    innovation: 'Use it to show the baseline problem, solution choice, controls, adoption and verified value.',
    architecture: 'Use it to explain the architecture subject actually asked, your decision/validation scope, dependencies/NFRs and outcome.',
    tradeoff: 'Use it to explain the specific technical constraint, options, criteria, chosen trade-off, mitigation and result.',
    nfr: 'Use it to explain the specific NFR asked, measurable criteria, controls/tests and operational result.',
    release: 'Use it to show the exact release-readiness subject asked, evidence gates, rollback/BAU controls and production result.',
    technical: 'Use it to answer the exact technical subject, making your own decision/validation scope and controls explicit.',
    introduction: 'Use the strongest item as a proof point in a concise career narrative and link it to this role.',
    motivation: 'Use the strongest item to prove why this role fits your experience, then add only genuine motivation.',
    practical: 'Do not infer personal availability, salary or working preferences from career evidence; answer those with exact facts.',
    hr: 'Use one item as proof, then answer the exact HR question directly.',
    behavioural: `Use the evidence only where it directly proves the question focus: ${exactFocus}.`,
  };
  return `Evidence-grounded response for the exact question “${question}”.\n\nMost relevant verified evidence:\n${evidenceText}\n\n${actionGuides[intent] || actionGuides.behavioural} Build the answer around what you personally did and the verified result already present in the evidence; do not add facts that are not supported.`;
}

export function buildExpectedInterviewResponse(raw = {}) {
  const role = clean(raw.role, 240) || 'target role';
  const company = clean(raw.company, 240);
  const question = clean(raw.question, 1200) || 'Interview question';
  const type = ['hr','behavioural','technical'].includes(raw.interview_type) ? raw.interview_type : 'behavioural';
  const jobDescription = clean(raw.job_description, 12000);
  const focus = focusTerms(question);
  const evidence = rankEvidence(question, role, jobDescription, raw.candidate_evidence).slice(0, 3);
  const intent = classify(question, type);
  const testing = TESTING[intent] || TESTING.behavioural;
  const structure = STRUCTURES[intent] || STRUCTURES.behavioural;
  const response = evidence.length
    ? evidenceGrounded(intent, question, role, company, evidence, focus)
    : illustrative(intent, question, role, company, focus);
  return output(intent, question, testing, structure, response, evidence, focus);
}
