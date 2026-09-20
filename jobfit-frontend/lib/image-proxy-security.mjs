// Image proxy responses share the application's origin. Treat upstream bytes
// as hostile; never pass through active SVG/HTML/XML or redirect responses.
const SAFE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

export const MAX_PROXY_IMAGE_BYTES = 512_000;

export function safeProxyImageMime(value) {
  const mime = String(value || '').split(';', 1)[0].trim().toLowerCase();
  return SAFE_MIME_TYPES.has(mime) ? mime : '';
}

export function canProxyImageResponse(status, contentType, contentLength) {
  if (status !== 200 || !safeProxyImageMime(contentType)) return false;
  const length = Number(contentLength);
  if (contentLength != null && contentLength !== '' && (!Number.isFinite(length) || length > MAX_PROXY_IMAGE_BYTES || length < 0)) return false;
  return true;
}
