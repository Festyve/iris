import { createOperation, jsonResponse, SponsorError, text, timeoutSignal } from './common.mjs';

export function createPloid({ env, fetchImpl, timeoutMs }) {
  const op = createOperation('ploid', ['PLOID_API_KEY'], env);
  return {
    status: op.status,
    audienceSearch({ query, limit = 5, signal } = {}) {
      const cleaned = text(query, 'professional audience query', 600);
      const count = Math.min(10, Math.max(1, Number.isInteger(limit) ? limit : 5));
      return op.run('POST /v1/search', async () => {
        const raw = await jsonResponse(await fetchImpl('https://api.ploid.com/v1/search', {
          method: 'POST', headers: { Authorization: `Bearer ${env.PLOID_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: cleaned, type: 'instant', category: 'people', num_results: count,
            contents: { fields: ['linkedin', 'title', 'company', 'location'] } }), signal: timeoutSignal(signal, timeoutMs)
        }), 'Ploid');
        const rows = raw.results ?? raw.people ?? raw.data?.results ?? raw.data;
        if (!Array.isArray(rows)) throw new SponsorError('Ploid returned an unrecognized search result. Inspect the current provider response schema.');
        const people = rows.slice(0, count).map(person => ({ id: person.id, name: person.name, title: person.title,
          company: person.company, location: person.location, linkedin: person.linkedin ?? person.linkedin_url }));
        return { query: cleaned, people, source: 'https://ploid.com/documentation/api/search',
          usedFor: 'Professional audience examples for user-research planning', contacted: false };
      });
    }
  };
}
