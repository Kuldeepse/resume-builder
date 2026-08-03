import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/app/admin/career-network/auth';
import { buildSupabaseRestHeaders } from '@/lib/supabase-rest.mjs';
import {
  sendCareerNetworkConfirmationEmail,
  sendCareerNetworkStatusUpdateEmail,
} from '@/lib/career-network-email.mjs';
import { deriveEmailDeliveryState } from '@/lib/career-network-email-status.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REGISTRATION_STATUSES = new Set(['pending_verification', 'verified', 'declined', 'deleted']);
const WHATSAPP_STATUSES = new Set(['not_requested', 'pending_approval', 'approved', 'invited', 'declined', 'withdrawn']);

async function updateConfirmationEmailStatus({
  supabaseUrl,
  serviceRoleKey,
  id,
  status,
  error,
}: {
  supabaseUrl: string;
  serviceRoleKey: string;
  id: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  error: string | null;
}) {
  await fetch(
    `${supabaseUrl.replace(/\/$/, '')}/rest/v1/career_network_registrations?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: buildSupabaseRestHeaders(serviceRoleKey, {
        contentType: 'application/json',
        accept: 'application/json',
      }),
      body: JSON.stringify({
        confirmation_email_status: status,
        confirmation_email_sent_at: status === 'sent' ? new Date().toISOString() : null,
        confirmation_email_error: error,
        updated_at: new Date().toISOString(),
      }),
      cache: 'no-store',
    },
  );
}

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
  const action = typeof formData.get('action') === 'string' ? String(formData.get('action')) : 'update-status';
  const registrationStatus = typeof formData.get('registration_status') === 'string' ? String(formData.get('registration_status')) : '';
  const whatsappStatus = typeof formData.get('whatsapp_status') === 'string' ? String(formData.get('whatsapp_status')) : '';

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.redirect(new URL('/admin/career-network?error=supabase-config', request.url), 303);
  }

  const existingResponse = await fetch(
    `${supabaseUrl.replace(/\/$/, '')}/rest/v1/career_network_registrations?select=id,full_name,email,role,status,whatsapp_group_status,status_lookup_code&id=eq.${encodeURIComponent(id)}&limit=1`,
    {
      method: 'GET',
      headers: buildSupabaseRestHeaders(serviceRoleKey, {
        accept: 'application/json',
      }),
      cache: 'no-store',
    },
  );

  if (!existingResponse.ok) {
    return NextResponse.redirect(new URL('/admin/career-network?error=update-failed', request.url), 303);
  }

  const existingRecords = (await existingResponse.json().catch(() => [])) as Array<{
    id: string;
    full_name: string;
    email: string;
    role: string;
    status: string;
    whatsapp_group_status: string;
    status_lookup_code: string;
  }>;
  const existingRecord = existingRecords[0];
  if (!existingRecord) {
    return NextResponse.redirect(new URL('/admin/career-network?error=update-failed', request.url), 303);
  }

  if (action === 'resend-confirmation') {
    if (!existingRecord.status_lookup_code) {
      return NextResponse.redirect(new URL('/admin/career-network?error=missing-status-lookup-code', request.url), 303);
    }

    try {
      const result = await sendCareerNetworkConfirmationEmail({
        registration: existingRecord,
        siteUrl: request.nextUrl.origin,
        groupName: process.env.CAREER_NETWORK_WHATSAPP_GROUP_NAME || 'RoleCraft IT Jobs referrals UK',
        emailConfig: {
          apiKey: process.env.RESEND_API_KEY,
          from: process.env.CAREER_NETWORK_EMAIL_FROM,
        },
      });

      const confirmationDelivery = deriveEmailDeliveryState(
        { status: 'fulfilled', value: result },
        'Email sending was skipped because RESEND_API_KEY, CAREER_NETWORK_EMAIL_FROM, or recipient email is missing.',
      );

      await updateConfirmationEmailStatus({
        supabaseUrl,
        serviceRoleKey,
        id: existingRecord.id,
        status: confirmationDelivery.status as 'pending' | 'sent' | 'failed' | 'skipped',
        error: confirmationDelivery.error,
      }).catch(() => {});
    } catch (error) {
      console.error('Career Network confirmation resend failed', error);
      await updateConfirmationEmailStatus({
        supabaseUrl,
        serviceRoleKey,
        id: existingRecord.id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Career Network confirmation resend failed.',
      }).catch(() => {});
      return NextResponse.redirect(new URL('/admin/career-network?error=resend-failed', request.url), 303);
    }

    return NextResponse.redirect(new URL('/admin/career-network?resent=1', request.url), 303);
  }

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

  const updatedRecords = (await response.json().catch(() => [])) as Array<{
    id: string;
    full_name: string;
    email: string;
    role: string;
    status: string;
    whatsapp_group_status: string;
  }>;
  const updatedRecord = updatedRecords[0];

  const statusChanged =
    updatedRecord &&
    (updatedRecord.status !== existingRecord.status ||
      updatedRecord.whatsapp_group_status !== existingRecord.whatsapp_group_status);

  if (statusChanged) {
    sendCareerNetworkStatusUpdateEmail({
      registration: updatedRecord,
      siteUrl: request.nextUrl.origin,
      emailConfig: {
        apiKey: process.env.RESEND_API_KEY,
        from: process.env.CAREER_NETWORK_EMAIL_FROM,
      },
    }).catch((error) => {
      console.error('Career Network status update email failed', error);
    });
  }

  return NextResponse.redirect(new URL('/admin/career-network?updated=1', request.url), 303);
}
