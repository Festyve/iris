import assert from 'node:assert/strict';
import test from 'node:test';
import { importFiles, rankReferences, droppedFiles } from '../studio/vault.mjs';

const entry = (path, text = '') => ({ path, file: new File([text], path.split('/').pop()) });

test('notes retain safe URLs, feature metadata, all distinct linked blobs and plain Markdown', async () => {
  const { refs, errors } = await importFiles([
    entry('Vault/notes/search.md', '---\nfeatures: [Search, forms]\nasset_path: ../assets/a.png\n---\n# Quick find\n## Observation\nInstant results\n## Adaptation\nKeep focus\n![[b.jpg|200]]'),
    entry('Vault/assets/a.png', 'first'), entry('Vault/assets/b.jpg', 'second'),
    entry('loose.md', '# Loose note\nPlain text #motion [source](https://example.com/)'), entry('extra.webp'),
  ]);
  assert.deepEqual(errors, []);
  assert.equal(refs.length, 3);
  const note = refs.find(ref => ref.title === 'Quick find');
  assert.deepEqual(note.tags, ['search', 'forms']);
  assert.equal(note.observation, 'Instant results');
  assert.match(note.adaptation, /Keep focus/);
  assert.equal(await note.images[1].blob.text(), 'second');
  const loose = refs.find(ref => ref.title === 'Loose note');
  assert.deepEqual(loose.tags, ['motion']);
  assert.equal(loose.sourceUrl, 'https://example.com/');
  assert.equal(refs.find(ref => ref.title === 'extra.webp').images.length, 1);
});

test('resolve bounded sibling paths, isolate roots and reject unsafe or ambiguous links', async () => {
  const note = [
    '![](../assets/ok%20image.png)', '![](%2e%2e/%2e%2e/Other/secret.png)',
    '![[secret.png]]', '![[duplicate.png]]', '![](file:///tmp/x.png)', '![](/private.png)',
    '![](%5c..%5csecret.png)', '![](https://example.com/r.png)',
  ].join('\n');
  const { refs, errors } = await importFiles([
    entry('A/notes/ref.md', '---\nsource_url: javascript:alert(1)\n---\n' + note),
    entry('A/assets/ok image.png'), entry('A/x/duplicate.png'), entry('A/y/duplicate.png'), entry('Other/secret.png'),
  ]);
  assert.equal(refs[0].images.length, 1);
  assert.equal(refs[0].sourceUrl, '');
  assert.equal(errors.length, 7);
  assert.ok(errors.every(e => e.path === 'A/notes/ref.md'));
  assert.match(errors[0].message, /leaves this collection/);
});

test('bad files produce individual errors alongside successful siblings', async () => {
  const { refs, errors } = await importFiles([
    entry('../outside.md'), entry('bad.md', '---\ntitle: [invalid\n---\n'), entry('unfinished.md', '---\nx: y'),
    entry('README.txt'), entry('ok.md', '# Saved'), entry('folder/.obsidian/config.json'),
  ]);
  assert.deepEqual(refs.map(r => r.title), ['Saved']);
  assert.equal(errors.length, 4);
});

test('folder drops drain all reader batches and report unreadable entries', async () => {
  const f = name => ({ name, isFile: true, file: yes => yes(new File([], name)) });
  const batches = [[f('one.md')], [f('two.md'), { name: 'broken.md', isFile: true, file: (_, no) => no(new Error('denied')) }], []];
  const dir = { name: 'Vault', isDirectory: true, createReader: () => ({ readEntries: ok => ok(batches.shift()) }) };
  const entries = await droppedFiles({ items: [{ kind: 'file', webkitGetAsEntry: () => dir }] });
  const result = await importFiles(entries);
  assert.deepEqual(result.refs.map(r => r.path), ['Vault/one.md', 'Vault/two.md']);
  assert.deepEqual(result.errors, [{ path: 'Vault/broken.md', message: 'denied' }]);
});

test('rank feature evidence over incidental text with deterministic ties and reasons', () => {
  const refs = [
    { id: 'text', observation: 'Navigation search' }, { id: 'b', tags: ['navigation'] },
    { id: 'unrelated', title: 'Pricing' }, { id: 'a', tags: ['navigation'] },
  ];
  const ranked = rankReferences(refs, 'Build a search page', [{ name: 'Navigation' }]);
  assert.deepEqual(ranked.map(r => r.id), ['a', 'b', 'text']);
  assert.match(ranked[0].reason, /navigation/);
  assert.ok(ranked[0].score > ranked[2].score);
  assert.deepEqual(rankReferences(refs, '', []), []);
});

test('ordinary Markdown supports reference-style thumbnails and filenames with parentheses', async () => {
  const note = '# Examples\n![Panel][shot]\n![Graph](graph(2).png)\n\n[Shot]: <wide panel.png> "Panel"';
  const { refs, errors } = await importFiles([entry('note.md', note), entry('wide panel.png'), entry('graph(2).png')]);
  assert.deepEqual(errors, []);
  assert.equal(refs.length, 1);
  assert.deepEqual(refs[0].images.map(image => image.path), ['wide panel.png', 'graph(2).png']);
});

test('the bundled collection resolves both After Hours screenshots and retrieves founder research', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  const files = [];
  for (const dir of ['references', 'assets']) {
    const root = new URL('../design-vault/' + dir + '/', import.meta.url);
    for (const name of await readdir(root)) {
      if (name.startsWith('.')) continue;
      files.push(entry('design-vault/' + dir + '/' + name, await readFile(new URL(name, root))));
    }
  }
  const { refs, errors } = await importFiles(files, 'design-vault-demo');
  assert.deepEqual(errors, []);
  for (const ref of refs.filter(r => r.title.startsWith('After Hours'))) {
    assert.equal(ref.images.length, 1);
    assert.ok(ref.images[0].blob.size > 0);
  }
  const founder = refs.find(ref => ref.title.includes('Founder audience'));
  assert.equal(rankReferences(refs, 'YC program for founders', ['accelerator'])[0].id, founder.id);
});
