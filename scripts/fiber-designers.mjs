// Research well-known UI/product designers with Fiber AI and save public profile fields
// (name, role, company, headline, location, LinkedIn) to vault/Designers/fiber-designers.json.
// Never requests emails or phone numbers. Run: npm run fiber
import { healthCheck, getOrgCredits, slushieRun } from '@fiberai/sdk';
import { mkdir, writeFile } from 'node:fs/promises';

const apiKey = process.env.FIBER_API_KEY;
if (!apiKey) { console.error('Set FIBER_API_KEY in .env.local first.'); process.exit(1); }
const PAGE = Number(process.env.FIBER_PAGE_SIZE || 12);
const queries = [
  ['product-leads', 'Heads of design, design directors and principal product designers at Linear, Vercel, Stripe, Figma, Airbnb, Apple and Arc (The Browser Company)'],
  ['design-engineers', 'Design engineers known for interaction design, motion and UI craft at developer tool startups in San Francisco and New York'],
  ['studios', 'Founders and creative directors of independent digital product design studios in Europe'],
  ['type-brand', 'Typeface designers and brand identity designers who also design websites and apps'],
  ['mobile', 'Senior mobile app UI designers at consumer apps known for great design such as Duolingo, Headspace, Revolut, Monzo and Spotify'],
];

const health = await healthCheck();
console.log('healthCheck:', health.response?.status, JSON.stringify(health.data));
const credits = await getOrgCredits({ query: { apiKey } });
const c = credits.data?.output?.[0];
console.log('credits available:', c?.available, 'of', c?.max, '(used', c?.used + ')');
const estimate = queries.length * (2 + PAGE);
if (c && c.available < estimate) { console.error('Not enough credits for about ' + estimate + '; lower FIBER_PAGE_SIZE.'); process.exit(1); }
if (process.argv.includes('--check')) process.exit(0);

const pick = p => {
  const job = p.currentJob || p.current_job || (p.experiences || p.workExperience || [])[0] || {};
  return {
    name: p.name || [p.firstName || p.first_name, p.lastName || p.last_name].filter(Boolean).join(' '),
    headline: p.headline || '',
    title: job.title || p.title || '',
    company: job.companyName || job.company_name || job.company?.name || p.companyName || '',
    location: p.locality || p.location || [p.city, p.country].filter(Boolean).join(', '),
    linkedin: p.url || p.linkedinUrl || p.linkedin_url || (p.slug ? 'https://www.linkedin.com/in/' + p.slug : ''),
    skills: (p.skills || []).slice(0, 8).map(s => typeof s === 'string' ? s : s.name).filter(Boolean),
    summary: String(p.summary || p.about || '').slice(0, 400),
  };
};

const results = {}, charges = [];
for (const [key, query] of queries) {
  const r = await slushieRun({ body: { apiKey, query, pageSize: PAGE } });
  if (r.error) { console.error(key, 'failed:', JSON.stringify(r.error).slice(0, 300)); continue; }
  const out = r.data?.output || r.data || {};
  const people = out.profiles || out.people || out.data || out.results || [];
  results[key] = { query, people: people.map(pick).filter(p => p.name) };
  charges.push({ key, chargeInfo: r.data?.chargeInfo || out.chargeInfo || null });
  console.log(key + ': ' + results[key].people.length + ' people', JSON.stringify(r.data?.chargeInfo || out.chargeInfo || ''));
  if (!results[key].people.length) console.log('  response keys:', Object.keys(out).join(', '));
}
await mkdir(new URL('../vault/Designers/', import.meta.url), { recursive: true });
await writeFile(new URL('../vault/Designers/fiber-designers.json', import.meta.url), JSON.stringify({ fetched: new Date().toISOString(), source: 'Fiber AI slushieRun (natural-language people search)', results, charges }, null, 2) + '\n');
console.log('Saved vault/Designers/fiber-designers.json');
