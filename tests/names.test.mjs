import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {websiteDesign, BrandNames} from '../references/planner.mjs';

const root = fileURLToPath(new URL('../vault/', import.meta.url));
const real = /\b(stripe|google|apple|spotify|nike|airbnb|starbucks|vercel|raycast|notion|figma|microsoft|amazon|openai)\b/i;
const build = async note => (await websiteDesign(note, root)).doc;

test('a brief naming a real company builds that kind of site under an invented name', async () => {
  for (const note of ['spotify', 'google', 'nike', 'apple', 'website like airbnb', 'a coffee shop called Starbucks', 'spotify clone']) {
    const doc = await build(note);
    assert.doesNotMatch(doc.name, real, note);
    for (const n of doc.nodes) if (n.text) assert.doesNotMatch(n.text, real, note + ': ' + n.text);
  }
  assert.equal((await build('spotify')).reference.kit, 'music');
});

test('unnamed briefs get a believable name for their category, not the category itself', async () => {
  for (const [note, kind] of [['a law firm website', 'service'], ['dentist website', 'health'], ['dog walking website', 'pets']]) {
    const doc = await build(note);
    assert.ok(BrandNames.pools[kind].includes(doc.name), note + ' → ' + doc.name);
  }
});

test('typed names and explicit names are kept', async () => {
  
  assert.equal((await build('a fintech website called Ledgerly')).name, 'Ledgerly');
  assert.equal((await build('a coffee shop website called Bean')).name, 'Bean');
});

test('every captured site and its gallery copy is free of real company names', async () => {
  for (const id of ['stripe', 'vercel', 'raycast', 'siteinspire', 'designspells', 'apple-liquid-glass']) {
    const doc = await build('recreate ' + id);
    assert.equal(doc.reference.capture, true, id);
    assert.doesNotMatch(doc.name + ' ' + doc.reference.title, real, id);
    for (const n of doc.nodes) if (n.text) assert.doesNotMatch(n.text, real, id + ': ' + n.text);
  }
});

test('everyday words that are also brands do not trigger renaming', () => {
  assert.equal(BrandNames.realBrand('an apple pie bakery'), null);
  assert.equal(BrandNames.realBrand('a calm meditation app'), null);
  assert.equal(BrandNames.realBrand('apple')?.kind, 'shop');
});

import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {originals} from '../references/originals.mjs';
import {minimal} from '../references/planner.mjs';
import {brands, brandCopy} from '../references/captures.mjs';
import {Doc} from '../designer.mjs';
import Match from '../references/match.js';
import {catalog} from '../references/catalog.mjs';

test('every selectable template builds, and a typed title replaces its name everywhere', async () => {
  const read = name => readFile(new URL('../references/' + name, import.meta.url), 'utf8');
  const Websites = vm.runInNewContext((await read('websites.js')) + '\nWebsites', {
    Doc, BrandNames, OriginalPages: originals, MinimalPages: minimal, ReferenceBrands: brands, ReferenceCopy: brandCopy,
    RasterLayouts: JSON.parse(await read('raster-layouts.json')), ReferenceSites: JSON.parse(await read('sites.json')),
    ReferenceMedia: await catalog(root), ReferenceMatch: Match});
  assert.ok(Websites.templates.length >= 12);
  for (const t of Websites.templates) {
    const plain = Websites.fromTemplate(t.id);
    assert.doesNotMatch(plain.name, real, t.id);
    const titled = Websites.fromTemplate(t.id, 'Moonbeam');
    assert.equal(titled.name, 'Moonbeam', t.id);
    assert.ok(titled.nodes.some(n => n.text && n.text.includes('Moonbeam')), t.id + ' shows the typed title');
    if (plain.name !== 'Moonbeam') assert.ok(!titled.nodes.some(n => n.text && n.text.includes(plain.name)), t.id + ' keeps no old name');
    assert.ok(titled.screens.every(s => s.name.startsWith('Moonbeam · ')), t.id);
  }
  const random = Websites.randomTemplate('Typed Name');
  assert.equal(random.name, 'Typed Name');
  assert.ok(Websites.templates.some(t => t.id === random.reference.template));
});
