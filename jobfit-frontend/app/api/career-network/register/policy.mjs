export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const LINKEDIN_PATTERN = /^https:\/\/(www\.)?linkedin\.com\//i;
export const PHONE_PATTERN = /^[0-9+\s().-]{7,30}$/;
export const ALLOWED_ROLES = new Set(['candidate', 'referrer', 'mentor']);

const defaultOrigins = [
  'https://rolecraftai.duckdns.org',
  'https://resume-builder-ha5ykxvh9-resume-builder-s-projects.vercel.app',
];

export function getAllowedOrigins(configuredOrigins = '') {
  const configured = configuredOrigins
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  return [...new Set([...defaultOrigins, ...configured])];
}

export function isAllowedOrigin(origin, configuredOrigins = '') {
  if (!origin) return false;

  const normalised = origin.replace(/\/$/, '');
  if (getAllowedOrigins(configuredOrigins).includes(normalised)) return true;

  try {
    const host = new URL(normalised).hostname;
    return host.startsWith('resume-builder-') && host.endsWith('-resume-builder-s-projects.vercel.app');
  } catch {
    return false;
  }
}

export function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

export function validateRegistrationPayload(body) {
  const fullName = cleanText(body.full_name, 120);
  const email = cleanText(body.email, 254).toLowerCase();
  const role = cleanText(body.role, 20);
  const linkedinProfile = cleanText(body.linkedin_profile, 500);
  const whatsappNumber = cleanText(body.whatsapp_number, 30);
  const currentCompany = cleanText(body.current_company, 160);
  const professionalArea = cleanText(body.professional_area, 160);
  const privacyNoticeVersion = cleanText(body.privacy_notice_version, 40);
  const termsAccepted = body.terms_accepted === true;
  const ageConfirmed = body.age_confirmed === true;
  const marketingOptIn = body.marketing_opt_in === true;
  const whatsappGroupConsent = body.whatsapp_group_consent === true;
  const honeypotTriggered = Boolean(cleanText(body.website, 200));

  if (honeypotTriggered) {
    return { ok: true, honeypotTriggered: true };
  }

  if (fullName.length < 2 || !EMAIL_PATTERN.test(email) || !ALLOWED_ROLES.has(role) || !professionalArea) {
    return { ok: false, detail: 'Complete all required registration fields.' };
  }

  if (linkedinProfile && !LINKEDIN_PATTERN.test(linkedinProfile)) {
    return { ok: false, detail: 'LinkedIn profile must use a linkedin.com URL.' };
  }

  if (whatsappNumber && !PHONE_PATTERN.test(whatsappNumber)) {
    return { ok: false, detail: 'WhatsApp number must look like a valid phone number.' };
  }

  if (whatsappGroupConsent && !whatsappNumber) {
    return { ok: false, detail: 'Enter a WhatsApp number if you want group-invite consent recorded.' };
  }

  if (role === 'referrer' && !currentCompany) {
    return { ok: false, detail: 'Current company is required for referrer registration.' };
  }

  if (!termsAccepted || !ageConfirmed || !privacyNoticeVersion) {
    return { ok: false, detail: 'Privacy acceptance and age confirmation are required.' };
  }

  return {
    ok: true,
    honeypotTriggered: false,
    record: {
      full_name: fullName,
      email,
      role,
      linkedin_profile: linkedinProfile || null,
      whatsapp_number: whatsappNumber || null,
      whatsapp_group_consent: whatsappGroupConsent,
      whatsapp_group_status: whatsappGroupConsent ? 'pending_approval' : 'not_requested',
      current_company: currentCompany || null,
      professional_area: professionalArea,
      privacy_notice_version: privacyNoticeVersion,
      terms_accepted: termsAccepted,
      age_confirmed: ageConfirmed,
      marketing_opt_in: marketingOptIn,
      status: 'pending_verification',
      updated_at: new Date().toISOString(),
    },
  };
}
