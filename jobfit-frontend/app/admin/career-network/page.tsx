import { redirect } from 'next/navigation';
import { CheckCircle2, Clock3, LogOut, ShieldCheck, Users, XCircle } from 'lucide-react';
import { requireAdminAuth } from './auth';

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
};

async function loadRegistrations() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return { registrations: [], error: 'Supabase admin storage is not configured.' };
  }

  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, '')}/rest/v1/career_network_registrations?select=id,created_at,full_name,email,role,linkedin_profile,whatsapp_number,whatsapp_group_consent,whatsapp_group_status,current_company,professional_area,marketing_opt_in,status&order=created_at.desc`,
    {
      method: 'GET',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    return { registrations: [], error: 'Could not load registrations from private storage.' };
  }

  const registrations = (await response.json().catch(() => [])) as RegistrationRecord[];
  return { registrations, error: '' };
}

function statCount(registrations: RegistrationRecord[], predicate: (record: RegistrationRecord) => boolean) {
  return registrations.filter(predicate).length;
}

export default async function CareerNetworkAdminDashboardPage() {
  await requireAdminAuth();
  const { registrations, error } = await loadRegistrations();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fffdf8_0%,_#f7efe4_42%,_#ede2d1_100%)] px-4 py-8 text-stone-950 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-[#d9c3a7] bg-white/92 p-6 shadow-[0_20px_60px_rgba(115,74,28,0.08)] md:p-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-900">
              <ShieldCheck className="h-3.5 w-3.5" /> Admin Dashboard
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">Career Network registrations</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600 md:text-base">
              Private registration data for authorised RoleCraft administrators. Registration consent does not grant member access to this dashboard.
            </p>
          </div>

          <form action="/api/admin/career-network/logout" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl border border-[#d9c3a7] bg-white px-4 py-2 text-xs font-black text-stone-700 hover:bg-amber-50"
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
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-3xl border border-[#d9c3a7] bg-white/92 shadow-[0_20px_60px_rgba(115,74,28,0.08)]">
          <div className="border-b border-[#e6d4bf] px-6 py-4">
            <h2 className="text-lg font-black">Private registrations</h2>
            <p className="mt-1 text-xs leading-6 text-stone-600">
              Use this list for manual review, approval, and moderated WhatsApp follow-up only.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#fff8ef] text-xs uppercase tracking-wider text-stone-600">
                <tr>
                  <th className="px-4 py-3 font-black">Name</th>
                  <th className="px-4 py-3 font-black">Role</th>
                  <th className="px-4 py-3 font-black">Contact</th>
                  <th className="px-4 py-3 font-black">Professional area</th>
                  <th className="px-4 py-3 font-black">Company</th>
                  <th className="px-4 py-3 font-black">Registration</th>
                  <th className="px-4 py-3 font-black">WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {registrations.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-stone-500">
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
                    <td className="px-4 py-4 text-xs leading-6 text-stone-700">
                      <div>{record.email}</div>
                      {record.linkedin_profile && (
                        <a href={record.linkedin_profile} className="text-amber-800 underline" target="_blank" rel="noreferrer">
                          LinkedIn profile
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs leading-6 text-stone-700">{record.professional_area}</td>
                    <td className="px-4 py-4 text-xs leading-6 text-stone-700">{record.current_company || 'Not provided'}</td>
                    <td className="px-4 py-4 text-xs leading-6 text-stone-700">
                      <div>Marketing: {record.marketing_opt_in ? 'Opted in' : 'Not requested'}</div>
                    </td>
                    <td className="px-4 py-4 text-xs leading-6 text-stone-700">
                      <div>{record.whatsapp_number || 'No number provided'}</div>
                      <div className="mt-1">Consent: {record.whatsapp_group_consent ? 'Yes' : 'No'}</div>
                      <div className="mt-2">
                        <Badge tone={record.whatsapp_group_consent ? 'green' : 'slate'}>{record.whatsapp_group_status}</Badge>
                      </div>
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
    <div className="rounded-2xl border border-[#d9c3a7] bg-white/92 p-5 shadow-[0_20px_60px_rgba(115,74,28,0.08)]">
      <div className="flex items-center gap-2 text-sm font-black text-amber-900">{icon}{label}</div>
      <div className="mt-3 text-3xl font-black tracking-tight">{value}</div>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'amber' | 'green' | 'slate' }) {
  const styles = {
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    slate: 'border-stone-200 bg-stone-100 text-stone-700',
  };

  return <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${styles[tone]}`}>{children}</span>;
}
