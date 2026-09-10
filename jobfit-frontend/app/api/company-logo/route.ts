import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ALLOWED_DOMAINS = new Set([
  'rightmove.co.uk',
  'bondsmith.com',
  'capitalontap.com',
  'modulrfinance.com',
  'blacklane.com',
  'speechmatics.com',
  'capco.com',
  'yondrgroup.com',
  'partly.com',
  'orbital.com',
  'herondata.io',
  'freetrade.io',
  'elliptic.co',
  'ema.co',
  'swap-commerce.com',
  'antithesis.com',
  'lyrahealth.com',
  'openpayd.com',
  'serverfarmllc.com',
  'equinix.com',
]);

function safeDomain(value: string | null) {
  const domain = String(value || '').trim().toLowerCase();
  return ALLOWED_DOMAINS.has(domain) ? domain : '';
}

async function fetchImage(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'image/avif,image/webp,image/png,image/svg+xml,image/*,*/*;q=0.8',
        'User-Agent': 'CogniTwist/1.0',
      },
      redirect: 'follow',
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) return null;
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > 512_000) return null;
    return { bytes, contentType };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const domain = safeDomain(url.searchParams.get('domain'));
  if (!domain) return new NextResponse(null, { status: 404 });

  const candidates = [
    `https://${domain}/favicon.ico`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
  ];

  for (const candidate of candidates) {
    const image = await fetchImage(candidate);
    if (!image) continue;
    return new NextResponse(image.bytes, {
      status: 200,
      headers: {
        'Content-Type': image.contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  return new NextResponse(null, {
    status: 404,
    headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
  });
}
