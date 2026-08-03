import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/app/admin/career-network/auth';
import { buildSupabaseRestHeaders } from '@/lib/supabase-rest.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REGISTRATION_STATUSES = new Set(['pending_verification', 'verified', 'declined', 'deleted']);
const WHATSAPP_STATUSES = new Set(['not_requested', 'pending_approval', 'approved', 'invited', 'declined', 'withdrawn']);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authenticated = await isAdminAuthenticated();
  if (!authenticated) {
    return NextResponse.redirect(new URL('/admin/career-network/login', request.url), 307);
  }

  const { id } = await context.params;
  const formData = await request.formData();
  const registrationStatus = typeof formData.get('registration_status') === 'string' ? String(formData.get('registration_status')) : '';
  const whatsappStatus = typeof formData.get('whatsapp_status') === 'string' ? String(formData.get('whatsapp_status')) : '';

  const patch: Record<string, string> = {};

  if (registrationStatus) {
    if (!REGISTRATION_STATUSES.has(registrationStatus)) {
      return NextResponse.redirect(new URL('/admin/career-network?error=registration-status', request.url), 303);
    }
    patch.status = registrationStatus;
  }

  if (whatsappStatus) {
    if (!WHATSAPP_STATUSES.has(whatsappStatus)) {
      return NextResponse.redirect(new URL('/admin/career-network?error=whatsapp-status', request.url), 303);
    }
    patch.whatsapp_group_status = whatsappStatus;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.redirect(new URL('/admin/career-network', request.url), 303);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.redirect(new URL('/admin/career-network?error=supabase-config', request.url), 303);
  }

  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, '')}/rest/v1/career_network_registrations?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: buildSupabaseRestHeaders(serviceRoleKey, {
        contentType: 'application/json',
        accept: 'application/json',
        prefer: 'return=representation',
      }),
      body: JSON.stringify({
        ...patch,
        updated_at: new Date().toISOString(),
      }),
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    return NextResponse.redirect(new URL('/admin/career-network?error=update-failed', request.url), 303);
  }

  return NextResponse.redirect(new URL('/admin/career-network?updated=1', request.url), 303);
}
