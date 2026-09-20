import test from 'node:test';
import assert from 'node:assert/strict';
import { safeProxyImageMime, canProxyImageResponse, MAX_PROXY_IMAGE_BYTES } from './image-proxy-security.mjs';

test('only passive image formats may be relayed on the application origin', () => {
  assert.equal(safeProxyImageMime('image/png; charset=binary'), 'image/png');
  assert.equal(safeProxyImageMime('image/x-icon'), 'image/x-icon');
  for (const dangerous of ['image/svg+xml', 'text/html', 'application/xml', 'application/octet-stream', '']) {
    assert.equal(safeProxyImageMime(dangerous), '', dangerous);
  }
});

test('redirects, errors and oversized responses are not proxied', () => {
  assert.equal(canProxyImageResponse(302, 'image/png', 256), false);
  assert.equal(canProxyImageResponse(200, 'image/svg+xml', 256), false);
  assert.equal(canProxyImageResponse(200, 'image/png', MAX_PROXY_IMAGE_BYTES + 1), false);
  assert.equal(canProxyImageResponse(200, 'image/png', MAX_PROXY_IMAGE_BYTES), true);
});
