export const MAX_BYTES = 64_000;
export function projectId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value)) throw Object.assign(Error('Use a project ID of 1–80 letters, numbers, underscores or hyphens.'), { status: 400 });
  return value;
}
export function validateSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(Error('Provide a project object.'), { status: 400 });
  function check(item, depth = 0) {
    if (depth > 16) throw Object.assign(Error('Project metadata is too deeply nested.'), { status: 400 });
    if (item && typeof item === 'object') for (const [key, nested] of Object.entries(item)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw Object.assign(Error('Unsafe metadata key.'), { status: 400 });
      check(nested, depth + 1);
    }
  }
  check(value);
  const snapshot = JSON.stringify(value);
  if (Buffer.byteLength(snapshot, 'utf8') > MAX_BYTES) throw Object.assign(Error('Save a metadata/version manifest under 64 KB. Keep large HTML artifacts in the studio artifact store.'), { status: 413 });
  const title = typeof value.title === 'string' ? value.title.trim().slice(0, 160) : 'Untitled design';
  return { snapshot, title: title || 'Untitled design' };
}
export function expectedRevision(value) {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || value < 0) throw Object.assign(Error('expectedRevision must be a nonnegative integer.'), { status: 400 });
  return value;
}
export function isLocalRequest(remoteAddress, host, origin) {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddress)) return false;
  let hostname;
  try { hostname = new URL('http://' + host).hostname; } catch { return false; }
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(hostname)) return false;
  if (!origin) return true;
  try { const url = new URL(origin); return url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname); } catch { return false; }
}
