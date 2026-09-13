const STOP_WORDS = new Set([
  'the','and','for','with','that','this','from','your','you','our','are','will','have','has','had','into','job','role','work','working','team','teams','within','across','their','they','who','what','where','when','using','use','used','can','all','not','but','about','more','than','years','year','experience','skills','skill','required','requirements','responsibilities','responsibility','including','such','other','also','would','should','could','able','been','being','make','well','strong','good','new','day','business','company','candidate','position','people','support','delivery','successful','responsible','ability','excellent','knowledge','understanding','looking','seeking','join','ensure','drive','manage','management'
]);

const ALIASES = new Map([
  ['programme', 'program'],
  ['programmes', 'program'],
  ['projects', 'project'],
  ['technical programme manager', 'technical program manager'],
  ['identity and access management', 'iam'],
  ['identity & access management', 'iam'],
  ['privileged access management', 'pam'],
  ['azure active directory', 'entra id'],
  ['azure ad', 'entra id'],
  ['single sign on', 'sso'],
  ['multi factor authentication', 'mfa'],
  ['multi-factor authentication', 'mfa'],
  ['continuous integration', 'ci'],
  ['continuous delivery', 'cd'],
  ['continuous deployment', 'cd'],
]);

const TECHNOLOGY_TERMS = [
  'aws','azure','gcp','jira','confluence','servicenow','okta','sailpoint','cyberark','entra id','iam','pam','mfa','sso','oauth','oidc','saml','api','apis','microservices','kubernetes','docker','terraform','linux','windows','sql','python','java','javascript','typescript','react','node','oracle','sap','dynamics 365','power bi','tableau','grafana','sentinel','defender','agile','scrum','kanban','safe','prince2','itil','ios','android'
];

export function cleanText(value, limit = 30000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

export function normalizeText(value) {
  let text = cleanText(value, 40000).toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9+#./ -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [from, to] of ALIASES.entries()) {
    text = text.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, 'g'), to);
  }
  return text.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function tokens(value) {
  return Array.from(new Set(normalizeText(value).match(/[a-z0-9+#.]{2,}/g) || []))
    .filter((word) => !STOP_WORDS.has(word) && !/^\d+$/.test(word));
}

function splitSentences(value) {
  const prepared = String(value ?? '')
    .replace(/\r/g, '\n')
    .replace(/[•●▪◦]/g, '\n')
    .replace(/\s*[-–—]\s+(?=[A-Z])/g, '\n')
    .replace(/\n{2,}/g, '\n');
  return prepared
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((item) => cleanText(item, 420))
    .filter((item) => item.length >= 18);
}

function classifyRequirement(sentence) {
  const text = normalizeText(sentence);
  if (/\b(preferred|preferably|desirable|nice to have|bonus|ideally|advantage|advantageous)\b/.test(text)) return 'preferred';
  if (/\b(must|required|essential|minimum|mandatory|you need|you will need|you'll need|proven experience|demonstrated experience|hands on experience|expertise in|strong experience)\b/.test(text)) return 'must_have';
  if (/\b(lead|manage|coordinate|deliver|drive|own|oversee|partner|collaborate|ensure|plan|execute|govern|report|facilitate|support|responsible for)\b/.test(text)) return 'responsibility';
  return 'signal';
}

function requirementKey(text) {
  return tokens(text).slice(0, 10).sort().join('|');
}

export function extractRequirements(description, skills = []) {
  const candidates = [];
  for (const sentence of splitSentences(description)) {
    const category = classifyRequirement(sentence);
    const reqTokens = tokens(sentence);
    if (reqTokens.length < 2) continue;
    const meaningful = reqTokens.some((token) => token.length >= 4 || TECHNOLOGY_TERMS.includes(token));
    if (!meaningful) continue;
    candidates.push({ requirement: sentence, category, source: 'description' });
  }
  for (const rawSkill of Array.isArray(skills) ? skills : []) {
    const skill = cleanText(rawSkill, 120);
    if (tokens(skill).length) candidates.push({ requirement: skill, category: 'signal', source: 'skill' });
  }

  const seen = new Set();
  const weighted = candidates
    .filter((item) => {
      const key = requirementKey(item.requirement);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => categoryPriority(a.category) - categoryPriority(b.category));

  return weighted.slice(0, 20);
}

function categoryPriority(category) {
  return category === 'must_have' ? 0 : category === 'responsibility' ? 1 : category === 'preferred' ? 2 : 3;
}

function techTermsIn(value) {
  const normalized = normalizeText(value);
  return TECHNOLOGY_TERMS.filter((term) => normalized.includes(term));
}

function sentenceSimilarity(requirement, candidateSentence) {
  const reqTokens = tokens(requirement);
  const candidateTokens = new Set(tokens(candidateSentence));
  if (!reqTokens.length) return { coverage: 0, overlap: [], techOverlap: [] };
  const overlap = reqTokens.filter((token) => candidateTokens.has(token));
  const reqTech = techTermsIn(requirement);
  const candidateNorm = normalizeText(candidateSentence);
  const techOverlap = reqTech.filter((term) => candidateNorm.includes(term));
  const coverage = overlap.length / reqTokens.length;
  return { coverage, overlap, techOverlap };
}

function evidenceForRequirement(requirement, profileSentences) {
  const reqTokens = tokens(requirement.requirement);
  const reqTech = techTermsIn(requirement.requirement);
  const scored = profileSentences.map((sentence) => {
    const similarity = sentenceSimilarity(requirement.requirement, sentence);
    const numeric = /\b\d+(?:[.,]\d+)?%?\b/.test(sentence) ? 0.06 : 0;
    const techBoost = similarity.techOverlap.length ? 0.18 : 0;
    return { sentence, score: Math.min(1, similarity.coverage + techBoost + numeric), ...similarity };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0] || { score: 0, coverage: 0, overlap: [], techOverlap: [], sentence: '' };
  const evidence = scored.filter((item) => item.score >= 0.28).slice(0, 2).map((item) => item.sentence);
  let status = 'unknown';

  const strongLexical = best.coverage >= 0.52 && best.overlap.length >= Math.min(3, Math.max(2, reqTokens.length));
  const strongTech = reqTech.length > 0 && best.techOverlap.length > 0 && best.coverage >= 0.22;
  const partialLexical = best.coverage >= 0.27 && best.overlap.length >= 1;
  const partialTech = reqTech.length > 0 && best.techOverlap.length > 0;

  if (strongLexical || strongTech) status = 'confirmed';
  else if (partialLexical || partialTech) status = 'partial';
  else if ((requirement.category === 'must_have' || requirement.category === 'preferred') && reqTokens.length >= 2) status = 'gap';
  else status = 'unknown';

  const rationale = status === 'confirmed'
    ? 'The candidate profile contains explicit evidence aligned to this requirement.'
    : status === 'partial'
      ? 'Related evidence is present, but the requirement is not fully explicit in the candidate profile.'
      : status === 'gap'
        ? 'This explicit requirement is not supported by evidence in the supplied candidate profile.'
        : 'The available vacancy or candidate evidence is not specific enough to make a reliable match decision.';

  return {
    requirement: requirement.requirement,
    category: requirement.category,
    source: requirement.source,
    status,
    candidate_evidence: evidence,
    rationale,
    overlap_terms: best.overlap.slice(0, 8),
  };
}

function roleAlignment(title, profile) {
  const titleTokens = tokens(title).filter((token) => !['senior','lead','principal','junior','associate'].includes(token));
  if (!titleTokens.length) return { score: 50, evidence: [] };
  const sentences = splitSentences(profile);
  const ranked = sentences.map((sentence) => {
    const candidate = new Set(tokens(sentence));
    const overlap = titleTokens.filter((token) => candidate.has(token));
    return { sentence, overlap, coverage: overlap.length / titleTokens.length };
  }).sort((a, b) => b.coverage - a.coverage || b.overlap.length - a.overlap.length);
  const best = ranked[0] || { coverage: 0, overlap: [], sentence: '' };
  let score = 35;
  if (best.coverage >= 0.99) score = 95;
  else if (best.coverage >= 0.67) score = 85;
  else if (best.coverage >= 0.5) score = 72;
  else if (best.overlap.length) score = 58;
  return { score, evidence: best.sentence ? [best.sentence] : [] };
}

function scoreEvidenceItems(items, categories) {
  const selected = items.filter((item) => categories.includes(item.category));
  if (!selected.length) return null;
  const known = selected.filter((item) => item.status !== 'unknown');
  if (!known.length) return { score: 50, known: 0, total: selected.length };
  const points = known.reduce((sum, item) => sum + (item.status === 'confirmed' ? 1 : item.status === 'partial' ? 0.55 : 0), 0);
  return { score: Math.round((points / known.length) * 100), known: known.length, total: selected.length };
}

function dimension(label, key, weight, score, detail) {
  return { key, label, weight, score: Math.max(0, Math.min(100, Math.round(score))), detail };
}

function recommendationFor(score, evidence) {
  const mustGaps = evidence.filter((item) => item.category === 'must_have' && item.status === 'gap').length;
  if (score >= 80 && mustGaps === 0) return 'Apply';
  if (score >= 62 && mustGaps <= 1) return 'Apply after tailoring';
  return 'Review carefully';
}

function fitLabel(score) {
  if (score >= 85) return 'Excellent fit';
  if (score >= 75) return 'Strong fit';
  if (score >= 62) return 'Competitive with tailoring';
  if (score >= 50) return 'Mixed fit';
  return 'Low evidence fit';
}

function evidenceConfidence(profile, evidence) {
  const known = evidence.filter((item) => item.status !== 'unknown').length;
  const unknownRate = evidence.length ? evidence.filter((item) => item.status === 'unknown').length / evidence.length : 1;
  if (profile.length >= 1500 && known >= 6 && unknownRate <= 0.3) return 'high';
  if (profile.length >= 600 && known >= 3 && unknownRate <= 0.55) return 'medium';
  return 'low';
}

export function analyseCandidateFit(vacancy, profile) {
  const title = cleanText(vacancy?.title, 240);
  const description = cleanText(vacancy?.description, 12000);
  const skills = Array.isArray(vacancy?.skills) ? vacancy.skills.map((item) => cleanText(item, 120)).filter(Boolean) : [];
  const candidateProfile = cleanText(profile, 30000);
  if (!title || !description) throw new Error('A selected vacancy with title and description is required.');
  if (!candidateProfile) throw new Error('Candidate evidence is required.');

  const requirements = extractRequirements(description, skills);
  const profileSentences = splitSentences(candidateProfile);
  const evidence = requirements.map((requirement) => evidenceForRequirement(requirement, profileSentences));
  const role = roleAlignment(title, candidateProfile);
  const must = scoreEvidenceItems(evidence, ['must_have']);
  const responsibilities = scoreEvidenceItems(evidence, ['responsibility']);
  const preferred = scoreEvidenceItems(evidence, ['preferred', 'signal']);

  const rawDimensions = [
    { label: 'Role alignment', key: 'role_alignment', weight: 25, score: role.score, detail: role.evidence[0] || 'Role-title evidence was not explicit in the profile.' },
    ...(must ? [{ label: 'Must-have evidence', key: 'must_have', weight: 35, score: must.score, detail: `${must.known} of ${must.total} extracted must-have requirements had enough evidence for assessment.` }] : []),
    ...(responsibilities ? [{ label: 'Responsibility alignment', key: 'responsibilities', weight: 25, score: responsibilities.score, detail: `${responsibilities.known} of ${responsibilities.total} responsibility signals had enough evidence for assessment.` }] : []),
    ...(preferred ? [{ label: 'Preferred / skill evidence', key: 'preferred_skills', weight: 15, score: preferred.score, detail: `${preferred.known} of ${preferred.total} preferred or skill signals had enough evidence for assessment.` }] : []),
  ];
  const totalWeight = rawDimensions.reduce((sum, item) => sum + item.weight, 0) || 1;
  const dimensions = rawDimensions.map((item) => dimension(item.label, item.key, item.weight, item.score, item.detail));
  let overall = Math.round(rawDimensions.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight);

  const mustGaps = evidence.filter((item) => item.category === 'must_have' && item.status === 'gap').length;
  if (mustGaps >= 2) overall = Math.min(overall, 69);
  else if (mustGaps === 1) overall = Math.min(overall, 78);

  const recommendation = recommendationFor(overall, evidence);
  const strengths = evidence.filter((item) => item.status === 'confirmed').slice(0, 6).map((item) => item.requirement);
  const gaps = evidence.filter((item) => item.status === 'gap').slice(0, 6).map((item) => item.requirement);
  const unknowns = evidence.filter((item) => item.status === 'unknown').slice(0, 6).map((item) => item.requirement);
  const partials = evidence.filter((item) => item.status === 'partial').slice(0, 6).map((item) => item.requirement);

  return {
    overall_fit: overall,
    fit_label: fitLabel(overall),
    recommendation,
    confidence: evidenceConfidence(candidateProfile, evidence),
    dimensions,
    evidence,
    strengths,
    partials,
    gaps,
    unknowns,
    summary: recommendation === 'Apply'
      ? `The supplied profile contains strong evidence for this vacancy with ${mustGaps} explicit must-have gap${mustGaps === 1 ? '' : 's'}.`
      : recommendation === 'Apply after tailoring'
        ? 'The vacancy is plausible, but the application should make partial or missing evidence explicit before submission.'
        : 'The available evidence does not yet justify treating this as a high-priority application.',
  };
}

function parsePostedAgeDays(value) {
  const text = cleanText(value, 120).toLowerCase();
  if (!text) return null;
  if (text === 'today' || text.includes('just posted')) return 0;
  if (text === 'yesterday') return 1;
  const relative = text.match(/(\d+)\s+day/);
  if (relative) return Number(relative[1]);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor((Date.now() - parsed) / 86400000));
}

export function vacancyConfidence(vacancy) {
  let score = 0;
  const notes = [];
  const link = cleanText(vacancy?.link, 1600);
  let validUrl = false;
  try {
    const parsed = new URL(link);
    validUrl = parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  } catch {
    validUrl = false;
  }
  if (validUrl) score += 25;
  else notes.push('A verified HTTPS vacancy URL was not carried into Job Intelligence.');

  if (vacancy?.direct) score += 35;
  else if (cleanText(vacancy?.source, 160)) score += 20;
  else notes.push('Source provenance is limited in this handoff.');

  const descriptionLength = cleanText(vacancy?.description, 12000).length;
  if (descriptionLength >= 700) score += 20;
  else if (descriptionLength >= 250) score += 12;
  else notes.push('The vacancy description is relatively short, so requirement extraction confidence is lower.');

  const ageDays = parsePostedAgeDays(vacancy?.posted);
  let freshness = 'unknown';
  if (ageDays === null) {
    score += 5;
    notes.push('Posting age was not available; freshness is shown as unknown rather than inferred.');
  } else if (ageDays <= 14) {
    score += 20;
    freshness = 'fresh';
  } else if (ageDays <= 30) {
    score += 10;
    freshness = 'aging';
  } else {
    freshness = 'stale';
    notes.push('The supplied posting date appears older than 30 days.');
  }

  const level = score >= 80 ? 'high' : score >= 55 ? 'medium' : 'low';
  return { score, level, valid_url: validUrl, freshness, notes };
}

export function parseLegacyScoutPrefill(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const targetRole = cleanText(raw.targetRole, 240);
  const location = cleanText(raw.location, 240) || 'UK';
  const rawDescription = String(raw.jobDescription || '').replace(/\r/g, '\n').slice(0, 12000).trim();
  if (!targetRole || !rawDescription) return null;
  const firstLine = rawDescription.split(/\n+/)[0] || '';
  const prefix = `${targetRole} at `;
  const company = firstLine.startsWith(prefix) ? cleanText(firstLine.slice(prefix.length), 240) : 'Selected employer';
  const roleSignalsMatch = rawDescription.match(/Role signals:\s*([^\n]+)/i);
  const skills = roleSignalsMatch ? roleSignalsMatch[1].split(',').map((item) => cleanText(item, 120)).filter(Boolean) : [];
  const description = cleanText(rawDescription
    .replace(firstLine, '')
    .replace(/Location:\s*[^\n]+/i, '')
    .replace(/Role signals:\s*[^\n]+/i, '')
    .trim(), 12000);
  return {
    title: targetRole,
    company,
    location,
    salary: '',
    posted: '',
    description,
    skills,
    link: '',
    remote: /remote/i.test(location),
    source: 'Job Scout verified selection',
    direct: false,
    handoff_version: 'legacy',
  };
}
