export function isSupabaseSecretKey(apiKey) {
  return typeof apiKey === 'string' && apiKey.startsWith('sb_secret_');
}

export function buildSupabaseRestHeaders(apiKey, options = {}) {
  const headers = {
    apikey: apiKey,
  };

  if (!isSupabaseSecretKey(apiKey)) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  if (options.accept) {
    headers.Accept = options.accept;
  }

  if (options.contentType) {
    headers['Content-Type'] = options.contentType;
  }

  if (options.prefer) {
    headers.Prefer = options.prefer;
  }

  return headers;
}
