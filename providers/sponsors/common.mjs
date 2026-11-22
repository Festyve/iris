export class SponsorError extends Error {
  constructor(message, { code = 'provider_error', status = 502 } = {}) { super(message); this.name = 'SponsorError'; this.code = code; this.status = status; }
}

export function text(value, name, max = 1000, optional = false) {
  if (optional && (value == null || value === '')) return '';
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new SponsorError(`${name} must be nonempty text of at most ${max} characters.`, { code: 'invalid_input', status: 400 });
  return value.trim();
}

export function publicUrl(value, name = 'URL') {
  let url;
  try { url = new URL(value); } catch { throw new SponsorError(`${name} must be an HTTPS URL.`, { code: 'invalid_input', status: 400 }); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) throw new SponsorError(`${name} must use a public HTTPS hostname without credentials.`, { code: 'invalid_input', status: 400 });
  return url;
}

export function redacted(value, secrets = []) {
  if (Array.isArray(value)) return value.map(item => redacted(item, secrets));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/token|secret|password|api.?key|authorization|cookie/i.test(key))
    .map(([key, item]) => [key, redacted(item, secrets)]));
  if (typeof value !== 'string') return value;
  let result = value.replace(/\b(?:sk|mk|mlk|alter_rk|alter_ak|alter_key)_[A-Za-z0-9_-]{8,}\b/g, '[redacted]');
  for (const secret of secrets) if (secret) result = result.split(secret).join('[redacted]');
  return result;
}

export function timeoutSignal(signal, timeoutMs) {
  return signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
}

export function safeError(error, provider) {
  if (error instanceof SponsorError) return error;
  if (error?.name === 'AbortError') return new SponsorError(`${provider} request cancelled.`, { code: 'cancelled', status: 499 });
  if (error?.name === 'TimeoutError') return new SponsorError(`${provider} request timed out.`, { code: 'timeout', status: 504 });
  if (error?.code === 'ERR_MODULE_NOT_FOUND') return new SponsorError(`${provider} SDK is not installed.`, { code: 'missing_dependency', status: 503 });
  const status = Number(error?.status ?? error?.statusCode ?? error?.response?.status);
  if (status === 401 || status === 403) return new SponsorError(`${provider} denied this credential or scope.`, { code: 'authorization', status });
  if (status === 402 || status === 429) return new SponsorError(`${provider} credit or rate limit reached.`, { code: 'quota', status });
  return new SponsorError(`${provider} request failed. Check configuration and the provider dashboard.`, { code: 'provider_error', status: 502 });
}

export async function jsonResponse(response, provider) {
  if (!response.ok) throw safeError({ status: response.status }, provider);
  try { return await response.json(); }
  catch { throw new SponsorError(`${provider} returned invalid JSON.`); }
}

export function parseMcp(result, provider) {
  if (result?.isError) throw new SponsorError(`${provider} rejected the operation. Check its account, input and scope.`);
  if (result?.structuredContent != null) return result.structuredContent;
  const parts = (result?.content ?? []).filter(part => part.type === 'text').map(part => part.text);
  if (!parts.length) throw new SponsorError(`${provider} returned no readable result.`);
  try { return JSON.parse(parts.join('\n')); }
  catch { return { text: parts.join('\n') }; }
}

export async function defaultMcpFactory({ url, headers, signal }) {
  const [{ Client }, { StreamableHTTPClientTransport }] = await Promise.all([
    import('@modelcontextprotocol/sdk/client/index.js'),
    import('@modelcontextprotocol/sdk/client/streamableHttp.js')
  ]);
  const client = new Client({ name: 'second-cursor-sponsor-hub', version: '1.0.0' }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers, signal } });
  try { await client.connect(transport); return client; }
  catch (error) { await client.close().catch(() => {}); throw error; }
}

export async function mcpCall(client, name, args, { signal, timeoutMs }) {
  return client.callTool({ name, arguments: args }, undefined, { signal, timeout: timeoutMs });
}

export async function withMcp({ factory = defaultMcpFactory, url, headers, signal, timeoutMs }, operation) {
  const combined = timeoutSignal(signal, timeoutMs);
  combined.throwIfAborted();
  const client = await factory({ url, headers, signal: combined, timeoutMs });
  try { return await operation(client, combined); }
  finally { await Promise.resolve(client.close?.()).catch(() => {}); }
}

export function createOperation(id, required, env) {
  const missing = required.filter(name => !env[name]);
  const secrets = required.filter(name => /KEY|TOKEN/.test(name)).map(name => env[name]);
  let status = { id, provider: id, configured: missing.length === 0, state: missing.length ? 'unavailable' : 'configured', missing, verifiedAt: null };
  return {
    status: () => ({ ...status, missing: [...status.missing] }),
    update: patch => { status = { ...status, ...patch }; },
    async run(operation, callback) {
      if (missing.length) return { provider: id, state: 'unavailable', missing, error: `Configure ${missing.join(', ')}.` };
      try {
        const data = await callback();
        const verifiedAt = new Date().toISOString();
        const state = data?.pending === true ? 'pending' : 'verified';
        status = { ...status, state, verifiedAt: state === 'verified' ? verifiedAt : status.verifiedAt, lastOperation: operation };
        return { provider: id, state, data: redacted(data, secrets), evidence: { operation, verifiedAt: state === 'verified' ? verifiedAt : null } };
      } catch (error) {
        const safe = safeError(error, id);
        status = { ...status, state: 'error', lastOperation: operation, error: safe.message };
        return { provider: id, state: 'error', error: safe.message, code: safe.code, status: safe.status };
      }
    }
  };
}
