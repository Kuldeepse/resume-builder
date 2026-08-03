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
};

type LoadRegistrationsResult = {
  registrations: RegistrationRecord[];
  error: string;
  schemaWarning: string;
  debugInfo: string[];
};

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
  debugInfo.push(`Primary query: select includes status_lookup_code.`);
  const response = await fetch(
    `${baseUrl}?select=id,created_at,full_name,email,role,linkedin_profile,whatsapp_number,whatsapp_group_consent,whatsapp_group_status,current_company,professional_area,marketing_opt_in,status,status_lookup_code&order=created_at.desc`,
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
  const { registrations, error, schemaWarning, debugInfo } = await loadRegistrations();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorCode = typeof resolvedSearchParams.error === 'string' ? resolvedSearchParams.error : '';
  const notices = {
    updated: resolvedSearchParams.updated === '1',
    resent: resolvedSearchParams.resent === '1',
    error: getAdminErrorMessage(errorCode),
  };

  return (
    <main className="min-h-screen px-4 py-8 text-slate-950 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-wrap items-start justify-between gap-4 rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xl)] md:p-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-teal-900">
              <ShieldCheck className="h-3.5 w-3.5" /> Admin Dashboard
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">Command center for approvals</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-soft)] md:text-base">
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

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard icon={<Users className="h-5 w-5" />} label="Total registrations" value={registrations.length} />
          <StatCard icon={<Clock3 className="h-5 w-5" />} label="Pending review" value={statCount(registrations, (record) => record.status === 'pending_verification')} />
          <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="WhatsApp requested" value={statCount(registrations, (record) => record.whatsapp_group_consent)} />
          <StatCard icon={<XCircle className="h-5 w-5" />} label="Marketing opt-ins" value={statCount(registrations, (record) => record.marketing_opt_in)} />
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

        <div className="rounded-[1.5rem] border border-teal-200 bg-teal-50 p-4 text-xs leading-6 text-teal-950">
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

        <section className="overflow-hidden rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] shadow-[var(--shadow-xl)]">
          <div className="border-b border-[#e6d4bf] px-6 py-4">
            <h2 className="text-lg font-black">Private registrations</h2>
            <p className="mt-1 text-xs leading-6 text-[var(--ink-soft)]">
              Use this list for manual review, approval, and moderated WhatsApp follow-up only.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f6fbfa] text-xs uppercase tracking-[0.18em] text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-black">Name</th>
                  <th className="px-4 py-3 font-black">Role</th>
                  <th className="px-4 py-3 font-black">Contact</th>
                  <th className="px-4 py-3 font-black">Tracking code</th>
                  <th className="px-4 py-3 font-black">Professional area</th>
                  <th className="px-4 py-3 font-black">Company</th>
                  <th className="px-4 py-3 font-black">Registration</th>
                  <th className="px-4 py-3 font-black">WhatsApp</th>
                  <th className="px-4 py-3 font-black">Actions</th>
                </tr>
              </thead>
              <tbody>
                {registrations.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-stone-500">
                      No registrations available yet.
                    </td>
                  </tr>
                )}

                {registrations.map((record) => (
                  <tr key={record.id} className="border-t border-[#f0e4d6] align-top">
                    <td className="px-4 py-4">
                      <div className="font-bold text-stone-900">{record.full_name}</div>
                      <div className="mt-1 text-xs text-stone-500">{new Date(record.created_at).toLocaleString('en-GB')}</div>
                    </td>
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
                    <td className="px-4 py-4 text-xs leading-6 text-slate-700">{record.current_company || 'Not provided'}</td>
                    <td className="px-4 py-4 text-xs leading-6 text-slate-700">
                      <div>Marketing: {record.marketing_opt_in ? 'Opted in' : 'Not requested'}</div>
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
                          className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-white/90 px-3 py-2 text-xs font-black text-slate-800 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
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

function Badge({ children, tone }: { children: React.ReactNode; tone: 'amber' | 'green' | 'slate' }) {
  const styles = {
    amber: 'border-orange-200 bg-orange-50 text-orange-900',
    green: 'border-teal-200 bg-teal-50 text-teal-900',
    slate: 'border-stone-200 bg-stone-100 text-stone-700',
  };

  return <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${styles[tone]}`}>{children}</span>;
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
