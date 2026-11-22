import { rankReferences } from './vault.mjs';

export function retrieve(refs, brief, pinned) {
  const attached = refs.filter(r => pinned.includes(r.id));
  const ranked = rankReferences(refs, brief, attached.flatMap(r => r.tags));
  const matches = new Map(ranked.slice(0, 4).map(hit => [hit.id, hit]));
  for (const ref of attached) {
    matches.set(ref.id, { ...matches.get(ref.id), id: ref.id, reason: 'Selected for this brief' + (matches.has(ref.id) ? ' · ' + matches.get(ref.id).reason : '') });
  }
  return Array.from(matches.values(), hit => ({ ...hit, title: refs.find(r => r.id === hit.id).title }));
}

