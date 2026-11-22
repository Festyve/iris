// Design profiles from vault/Profiles and how they reach the Claude designer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadProfiles, profileStyle} from '../profiles.mjs';
import {design, edit, designSystem, editSystem, Doc} from '../designer.mjs';

const vault = fileURLToPath(new URL('../vault', import.meta.url));

test('the vault ships ordered profiles, starting with the general default', async () => {
  const profiles = await loadProfiles(vault);
  assert.ok(profiles.length >= 10);
  assert.equal(profiles[0].id, 'general');
  assert.equal(new Set(profiles.map(p => p.id)).size, profiles.length);
  for (const p of profiles) { assert.ok(p.name && p.tagline && p.brief.length > 200, p.id); assert.equal(p.refs.length, 3, p.id); }
  assert.ok(!profiles.some(p => /!\[|\[\[/.test(p.brief)), 'briefs are plain text without Obsidian markup');
});

test('a profile becomes a style brief plus its three reference images', async () => {
  const style = await profileStyle(vault, 'terminal-monk');
  assert.equal(style.name, 'Terminal Monk');
  assert.match(style.text, /Terminal Monk/); assert.match(style.text, /profile wins/);
  assert.equal(style.images.length, 3);
  for (const img of style.images) { assert.equal(img.type, 'image'); assert.match(img.source.media_type, /^image\//); assert.ok(img.source.data.length > 1000); }
  assert.equal((await profileStyle(vault, 'terminal-monk', 0)).images.length, 0);
  assert.equal(await profileStyle(vault, 'no-such-style'), null);
  assert.equal(await profileStyle(vault, ''), null);
  assert.deepEqual(await loadProfiles(''), []);
});

test('reference images outside the vault are never read', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'iris-vault-'));
  await mkdir(join(dir, 'Profiles'));
  await writeFile(join(dir, 'Profiles', 'x.md'), '---\nid: sneaky\nname: Sneaky\ntagline: t\nrefs: [../../../etc/hosts.png, /etc/passwd.jpg]\n---\nA brief.\n');
  const style = await profileStyle(dir, 'sneaky');
  assert.equal(style.name, 'Sneaky'); assert.equal(style.images.length, 0);
});

test('design and edit send the profile with the request and keep the cached system prompt', async () => {
  const style = {name: 'Test', text: 'Design profile: "Test". Use square corners.', images: [{type: 'image', source: {type: 'base64', media_type: 'image/png', data: 'iVBOR'}}]};
  const board = {name: 'Fern', summary: 'x', screens: [{id: 'home', name: 'Fern · Home', w: 390, h: 844, fill: '#F4F7F2'}],
    nodes: [{id: 'title', parent: 'home', type: 'text', name: 'Title', text: 'Your plants', size: 30, weight: 700, color: '#14261C'}]};
  let seen;
  await design('A plant care app', async (system, user) => { seen = {system, user}; return board; }, style);
  assert.equal(seen.system, designSystem);
  assert.ok(Array.isArray(seen.user)); assert.equal(seen.user[0].type, 'image');
  const text = seen.user.at(-1); assert.equal(text.type, 'text'); assert.match(text.text, /square corners[\s\S]*plant care/);
  await edit(Doc.clean(board), 'Bigger title', async (system, user) => { seen = {system, user}; return {summary: 's', ops: []}; }, style);
  assert.equal(seen.system, editSystem); assert.match(seen.user.at(-1).text, /square corners[\s\S]*Bigger title/);
  await design('A plant care app', async (system, user) => { seen = {user}; return board; }, null);
  assert.equal(typeof seen.user, 'string', 'without a profile the request is unchanged');
});
