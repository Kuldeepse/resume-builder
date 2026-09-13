import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function GET() {
  return NextResponse.json({
    jobs: [],
    total: 0,
    partial: false,
    status: 'already_integrated',
    duration_ms: 0,
    passes_completed: [],
    passes_failed: [],
    coverage_note: 'Expanded employer/ATS discovery is already included in the initial Job Scout result set.',
  });
}
