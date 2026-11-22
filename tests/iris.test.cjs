const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const engine = ['screen-spec.cjs', 'icons.js', 'layout.js', 'kit.js', 'crew.js'].map(read).join('\n');
const ctx = vm.createContext({});
vm.runInContext(engine, ctx);
const {Screens, Kit, Crew, Doc, Icons} = vm.runInContext('({Screens, Kit, Crew, Doc, Icons})', ctx);
const briefs = [...Kit.samples, 'A pottery kiln scheduler', 'dashboard for a bus company', 'dark crypto wallet', ''];
const compile = doc => Doc.pin(doc, Screens.checkBoard(Doc.compile(doc), true)) && Screens.checkBoard(Doc.compile(doc), true);

/* A small hand-written design in the document format, like the one Claude returns. */
function sample() {
  return Doc.clean({name: 'Fern', screens: [{id: 'home', name: 'Fern · Home', w: 390, h: 844, fill: '#F5F5F8', pad: [56, 24, 24, 24], gap: 16}], nodes: [
    {id: 'hdr', parent: 'home', type: 'frame', name: 'Header', layout: 'row', justify: 'between'},
    {id: 'hello', parent: 'hdr', type: 'text', name: 'Greeting', text: 'Good morning, Ava', size: 22, weight: 700, color: '#15151E'},
    {id: 'bell', parent: 'hdr', type: 'icon', name: 'Bell', icon: 'bell', size: 22, color: '#15151E'},
    {id: 'card', parent: 'home', type: 'frame', name: 'Balance card', fill: '#6E56F8', fill2: '#B26BFF', r: 24, pad: 20, gap: 6, shadow: true},
    {id: 'label', parent: 'card', type: 'text', name: 'Balance label', text: 'Total balance', size: 14, color: '#FFFFFF'},
    {id: 'value', parent: 'card', type: 'text', name: 'Balance', text: '$12,480.20', size: 34, weight: 700, color: '#FFFFFF'},
    {id: 'trend', parent: 'card', type: 'line', name: 'Trend', w: 'fill', h: 40, points: [[0, .8], [.5, .3], [1, .1]], color: '#FFFFFF'},
    {id: 'grid', parent: 'home', type: 'frame', name: 'Actions', layout: 'grid', cols: 2, gap: 12},
    ...[1, 2, 3, 4].map(i => ({id: 'tile' + i, parent: 'grid', type: 'frame', name: 'Tile ' + i, fill: '#FFFFFF', r: 18, pad: 16, gap: 8})),
    ...[1, 2, 3, 4].map(i => ({id: 'tile-icon' + i, parent: 'tile' + i, type: 'icon', name: 'Tile icon', icon: ['send', 'card', 'pie', 'gift'][i - 1], color: '#6E56F8'})),
    ...[1, 2, 3, 4].map(i => ({id: 'tile-text' + i, parent: 'tile' + i, type: 'text', name: 'Tile label', text: 'A fairly long label that should wrap', size: 14, weight: 600, color: '#15151E'})),
    {id: 'spacer', parent: 'home', type: 'frame', name: 'Spacer', h: 'fill'},
    {id: 'cta', parent: 'home', type: 'frame', name: 'Continue button', fill: '#15151E', r: 16, h: 56, layout: 'row', justify: 'center'},
    {id: 'cta-label', parent: 'cta', type: 'text', name: 'Continue', text: 'Continue', size: 16, weight: 600, color: '#FFFFFF'}
  ]});
}

test('every brief becomes a valid seven-screen board', () => {
  for (const brief of briefs) {
    const board = Screens.checkBoard(Kit.build(brief));
    assert.equal(board.screens.length, 7, brief);
    for (const s of board.screens) assert.ok(s.layers.length > 25, s.name);
    for (const s of board.screens) for (const o of board.screens) if (s !== o)
      assert.ok(s.x + s.width <= o.x || o.x + o.width <= s.x || s.y + s.height <= o.y || o.y + o.height <= s.y, 'screens overlap');
  }
});

test('briefs pick the right product and honour colour and mode words', () => {
  assert.equal(Kit.pick('A budgeting app called "Penny"').pack.name, 'Penny');
  assert.equal(Kit.pick('running coach').domain, 'fitness');
  assert.equal(Kit.pick('train departures for commuters').domain, 'travel');
  assert.equal(Kit.pick('A recipe app called Saffron').pack.name, 'Saffron');
  assert.equal(Kit.pick('task manager in dark mode').theme.mode, 'dark');
  assert.equal(Kit.pick('budget tracker in emerald green').theme.hue, 'emerald');
  assert.equal(Kit.pick('A pottery kiln scheduler').domain, 'generic');
});

test('validation rejects broken layers, or drops them when lenient', () => {
  const s = Kit.build('budget').screens[1];
  assert.throws(() => Screens.check(Object.assign({}, s, {layers: [{kind: 'rect', name: 'x', x: 0, y: 0, w: 10, h: 10, fill: 'red'}]})), /fill/);
  assert.throws(() => Screens.check(Object.assign({}, s, {layers: [{kind: 'rect', name: 'x', x: 5000, y: 0, w: 10, h: 10, fill: '#000000'}]})), /geometry/);
  const kept = Screens.check(Object.assign({}, s, {layers: [{kind: 'rect', name: 'ok', x: 0, y: 0, w: 10, h: 10, fill: '#000000'}, {kind: 'rect', name: 'bad', x: 5000, y: 0, w: 10, h: 10, fill: '#000000'}]}), true);
  assert.equal(kept.layers.length, 1);
});

test('the local kit converts to a document and compiles back to the same geometry', () => {
  const board = Screens.checkBoard(Kit.build('Meal kit delivery app called "Ladle"'));
  const back = Doc.compile(Doc.fromBoard(board));
  board.screens.forEach((S, i) => {
    assert.equal(back.screens[i].layers.length, S.layers.length, S.name);
    S.layers.forEach((L, k) => { const M = back.screens[i].layers[k]; for (const key of ['x', 'y', 'w', 'h']) assert.ok(Math.abs(L[key] - M[key]) < .02, S.name + ' ' + L.name + ' ' + key); });
  });
});

test('the layout engine lays out rows, grids, wrapping text and spacers', () => {
  const b = compile(sample()), L = Object.fromEntries(b.screens[0].layers.map(l => [l.id, l]));
  assert.equal(L.hello.y, 56); assert.equal(L.hello.x, 24);
  assert.equal(L.bell.x + L.bell.w, 366, 'row justify between pushes the bell to the right margin');
  assert.equal(L.card.w, 342, 'column children stretch');
  assert.equal(L.label.x, 44, 'padding inside the card');
  assert.equal(L.tile1.w, L.tile2.w); assert.equal(L.tile2.x, L.tile1.x + L.tile1.w + 12, 'grid gap');
  assert.ok(L['tile-text1'].text.includes('\n'), 'long text wraps inside the tile');
  assert.equal(L.cta.y + L.cta.h, 844 - 24, 'the spacer pushes the button to the bottom padding');
  assert.equal(L['cta-label'].x + L['cta-label'].w / 2, 195, 'centred in the button');
  assert.equal(L.trend.kind, 'line'); assert.equal(L.bell.kind, 'icon'); assert.equal(L.bell.icon, 'bell');
  assert.ok(Icons.names.length > 80); assert.equal(Icons.resolve('gear'), 'settings'); assert.equal(Icons.resolve('nonsense'), 'circle');
});

test('text in an overflowing row wraps instead of running off the screen', () => {
  const d = Doc.clean({name: 'T', screens: [{id: 's', name: 'T · S', w: 390, h: 844, pad: [24, 24]}], nodes: [
    {id: 'row', parent: 's', type: 'frame', layout: 'row', gap: 8},
    {id: 'title', parent: 'row', type: 'text', text: 'Monstera Deliciosa Variegata', size: 30, weight: 700, color: '#111111'},
    {id: 'pill', parent: 'row', type: 'frame', fill: '#DDEEDD', r: 10, pad: [4, 10]},
    {id: 'pill-text', parent: 'pill', type: 'text', text: 'Healthy', size: 12, color: '#111111'}]});
  const L = Object.fromEntries(compile(d).screens[0].layers.map(l => [l.id, l]));
  assert.ok(L.pill.x + L.pill.w <= 366.5, 'the pill stays inside the margin');
  assert.ok(L.title.text.includes('\n'), 'the title wraps');
});

test('patches add, change, move and remove nodes and screens, and skip bad ops', () => {
  const r = Doc.apply(sample(), [
    {op: 'set', id: 'card', node: {fill: '#111111'}},
    {op: 'add', parent: 'home', before: 'grid', node: {id: 'qa', type: 'text', name: 'Quick actions', text: 'Quick actions', size: 18, weight: 700, color: '#15151E'}},
    {op: 'remove', id: 'tile4'},
    {op: 'move', id: 'bell', parent: 'hdr', before: 'hello'},
    {op: 'addScreen', screen: {id: 'settings', name: 'Fern · Settings', w: 390, h: 844, fill: '#FFFFFF'}},
    {op: 'add', parent: 'settings', node: {type: 'text', text: 'Settings', size: 28, weight: 700, color: '#15151E'}},
    {op: 'remove', id: 'does-not-exist'}, {op: 'bogus'}
  ]);
  assert.equal(r.applied.length, 6); assert.equal(r.skipped.length, 2);
  const d = r.doc;
  assert.equal(d.nodes.find(n => n.id === 'card').fill, '#111111');
  assert.ok(!d.nodes.some(n => n.id === 'tile4' || n.id === 'tile-icon4'), 'children go with their parent');
  const kids = d.nodes.filter(n => n.parent === 'home').map(n => n.id);
  assert.ok(kids.indexOf('qa') === kids.indexOf('grid') - 1);
  assert.equal(JSON.stringify(d.nodes.filter(n => n.parent === 'hdr').map(n => n.id)), JSON.stringify(['bell', 'hello']));
  assert.equal(d.screens.length, 2);
  assert.ok(d.nodes.some(n => n.parent === 'settings' && n.id));
});

test('edits to a pinned board keep existing screens in place and add new ones beside them', () => {
  const doc = sample(), b1 = compile(doc);
  const r = Doc.apply(doc, [{op: 'addScreen', screen: {id: 's2', name: 'Two', w: 390, h: 844, fill: '#FFFFFF'}}, {op: 'add', parent: 's2', node: {type: 'shape', w: 40, h: 40, fill: '#000000'}}]);
  const b2 = compile(r.doc);
  assert.equal(b2.screens[0].x, b1.screens[0].x); assert.equal(b2.screens[0].y, b1.screens[0].y);
  assert.ok(b2.screens[1].x >= b1.screens[0].x + 390);
});

for (const count of [50, 250, 1000]) {
  test('a crew of ' + count + ' performs every task once, in dependency order', () => {
    const board = Screens.checkBoard(Kit.build('Running coach app, dark mode'));
    const P = Crew.plan(board, count);
    const work = P.tasks.filter(t => t.kind !== 'join');
    for (const t of P.tasks) {
      assert.ok(Number.isFinite(t.start) && t.end >= t.start, 'task scheduled');
      for (const d of t.deps) assert.ok(t.start >= P.tasks[d].end - 1e-9, t.kind + ' starts after its dependency');
    }
    const seen = new Map();
    for (const c of P.crew) {
      let prev = null;
      for (const s of c.segs) {
        assert.ok(s.t1 >= s.t0);
        if (prev) assert.ok(s.t0 >= prev.t1 - 1e-9, 'segments do not overlap');
        if (s.kind === 'move' && prev) assert.deepEqual(s.from, prev.to, 'cursors move continuously');
        if (s.kind === 'work') { assert.equal(P.tasks[s.task].cursor, c.id); seen.set(s.task, (seen.get(s.task) || 0) + 1); }
        prev = s;
      }
    }
    assert.equal(seen.size, work.length);
    for (const v of seen.values()) assert.equal(v, 1);
    for (const ref of P.layers) if (ref.parent >= 0) {
      const parent = P.layers.find(p => p.screen === ref.screen && p.index === ref.parent);
      const first = P.tasks[ref.tasks.draw ?? ref.tasks.type ?? ref.tasks.trace ?? ref.tasks.icon];
      assert.ok(first.start >= P.tasks[parent.last].end - 1e-9);
    }
    const used = P.crew.filter(c => c.jobs > 0).length;
    assert.ok(used >= Math.min(count, work.length) * .85, 'most of the crew gets work: ' + used);
    assert.ok(P.finish < (count >= 250 ? 14 : 40), 'finishes in a watchable time: ' + P.finish);
  });
}

test('the final frame of a build matches the designed board exactly', () => {
  for (const board of [Screens.checkBoard(Kit.build('Meal kit delivery app called "Ladle"')), compile(sample())]) {
    const P = Crew.plan(board, 100), t = P.total;
    for (let li = 0; li < P.layers.length; li++) {
      const L = P.layers[li].L, s = Crew.layerAt(P, li, t);
      assert.ok(s && s.final, L.name);
      if (L.kind === 'text') assert.equal(s.chars, L.text.length);
      else if (L.kind === 'line') assert.equal(s.trace, 1);
      else if (L.kind === 'icon') assert.equal(s.scale, 1);
      else { assert.deepEqual([s.box.x, s.box.y, s.box.w, s.box.h], [L.x, L.y, L.w, L.h]); assert.equal(s.fill, 1); }
    }
    for (const c of P.crew) assert.equal(Crew.cursorAt(P, c, t), null, 'crew has left');
    assert.equal(Crew.stats(P, t).done, P.workCount);
  }
});

test('an edit run animates only the difference and ends exactly on the new design', () => {
  const doc = sample(), before = compile(doc);
  const r = Doc.apply(doc, [
    {op: 'set', id: 'card', node: {fill: '#15151E', fill2: null}}, {op: 'set', id: 'value', node: {text: '$9,040.00'}},
    {op: 'remove', id: 'tile4'}, {op: 'set', id: 'grid', node: {gap: 20}},
    {op: 'add', parent: 'home', before: 'grid', node: {id: 'qa', type: 'text', name: 'Quick actions', text: 'Quick actions', size: 18, weight: 700, color: '#15151E'}}
  ]);
  const after = compile(r.doc);
  const P = Crew.plan(after, 250, {prev: before});
  const kinds = {}; for (const t of P.tasks) if (t.kind !== 'join') kinds[t.kind] = (kinds[t.kind] || 0) + 1;
  assert.equal(kinds.erase, 3, 'the removed tile and its icon and label are deleted');
  assert.ok(kinds.fill >= 1 && kinds.type >= 2 && kinds.snap >= 1, JSON.stringify(kinds));
  assert.ok(!kinds.frame && !kinds.paint && !kinds.draw, 'nothing is rebuilt');
  assert.ok(P.count < 250, 'a small edit uses a small crew');
  assert.ok(P.layers.some(l => l.ride), 'children ride along with a moved container');
  // At t=0 the canvas shows the old design; at the end, the new one.
  const at = (t, li) => Crew.layerAt(P, li, t);
  const idx = id => P.layers.findIndex(l => l.L.id === id && !l.ghost);
  assert.equal(at(0, idx('value')).text, '$12,480.20');
  assert.equal(at(P.total, idx('value')).text, '$9,040.00');
  assert.equal(at(0, idx('qa')), null);
  for (let li = 0; li < P.layers.length; li++) {
    const ref = P.layers[li], s = at(P.total, li);
    if (ref.ghost) { assert.equal(s, null, 'deleted layers are gone'); continue; }
    assert.ok(s.final);
    if (ref.L.kind !== 'text') assert.deepEqual([s.box.x, s.box.y, s.box.w, s.box.h].map(v => Math.round(v * 100)), [ref.L.x, ref.L.y, ref.L.w, ref.L.h].map(v => Math.round(v * 100)), ref.L.name);
  }
  assert.ok(P.order.map(id => Crew.describe(P, P.tasks[id])).some(s => s.startsWith('deleted ')));
});

test('manual Figma edits are folded back into the document', () => {
  const doc = Doc.fromBoard(Screens.checkBoard(Kit.build('budget'))), board = compile(doc);
  const S = board.screens[1], title = S.layers.find(l => l.name === 'User name'), card = S.layers.find(l => l.name === 'Balance card'), gone = S.layers.find(l => l.name === 'Section title');
  const nodes = S.layers.filter(l => l !== gone).map(l => ({id: l.id, x: l.x, y: l.y, w: l.w, h: l.h, text: l.text, fill: typeof l.fill === 'string' ? l.fill : undefined}));
  Object.assign(nodes.find(n => n.id === title.id), {text: 'Jordan Diaz'});
  Object.assign(nodes.find(n => n.id === card.id), {x: card.x + 10});
  const m = Doc.merge(doc, board, {screens: [S.id], nodes});
  assert.equal(m.doc.nodes.find(n => n.id === title.id).text, 'Jordan Diaz');
  assert.ok(!m.doc.nodes.some(n => n.id === gone.id));
  const moved = compile(m.doc).screens[1].layers.find(l => l.id === card.id);
  assert.equal(moved.x, card.x + 10);
  assert.ok(m.notes.length >= 3);
});

test('planning is deterministic so the browser and Figma agree', () => {
  const board = Screens.checkBoard(Kit.build('budget'));
  const a = Crew.plan(board, 120), b = Crew.plan(board, 120);
  assert.deepEqual(a.tasks.map(t => [t.start, t.cursor]), b.tasks.map(t => [t.start, t.cursor]));
});

/* ---------- the Figma plugin, against a mocked Figma API ---------- */
function mockFigma() {
  let clock = 1000, tick = null, uiHandler = null;
  const posted = [], page = node('PAGE'), data = new Map();
  function node(type) {
    const n = {type, children: [], parent: null, removed: false, visible: true, x: 0, y: 0, width: 100, height: 100, opacity: 1, fills: [], strokes: [], name: '', fontSize: 12, plugin: {},
      resize(w, h) { this.width = w; this.height = h; }, rescale(k) { this.width *= k; this.height *= k; },
      appendChild(c) { this.insertChild(this.children.length, c); },
      insertChild(i, c) { if (c.parent) c.parent.children.splice(c.parent.children.indexOf(c), 1); c.parent = this; this.children.splice(i, 0, c); },
      remove() { this.removed = true; if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); },
      setPluginData(k, v) { this.plugin[k] = v; }, getPluginData(k) { return this.plugin[k] || ''; },
      get absoluteBoundingBox() { return {x: this.x + (this.parent && this.parent.type === 'FRAME' ? this.parent.x : 0), y: this.y + (this.parent && this.parent.type === 'FRAME' ? this.parent.y : 0), width: this.width, height: this.height}; },
      get absoluteTransform() { return [[1, 0, this.x], [0, 1, this.y]]; }};
    return n;
  }
  const figma = {
    currentPage: Object.assign(page, {selection: []}),
    viewport: {center: {x: 0, y: 0}, zoom: 1, bounds: {x: 0, y: 0, width: 1600, height: 1000}, scrollAndZoomIntoView() {}},
    showUI() {}, notify() {}, commitUndo() {}, on() {}, clientStorage: {store: {}, async getAsync(k) { return this.store[k]; }, async setAsync(k, v) { this.store[k] = v; }},
    ui: {postMessage: m => posted.push(m), set onmessage(f) { uiHandler = f; }},
    loadFontAsync: async f => { if (f.style === 'Extra Bold') throw Error('missing'); },
    createFrame: () => node('FRAME'), createRectangle: () => node('RECTANGLE'), createEllipse: () => node('ELLIPSE'),
    createVector: () => node('VECTOR'), createNodeFromSvg: () => node('FRAME'),
    createText() { const n = node('TEXT'); Object.defineProperty(n, 'characters', {get() { return this._c || ''; }, set(v) { this._c = v; this.width = v.length * 7; }}); return n; }
  };
  const sandbox = vm.createContext({figma, __html__: '', Date: {now: () => clock}, setInterval: f => (tick = f, 1), clearInterval: () => { tick = null; }, console, process});
  vm.runInContext(read('plugin.js'), sandbox);
  return {figma, page, posted, send: m => uiHandler(m), runToEnd() { let g = 0; while (tick && g++ < 8000) { clock += 70; tick(); } }};
}
const tagged = f => f.children.filter(n => n.getPluginData('iris-layer'));

test('the Figma plugin builds every layer natively, tags it and cleans up its cursors', async () => {
  const F = mockFigma();
  const doc = Doc.fromBoard(Screens.checkBoard(Kit.build('Team task manager in emerald green'))), board = compile(doc);
  await F.send({kind: 'build', board, doc, count: 60, speed: 1});
  F.runToEnd();
  assert.ok(F.posted.some(m => m.kind === 'done'), JSON.stringify(F.posted.filter(m => m.kind === 'error')));
  const frames = F.page.children.filter(n => n.type === 'FRAME');
  assert.equal(frames.length, 7, 'seven screens and no leftover crew layer');
  for (const S of board.screens) {
    const f = frames.find(x => x.getPluginData('iris-screen') === S.id);
    assert.ok(f, S.name);
    assert.equal(JSON.stringify(f.children.map(n => n.getPluginData('iris-layer'))), JSON.stringify(S.layers.map(L => L.id)), 'every layer, in order');
    f.children.forEach((n, k) => {
      const L = S.layers[k];
      if (L.kind === 'text') assert.equal(n.characters, L.text);
      if (L.kind === 'rect' || L.kind === 'ellipse') { assert.equal(n.width, L.w); assert.equal(n.x, L.x); if (L.fill) assert.notEqual(JSON.stringify(n.fills), JSON.stringify([{type: 'SOLID', color: {r: 217 / 255, g: 217 / 255, b: 217 / 255}}])); }
    });
  }
  assert.ok(F.page.getPluginData('iris-doc'), 'the design is stored on the page');
});

test('two designs on one Figma page stay separate', async () => {
  const F = mockFigma();
  const a = Doc.fromBoard(Screens.checkBoard(Kit.build('budget'))), b = Doc.fromBoard(Screens.checkBoard(Kit.build('meal kit')));
  assert.notEqual(a.id, b.id);
  const ba = compile(a), bb = compile(b);
  await F.send({kind: 'build', board: ba, doc: a, count: 30}); F.runToEnd();
  await F.send({kind: 'build', board: bb, doc: b, count: 30}); F.runToEnd();
  const r = Doc.apply(a, [{op: 'set', id: a.screens[0].id, screen: {fill: '#000000'}}]);
  await F.send({kind: 'build', board: compile(r.doc), prev: ba, doc: r.doc, count: 30}); F.runToEnd();
  const frames = F.page.children.filter(n => n.type === 'FRAME');
  assert.equal(frames.length, 14);
  const first = d => frames.find(f => f.getPluginData('iris-design') === d.id && f.getPluginData('iris-screen') === d.screens[0].id);
  assert.deepEqual(JSON.parse(JSON.stringify(first(a).fills))[0].color, {r: 0, g: 0, b: 0});
  assert.notDeepEqual(JSON.parse(JSON.stringify(first(b).fills))[0].color, {r: 0, g: 0, b: 0}, 'the other design is untouched');
});

test('the Figma plugin applies an edit in place and can restore and read back the design', async () => {
  const F = mockFigma();
  const doc = sample(), before = compile(doc);
  await F.send({kind: 'build', board: before, doc, count: 40, speed: 1}); F.runToEnd();
  const frame = F.page.children.find(n => n.getPluginData('iris-screen') === 'home');
  const cardNode = tagged(frame).find(n => n.getPluginData('iris-layer') === 'card'), untouched = tagged(frame).find(n => n.getPluginData('iris-layer') === 'hello');
  // Someone retypes the greeting by hand in Figma.
  untouched.characters = 'Hi there';
  F.posted.length = 0;
  await F.send({kind: 'readback', id: 7, design: doc.id});
  const read = F.posted.find(m => m.kind === 'readback').read;
  const merged = Doc.merge(doc, before, read);
  assert.equal(merged.doc.nodes.find(n => n.id === 'hello').text, 'Hi there');
  const base = compile(merged.doc);
  const r = Doc.apply(merged.doc, [{op: 'set', id: 'card', node: {fill: '#15151E', fill2: null}}, {op: 'remove', id: 'tile4'}, {op: 'add', parent: 'home', before: 'grid', node: {id: 'qa', type: 'text', name: 'Quick actions', text: 'Quick actions', size: 18, weight: 700, color: '#15151E'}}]);
  const after = compile(r.doc);
  F.posted.length = 0;
  await F.send({kind: 'build', board: after, prev: base, doc: r.doc, count: 40, speed: 1}); F.runToEnd();
  assert.ok(F.posted.some(m => m.kind === 'done'), JSON.stringify(F.posted.filter(m => m.kind === 'error')));
  const frames = F.page.children.filter(n => n.type === 'FRAME');
  assert.equal(frames.length, 1, 'no extra frames');
  assert.equal(tagged(frame).find(n => n.getPluginData('iris-layer') === 'card'), cardNode, 'the existing card node was edited, not replaced');
  assert.deepEqual(JSON.parse(JSON.stringify(cardNode.fills)), [{type: 'SOLID', color: {r: 21 / 255, g: 21 / 255, b: 30 / 255}}]);
  assert.ok(!tagged(frame).some(n => n.getPluginData('iris-layer') === 'tile4'), 'removed tile is gone');
  assert.equal(tagged(frame).find(n => n.getPluginData('iris-layer') === 'hello').characters, 'Hi there', 'the manual edit survives');
  assert.equal(JSON.stringify(frame.children.map(n => n.getPluginData('iris-layer'))), JSON.stringify(after.screens[0].layers.map(L => L.id)), 'stacking order matches the new design');
  // Reopening the plugin offers the stored design back to the UI.
  F.posted.length = 0;
  await F.send({kind: 'ui-ready'});
  const restored = F.posted.find(m => m.kind === 'restore');
  assert.ok(restored && restored.doc.nodes.some(n => n.id === 'qa'));
});
