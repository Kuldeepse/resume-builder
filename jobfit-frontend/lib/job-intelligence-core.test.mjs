import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseCandidateFit, vacancyConfidence, parseLegacyScoutPrefill } from './job-intelligence-core.mjs';

const vacancy = {
  title: 'Senior Technical Project Manager',
  company: 'Example Bank',
  location: 'London, United Kingdom',
  posted: '2 days ago',
  source: 'Direct · Greenhouse',
  direct: true,
  link: 'https://boards.greenhouse.io/example/jobs/12345',
  skills: ['Jira', 'Agile', 'iOS', 'Android'],
  description: 'Must have proven experience delivering mobile banking programmes across iOS and Android. Lead cross-functional engineering, product, security and QA teams. Strong experience with Jira and Agile delivery is required. Experience with payments is preferred. Own release planning, dependency management and operational readiness.'
};

const profile = 'Senior Technical Project Manager with 12 years in banking technology. Led iOS and Android mobile banking releases across Product, Engineering, Security and QA. Managed release planning, dependencies and operational readiness using Jira and Agile delivery. Delivered payments and identity programmes for more than 100,000 users with zero P1 incidents. Managed multi-region technical projects, governance, RAIDD, release readiness and senior stakeholder reporting. Coordinated architecture, UX, testing, security and operations through production launch. Experienced with APIs, cloud platforms, service transition, vendor management and regulated banking controls. Built delivery plans, managed critical paths and resolved cross-team dependencies while protecting BAU. Repeatedly delivered complex customer-facing change with measurable adoption, stability and operational outcomes.';

test('strong explicit evidence produces a high, explainable fit', () => {
  const result = analyseCandidateFit(vacancy, profile);
  assert.ok(result.overall_fit >= 75, `expected >=75, got ${result.overall_fit}`);
  assert.ok(result.evidence.some((item) => item.status === 'confirmed'));
  assert.notEqual(result.confidence, 'low');
});

test('posting freshness does not change candidate fit', () => {
  const fresh = analyseCandidateFit({ ...vacancy, posted: 'Today' }, profile);
  const old = analyseCandidateFit({ ...vacancy, posted: '60 days ago' }, profile);
  assert.equal(fresh.overall_fit, old.overall_fit);
  assert.equal(fresh.recommendation, old.recommendation);
});

test('posting freshness changes vacancy confidence only', () => {
  const fresh = vacancyConfidence({ ...vacancy, posted: 'Today' });
  const old = vacancyConfidence({ ...vacancy, posted: '60 days ago' });
  assert.ok(fresh.score > old.score);
  assert.equal(fresh.freshness, 'fresh');
  assert.equal(old.freshness, 'stale');
});

test('explicit unsupported must-have requirement is a gap', () => {
  const result = analyseCandidateFit({ ...vacancy, description: vacancy.description + ' Must hold an active CISSP certification.' }, profile);
  assert.ok(result.evidence.some((item) => item.category === 'must_have' && item.status === 'gap' && /CISSP/i.test(item.requirement)));
});

test('program spelling aliases do not turn project into program', () => {
  const result = analyseCandidateFit({ ...vacancy, title: 'Technical Program Manager' }, 'Technical Project Manager with enterprise infrastructure delivery and Jira experience.');
  assert.ok(result.dimensions.find((item) => item.key === 'role_alignment').score < 95);
});

test('legacy Job Scout handoff is parsed without inventing a vacancy URL', () => {
  const parsed = parseLegacyScoutPrefill({
    targetRole: 'Technical Project Manager',
    location: 'London, UK',
    jobDescription: 'Technical Project Manager at Example Bank\n\nLocation: London, UK\n\nLead delivery across mobile engineering.\n\nRole signals: Jira, Agile',
  });
  assert.equal(parsed.company, 'Example Bank');
  assert.equal(parsed.link, '');
  assert.match(parsed.description, /Lead delivery across mobile engineering/);
  assert.deepEqual(parsed.skills, ['Jira', 'Agile']);
});
