import { NextResponse } from 'next/server';
import { buildFallbackCoachTurn, normaliseCoachInput, validateCoachInput } from '../../../lib/interview-coach-runtime.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };
const MAX_BODY_BYTES = 80 * 1024;

function backendBase() {
  return (process.env.JOBFIT_BACKEND_URL || 'https://resume-builder-backend-ph7b.onrender.com').replace(/\/$/, '');
}

function validAssessmentPayload(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const data = value as { assessment?: { total?: unknown; dimensions?: unknown; follow_up?: unknown; next_question?: unknown } };
  const assessment = data.assessment;
  return Boolean(
    assessment
    && Number.isFinite(Number(assessment.total))
    && Array.isArray(assessment.dimensions)
    && assessment.dimensions.length === 5
    && typeof assessment.follow_up === 'string'
    && typeof assessment.next_question === 'string'
  );
}

export async function GET() {
  try {
    const response = await fetch(`${backendBase()}/interview-coach/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => null);
    return NextResponse.json({
      available: Boolean(response.ok && payload?.status === 'ready'),
      backend: response.ok ? payload : null,
      fallback_available: true,
      version: 'coach-proxy-v1',
    }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ available: false, backend: null, fallback_available: true, version: 'coach-proxy-v1' }, { headers: NO_STORE });
  }
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ detail: 'Interview coaching request is too large.' }, { status: 413, headers: NO_STORE });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ detail: 'Interview coaching request is invalid.' }, { status: 400, headers: NO_STORE });
  }

  const input = normaliseCoachInput(raw as Record<string, unknown>);
  const validationError = validateCoachInput(input);
  if (validationError) {
    return NextResponse.json({ detail: validationError }, { status: 400, headers: NO_STORE });
  }

  try {
    const response = await fetch(`${backendBase()}/interview-coach/turn`, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(18000),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await response.json().catch(() => null);
    if (response.ok && validAssessmentPayload(payload)) {
      return NextResponse.json(payload, { headers: NO_STORE });
    }
  } catch {
    // Fall through to the deterministic evidence-safe coach below.
  }

  try {
    const fallback = buildFallbackCoachTurn(input);
    return NextResponse.json({ ...fallback, degraded_reason: 'adaptive_ai_unavailable' }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ detail: 'Interview coaching could not complete this assessment.' }, { status: 500, headers: NO_STORE });
  }
}
