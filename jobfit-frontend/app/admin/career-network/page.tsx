import { CheckCircle2, Clock3, LogOut, Mail, Save, ShieldCheck, Users, XCircle } from 'lucide-react';
import { requireAdminAuth } from './auth';
import { CopyCodeButton } from './copy-code-button';
import { buildSupabaseRestHeaders } from '@/lib/supabase-rest.mjs';

type RegistrationRecord = {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  role: 'candidate' | 'referrer' | 'mentor';
  linkedin_profile: string | null;
  whatsapp_number: string | null;
  whatsapp_group_consent: boolean;
  whatsapp_group_status: string;
  current_company: string | null;
  professional_area: string;
  marketing_opt_in: boolean;
  status: string;
  status_lookup_code: string | null;
  confirmation_email_status: 'pending' | 'sent' | 'failed' | 'skipped' | null;
  confirmation_email_sent_at: string | null;
  confirmation_email_error: string | null;
};

type LoadRegistrationsResult = {
  registrations: RegistrationRecord[];
  error: string;
  schemaWarning: string;
  debugInfo: string[];
};

const EMAIL_STATUS_FILTERS = ['all', 'pending', 'sent', 'failed', 'skipped', 'unavailable'] as const;
type EmailStatusFilter = (typeof EMAIL_STATUS_FILTERS)[number];

async function loadRegistrations() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const debugInfo: string[] = [];

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      registrations: [],
      error: 'Supabase admin storage is not configured.',
      schemaWarning: '',
      debugInfo: ['Missing one or both server environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.'],
    } satisfies LoadRegistrationsResult;
  }

  const baseUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/career_network_registrations`;
  debugInfo.push(`Primary query: select includes status_lookup_code and confirmation email fields.`);
  const response = await fetch(
    `${baseUrl}?select=id,created_at,full_name,email,role,linkedin_profile,whatsapp_number,whatsapp_group_consent,whatsapp_group_status,current_company,professional_area,marketing_opt_in,status,status_lookup_code,confirmation_email_status,confirmation_email_sent_at,confirmation_email_error&order=created_at.desc`,
    {
      method: 'GET',
      headers: buildSupabaseRestHeaders(serviceRoleKey, {
        accept: 'application/json',
      }),
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    debugInfo.push(`Primary query failed with HTTP ${response.status}.`);
    if (detail) {
      debugInfo.push(`Supabase response: ${detail}`);
    }
    const missingStatusLookupColumn =
      response.status === 400 &&
      detail.includes('status_lookup_code');

    if (!missingStatusLookupColumn) {
      const missingEmailStatusColumns =
        response.status === 400 &&
        (detail.includes('confirmation_email_status') ||
          detail.includes('confirmation_email_sent_at') ||
          detail.includes('confirmation_email_error'));

      if (missingEmailStatusColumns) {
        debugInfo.push('Falling back to query without confirmation email fields.');
        const fallbackEmailResponse = await fetch(
          `${baseUrl}?select=id,created_at,full_name,email,role,linkedin_profile,whatsapp_number,whatsapp_group_consent,whatsapp_group_status,current_company,professional_area,marketing_opt_in,status,status_lookup_code&order=created_at.desc`,
          {
            method: 'GET',
            headers: buildSupabaseRestHeaders(serviceRoleKey, {
              accept: 'application/json',
            }),
            cache: 'no-store',
          },
        );

        if (!fallbackEmailResponse.ok) {
          const fallbackEmailDetail = await fallbackEmailResponse.text().catch(() => '');
          debugInfo.push(`Fallback email-status query failed with HTTP ${fallbackEmailResponse.status}.`);
          if (fallbackEmailDetail) {
            debugInfo.push(`Fallback response: ${fallbackEmailDetail}`);
          }
          return {
            registrations: [],
            error: 'Could not load registrations from private storage.',
            schemaWarning: '',
            debugInfo,
          } satisfies LoadRegistrationsResult;
        }

        const fallbackRecords = (await fallbackEmailResponse.json().catch(() => [])) as Array<Omit<RegistrationRecord, 'confirmation_email_status' | 'confirmation_email_sent_at' | 'confirmation_email_error'>>;
        const registrations = fallbackRecords.map((record) => ({
          ...record,
          confirmation_email_status: null,
          confirmation_email_sent_at: null,
          confirmation_email_error: null,
        }));

        return {
          registrations,
          error: '',
          schemaWarning: 'Confirmation email tracking is not available in this Supabase table yet. Run the email delivery migration to show sent, failed, or skipped status in admin.',
          debugInfo,
        } satisfies LoadRegistrationsResult;
      }

      return {
        registrations: [],
        error: 'Could not load registrations from private storage.',
        schemaWarning: '',
        debugInfo,
      } satisfies LoadRegistrationsResult;
    }

    debugInfo.push('Falling back to legacy query without status_lookup_code.');
    const fallbackResponse = await fetch(
      `${baseUrl}?select=id,created_at,full_name,email,role,linkedin_profile,whatsapp_number,whatsapp_group_consent,whatsapp_group_status,current_company,professional_area,marketing_opt_in,status&order=created_at.desc`,
      {
        method: 'GET',
        headers: buildSupabaseRestHeaders(serviceRoleKey, {
          accept: 'application/json',
        }),
        cache: 'no-store',
      },
    );

    if (!fallbackResponse.ok) {
      const fallbackDetail = await fallbackResponse.text().catch(() => '');
      debugInfo.push(`Fallback query failed with HTTP ${fallbackResponse.status}.`);
      if (fallbackDetail) {
        debugInfo.push(`Fallback response: ${fallbackDetail}`);
      }
      return {
        registrations: [],
        error: 'Could not load registrations from private storage.',
        schemaWarning: '',
        debugInfo,
      } satisfies LoadRegistrationsResult;
    }

    const fallbackRecords = (await fallbackResponse.json().catch(() => [])) as Array<Omit<RegistrationRecord, 'status_lookup_code'>>;
    const registrations = fallbackRecords.map((record) => ({
      ...record,
      status_lookup_code: null,
      confirmation_email_status: null,
      confirmation_email_sent_at: null,
      confirmation_email_error: null,
    }));

    return {
      registrations,
      error: '',
      schemaWarning: 'Tracking codes are not available in this Supabase table yet. Run the status lookup migration to add the private status_lookup_code column.',
      debugInfo,
    } satisfies LoadRegistrationsResult;
  }

  const registrations = (await response.json().catch(() => [])) as RegistrationRecord[];
  debugInfo.push(`Primary query succeeded. Loaded ${registrations.length} registrations.`);
  return { registrations, error: '', schemaWarning: '', debugInfo } satisfies LoadRegistrationsResult;
}

function statCount(registrations: RegistrationRecord[], predicate: (record: RegistrationRecord) => boolean) {
  return registrations.filter(predicate).length;
}

export default async function CareerNetworkAdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminAuth();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const { registrations, error, schemaWarning, debugInfo } = await loadRegistrations();
  const errorCode = typeof resolvedSearchParams.error === 'string' ? resolvedSearchParams.error : '';
  const queryFilter = typeof resolvedSearchParams.q === 'string' ? resolvedSearchParams.q.trim() : '';
  const companyFilter = typeof resolvedSearchParams.company === 'string' ? resolvedSearchParams.company.trim() : '';
  const emailStatusFilter = getEmailStatusFilter(
    typeof resolvedSearchParams.email_status === 'string' ? resolvedSearchParams.email_status : '',
  );
  const filteredRegistrations = registrations.filter((record) =>
    matchesEmailStatusFilter(record.confirmation_email_status, emailStatusFilter) &&
    matchesCompanyFilter(record.current_company, companyFilter) &&
    matchesQueryFilter(record, queryFilter),
  );
  const activeFilterCount = Number(emailStatusFilter !== 'all') + Number(Boolean(companyFilter)) + Number(Boolean(queryFilter));
  const notices = {
    updated: resolvedSearchParams.updated === '1',
    resent: resolvedSearchParams.resent === '1',
    error: getAdminErrorMessage(errorCode),
  };

  return (
    <main className="min-h-screen px-4 py-8 text-slate-950 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-wrap items-start justify-between gap-4 rounded-[1.75rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)] md:p-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-teal-900">
              <ShieldCheck className="h-3.5 w-3.5" /> Admin Dashboard
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight md:text-[2.4rem]">Command center for approvals</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-soft)]">
              Review applications, verify network access, and manage WhatsApp invite progression without exposing the underlying registration data publicly.
            </p>
          </div>

          <form action="/api/admin/career-network/logout" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-white/70 px-4 py-2 text-xs font-black text-slate-700 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </form>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatCard icon={<Users className="h-5 w-5" />} label="Total registrations" value={registrations.length} />
          <StatCard icon={<Mail className="h-5 w-5" />} label="Filtered results" value={filteredRegistrations.length} />
          <StatCard icon={<Clock3 className="h-5 w-5" />} label="Pending review" value={statCount(registrations, (record) => record.status === 'pending_verification')} />
          <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="WhatsApp requested" value={statCount(registrations, (record) => record.whatsapp_group_consent)} />
          <StatCard icon={<XCircle className="h-5 w-5" />} label="Email failures" value={statCount(registrations, (record) => record.confirmation_email_status === 'failed')} />
        </section>

        {error && (
          <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {error}
          </div>
        )}

        {schemaWarning && (
          <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {schemaWarning}
          </div>
        )}

        {notices.updated && (
          <div className="rounded-[1.5rem] border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950">
            Registration status saved.
          </div>
        )}

        {notices.resent && (
          <div className="rounded-[1.5rem] border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
            Tracking code email sent again to the registrant.
          </div>
        )}

        {notices.error && (
          <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {notices.error}
          </div>
        )}

        <div className="rounded-[1.35rem] border border-teal-200 bg-teal-50 p-4 text-xs leading-6 text-teal-950">
          Update each row to move a person from registration review into verified access, resend a private tracking email when needed, and separately manage the WhatsApp invite lifecycle.
        </div>

        {(error || schemaWarning) && debugInfo.length > 0 && (
          <details className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
            <summary className="cursor-pointer font-black tracking-[0.08em] text-slate-950">
              Admin Debug Details
            </summary>
            <div className="mt-3 space-y-2 text-xs leading-6 text-slate-700">
              {debugInfo.map((item) => (
                <div key={item} className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 font-mono">
                  {item}
                </div>
              ))}
            </div>
          </details>
        )}

        <section className="overflow-hidden rounded-[1.75rem] border border-[var(--surface-border)] bg-[var(--surface)] shadow-[var(--shadow-xl)]">
          <div className="border-b border-[#e6d4bf] px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-black">Private registrations</h2>
                <p className="mt-1 text-xs leading-6 text-[var(--ink-soft)]">
                  Use this list for manual review, approval, and moderated WhatsApp follow-up only.
                </p>
              </div>

              <form method="get" className="flex w-full flex-wrap items-end gap-3 lg:w-auto" aria-label="Filter private registrations">
                <label className="block min-w-[15rem] flex-1 text-[11px] font-black uppercase tracking-wider text-stone-600 lg:min-w-[18rem]">
                  Search people
                  <input
                    type="text"
                    name="q"
                    defaultValue={queryFilter}
                    placeholder="Name, email, tracking code, area"
                    className="mt-1 w-full rounded-2xl border border-[var(--surface-border)] bg-white/90 p-2 text-xs font-medium text-slate-900 outline-none focus:border-[var(--accent)]"
                  />
                </label>

                <label className="block text-[11px] font-black uppercase tracking-wider text-stone-600">
                  Company name
                  <input
                    type="text"
                    name="company"
                    defaultValue={companyFilter}
                    placeholder="Filter by company"
                    className="mt-1 min-w-[13rem] rounded-2xl border border-[var(--surface-border)] bg-white/90 p-2 text-xs font-medium text-slate-900 outline-none focus:border-[var(--accent)]"
                  />
                </label>

                <label className="block text-[11px] font-black uppercase tracking-wider text-stone-600">
                  Email status
                  <select
                    name="email_status"
                    defaultValue={emailStatusFilter}
                    className="mt-1 min-w-[13rem] rounded-2xl border border-[var(--surface-border)] bg-white/90 p-2 text-xs font-medium text-slate-900 outline-none focus:border-[var(--accent)]"
                  >
                    <option value="all">All email states</option>
                    <option value="pending">Pending</option>
                    <option value="sent">Sent</option>
                    <option value="failed">Failed</option>
                    <option value="skipped">Skipped</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </label>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--highlight)_100%)] px-4 py-2 text-xs font-black text-white shadow-sm shadow-teal-900/20 hover:opacity-95"
                >
                  Filter
                </button>

                {activeFilterCount > 0 && (
                  <a
                    href="/admin/career-network"
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-white/90 px-4 py-2 text-xs font-black text-slate-700 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                  >
                    Clear
                  </a>
                )}
              </form>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600" aria-live="polite">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold text-slate-700">
                Showing {filteredRegistrations.length} of {registrations.length}
              </span>
              {queryFilter && <FilterChip label={`Search: ${queryFilter}`} />}
              {companyFilter && <FilterChip label={`Company: ${companyFilter}`} />}
              {emailStatusFilter !== 'all' && <FilterChip label={`Email: ${emailStatusFilter.replaceAll('_', ' ')}`} />}
            </div>
          </div>

          <div className="space-y-4 p-4 md:hidden">
            {filteredRegistrations.length === 0 && (
              <div className="rounded-[1.25rem] border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-sm text-stone-500">
                No registrations match the active filters.
              </div>
            )}

            {filteredRegistrations.map((record) => (
              <article key={record.id} className="rounded-[1.35rem] border border-[var(--surface-border)] bg-white/90 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-950">{record.full_name}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{record.email}</p>
                    <p className="mt-1 text-[11px] leading-5 text-stone-500">{new Date(record.created_at).toLocaleString('en-GB')}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="amber">{record.role}</Badge>
                    <Badge tone={record.status === 'pending_verification' ? 'slate' : 'green'}>{record.status}</Badge>
                  </div>
                </div>

                <dl className="mt-4 grid gap-3 text-xs leading-6 text-slate-700">
                  <ReportPair label="Professional area" value={record.professional_area} />
                  <ReportPair label="Company" value={record.current_company || 'Not provided'} />
                  <ReportPair label="Tracking code" value={record.status_lookup_code || 'Not available yet'} mono={Boolean(record.status_lookup_code)} />
                  <ReportPair label="Email status" value={formatEmailStatus(record)} />
                  <ReportPair label="WhatsApp" value={formatWhatsAppStatus(record)} />
                </dl>

                <form action={`/api/admin/career-network/registrations/${record.id}`} method="post" className="mt-4 space-y-3 border-t border-stone-200 pt-4">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-stone-600">
                    Registration status
                    <select
                      name="registration_status"
                      defaultValue={record.status}
                      className="mt-1 w-full rounded-2xl border border-[var(--surface-border)] bg-white/90 p-2 text-xs font-medium text-slate-900 outline-none focus:border-[var(--accent)]"
                    >
                      <option value="pending_verification">Pending verification</option>
                      <option value="verified">Verified</option>
                      <option value="declined">Declined</option>
                      <option value="deleted">Deleted</option>
                    </select>
                  </label>

                  <label className="block text-[11px] font-black uppercase tracking-wider text-stone-600">
                    WhatsApp status
                    <select
                      name="whatsapp_status"
                      defaultValue={record.whatsapp_group_status}
                      className="mt-1 w-full rounded-2xl border border-[var(--surface-border)] bg-white/90 p-2 text-xs font-medium text-slate-900 outline-none focus:border-[var(--accent)]"
                    >
                      <option value="not_requested">Not requested</option>
                      <option value="pending_approval">Pending approval</option>
                      <option value="approved">Approved</option>
                      <option value="invited">Invited</option>
                      <option value="declined">Declined</option>
                      <option value="withdrawn">Withdrawn</option>
                    </select>
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--highlight)_100%)] px-3 py-2 text-xs font-black text-white shadow-sm shadow-teal-900/20 hover:opacity-95"
                    >
                      <Save className="h-3.5 w-3.5" /> Save status
                    </button>
                    <button
                      type="submit"
                      name="action"
                      value="resend-confirmation"
                      disabled={!record.status_lookup_code}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-white/90 px-3 py-2 text-xs font-black text-slate-800 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Mail className="h-3.5 w-3.5" /> Resend code
                    </button>
                  </div>
                </form>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-[13px]">
              <caption className="sr-only">
                Private registrations report with filters for search, company name, and confirmation email status.
              </caption>
              <thead className="bg-[#f6fbfa] text-[10px] uppercase tracking-[0.16em] text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-black">Name</th>
                  <th scope="col" className="px-4 py-3 font-black">Role</th>
                  <th scope="col" className="px-4 py-3 font-black">Contact</th>
                  <th scope="col" className="px-4 py-3 font-black">Tracking code</th>
                  <th scope="col" className="px-4 py-3 font-black">Professional area</th>
                  <th scope="col" className="px-4 py-3 font-black">Company</th>
                  <th scope="col" className="px-4 py-3 font-black">Registration</th>
                  <th scope="col" className="px-4 py-3 font-black">Email</th>
                  <th scope="col" className="px-4 py-3 font-black">WhatsApp</th>
                  <th scope="col" className="px-4 py-3 font-black">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegistrations.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-sm text-stone-500">
                      No registrations match the active filters.
                    </td>
                  </tr>
                )}

                {filteredRegistrations.map((record) => (
                  <tr key={record.id} className="border-t border-[#f0e4d6] align-top">
                    <th scope="row" className="px-4 py-4 text-left">
                      <div className="font-semibold text-stone-900">{record.full_name}</div>
                      <div className="mt-1 text-xs text-stone-500">{new Date(record.created_at).toLocaleString('en-GB')}</div>
                    </th>
                    <td className="px-4 py-4">
                      <Badge tone="amber">{record.role}</Badge>
                      <div className="mt-2">
                        <Badge tone={record.status === 'pending_verification' ? 'slate' : 'green'}>{record.status}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs leading-6 text-slate-700">
                      <div>{record.email}</div>
                      {record.linkedin_profile && (
                        <a href={record.linkedin_profile} className="text-amber-800 underline" target="_blank" rel="noreferrer">
                          LinkedIn profile
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="rounded-[1.25rem] border border-[var(--surface-border)] bg-white/85 p-3">
                        {record.status_lookup_code ? (
                          <>
                            <div className="font-mono text-[13px] font-black uppercase tracking-[0.22em] text-slate-900">
                              {record.status_lookup_code}
                            </div>
                            <div className="mt-2">
                              <CopyCodeButton value={record.status_lookup_code} />
                            </div>
                          </>
                        ) : (
                          <div className="text-xs leading-6 text-stone-500">
                            Not available until the status lookup migration is applied.
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs leading-6 text-slate-700">{record.professional_area}</td>
                    <td className="px-4 py-4 text-xs leading-6 text-slate-700">
                      {record.current_company ? (
                        <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-semibold text-stone-700">
                          {record.current_company}
                        </span>
                      ) : (
                        'Not provided'
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs leading-6 text-slate-700">
                      <div>Marketing: {record.marketing_opt_in ? 'Opted in' : 'Not requested'}</div>
                    </td>
                    <td className="px-4 py-4 text-xs leading-6 text-slate-700">
                      {record.confirmation_email_status ? (
                        <>
                          <Badge tone={emailTone(record.confirmation_email_status)}>
                            {record.confirmation_email_status}
                          </Badge>
                          {record.confirmation_email_sent_at && (
                            <div className="mt-2 text-stone-500">
                              Sent: {new Date(record.confirmation_email_sent_at).toLocaleString('en-GB')}
                            </div>
                          )}
                          {record.confirmation_email_error && (
                            <div className="mt-2 max-w-[18rem] text-stone-500">
                              {record.confirmation_email_error}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-stone-500">
                          Not available until the email delivery migration is applied.
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs leading-6 text-slate-700">
                      <div>{record.whatsapp_number || 'No number provided'}</div>
                      <div className="mt-1">Consent: {record.whatsapp_group_consent ? 'Yes' : 'No'}</div>
                      <div className="mt-2">
                        <Badge tone={record.whatsapp_group_consent ? 'green' : 'slate'}>{record.whatsapp_group_status}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <form action={`/api/admin/career-network/registrations/${record.id}`} method="post" className="space-y-3">
                        <label className="block text-[11px] font-black uppercase tracking-wider text-stone-600">
                          Registration status
                          <select
                            name="registration_status"
                            defaultValue={record.status}
                            className="mt-1 w-full rounded-2xl border border-[var(--surface-border)] bg-white/90 p-2 text-xs font-medium text-slate-900 outline-none focus:border-[var(--accent)]"
                          >
                            <option value="pending_verification">Pending verification</option>
                            <option value="verified">Verified</option>
                            <option value="declined">Declined</option>
                            <option value="deleted">Deleted</option>
                          </select>
                        </label>

                        <label className="block text-[11px] font-black uppercase tracking-wider text-stone-600">
                          WhatsApp status
                          <select
                            name="whatsapp_status"
                            defaultValue={record.whatsapp_group_status}
                            className="mt-1 w-full rounded-2xl border border-[var(--surface-border)] bg-white/90 p-2 text-xs font-medium text-slate-900 outline-none focus:border-[var(--accent)]"
                          >
                            <option value="not_requested">Not requested</option>
                            <option value="pending_approval">Pending approval</option>
                            <option value="approved">Approved</option>
                            <option value="invited">Invited</option>
                            <option value="declined">Declined</option>
                            <option value="withdrawn">Withdrawn</option>
                          </select>
                        </label>

                        <button
                          type="submit"
                          className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--highlight)_100%)] px-3 py-2 text-xs font-black text-white shadow-sm shadow-teal-900/20 hover:opacity-95"
                        >
                          <Save className="h-3.5 w-3.5" /> Save status
                        </button>

                        <button
                          type="submit"
                          name="action"
                          value="resend-confirmation"
                          disabled={!record.status_lookup_code}
                          className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-white/90 px-3 py-2 text-xs font-black text-slate-800 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Mail className="h-3.5 w-3.5" /> Resend code
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-[1.6rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)]">
      <div className="flex items-center gap-2 text-sm font-black text-slate-900">{icon}{label}</div>
      <div className="mt-3 text-3xl font-black tracking-tight">{value}</div>
    </div>
  );
}

function FilterChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 font-semibold text-teal-900">
      {label}
    </span>
  );
}

function ReportPair({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-black uppercase tracking-[0.14em] text-stone-500">{label}</dt>
      <dd className={`mt-1 text-slate-800 ${mono ? 'font-mono text-[12px] font-black tracking-[0.18em]' : ''}`}>{value}</dd>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'amber' | 'green' | 'slate' | 'rose' }) {
  const styles = {
    amber: 'border-orange-200 bg-orange-50 text-orange-900',
    green: 'border-teal-200 bg-teal-50 text-teal-900',
    slate: 'border-stone-200 bg-stone-100 text-stone-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
  };

  return <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${styles[tone]}`}>{children}</span>;
}

function emailTone(status: NonNullable<RegistrationRecord['confirmation_email_status']>) {
  switch (status) {
    case 'sent':
      return 'green';
    case 'failed':
      return 'rose';
    case 'skipped':
      return 'amber';
    default:
      return 'slate';
  }
}

function getEmailStatusFilter(value: string): EmailStatusFilter {
  return EMAIL_STATUS_FILTERS.includes(value as EmailStatusFilter)
    ? (value as EmailStatusFilter)
    : 'all';
}

function matchesEmailStatusFilter(
  status: RegistrationRecord['confirmation_email_status'],
  filter: EmailStatusFilter,
) {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'unavailable') {
    return status === null;
  }

  return status === filter;
}

function matchesCompanyFilter(companyName: string | null, filter: string) {
  if (!filter) {
    return true;
  }

  return (companyName || '').toLowerCase().includes(filter.toLowerCase());
}

function matchesQueryFilter(record: RegistrationRecord, filter: string) {
  if (!filter) {
    return true;
  }

  const haystack = [
    record.full_name,
    record.email,
    record.status_lookup_code || '',
    record.professional_area,
    record.current_company || '',
  ].join(' ').toLowerCase();

  return haystack.includes(filter.toLowerCase());
}

function formatEmailStatus(record: RegistrationRecord) {
  if (!record.confirmation_email_status) {
    return 'Not available until the email delivery migration is applied.';
  }

  const sentAt = record.confirmation_email_sent_at
    ? ` Sent ${new Date(record.confirmation_email_sent_at).toLocaleString('en-GB')}.`
    : '';
  const error = record.confirmation_email_error ? ` ${record.confirmation_email_error}` : '';

  return `${record.confirmation_email_status.replaceAll('_', ' ')}.${sentAt}${error}`.trim();
}

function formatWhatsAppStatus(record: RegistrationRecord) {
  const consent = record.whatsapp_group_consent ? 'Consent given.' : 'No consent.';
  const number = record.whatsapp_number ? ` Number: ${record.whatsapp_number}.` : ' No number provided.';
  return `${record.whatsapp_group_status.replaceAll('_', ' ')}. ${consent}${number}`;
}

function getAdminErrorMessage(errorCode: string) {
  switch (errorCode) {
    case 'registration-status':
      return 'Registration status could not be updated because the selected value is invalid.';
    case 'whatsapp-status':
      return 'WhatsApp status could not be updated because the selected value is invalid.';
    case 'supabase-config':
      return 'Supabase admin storage is not configured on the server.';
    case 'update-failed':
      return 'The registration update could not be saved. Please try again.';
    case 'resend-failed':
      return 'The tracking code email could not be resent. Check the email configuration and try again.';
    case 'missing-status-lookup-code':
      return 'This registration does not have a tracking code yet. Run the status lookup migration in Supabase first.';
    default:
      return '';
  }
}
