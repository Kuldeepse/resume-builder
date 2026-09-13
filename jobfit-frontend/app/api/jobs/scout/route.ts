import { GET as runDualLaneScout } from '../scout-v2/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return runDualLaneScout(request);
}
