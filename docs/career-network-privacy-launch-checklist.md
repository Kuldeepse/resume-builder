# Career Network privacy and GDPR launch gates

The registration feature must remain disabled until every mandatory launch gate below is complete. This checklist supports implementation but is not a substitute for legal advice.

## Mandatory before registration is enabled

- [ ] Identify the legal data controller, business address, and privacy contact.
- [ ] Configure `NEXT_PUBLIC_DATA_CONTROLLER_NAME` and `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL` in Vercel.
- [ ] Configure server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel. Never prefix the service key with `NEXT_PUBLIC_`.
- [ ] If you use a newer `sb_secret_...` key, keep it server-only. The app now sends `Authorization: Bearer` only for legacy JWT-style keys and uses `apikey` for both formats.
- [ ] Configure a server-only `CAREER_NETWORK_ADMIN_PASSWORD` before using the admin dashboard.
- [ ] If registration emails are enabled, configure server-only `RESEND_API_KEY`, `CAREER_NETWORK_EMAIL_FROM`, and `CAREER_NETWORK_ADMIN_ALERT_EMAIL`.
- [ ] Run `supabase/migrations/20260802_career_network_registrations.sql` in the correct Supabase project.
- [ ] Verify Row Level Security is enabled and that `anon` and `authenticated` roles cannot select, insert, update, or delete registration rows.
- [ ] Review and approve `/privacy` against the final controller, processors, hosting locations, transfer safeguards, and operating model.
- [ ] Document the lawful basis for each processing purpose. Keep optional marketing consent separate from core registration.
- [ ] Complete a Data Protection Impact Assessment before adding AI scoring, CV processing, identity verification, employee verification, or automated matching.
- [ ] Complete the ICO data-protection-fee self-assessment and pay/register where required.
- [ ] Put processor contracts and data-processing terms in place for Vercel, Supabase, email, monitoring, and any other supplier.
- [ ] If WhatsApp invites are enabled, document the lawful basis, administrator workflow, supplier terms, retention controls, and international-transfer safeguards for WhatsApp group processing.
- [ ] Confirm the exact approved group name and admins for `CogniTwist AI IT Jobs referrals UK`, and keep it invite-only.
- [ ] Define a 12-month maximum pending-registration retention schedule and implement deletion or anonymisation when the purpose ends.
- [ ] Establish procedures for access, correction, erasure, restriction, objection, consent withdrawal, and complaints.
- [ ] Establish incident detection, escalation, breach assessment, and notification procedures.
- [ ] Add production-grade abuse controls such as Vercel Firewall rate limiting or Cloudflare Turnstile before promoting the form widely.

## Product restrictions for the registration release

- Do not collect CVs, job descriptions, passports, immigration records, bank information, date of birth, home address, or special-category data.
- Do not expose a public member, employee, employer, or candidate directory.
- Do not add anyone to a WhatsApp group without separate consent and manual approval.
- Do not grant admin-dashboard access automatically because a person registered.
- Do not send registration data to an AI model.
- Do not accept or reject registration solely through automated decision-making.
- Do not disclose a referrer's identity or employer to a candidate until the referrer explicitly accepts a controlled match.
- Do not enable referral requests until authentication, private account access, authorisation, audit logging, and consent-based disclosure are implemented.

## Verification tests

1. Submit from an approved CogniTwist AI domain and confirm the row is stored privately.
2. Submit from an unapproved origin and confirm HTTP 403.
3. Attempt an anonymous Supabase `select` and confirm access is denied.
4. Inspect browser storage, page source, and network responses and confirm no service key or registration record is exposed.
5. Confirm responses include `Cache-Control: no-store`.
6. Confirm duplicate email-and-role registration updates the private record rather than creating uncontrolled duplicates.
7. Confirm optional marketing remains false unless separately selected.
8. Confirm the registration button is disabled when the privacy contact environment variable is absent.
9. Confirm WhatsApp group consent remains false unless separately selected and that no invite is sent automatically on registration.
10. Confirm `/admin/career-network` redirects to the admin login page when the admin session cookie is absent.
