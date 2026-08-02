const PRIVACY_CONTACT = process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL || '';
const CONTROLLER_NAME = process.env.NEXT_PUBLIC_DATA_CONTROLLER_NAME || 'RoleCraft AI';
const WHATSAPP_GROUP_NAME = 'RoleCraft IT Jobs referrals UK';

export default function PrivacyNoticePage() {
  return (
    <main className="min-h-screen px-4 py-10 text-slate-950 md:px-8">
      <article className="mx-auto max-w-4xl rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xl)] md:p-10">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-800">RoleCraft Career Network</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">Privacy Notice</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">Version 2026-08-02 · Applies to Career Network registration and optional WhatsApp group invite requests for {WHATSAPP_GROUP_NAME}.</p>

        {!PRIVACY_CONTACT && (
          <div className="mt-6 rounded-[1.25rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
            Registration must remain disabled until a privacy contact address is configured and this notice is reviewed for the final operating entity and processors.
          </div>
        )}

        <Section title="Who controls your information">
          <p>{CONTROLLER_NAME} is the data controller for Career Network registration information.</p>
          <p>Privacy contact: <strong>{PRIVACY_CONTACT || 'Not yet configured'}</strong>.</p>
        </Section>

        <Section title="Information we collect">
          <ul>
            <li>Name and email address.</li>
            <li>Selected network role: candidate, referrer, or mentor.</li>
            <li>Professional area.</li>
            <li>LinkedIn profile, only when you choose to provide it.</li>
            <li>WhatsApp number and WhatsApp-group consent, only if you choose to request an invite to {WHATSAPP_GROUP_NAME}.</li>
            <li>Current company, required only for referrer verification.</li>
            <li>Records of privacy-notice acceptance, age confirmation, and optional marketing preference.</li>
          </ul>
          <p>We do not collect a CV, job description, date of birth, home address, passport, immigration document, bank information, or special-category information during registration.</p>
        </Section>

        <Section title="Why we use it and lawful basis">
          <ul>
            <li>To receive, verify, and administer your requested Career Network registration: steps at your request and, where applicable, performance of the service terms.</li>
            <li>To review and, if approved, administer an optional invite to {WHATSAPP_GROUP_NAME} that you separately requested: your consent and our legitimate interests in running a moderated support community.</li>
            <li>To protect the network against abuse, impersonation, and fraud: our legitimate interests in operating a safe professional service.</li>
            <li>To send optional product updates: your separate consent. You may withdraw this consent without affecting network registration.</li>
          </ul>
        </Section>

        <Section title="Who can access it">
          <p>Registration data is not published and is not available through a public directory or public read API. Access is limited to authorised RoleCraft administrators and contracted service providers who need the information to operate or secure the service.</p>
          <p>Your identity or professional details will not be disclosed to another network member merely because you registered. Any later matching workflow must use a separate, explicit disclosure step.</p>
          <p>If you request a WhatsApp invite, your number must remain private until RoleCraft approves the request and performs the invite through an authorised administrator workflow.</p>
          <p>Viewing the private admin dashboard requires separate administrator credentials and is not granted automatically because a person registers.</p>
        </Section>

        <Section title="Automated decisions and AI">
          <p>Registration is not accepted or rejected solely by an automated decision. Registration information is not sent to a generative-AI model as part of this registration process.</p>
        </Section>

        <Section title="Retention">
          <p>Pending registration information is retained for no longer than 12 months unless it is still required to administer an active account, handle a legal obligation, resolve a dispute, or respond to your request. Records are reviewed and deleted or anonymised when no longer needed.</p>
          <p>If you withdraw WhatsApp-group consent before an invite is approved, the WhatsApp invite request should be cancelled and the number should no longer be used for that purpose.</p>
        </Section>

        <Section title="Security">
          <p>Registration is submitted over HTTPS to a server-side endpoint and stored in a private database table with public access disabled. Access controls, audit procedures, least-privilege administration, secure secrets management, and appropriate encryption must be maintained throughout the service lifecycle.</p>
        </Section>

        <Section title="Your rights">
          <p>Depending on the circumstances, you may have rights to access, correct, erase, restrict, object to, or receive a copy of your personal information, and to withdraw consent where processing relies on consent. Contact the privacy address above to make a request.</p>
          <p>You may also raise a concern with the UK Information Commissioner’s Office.</p>
        </Section>

        <Section title="International processing and suppliers">
          <p>Before public launch, RoleCraft must document the final hosting, database, email, monitoring, WhatsApp administration workflow, and other processors, their processing locations, contracts, retention controls, and any required international-transfer safeguards. The registration service must remain disabled until this record is complete.</p>
        </Section>

        <Section title="Changes to this notice">
          <p>Material changes will be versioned and presented before new processing occurs. We will not silently expand the use of registration information beyond the stated purposes.</p>
        </Section>

        <a href="/career-network/register" className="mt-10 inline-flex rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--highlight)_100%)] px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-900/20">Return to registration</a>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-stone-200 pt-6">
      <h2 className="text-lg font-black">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-[var(--ink-soft)] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">{children}</div>
    </section>
  );
}
