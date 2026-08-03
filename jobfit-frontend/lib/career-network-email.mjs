const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildStatusUrl(siteUrl) {
  return `${siteUrl.replace(/\/$/, '')}/career-network/status`;
}

function baseTemplate({ eyebrow, title, intro, sections, outro }) {
  const renderedSections = sections
    .map(
      (section) => `
        <div style="margin-top:16px;padding:16px 18px;border:1px solid rgba(15,118,110,0.16);border-radius:18px;background:#ffffff;">
          <div style="font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#0f766e;">${escapeHtml(section.label)}</div>
          <div style="margin-top:6px;font-size:16px;line-height:1.6;color:#111827;">${section.html}</div>
        </div>
      `,
    )
    .join('');

  return `
    <div style="background:#f4efe6;padding:32px 16px;font-family:'Segoe UI',sans-serif;color:#111827;">
      <div style="max-width:640px;margin:0 auto;background:rgba(255,251,245,0.96);border:1px solid rgba(155,124,83,0.24);border-radius:28px;padding:32px;box-shadow:0 26px 80px rgba(23,37,84,0.08);">
        <div style="display:inline-block;padding:8px 12px;border-radius:999px;background:#d7f3ef;border:1px solid rgba(15,118,110,0.16);font-size:11px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:#115e59;">${escapeHtml(eyebrow)}</div>
        <h1 style="margin:18px 0 0;font-size:32px;line-height:1.15;color:#111827;">${escapeHtml(title)}</h1>
        <p style="margin:16px 0 0;font-size:16px;line-height:1.7;color:#5f6675;">${intro}</p>
        ${renderedSections}
        <p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:#5f6675;">${outro}</p>
      </div>
    </div>
  `;
}

export function renderRegistrantConfirmationEmail({
  fullName,
  role,
  statusLookupCode,
  statusUrl,
  groupName,
}) {
  const safeName = escapeHtml(fullName);
  const safeRole = escapeHtml(role);
  const safeCode = escapeHtml(statusLookupCode);
  const safeStatusUrl = escapeHtml(statusUrl);
  const safeGroup = escapeHtml(groupName);

  const subject = 'Your CogniTwist AI Career Network registration is in review';
  const html = baseTemplate({
    eyebrow: 'CogniTwist AI Career Network',
    title: 'Your registration has been received',
    intro: `Hi ${safeName}, your private registration is now in manual review. Nothing has been published publicly, and access decisions remain moderated.`,
    sections: [
      {
        label: 'Tracking code',
        html: `<strong style="font-family:SFMono-Regular,Menlo,monospace;font-size:18px;letter-spacing:0.22em;">${safeCode}</strong>`,
      },
      {
        label: 'Status page',
        html: `Use your registration email address and this code at <a href="${safeStatusUrl}" style="color:#0f766e;font-weight:700;">${safeStatusUrl}</a>.`,
      },
      {
        label: 'What happens next',
        html: `We will manually review your ${safeRole} registration. If you requested access to the private WhatsApp group ${safeGroup}, that consent is reviewed separately.`,
      },
    ],
    outro: 'Keep this message or store the tracking code somewhere safe. You can use it at any time to check your registration status privately.',
  });

  const text = [
    `Hi ${fullName},`,
    '',
    'Your CogniTwist AI Career Network registration has been received and is now in manual review.',
    `Tracking code: ${statusLookupCode}`,
    `Status page: ${statusUrl}`,
    `Role: ${role}`,
    `WhatsApp group: ${groupName}`,
    '',
    'Keep this code safe so you can check your status privately later.',
  ].join('\n');

  return { subject, html, text };
}

export function renderAdminAlertEmail({
  fullName,
  email,
  role,
  professionalArea,
  currentCompany,
  whatsappGroupConsent,
  adminUrl,
}) {
  const subject = `New Career Network registration: ${fullName} (${role})`;
  const html = baseTemplate({
    eyebrow: 'Admin alert',
    title: 'A new registration needs review',
    intro: `A new private Career Network registration has been stored and is waiting for review in the admin dashboard.`,
    sections: [
      {
        label: 'Registrant',
        html: `<strong>${escapeHtml(fullName)}</strong><br/>${escapeHtml(email)}`,
      },
      {
        label: 'Profile',
        html: `Role: <strong>${escapeHtml(role)}</strong><br/>Professional area: <strong>${escapeHtml(professionalArea)}</strong>${currentCompany ? `<br/>Current company: <strong>${escapeHtml(currentCompany)}</strong>` : ''}`,
      },
      {
        label: 'WhatsApp',
        html: whatsappGroupConsent ? 'Optional WhatsApp invite consent was requested.' : 'No WhatsApp invite consent was requested.',
      },
      {
        label: 'Admin dashboard',
        html: `<a href="${escapeHtml(adminUrl)}" style="color:#0f766e;font-weight:700;">Open admin dashboard</a>`,
      },
    ],
    outro: 'Review the registration, update verification status, and separately handle any WhatsApp invite approval.',
  });

  const text = [
    'A new Career Network registration is waiting for review.',
    '',
    `Name: ${fullName}`,
    `Email: ${email}`,
    `Role: ${role}`,
    `Professional area: ${professionalArea}`,
    `Current company: ${currentCompany || 'Not provided'}`,
    `WhatsApp consent: ${whatsappGroupConsent ? 'Yes' : 'No'}`,
    `Admin dashboard: ${adminUrl}`,
  ].join('\n');

  return { subject, html, text };
}

export async function sendEmailNotification({
  apiKey,
  from,
  to,
  subject,
  html,
  text,
}) {
  if (!apiKey || !from || !to) {
    return { ok: false, skipped: true };
  }

  const recipients = Array.isArray(to) ? to : [to];
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject,
      html,
      text,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Email send failed with status ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  return { ok: true, skipped: false };
}

export async function sendCareerNetworkRegistrationEmails({
  registration,
  siteUrl,
  adminUrl,
  groupName,
  emailConfig,
}) {
  const statusUrl = buildStatusUrl(siteUrl);
  const confirmation = renderRegistrantConfirmationEmail({
    fullName: registration.full_name,
    role: registration.role,
    statusLookupCode: registration.status_lookup_code,
    statusUrl,
    groupName,
  });
  const adminAlert = renderAdminAlertEmail({
    fullName: registration.full_name,
    email: registration.email,
    role: registration.role,
    professionalArea: registration.professional_area,
    currentCompany: registration.current_company,
    whatsappGroupConsent: registration.whatsapp_group_consent,
    adminUrl,
  });

  const tasks = [
    sendEmailNotification({
      apiKey: emailConfig.apiKey,
      from: emailConfig.from,
      to: registration.email,
      subject: confirmation.subject,
      html: confirmation.html,
      text: confirmation.text,
    }),
    sendEmailNotification({
      apiKey: emailConfig.apiKey,
      from: emailConfig.from,
      to: emailConfig.adminAlertEmail,
      subject: adminAlert.subject,
      html: adminAlert.html,
      text: adminAlert.text,
    }),
  ];

  return Promise.allSettled(tasks);
}
