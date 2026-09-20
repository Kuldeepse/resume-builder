import { NextRequest, NextResponse } from 'next/server';
import { isAllowedOrigin, validateRegistrationPayload } from './policy.mjs';
import { buildSupabaseRestHeaders } from '@/lib/supabase-rest.mjs';
import { sendCareerNetworkRegistrationEmails } from '@/lib/career-network-email.mjs';
import { deriveEmailDeliveryState } from '@/lib/career-network-email-status.mjs';
import { duplicateRegistrationResponse, isDuplicateRegistration } from '@/lib/registration-security.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
};

const WHATSAPP_GROUP_NAME = 'CogniTwist AI IT Jobs referrals UK';
const MAX_BODY_BYTES = 32 * 1024;

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

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!isAllowedOrigin(origin, process.env.CAREER_NETWORK_ALLOWED_ORIGINS || '')) {
    return NextResponse.json({ detail: 'Origin is not allowed.' }, { status: 403, headers: NO_STORE_HEADERS });
  }

  const contentLength = Number(request.headers.get('content-length') || '0');
  if (!Number.isFinite(contentLength) || contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ detail: 'Registration request is too large.' }, { status: 413, headers: NO_STORE_HEADERS });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { detail: 'Private registration storage is not configured.' },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  let body: Record<string, unknown>;
  try {
    // Some clients omit Content-Length; enforce the byte limit on the actual body too.
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
      return NextResponse.json({ detail: 'Registration request is too large.' }, { status: 413, headers: NO_STORE_HEADERS });
    }
    body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid payload');
  } catch {
    return NextResponse.json({ detail: 'Invalid registration request.' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const validation = validateRegistrationPayload(body);
  if (validation.ok && validation.honeypotTriggered) {
    return NextResponse.json({ status: 'received' }, { status: 201, headers: NO_STORE_HEADERS });
  }

  if (!validation.ok) {
    return NextResponse.json({ detail: validation.detail }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const storageRecord = validation.record;
  // Insert-only: an unauthenticated repeat registration must NEVER overwrite a
  // verified registrant, update consent or return an existing tracking code.
  const storageResponse = await fetch(
    `${supabaseUrl.replace(/\/$/, '')}/rest/v1/career_network_registrations`,
    {
      method: 'POST',
      headers: buildSupabaseRestHeaders(serviceRoleKey, {
        contentType: 'application/json',
        accept: 'application/json',
        prefer: 'return=representation',
      }),
      body: JSON.stringify(storageRecord),
      cache: 'no-store',
    },
  );

  if (!storageResponse.ok) {
    const errorPayload = await storageResponse.json().catch(() => null) as { code?: string } | null;
    if (isDuplicateRegistration(storageResponse.status, errorPayload?.code)) {
      return NextResponse.json(duplicateRegistrationResponse(), { status: 202, headers: NO_STORE_HEADERS });
    }
    return NextResponse.json(
      { detail: 'Registration could not be stored securely. Please try again later.' },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const stored = (await storageResponse.json().catch(() => [])) as Array<{ id?: string; status_lookup_code?: string }>;
  const storedRecord = {
    ...storageRecord,
    id: stored[0]?.id || null,
    status_lookup_code: stored[0]?.status_lookup_code || null,
  };

  const emailApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.CAREER_NETWORK_EMAIL_FROM;
  const adminAlertEmail = process.env.CAREER_NETWORK_ADMIN_ALERT_EMAIL || process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL;

  if (storedRecord.id) {
    if (!storedRecord.status_lookup_code) {
      await updateConfirmationEmailStatus({
        supabaseUrl,
        serviceRoleKey,
        id: storedRecord.id,
        status: 'skipped',
        error: 'Tracking code was not generated for this registration.',
      }).catch(() => {});
    } else {
      try {
        const results = await sendCareerNetworkRegistrationEmails({
          registration: storedRecord,
          siteUrl: request.nextUrl.origin,
          adminUrl: `${request.nextUrl.origin}/admin/career-network`,
          groupName: WHATSAPP_GROUP_NAME,
          emailConfig: {
            apiKey: emailApiKey,
            from: emailFrom,
            adminAlertEmail,
          },
        });

        const confirmationDelivery = deriveEmailDeliveryState(
          results[0],
          'Email sending was skipped because RESEND_API_KEY, CAREER_NETWORK_EMAIL_FROM, or recipient email is missing.',
        );

        await updateConfirmationEmailStatus({
          supabaseUrl,
          serviceRoleKey,
          id: storedRecord.id,
          status: confirmationDelivery.status as 'pending' | 'sent' | 'failed' | 'skipped',
          error: confirmationDelivery.error,
        }).catch(() => {});
      } catch (error) {
        console.error('Career Network email notification failed', error);
        await updateConfirmationEmailStatus({
          supabaseUrl,
          serviceRoleKey,
          id: storedRecord.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Career Network email notification failed.',
        }).catch(() => {});
      }
    }
  }

  return NextResponse.json(
    {
      status: 'pending_verification',
      registration_id: stored[0]?.id || null,
      status_lookup_code: stored[0]?.status_lookup_code || null,
      message: 'Registration received. Your details remain private and are not published.',
    },
    { status: 201, headers: NO_STORE_HEADERS },
  );
}
