/* Figma side: plays the crew timeline with real, editable Figma layers.
   Frames are dragged out, shapes drawn and filled, corners rounded, cards aligned and text
   typed by visible cursor layers. Every node is tagged with its design id, so later changes
   only touch what changed, and the design is stored on the page so it can be edited again. */
figma.showUI(__html__, {width: 380, height: 760, themeColors: false});

const STYLES = {100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black'};
const ARROW = 'M0 0L0 16.2L4.4 12.1L7.4 18.8L10.2 17.6L7.3 11L13 11Z';
const SCREEN_KEY = 'iris-screen', LAYER_KEY = 'iris-layer', DESIGN_KEY = 'iris-design', DOC_KEY = 'iris-doc';
let run = null;

const rgb = hex => ({r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255});
const toHex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const solid = hex => ({type: 'SOLID', color: rgb(hex)});
const light = hex => { const c = rgb(hex); return c.r * .299 + c.g * .587 + c.b * .114 > .62; };
function paints(f) {
  if (!f) return [];
  if (typeof f === 'string') return [solid(f)];
  return [{type: 'GRADIENT_LINEAR', gradientTransform: f.dir === 'v' ? [[0, 1, 0], [-1, 0, 1]] : [[.5, .5, 0], [-.5, .5, .5]],
    gradientStops: [{position: 0, color: Object.assign(rgb(f.from), {a: 1})}, {position: 1, color: Object.assign(rgb(f.to), {a: 1})}]}];
}
const post = m => figma.ui.postMessage(m);
const key = v => JSON.stringify(v === undefined ? null : v);

async function loadFont(weight) {
  for (const style of [STYLES[weight] || 'Regular', weight >= 600 ? 'Bold' : 'Regular']) {
    try { await figma.loadFontAsync({family: 'Inter', style}); return style; } catch (e) { /* try the fallback */ }
  }
  throw Error('The Inter font is not available in this file.');
}

// Figma limits a plugin-data value to 100 kB. Publish the index after every chunk
// has been written so a reopened design always points to a complete revision.
function storeDocument(page,doc) {
  const raw=JSON.stringify(doc), old=page.getPluginData(DOC_KEY);
  let previous; try {previous=JSON.parse(old);} catch {}
  if(raw.length<=20000) page.setPluginData(DOC_KEY,raw);
  else {
    const prefix='iris-doc-'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)+'-';
    const count=Math.ceil(raw.length/20000);
    for(let i=0;i<count;i++)page.setPluginData(prefix+i,raw.slice(i*20000,(i+1)*20000));
    page.setPluginData(DOC_KEY,JSON.stringify({prefix,count}));
  }
  if(previous?.prefix?.startsWith('iris-doc-') && Number.isInteger(previous.count))
    for(let i=0;i<previous.count;i++)page.setPluginData(previous.prefix+i,'');
}
function readDocument(page) {
  const raw=page.getPluginData(DOC_KEY);if(!raw)return null;
  const index=JSON.parse(raw);if(index.screens)return index;
  if(!index.prefix?.startsWith('iris-doc-') || !Number.isInteger(index.count) || index.count<1 || index.count>1000)return null;
  let value='';for(let i=0;i<index.count;i++)value+=page.getPluginData(index.prefix+i);
  return JSON.parse(value);
}

// Find what Iris built earlier for this design, by the ids stored on each node.
function scan(design) {
  const frames = new Map(), nodes = new Map();
  for (const f of VaultSections.taggedFrames(figma.currentPage)) {
    if (f.type !== 'FRAME') continue;
    const sid = f.getPluginData(SCREEN_KEY);
    if (!sid || f.getPluginData(DESIGN_KEY) !== design) continue;
    frames.set(sid, f);
    for (const n of f.children) { const lid = n.getPluginData(LAYER_KEY); if (lid) nodes.set(sid + '/' + lid, n); }
  }
  return {frames, nodes};
}

async function start(m) {
  if (run) finish(true);
  const board = Screens.checkBoard(m.board, true), prev = m.prev ? Screens.checkBoard(m.prev, true) : null;
  for (const s of [...board.screens, ...(prev ? prev.screens : [])]) { const c = rgb(s.background); s.dark = (c.r + c.g + c.b) / 3 < .4; }
  const P = Crew.plan(board, Math.min(250, m.count || 100), {prev});
  const fonts = {};
  const weights = new Set([600]);
  for (const s of [...board.screens, ...(prev ? prev.screens : [])]) for (const L of s.layers) if (L.kind === 'text') weights.add(L.weight);
  for (const w of weights) fonts[w] = await loadFont(w);

  const design = (m.doc && m.doc.id) || board.id || 'design';
  const found = scan(design), page = figma.currentPage, B = P.bounds;
  let dx, dy;
  const anchor = board.screens.concat(prev ? prev.screens : []).find(s => found.frames.has(s.id));
  if (prev && anchor) { const f = found.frames.get(anchor.id); dx = f.absoluteTransform[0][2] - anchor.x; dy = f.absoluteTransform[1][2] - anchor.y; }
  else {
    let ox = Math.round(figma.viewport.center.x - B.w / 2), oy = Math.round(figma.viewport.center.y - B.h / 2);
    const existing = page.children.map(n => n.absoluteBoundingBox).filter(Boolean);
    if (existing.length) { ox = Math.max(...existing.map(b => b.x + b.width)) + 400; oy = Math.min(...existing.map(b => b.y)); }
    dx = ox - B.x; dy = oy - B.y;
  }
  if(m.libraryId) {
    const at=VaultSections.position(VaultSections.checkImport(m.libraryId));dx=at.x+64;dy=at.y+102;
  }
  const imageHashes=new Map();
  for(const s of [...board.screens,...(prev?prev.screens:[])]) for(const layer of s.layers) {
    if(!layer.art || !layer.art.includes('/v3/') || imageHashes.has(layer.art))continue;
    const png=m.images && m.images[layer.art];
    if(!png && m.doc?.reference?.original && prev){
      const existing=found.nodes.get(s.id+'/'+layer.id);
      const stored=existing?.fills?.find?.(fill=>fill.type==='IMAGE' && fill.imageHash);
      if(stored){imageHashes.set(layer.art,stored.imageHash);continue;}
    }
    if(!png)throw Error('The vault artwork is missing. Reopen the updated Iris plugin.');
    imageHashes.set(layer.art,figma.createImage(figma.base64Decode(png)).hash);
  }
  const captureHash=m.png?figma.createImage(figma.base64Decode(m.png)).hash:null;
  // A fresh build never reuses frames from an older design on the page.
  if (!prev) { found.frames.clear(); found.nodes.clear(); }

  const crewLayer = figma.createFrame();
  crewLayer.name = 'Iris · crew (temporary)'; crewLayer.fills = []; crewLayer.clipsContent = false;
  crewLayer.resize(1, 1); crewLayer.x = dx; crewLayer.y = dy; crewLayer.locked = true;
  page.appendChild(crewLayer);

  if (!prev) {
    const view = figma.viewport.bounds;
    figma.viewport.center = {x: dx + B.x + B.w / 2, y: dy + B.y + B.h / 2};
    figma.viewport.zoom = figma.viewport.zoom * Math.min(view.width / (B.w * 1.12), view.height / (B.h * 1.12));
  }

  // Board order of every layer, used to keep Figma's stacking order in step.
  const order = new Map();
  P.screens.forEach(E => { for (let li = E.range[0]; li < E.range[1]; li++) order.set(E.S.id + '/' + P.layers[li].L.id, li); });
  run = {P, board, prev, design, imageHashes, captureHash, libraryId:m.libraryId, doc: m.doc, dx, dy, fonts, crewLayer, t: 0, speed: m.speed || 1, paused: false, last: Date.now(), lastPost: 0,
    frames: found.frames, nodes: found.nodes, cache: new Map(), order, cursors: [], cursorScale: 1};
  run.timer = setInterval(step, 70);
  post({kind: 'tick', t: 0, state: 'running'});
}

function step() {
  const r = run; if (!r) return;
  try {
    const now = Date.now();
    if (!r.paused) r.t = Math.min(r.P.total, r.t + (now - r.last) / 1000 * r.speed);
    r.last = now;
    apply(r, r.t);
    if (now - r.lastPost > 120) { r.lastPost = now; post({kind: 'tick', t: r.t, state: r.paused ? 'paused' : 'running'}); }
    if (r.t >= r.P.total) finish(false);
  } catch (e) {
    stop(); if (typeof process !== 'undefined' && process.env && process.env.IRIS_DEBUG) console.error(e); post({kind: 'error', text: 'The crew stopped: ' + (e && e.message || e)});
  }
}

function apply(r, t) {
  const {P, dx, dy} = r;
  P.screens.forEach((E, si) => {
    const S = E.S, st = Crew.screenAt(P, si, t);
    let f = r.frames.get(S.id);
    if (!st) { if (E.ghost && f && !f.removed) { f.remove(); r.frames.delete(S.id); } return; }
    if (!f || f.removed) {
      f = figma.createFrame(); f.name = S.name; f.fills = [solid('#FFFFFF')]; f.clipsContent = true;
      f.x = S.x + dx; f.y = S.y + dy; f.setPluginData(SCREEN_KEY, S.id); f.setPluginData(DESIGN_KEY, r.design);
      figma.currentPage.insertChild(figma.currentPage.children.indexOf(r.crewLayer), f);
      r.frames.set(S.id, f);
    }
    if (f.name !== S.name && !E.ghost) f.name = S.name;
    const w = Math.max(1, Math.round(st.w)), h = Math.max(1, Math.round(st.h));
    if (f.width !== w || f.height !== h) f.resize(w, h);
    const bg = st.paint >= .45 ? st.paintTo : st.paintFrom, c = r.cache.get('screen/' + S.id) || {};
    if (c.bg !== bg) { f.fills = [solid(bg)]; c.bg = bg; r.cache.set('screen/' + S.id, c); }
    if (E.ghost) f.opacity = Math.max(0, st.alpha);
    for (let li = E.range[0]; li < E.range[1]; li++) {
      const ref = P.layers[li], ls = Crew.layerAt(P, li, t), id = S.id + '/' + ref.L.id;
      if (!ls) { const n = r.nodes.get(id); if (ref.ghost && n && !n.removed) { n.remove(); r.nodes.delete(id); } continue; }
      if (E.ghost) continue;
      layer(r, f, S, ref, ls, li);
    }
  });
  cursors(r, t);
}

function place(r, f, S, li, n) {
  // Insert just above the last tagged sibling that comes earlier on the board.
  let at = 0;
  f.children.forEach((c, i) => { const lid = c.getPluginData(LAYER_KEY); const k = lid ? r.order.get(S.id + '/' + lid) : undefined; if (k !== undefined && k < li) at = i + 1; });
  f.insertChild(Math.min(at, f.children.length), n);
}

function makeNode(r, L, ls) {
  let n;
  if (L.kind === 'text') { n = figma.createText(); n.textAutoResize = 'WIDTH_AND_HEIGHT'; }
  else if (Websites.artwork(L.art)) {
    n = figma.createVector();
    n.vectorPaths = [{windingRule:'EVENODD',data:Websites.artwork(L.art).path}]; n.strokes = [];
    n.setPluginData('iris-art',L.art);
  }
  else if (L.kind === 'line') { n = figma.createVector(); n.fills = []; n.strokeCap = 'ROUND'; n.strokeJoin = 'ROUND'; }
  else if (L.kind === 'icon') { n = figma.createNodeFromSvg(Icons.svg(ls.icon, 24, ls.color, L.sw || 2)); n.clipsContent = false; if (L.w !== 24) n.rescale(L.w / 24); }
  else n = L.kind === 'ellipse' ? figma.createEllipse() : figma.createRectangle();
  return n;
}

function layer(r, f, S, ref, ls, li) {
  const L = ref.L, id = S.id + '/' + L.id;
  let n = r.nodes.get(id), c = r.cache.get(id);
  if (n && n.removed) n = null;
  if (!c) { c = {}; r.cache.set(id, c); }
  const wantType = L.kind === 'text' ? 'TEXT' : L.kind === 'line' || Websites.artwork(L.art) ? 'VECTOR' : L.kind === 'icon' ? 'FRAME' : L.kind === 'ellipse' ? 'ELLIPSE' : 'RECTANGLE';
  // Icons are rebuilt when their glyph or colour changes; any node of the wrong type is replaced.
  if (n && (n.type !== wantType || (n.type === 'VECTOR' && (n.getPluginData('iris-art') || '') !== (L.art || '')) || (L.kind === 'icon' && c.glyph !== undefined && c.glyph !== ls.icon + ls.color) || (L.kind === 'icon' && c.glyph === undefined && ref.prev && (ref.prev.icon !== ls.icon || ref.prev.stroke !== ls.color)))) { n.remove(); n = null; }
  if (!n) {
    n = makeNode(r, L, ls); n.name = L.name; n.setPluginData(LAYER_KEY, L.id);
    place(r, f, S, li, n); r.nodes.set(id, n);
    for (const k of Object.keys(c)) delete c[k];
  }
  if (L.kind === 'icon') c.glyph = ls.icon + ls.color;
  if (n.name !== L.name) n.name = L.name;
  const opacity = Math.round((L.opacity === undefined ? 1 : L.opacity) * ls.alpha * (L.kind === 'icon' ? Math.min(1, ls.scale) : 1) * 100) / 100;
  if (c.opacity !== opacity) { n.opacity = Math.max(0, Math.min(1, opacity)); c.opacity = opacity; }
  const b = ls.box, exact = ls.final && ls.alpha === 1;

  if (L.kind === 'text') {
    const T = ls.layer, chars = Math.max(1, ls.chars), stamp = key([ls.text.slice(0, chars), T.size, T.weight, T.lh, T.align, ls.color, exact ? 'final' : [Math.round(b.x), Math.round(b.y), Math.round(b.w)]]);
    if (c.text === stamp) return;
    c.text = stamp;
    n.fontName = {family: 'Inter', style: r.fonts[T.weight] || r.fonts[600]};
    n.fontSize = T.size; n.lineHeight = {unit: 'PERCENT', value: T.lh * 100};
    n.letterSpacing = {unit: 'PERCENT', value: T.size >= 28 ? -2 : 0};
    n.textAlignHorizontal = T.align === 'center' ? 'CENTER' : T.align === 'right' ? 'RIGHT' : 'LEFT';
    if(r.doc?.reference?.kind==='html-css'){
      n.textAutoResize='HEIGHT';
      n.resize(Math.max(1,b.w),Math.max(1,b.h));
    }
    n.characters = ls.text.slice(0, chars);
    n.fills = [solid(ls.color)];
    n.x = T.align === 'center' ? b.x + (b.w - n.width) / 2 : T.align === 'right' ? b.x + b.w - n.width : b.x;
    n.y = b.y;
    return;
  }
  if (L.kind === 'line') {
    const stamp = key([Math.round(ls.trace * 60), ls.color, L.sw]);
    if (c.line === stamp) return;
    c.line = stamp;
    n.strokes = [solid(ls.color)]; n.strokeWeight = L.sw;
    const pts = ls.pts || ref.pts, at = Crew.polyPoint(pts, ls.trace), end = ls.trace >= 1 ? pts.length - 1 : at.index;
    const path = pts.slice(0, end + 1).map(p => ({x: p.x - S.x, y: p.y - S.y}));
    if (ls.trace < 1) path.push({x: at.x - S.x, y: at.y - S.y});
    if (path.length < 2) path.push({x: path[0].x + .01, y: path[0].y});
    n.vectorPaths = [{windingRule: 'NONE', data: path.map((p, i) => (i ? 'L ' : 'M ') + p.x.toFixed(2) + ' ' + p.y.toFixed(2)).join(' ')}];
    // Re-anchor so the geometry sits where the path says, however Figma normalises it.
    const bb = n.absoluteBoundingBox, fb = f.absoluteTransform;
    if (bb) { n.x += fb[0][2] + Math.min(...path.map(p => p.x)) - bb.x; n.y += fb[1][2] + Math.min(...path.map(p => p.y)) - bb.y; }
    return;
  }
  if (L.kind === 'icon') {
    const where = exact ? 'final' : key([Math.round(b.x * 2), Math.round(b.y * 2)]);
    if (c.box !== where) { c.box = where; n.x = b.x; n.y = b.y; }
    return;
  }
  const where = exact ? 'final' : [b.x, b.y, b.w, b.h].map(v => Math.round(v * 2) / 2).join(',');
  if (c.box !== where) { c.box = where; n.resize(Math.max(.5, b.w), Math.max(.5, b.h)); n.x = b.x; n.y = b.y; }
  const paint = ls.fill >= .45 ? ls.fillTo : ls.fillFrom, look = key([L.art, paint, L.stroke, L.sw, L.shadow, S.dark]);
  if (c.look !== look) {
    c.look = look;
    const placeholder = paint === Crew.PLACEHOLDER;
    const hash=r.imageHashes.get(L.art);
    n.fills = hash ? [{type:'IMAGE',imageHash:hash,scaleMode:'FILL'}] : L.fill || (paint && !placeholder) ? paints(paint) : [];
    if (L.stroke || (!L.fill && placeholder)) { n.strokes = [solid(placeholder && !L.fill ? Crew.PLACEHOLDER : L.stroke)]; n.strokeWeight = L.sw || 1; n.strokeAlign = 'CENTER'; } else n.strokes = [];
    n.effects = L.shadow && !placeholder ? [{type: 'DROP_SHADOW', color: S.dark ? {r: 0, g: 0, b: 0, a: .5} : {r: .086, g: .086, b: .19, a: .13}, offset: {x: 0, y: 10}, radius: 30, spread: 0, visible: true, blendMode: 'NORMAL', showShadowBehindNode: false}] : [];
  }
  if (n.type === 'RECTANGLE') { const rad = exact ? ls.radius : Math.round(ls.radius * 2) / 2; if (c.r !== rad) { c.r = rad; n.cornerRadius = rad; } }
}

function makeCursor(r, c) {
  const g = figma.createFrame(); g.name = 'Cursor · ' + c.name; g.fills = []; g.clipsContent = false; g.resize(14, 19);
  const arrow = figma.createNodeFromSvg('<svg xmlns="http://www.w3.org/2000/svg" width="14" height="20" viewBox="-0.7 -0.7 14.4 20.4"><path d="' + ARROW + '" fill="' + c.color + '" stroke="#FFFFFF" stroke-width="1.4" stroke-linejoin="round"/></svg>');
  arrow.fills = []; g.appendChild(arrow); arrow.x = -.7; arrow.y = -.7;
  const chip = figma.createFrame(); chip.name = 'Name'; chip.layoutMode = 'HORIZONTAL'; chip.primaryAxisSizingMode = 'AUTO'; chip.counterAxisSizingMode = 'AUTO';
  chip.paddingLeft = chip.paddingRight = 6; chip.paddingTop = chip.paddingBottom = 3; chip.cornerRadius = 5; chip.fills = [solid(c.color)];
  const label = figma.createText(); label.fontName = {family: 'Inter', style: r.fonts[600]}; label.fontSize = 10.5; label.characters = c.name; label.fills = [solid(light(c.color) ? '#101014' : '#FFFFFF')];
  chip.appendChild(label); g.appendChild(chip); chip.x = 11; chip.y = 16;
  r.crewLayer.appendChild(g);
  if (r.cursorScale !== 1) g.rescale(r.cursorScale);
  return g;
}

function cursors(r, t) {
  const scale = 1 / Math.max(.02, figma.viewport.zoom);
  if (scale / r.cursorScale > 1.2 || scale / r.cursorScale < .83) {
    for (const g of r.cursors) if (g && !g.removed) g.rescale(scale / r.cursorScale);
    r.cursorScale = scale;
  }
  for (const c of r.P.crew) {
    const s = Crew.cursorAt(r.P, c, t);
    let g = r.cursors[c.id];
    if (!s) { if (g && g.visible) g.visible = false; continue; }
    if (!g) g = r.cursors[c.id] = makeCursor(r, c);
    if (!g.visible) g.visible = true;
    const x = Math.round(s.x * 2) / 2, y = Math.round(s.y * 2) / 2;
    if (g.x !== x) g.x = x;
    if (g.y !== y) g.y = y;
    const a = Math.round(s.alpha * 10) / 10;
    if (g.opacity !== a) g.opacity = a;
  }
}

function stop() {
  const r = run; if (!r) return null;
  clearInterval(r.timer); run = null;
  if (!r.crewLayer.removed) r.crewLayer.remove();
  return r;
}

// Jump to the end state, put every layer in board order and remember the design on the page.
function finish(silent) {
  const r = run; if (!r) return;
  apply(r, r.P.total);
  stop();
  for (const S of r.board.screens) {
    const f = r.frames.get(S.id); if (!f || f.removed) continue;
    S.layers.forEach((L, i) => { const n = r.nodes.get(S.id + '/' + L.id); if (n && !n.removed) f.insertChild(Math.min(i, f.children.length - 1), n); });
  }
  const frames = r.board.screens.map(S => r.frames.get(S.id)).filter(f => f && !f.removed);
  const section=VaultSections.organize(r,frames);
  if (r.doc && !r.libraryId) storeDocument(figma.currentPage,r.doc);
  figma.commitUndo();
  if (silent) return;
  if(r.libraryId) {VaultSections.next();return;}
  if (!r.prev) { figma.currentPage.selection = frames; figma.viewport.scrollAndZoomIntoView(section?[section]:frames); }
  figma.notify(r.prev ? 'Iris applied the change.' : 'Iris built ' + frames.length + ' editable screens.');
  post({kind: 'done', t: r.P.total});
}

// Cancelling a first build removes it; cancelling a change finishes it at once, so nothing is left half-edited.
function cancel() {
  const r = run; if (!r) return;
  if (r.prev) { finish(false); return; }
  stop();
  for (const f of r.frames.values()) if (f && !f.removed) f.remove();
  post({kind: 'cancelled'});
}

function readback(design) {
  const found = scan(design), nodes = [];
  for (const [id, n] of found.nodes) {
    if (n.removed) continue;
    const out = {id: id.slice(id.indexOf('/') + 1), x: n.x, y: n.y, w: n.width, h: n.height};
    const first = list => Array.isArray(list) && list[0] && list[0].type === 'SOLID' ? toHex(list[0].color) : undefined;
    if (n.type === 'TEXT') { out.text = n.characters; out.fill = first(n.fills); }
    else if (n.type === 'VECTOR') out.fill = first(n.getPluginData('iris-art') ? n.fills : n.strokes);
    else if (n.type === 'RECTANGLE' || n.type === 'ELLIPSE') out.fill = first(n.fills);
    nodes.push(out);
  }
  return {screens: [...found.frames.keys()], nodes};
}

figma.ui.onmessage = async m => {
  try {
    if (m.kind === 'ui-ready') {
      try { const k = await figma.clientStorage.getAsync('iris-key'); if (k) post({kind: 'key', key: k}); } catch (e) { /* storage unavailable */ }
      try {const doc=readDocument(figma.currentPage);if(doc && scan(doc.id).frames.size)post({kind:'restore',doc});} catch { /* ignore an incomplete record */ }
    } else if(m.kind==='library-open') await VaultSections.openLibrary();
    else if (m.kind === 'save-key') await figma.clientStorage.setAsync('iris-key', String(m.key || ''));
    else if (m.kind === 'build') await start(m);
    else if (m.kind === 'readback') post({kind: 'readback', id: m.id, read: run ? null : readback(m.design)});
    else if (m.kind === 'pause' && run) { run.paused = true; post({kind: 'tick', t: run.t, state: 'paused'}); }
    else if (m.kind === 'resume' && run) { run.paused = false; run.last = Date.now(); post({kind: 'tick', t: run.t, state: 'running'}); }
    else if (m.kind === 'speed' && run) run.speed = m.speed;
    else if (m.kind === 'cancel') cancel();
    else if (m.kind === 'open-url') figma.openExternal(String(m.url));
    else if (m.kind === 'look') {
      // Export the frame the designer is looking at (selection, climbed to its top-level frame) for the voice agent.
      try {
        const sel = figma.currentPage.selection[0];
        let f = sel;
        while (f && f.parent && f.parent.type !== 'PAGE') f = f.parent;
        if (!f || !('exportAsync' in f)) f = figma.currentPage.children.filter(n => n.type === 'FRAME').pop();
        if (!f) throw Error('Nothing is on this page yet. Select a frame or ask Iris to build one.');
        const img = await f.exportAsync({format: 'PNG', constraint: {type: 'WIDTH', value: Math.min(900, Math.max(320, Math.round(f.width)))}});
        const texts = [];
        if ('findAll' in f) for (const n of f.findAll(n => n.type === 'TEXT').slice(0, 40)) texts.push(n.characters.slice(0, 80));
        post({kind: 'look', id: m.id, png: figma.base64Encode(img), frame: {name: f.name, width: Math.round(f.width), height: Math.round(f.height)}, selected: figma.currentPage.selection.slice(0, 8).map(n => n.name), texts});
      } catch (e) { post({kind: 'look', id: m.id, error: String(e && e.message || e)}); }
    }
  } catch (e) { stop(); post({kind: 'error', text: String(e && e.message || e)}); }
};
figma.on('close', () => { if (run) finish(true); });
