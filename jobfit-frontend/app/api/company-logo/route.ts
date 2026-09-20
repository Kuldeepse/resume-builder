import { NextResponse } from 'next/server';
import { canProxyImageResponse, safeProxyImageMime, MAX_PROXY_IMAGE_BYTES } from '@/lib/image-proxy-security.mjs';

export const runtime = 'nodejs';
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
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/x-icon,image/vnd.microsoft.icon',
        'User-Agent': 'CogniTwist/1.0',
      },
      // Allowlisted URLs can redirect to untrusted or internal targets. Never follow redirects.
      redirect: 'manual',
      signal: controller.signal,
      cache: 'no-store',
    });
    const contentType = response.headers.get('content-type') || '';
    if (!canProxyImageResponse(response.status, contentType, response.headers.get('content-length'))) return null;
    if (!response.body) return null;

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PROXY_IMAGE_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
    if (!size) return null;
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { bytes, contentType: safeProxyImageMime(contentType) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    controller.abort();
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
