import { createOperation, mcpCall, parseMcp, SponsorError, text, withMcp } from './common.mjs';

export function createFiber({ env, mcpFactory, timeoutMs }) {
  const op = createOperation('fiber', ['FIBER_API_KEY'], env);
  return {
    status: op.status,
    companyContext({ query, domain, limit = 3, signal } = {}) {
      const normalizedDomain = domain ? text(domain, 'domain', 253).toLowerCase() : '';
      if (normalizedDomain && !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(normalizedDomain)) throw new SponsorError('domain must be a domain name, not a URL.', { code: 'invalid_input', status: 400 });
      const searchParams = normalizedDomain ? { domains: [normalizedDomain] } : { nameLike: text(query, 'company query', 200) };
      const pageSize = Math.min(10, Math.max(1, Number.isInteger(limit) ? limit : 3));
      return op.run('companySearch_tool', () => withMcp({ factory: mcpFactory, url: 'https://mcp.fiber.ai/mcp/v2',
        headers: { 'x-api-key': env.FIBER_API_KEY }, signal, timeoutMs }, async (client, combined) => {
        const raw = parseMcp(await mcpCall(client, 'companySearch_tool', { searchParams, pageSize, includeCount: false }, { signal: combined, timeoutMs }), 'Fiber');
        if (raw?.error || raw?.success === false || Number(raw?.statusCode ?? raw?.status) >= 400) throw new SponsorError('Fiber did not confirm a successful search. Check provider quota and input.');
        const payload = raw?.result ?? raw;
        const companies = payload?.output?.data ?? payload?.data?.output?.data ?? payload?.data ?? payload?.companies ?? payload?.results;
        if (!Array.isArray(companies)) throw new SponsorError('Fiber returned an unrecognized company result. Inspect the current provider response schema.');
        return { query: normalizedDomain || query, companies: companies.slice(0, pageSize), response: raw,
          source: 'https://docs.fiber.ai/build/mcp', usedFor: 'Target-company context for the design brief' };
      }));
    }
  };
}
