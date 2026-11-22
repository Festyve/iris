import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { planBuild, compileArtifact, verifyArtifact } from '../studio/compiler.mjs';

const founder = { id: 'f', title: 'Founder audience', tags: ['founders', 'accelerator', 'onboarding'], adaptation: 'Lead with eligibility and an application action.' };
const initial = (brief, refs = [], direction) => planBuild({ brief, refs, direction });
const edit = (previous, brief) => planBuild({ previous, brief });

test('matching founder reference changes the primary action and reading order', () => {
  const brief = 'Create a landing page called "Seed Room" for founders';
  const plan = initial(brief, [founder]);
  const html = compileArtifact(plan);
  assert.equal(plan.title, 'Seed Room');
  assert.equal(plan.kind, 'landing');
  assert.deepEqual(plan.referenceIds, ['f']);
  assert.match(plan.mechanism, /Founder audience.*eligibility/);
  assert.ok(html.indexOf('Who it’s for') < html.indexOf('>Apply<'));
  assert.ok(html.indexOf('>Apply<') < html.indexOf('id="section-title"'));
  assert.doesNotMatch(compileArtifact(initial(brief)), /id="apply"/);
  assert.doesNotMatch(compileArtifact(initial('An event landing page', [founder])), /id="apply"/);
});

test('directions and suggestions produce distinct, reproducible artifacts', () => {
  for (const brief of ['A landing page for a conference', 'A task tracker app']) {
    for (const direction of ['index','editorial']) {
      const p = initial(brief, [], direction);
      const html = compileArtifact(p);
      assert.deepEqual(verifyArtifact(html,p), verifyArtifact(compileArtifact(JSON.parse(JSON.stringify(p))),p));
      assert.match(html, /(?:<summary|<a|<button)[^>]*data-primary/);
      const next = edit(p,p.suggestion);
      assert.notEqual(compileArtifact(next),html);
      assert.equal(html.includes('class="contents"'),p.kind === 'landing' && direction === 'editorial');
    }
  }
});

test('bounded revisions preserve prior versions and reject unsupported requests', () => {
  const p = initial('Build a library app named Folio with search');
  const renamed = edit(p,'Change the title to Night Shelf');
  const layout = edit(renamed,'Switch to the editorial layout');
  const recolored = edit(layout,'Make the accent #ffffff');
  const filtered = edit(recolored,'Add filters');
  const html = compileArtifact(edit(filtered,'Remove search'));
  assert.equal(p.title,'Folio');
  assert.equal(p.direction,'index');
  assert.equal(filtered.title,'Night Shelf');
  assert.match(html, /--accent:#ffffff;--on-accent:#000/);
  assert.match(html, /id="only-saved"/);
  assert.doesNotMatch(html, /id="search"/);
  assert.throws(() => edit(p,'Add search and send emails'),/Unsupported revision/);
  assert.throws(() => edit(initial('A landing page'),'Add filters'),/Unsupported revision/);
  assert.throws(() => initial('App', [], 'other'),/editorial or index/);
});

test('untrusted title and reference data stay outside executable contexts', () => {
  const payload = '</title><script>throw 1</script><style>';
  const p = edit(initial('Create a library app', [{ id: payload, title: payload, tags: ['search'], adaptation: 'load arbitrary markup' }]), 'Set title to ' + payload);
  const html = compileArtifact(p);
  assert.ok(!html.includes(payload));
  assert.ok(html.includes('&lt;/title&gt;'));
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length,1);
  const hash = createHash('sha256').update(scripts[0][1]).digest('base64');
  assert.ok(html.includes("script-src 'sha256-" + hash + "'"));
  assert.throws(() => verifyArtifact(html.replace('data-primary','data-other'),p));
  assert.throws(() => verifyArtifact(html + '<img src="https://example.test">',p));
  assert.throws(() => compileArtifact({...p,accent:payload}));
  assert.throws(() => compileArtifact({...p,direction:payload}));
});

test('application draft action prepares entered text locally and restores the closed state', () => {
  const html = compileArtifact(initial('Create a founder program landing page',[founder]));
  const events = {};
  const nodes = {
    apply: { addEventListener: (_, fn) => events.open = fn, setAttribute: (_, value) => nodes.apply.expanded = value },
    application: {hidden:true}, pitch: {value:'  Help teams sort field notes  ',focus:() => nodes.pitch.focused = true},
    prepare: {addEventListener: (_, fn) => events.prepare = fn}, draft: {}
  };
  runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{document:{querySelectorAll:() => [],getElementById: id => nodes[id]}});
  events.open();
  assert.equal(nodes.application.hidden,false);
  assert.equal(nodes.pitch.focused,true);
  const pitch = nodes.pitch.value;
  nodes.pitch.value = '  ';
  events.prepare();
  assert.match(nodes.draft.textContent,/Describe your idea/);
  nodes.pitch.value = pitch;
  events.prepare();
  assert.equal(nodes.draft.textContent,'Application draft · Help teams sort field notes');
  events.open();
  assert.equal(nodes.apply.expanded,'false');
});

test('studio briefs get portfolio content and recipe briefs get kitchen content', () => {
  assert.match(compileArtifact(initial('A landing page for a ceramics studio')),/Material studies/);
  assert.match(compileArtifact(initial('An app for recipes')),/Seasonal ingredients/);
});

test('app script filters, shortlists and adds an entry from a filtered empty state', () => {
  function element(value = '') {
    return { value, listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; },
      focus() { this.focused = true; }, setCustomValidity() {}, reportValidity() {} };
  }
  function row(title) {
    const summary = { ...element(), textContent:title };
    return {dataset:{}, querySelector(selector) { return selector === 'summary' ? summary : {textContent: summary.textContent + ' Sample note'}; } };
  }
  const original = row('Material studies');
  const list = {...element(), children:[original], prepend(item) { this.children.unshift(item); }};
  const nodes = {entries:list, search:element(), 'only-saved':element(), result:{}, add:element(),
    'new-entry':element(), 'entry-template':{content:{firstElementChild:{cloneNode:() => row('')}}}};
  const html = compileArtifact(initial('A portfolio app with search and filters'));
  runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{document:{querySelectorAll:() => [],getElementById:id => nodes[id]}});
  nodes['only-saved'].checked = true;
  nodes['only-saved'].listeners.change();
  assert.equal(original.hidden,true);
  const button = {closest:() => original,setAttribute:(_,v) => button.pressed = v};
  nodes['only-saved'].checked = false;
  nodes['only-saved'].listeners.change();
  list.listeners.click({target:{closest:() => button}});
  assert.equal(button.pressed,'true');
  nodes['only-saved'].checked = true;
  nodes['only-saved'].listeners.change();
  assert.equal(original.hidden,false);
  nodes.search.value = 'missing';
  nodes.search.listeners.input();
  assert.match(nodes.result.textContent,/No matching entries/);
  nodes['new-entry'].value = '<new entry>';
  nodes.add.listeners.click();
  assert.equal(list.children[0].querySelector('summary').textContent,'<new entry>');
  assert.equal(list.children[0].querySelector('summary').focused,true);
  assert.equal(nodes.search.value,'');
  assert.equal(nodes['only-saved'].checked,false);
  assert.equal(nodes.result.textContent,'2 entries');
});

test('a motion reference selects an original disclosure treatment', () => {
  const ref = { id: 'motion-study', title: 'Reading transition', tags: ['motion'], artwork: 'https://example.test/print.jpg' };
  const plan = initial('A vinyl landing page', [ref]);
  assert.deepEqual(plan.referenceIds, [ref.id]);
  assert.match(plan.mechanism, /Reading transition.*when its entry opens/);
  const html = compileArtifact(plan);
  assert.match(html, /<body class="editorial reveal">/);
  assert.ok(!html.includes(ref.artwork));
});
