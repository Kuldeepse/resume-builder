import { NextResponse } from 'next/server';
import { buildExpectedInterviewResponse } from '../../../../lib/interview-expected-response.mjs';
import { buildInterviewAgentContext } from '../../../../lib/interview-agent-context.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };
const MAX_BODY_BYTES = 80 * 1024;

function clean(value: unknown, limit: number) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function backendBase() {
  return (process.env.JOBFIT_BACKEND_URL || 'https://resume-builder-backend-ph7b.onrender.com').replace(/\/$/, '');
}

function normaliseInput(raw: Record<string, unknown>) {
  const interviewType = raw.interview_type === 'hr' || raw.interview_type === 'technical' ? raw.interview_type : 'behavioural';
  return {
    role: clean(raw.role, 240),
    company: clean(raw.company, 240),
    job_description: clean(raw.job_description, 12000),
    interview_type: interviewType,
    question: clean(raw.question, 900),
    candidate_evidence: Array.isArray(raw.candidate_evidence)
      ? raw.candidate_evidence.map((item) => clean(item, 1200)).filter(Boolean).slice(0, 30)
      : [],
    history: Array.isArray(raw.history)
      ? raw.history.map((item) => {
          const turn = item && typeof item === 'object' ? item as Record<string, unknown> : {};
          return {
            question: clean(turn.question, 900),
            answer: clean(turn.answer, 6000),
            score: Number.isFinite(Number(turn.score)) ? Math.max(0, Math.min(100, Math.round(Number(turn.score)))) : undefined,
          };
        }).filter((item) => item.question && item.answer).slice(-8)
      : [],
  };
}

function validExpectedPayload(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return data.mode === 'ai'
    && typeof data.question === 'string'
    && typeof data.intent_summary === 'string'
    && Array.isArray(data.interviewer_testing)
    && typeof data.structure === 'string'
    && typeof data.expected_response === 'string'
    && data.expected_response.trim().length > 40;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ detail: 'Expected-response request is too large.' }, { status: 413, headers: NO_STORE });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ detail: 'Expected-response request is invalid.' }, { status: 400, headers: NO_STORE });
  }

  const input = normaliseInput((raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>);
  if (!input.role) {
    return NextResponse.json({ detail: 'Target role is required.' }, { status: 400, headers: NO_STORE });
  }
  if (!input.question) {
    return NextResponse.json({ detail: 'Interview question is required.' }, { status: 400, headers: NO_STORE });
  }

  const agentContext = buildInterviewAgentContext({
    jobDescription: input.job_description,
    role: input.role,
    cookieHeader: request.headers.get('cookie') || '',
  });
  input.job_description = agentContext.jobDescription;

  try {
    const response = await fetch(`${backendBase()}/interview-coach/expected`, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(16000),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await response.json().catch(() => null);
    if (response.ok && validExpectedPayload(payload)) {
      return NextResponse.json({
        ...payload,
        agent_context: {
          persistent_memory: Boolean(agentContext.memory),
          memory_sessions: agentContext.memory?.sessions || 0,
          panel_agent: agentContext.panel?.label || null,
        },
      }, { headers: NO_STORE });
    }
  } catch {
    // Fall through to deterministic exact-question fallback.
  }

  const fallback = buildExpectedInterviewResponse(input);
  return NextResponse.json({
    mode: 'fallback',
    agent: {
      provider: 'deterministic',
      model: 'exact-question-fallback-v2',
      version: 'expected-fallback-v2',
      adaptive: false,
      evidence_guard: true,
    },
    agent_context: {
      persistent_memory: Boolean(agentContext.memory),
      memory_sessions: agentContext.memory?.sessions || 0,
      panel_agent: agentContext.panel?.label || null,
    },
    question: input.question,
    intent_summary: fallback.intent_summary || fallback.intent || 'Fallback guidance based on the exact question wording.',
    interviewer_testing: fallback.interviewer_testing || [],
    structure: fallback.structure || '',
    expected_response: fallback.expected_response || '',
    relevant_evidence: fallback.relevant_evidence || [],
    evidence_gaps: fallback.missing_evidence || [],
    response_basis: fallback.basis || (fallback.relevant_evidence?.length ? 'verified_evidence' : 'illustrative_model'),
    degraded_reason: 'adaptive_expected_response_unavailable',
  }, { headers: NO_STORE });
}
