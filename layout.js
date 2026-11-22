/* The design document: screens plus a flat list of nodes, each naming its parent.
   Frames lay out their children like flexbox (column, row, grid) or absolutely (stack),
   so a model only describes structure and spacing and the engine computes exact geometry.
   Every node keeps a stable id, which is what lets edits be applied as small patches. */
const Doc = (() => {
  const HEX = /^#[0-9a-f]{6}$/i;
  const TYPES = ['frame', 'text', 'icon', 'image', 'shape', 'line'];
  const copy = v => JSON.parse(JSON.stringify(v));
  const num = (v, d) => Number.isFinite(v) ? v : d;
  const hex = v => typeof v === 'string' && HEX.test(v) ? v.toUpperCase() : null;
  const paintOf = (n, key = 'fill') => {
    const a = hex(n[key]), b = key === 'fill' ? hex(n.fill2) : null;
    if (n[key] && typeof n[key] === 'object' && hex(n[key].from) && hex(n[key].to)) return {from: hex(n[key].from), to: hex(n[key].to), dir: n[key].dir === 'v' ? 'v' : 'd'};
    return a && b ? {from: a, to: b, dir: n.fillDir === 'v' ? 'v' : 'd'} : a;
  };

  /* ---------- text metrics (Inter-like estimate shared with the crew) ---------- */
  function charWidth(c) {
    if (' '.includes(c)) return .27;
    if ('ijl|!.,:;\'’`'.includes(c)) return .26;
    if ('frtI()[]{}"/-'.includes(c)) return .36;
    if ('mwMW@%'.includes(c)) return .84;
    if (c >= 'A' && c <= 'Z') return .66;
    if (c >= '0' && c <= '9') return .58;
    return .55;
  }
  const measure = (s, size, weight) => { let w = 0; for (const c of s) w += charWidth(c); return w * size * (weight >= 600 ? 1.05 : 1); };
  function wrap(text, size, weight, max) {
    const out = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const next = line ? line + ' ' + word : word;
        if (line && measure(next, size, weight) > max) { out.push(line); line = word; } else line = next;
      }
      out.push(line);
    }
    return out;
  }

  /* ---------- validation ---------- */
  function clean(doc) {
    const d = copy(doc || {}), ids = new Set(), warn = [];
    d.name = String(d.name || 'Untitled').slice(0, 60);
    // Each design gets its own id so several designs can live on one Figma page.
    if (typeof d.id !== 'string' || !d.id) d.id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    d.screens = (Array.isArray(d.screens) ? d.screens : []).filter(s => s && s.id).slice(0, 10).map(s => {
      s.id = String(s.id); s.w = Math.round(Math.min(1920, Math.max(240, num(s.w, 390)))); s.h = Math.round(Math.min(2400, Math.max(240, num(s.h, 844))));
      s.fill = hex(s.fill) || '#FFFFFF'; s.name = String(s.name || 'Screen').slice(0, 60); ids.add(s.id); return s;
    });
    if (!d.screens.length) throw Error('The design has no screens.');
    const nodes = Array.isArray(d.nodes) ? d.nodes : [];
    d.nodes = [];
    for (const n of nodes) {
      if (!n || !TYPES.includes(n.type)) { warn.push('dropped node of unknown type'); continue; }
      n.id = String(n.id || ''); if (!n.id || ids.has(n.id)) n.id = uid(ids, n.type);
      ids.add(n.id); n.name = String(n.name || n.text || n.icon || n.type).slice(0, 60); d.nodes.push(n);
    }
    const known = new Set([...d.screens.map(s => s.id), ...d.nodes.map(n => n.id)]);
    d.nodes = d.nodes.filter(n => { const ok = known.has(n.parent) && n.parent !== n.id; if (!ok) warn.push('dropped orphan ' + n.id); return ok; });
    // Break any parent cycles.
    const byId = new Map(d.nodes.map(n => [n.id, n])), screenIds = new Set(d.screens.map(s => s.id));
    d.nodes = d.nodes.filter(n => { let p = n.parent, hops = 0; while (!screenIds.has(p) && hops++ < 64) { const q = byId.get(p); if (!q) return false; p = q.parent; } return screenIds.has(p); });
    d.warnings = warn;
    return d;
  }
  function uid(ids, prefix) { let i = ids.size + 1, id; do id = prefix[0] + (i++).toString(36); while (ids.has(id)); return id; }

  /* ---------- layout ---------- */
  function pads(n) {
    const p = n.pad;
    if (Array.isArray(p)) { const [t, r = t, b = t, l = r] = p.map(v => num(v, 0)); return {t, r, b, l}; }
    const v = num(p, 0); return {t: v, r: v, b: v, l: v};
  }
  const kidsOf = (doc, id) => doc.nodes.filter(n => n.parent === id);

  // Returns a laid-out box: {n, w, h, kids: [{x, y, box}]} with positions relative to the box.
  function box(doc, n, availW, availH, parentLayout) {
    const t = n.type;
    const fixedW = Number.isFinite(n.w) ? n.w : null, fixedH = Number.isFinite(n.h) ? n.h : null;
    const wantFill = n.w === 'fill' || (n.w === undefined && parentLayout === 'column' && (t === 'frame' || t === 'image'));
    if (t === 'text') {
      const size = num(n.size, 16), weight = num(n.weight, 400), lh = num(n.lh, 1.3);
      const limit = fixedW ?? availW;
      const lines = n.displayText && n.measuredText===n.text ? n.displayText.split('\n') : n.wrap === false ? String(n.text).split('\n') : wrap(n.text, size, weight, Math.max(size, limit));
      const natural = Math.max(...lines.map(l => measure(l, size, weight)));
      const w = fixedW ?? (n.w === 'fill' || (n.w === undefined && parentLayout === 'column' && n.align && n.align !== 'left') ? availW : Math.min(availW, Math.ceil(natural + 1)));
      return {n, w, h: fixedH ?? Math.ceil(lines.length * size * lh), lines, kids: []};
    }
    if (t === 'icon') { const s = num(n.size, num(n.w, 20)); return {n, w: s, h: s, kids: []}; }
    if (t === 'shape' || t === 'line' || t === 'image') {
      const w = fixedW ?? (wantFill || n.w === 'fill' ? availW : 40), h = fixedH ?? (n.h === 'fill' ? availH : t === 'image' ? Math.round(w * .6) : 40);
      return {n, w, h, kids: []};
    }
    // frame
    const layout = ['row', 'grid', 'stack'].includes(n.layout) ? n.layout : 'column';
    const p = pads(n), gap = num(n.gap, 0), kids = kidsOf(doc, n.id);
    let W = fixedW ?? (wantFill ? availW : null);
    const innerAvail = (W ?? availW) - p.l - p.r;
    let placed = [], contentW = 0, contentH = 0;
    const H0 = fixedH ?? (n.h === 'fill' ? availH : null);
    if (layout === 'column') {
      const boxes = kids.map(k => box(doc, k, innerAvail, 0, 'column'));
      const grow = kids.map(k => k.h === 'fill' || k.grow === true);
      const used = boxes.reduce((s, b, i) => s + (grow[i] ? 0 : b.h), 0) + gap * Math.max(0, kids.length - 1);
      const growers = grow.filter(Boolean).length;
      if (H0 !== null && growers) {
        const each = Math.max(0, (H0 - p.t - p.b - used) / growers);
        boxes.forEach((b, i) => { if (grow[i]) Object.assign(b, box(doc, kids[i], innerAvail, each, 'column'), {h: each}); });
      }
      contentW = Math.max(0, ...boxes.map(b => b.w)); contentH = boxes.reduce((s, b) => s + b.h, 0) + gap * Math.max(0, kids.length - 1);
      const innerW = (W ?? contentW + p.l + p.r) - p.l - p.r, innerH = (H0 ?? contentH + p.t + p.b) - p.t - p.b;
      let y = p.t + justifyStart(n.justify, innerH - contentH, kids.length), extra = justifyGap(n.justify, innerH - contentH, kids.length);
      boxes.forEach((b, i) => {
        const k = kids[i], al = k.alignSelf || n.align || 'stretch';
        if (al === 'stretch' && k.w === undefined && (k.type === 'frame' || k.type === 'image') && b.w !== innerW) Object.assign(b, box(doc, k, innerW, b.h, 'column'));
        const x = p.l + (al === 'center' ? (innerW - b.w) / 2 : al === 'end' ? innerW - b.w : 0);
        placed.push({x, y, box: b}); y += b.h + gap + extra;
      });
    } else if (layout === 'row') {
      const grow = kids.map(k => k.w === 'fill' || k.grow === true);
      const boxes = kids.map((k, i) => grow[i] ? null : box(doc, k, innerAvail, 0, 'row'));
      const used = boxes.reduce((s, b) => s + (b ? b.w : 0), 0) + gap * Math.max(0, kids.length - 1);
      const growers = grow.filter(Boolean).length, each = growers ? Math.max(0, (innerAvail - used) / growers) : 0;
      kids.forEach((k, i) => { if (grow[i]) boxes[i] = box(doc, Object.assign({}, k, {w: each}), each, 0, 'row'); });
      // A row that overflows squeezes its text so it wraps instead of running off the edge.
      const over = boxes.reduce((s, b) => s + b.w, 0) + gap * Math.max(0, kids.length - 1) - innerAvail;
      const texts = kids.map((k, i) => k.type === 'text' && !grow[i] && !Number.isFinite(k.w) ? i : -1).filter(i => i >= 0);
      if (over > .5 && texts.length) {
        const room = texts.reduce((s, i) => s + boxes[i].w, 0);
        texts.forEach(i => { const w = Math.max(boxes[i].w * .3, boxes[i].w - over * boxes[i].w / room); boxes[i] = box(doc, Object.assign({}, kids[i], {w}), w, 0, 'row'); });
      }
      contentW = boxes.reduce((s, b) => s + b.w, 0) + gap * Math.max(0, kids.length - 1); contentH = Math.max(0, ...boxes.map(b => b.h));
      const innerW = (W ?? (growers ? innerAvail : contentW) + p.l + p.r) - p.l - p.r, innerH = (H0 ?? contentH + p.t + p.b) - p.t - p.b;
      if (W === null) W = innerW + p.l + p.r;
      let x = p.l + justifyStart(n.justify, innerW - contentW, kids.length), extra = justifyGap(n.justify, innerW - contentW, kids.length);
      boxes.forEach((b, i) => {
        const al = kids[i].alignSelf || n.align || 'center';
        if (al === 'stretch' && kids[i].h === undefined && kids[i].type === 'frame') Object.assign(b, box(doc, Object.assign({}, kids[i], {w: b.w, h: innerH}), b.w, innerH, 'row'));
        const y = p.t + (al === 'center' ? (innerH - b.h) / 2 : al === 'end' ? innerH - b.h : 0);
        placed.push({x, y, box: b}); x += b.w + gap + extra;
      });
    } else if (layout === 'grid') {
      const cols = Math.max(1, Math.round(num(n.cols, 2))), cellW = (innerAvail - gap * (cols - 1)) / cols;
      const boxes = kids.map(k => box(doc, Object.assign({}, k, k.w === undefined ? {w: 'fill'} : {}), cellW, 0, 'column'));
      let y = p.t;
      for (let r = 0; r < boxes.length; r += cols) {
        const row = boxes.slice(r, r + cols), rh = Math.max(...row.map(b => b.h));
        row.forEach((b, c) => placed.push({x: p.l + c * (cellW + gap), y, box: b}));
        y += rh + gap;
      }
      contentW = innerAvail; contentH = Math.max(0, y - gap - p.t);
      if (W === null) W = innerAvail + p.l + p.r;
    } else {
      const boxes = kids.map(k => box(doc, k, innerAvail, H0 ?? availH, 'stack'));
      boxes.forEach((b, i) => placed.push({x: num(kids[i].x, 0), y: num(kids[i].y, 0), box: b}));
      contentW = Math.max(0, ...placed.map(q => q.x + q.box.w)); contentH = Math.max(0, ...placed.map(q => q.y + q.box.h));
    }
    const w = W ?? contentW + p.l + p.r, h = H0 ?? contentH + p.t + p.b;
    return {n, w, h, kids: placed};
  }
  function justifyStart(j, free, count) { if (free <= 0) return 0; return j === 'center' ? free / 2 : j === 'end' ? free : 0; }
  function justifyGap(j, free, count) { return j === 'between' && count > 1 && free > 0 ? free / (count - 1) : 0; }

  /* ---------- compile to the primitive board ---------- */
  const r2 = v => Math.round(v * 100) / 100;
  function emit(b, x, y, out) {
    const n = b.n, base = {id: n.id, name: n.name, x: r2(x), y: r2(y), w: r2(Math.max(.5, b.w)), h: r2(Math.max(.5, b.h))};
    if (Number.isFinite(n.opacity) && n.opacity < 1) base.opacity = Math.max(0, n.opacity);
    const extras = o => { if (num(n.r, 0) > 0) o.r = n.r; if (hex(n.stroke)) { o.stroke = hex(n.stroke); o.sw = num(n.sw, 1); } if (n.shadow) o.shadow = true; return o; };
    if (n.type === 'text') out.push(Object.assign(base, {kind: 'text', text: b.lines.join('\n') || ' ', size: num(n.size, 16), weight: Math.round(num(n.weight, 400) / 100) * 100, fill: hex(n.color) || hex(n.fill) || '#15151E', align: ['center', 'right'].includes(n.align) ? n.align : 'left', lh: num(n.lh, 1.3)}));
    else if (n.type === 'icon') out.push(Object.assign(base, {kind: 'icon', icon: Icons.resolve(n.icon), stroke: hex(n.color) || hex(n.fill) || '#15151E', sw: num(n.sw, 2), fill: null}));
    else if (n.type === 'line') out.push(Object.assign(base, {kind: 'line', points: n.points, stroke: hex(n.color) || hex(n.stroke) || '#15151E', sw: num(n.sw, 2.5), fill: null}));
    else if (n.type === 'image') {
      out.push(extras(Object.assign(base, {kind: 'rect', fill: paintOf(n) || {from: '#E4E4EC', to: '#CFCFDC', dir: 'd'}})));
      const s = Math.max(12, Math.min(40, Math.min(b.w, b.h) * .28));
      out.push({id: n.id + '~icon', name: n.name + ' icon', kind: 'icon', icon: 'image', stroke: hex(n.color) || '#FFFFFF', sw: 2, fill: null, x: r2(x + (b.w - s) / 2), y: r2(y + (b.h - s) / 2), w: s, h: s, opacity: .85});
    } else if (n.type === 'shape') out.push(extras(Object.assign(base, n.art ? {art:n.art} : {}, {kind: n.shape === 'ellipse' ? 'ellipse' : 'rect', fill: paintOf(n)})));
    else if (paintOf(n) || hex(n.stroke)) out.push(extras(Object.assign(base, {kind: 'rect', fill: paintOf(n)})));
    for (const k of b.kids) emit(k.box, x + k.x, y + k.y, out);
  }

  function compile(raw) {
    const doc = clean(raw);
    const screens = doc.screens.map(s => {
      const root = Object.assign({}, s, {type: 'frame', w: s.w, h: s.h, fill: null, stroke: null, r: 0, shadow: false});
      const b = box(doc, root, s.w, s.h, null), layers = [];
      emit(b, 0, 0, layers);
      for (const L of layers) if (L.kind === 'line' && !(Array.isArray(L.points) && L.points.length >= 2)) L.points = [[0, .5], [1, .5]];
      const out = {id: s.id, name: s.name, width: s.w, height: s.h, background: s.fill, layers: layers.filter(L => L.kind !== 'rect' && L.kind !== 'ellipse' || L.fill || L.stroke)};
      if (Number.isFinite(s.bx) && Number.isFinite(s.by)) { out.x = s.bx; out.y = s.by; }
      return out;
    });
    return {id: doc.id, name: doc.name, screens};
  }
  // Remember where each screen landed on the board so later edits don't shuffle the canvas.
  function pin(doc, board) { for (const s of doc.screens) { const b = board.screens.find(x => x.id === s.id); if (b) { s.bx = b.x; s.by = b.y; } } return doc; }

  /* ---------- patches ---------- */
  const NODE_KEYS = ['name', 'layout', 'gap', 'pad', 'align', 'alignSelf', 'justify', 'cols', 'w', 'h', 'x', 'y', 'grow', 'fill', 'fill2', 'fillDir', 'stroke', 'sw', 'r', 'shadow', 'opacity', 'text', 'size', 'weight', 'color', 'lh', 'wrap', 'icon', 'shape', 'points', 'art', 'copyRole', 'slot', 'displayText', 'measuredText'];
  const SCREEN_KEYS = ['vaultSource', 'name', 'w', 'h', 'fill', 'layout', 'gap', 'pad', 'align', 'justify'];
  function pick(src, keys) { const o = {}; for (const k of keys) if (src && src[k] !== undefined && src[k] !== null) o[k] = src[k]; return o; }
  function subtree(doc, id) { const out = new Set([id]); let grew = true; while (grew) { grew = false; for (const n of doc.nodes) if (out.has(n.parent) && !out.has(n.id)) { out.add(n.id); grew = true; } } return out; }
  function apply(doc0, ops) {
    const doc = copy(doc0), applied = [], skipped = [];
    const ids = new Set([...doc.screens.map(s => s.id), ...doc.nodes.map(n => n.id)]);
    const find = id => doc.nodes.find(n => n.id === id);
    const insert = (n, before) => {
      const at = before ? doc.nodes.findIndex(x => x.id === before && x.parent === n.parent) : -1;
      if (at >= 0) doc.nodes.splice(at, 0, n); else doc.nodes.push(n);
    };
    for (const op of ops || []) {
      try {
        if (op.op === 'set') {
          const s = doc.screens.find(x => x.id === op.id);
          if (s) { Object.assign(s, pick(op.screen || (op.node && op.node.screen) || op.node, SCREEN_KEYS)); applied.push(op); continue; }
          const n = find(op.id); if (!n) throw Error('no node ' + op.id);
          // null or an empty string clears a property (for example fill2 removes a gradient).
          for (const k of NODE_KEYS) if (op.node && k in op.node) { const v = op.node[k]; if (v === null || v === '') delete n[k]; else n[k] = v; }
          if (op.node && TYPES.includes(op.node.type)) n.type = op.node.type; applied.push(op);
        } else if (op.op === 'add') {
          const n = Object.assign(pick(op.node, NODE_KEYS), {type: op.node && op.node.type, parent: op.parent || (op.node && op.node.parent)});
          if (!TYPES.includes(n.type) || !ids.has(n.parent)) throw Error('bad add');
          n.id = op.node.id && !ids.has(op.node.id) ? String(op.node.id) : uid(ids, n.type); ids.add(n.id);
          if (!n.name) n.name = n.text || n.icon || n.type;
          insert(n, op.before); applied.push(op);
        } else if (op.op === 'remove' || op.op === 'removeScreen') {
          if (doc.screens.some(s => s.id === op.id)) { const gone = subtree(doc, op.id); doc.screens = doc.screens.filter(s => s.id !== op.id); doc.nodes = doc.nodes.filter(n => !gone.has(n.id)); applied.push(op); continue; }
          if (!find(op.id)) throw Error('no node ' + op.id);
          const gone = subtree(doc, op.id); doc.nodes = doc.nodes.filter(n => !gone.has(n.id)); applied.push(op);
        } else if (op.op === 'move') {
          const n = find(op.id), parent = op.parent || n && n.parent;
          if (!n || !ids.has(parent) || subtree(doc, n.id).has(parent)) throw Error('bad move');
          doc.nodes.splice(doc.nodes.indexOf(n), 1); n.parent = parent; insert(n, op.before); applied.push(op);
        } else if (op.op === 'addScreen') {
          const s = Object.assign(pick(op.screen, SCREEN_KEYS), {id: op.screen && op.screen.id && !ids.has(op.screen.id) ? String(op.screen.id) : uid(ids, 'screen')});
          ids.add(s.id); doc.screens.push(s); applied.push(op);
        } else throw Error('unknown op ' + op.op);
      } catch (e) { skipped.push({op, why: e.message}); }
    }
    return {doc: clean(doc), applied, skipped};
  }

  /* ---------- import a primitive board (local kit) as a document ---------- */
  function fromBoard(board) {
    const doc = {name: board.name, screens: [], nodes: []};
    let k = 0;
    board.screens.forEach((S, si) => {
      const sid = 's' + (si + 1);
      doc.screens.push({id: sid, name: S.name, w: S.width, h: S.height, fill: S.background, layout: 'stack'});
      const L = S.layers, parent = L.map(() => -1), ids = L.map(() => 'n' + (++k).toString(36));
      const inside = (a, b) => b.x >= a.x - 1 && b.y >= a.y - 1 && b.x + b.w <= a.x + a.w + 1 && b.y + b.h <= a.y + a.h + 1;
      // Nest only contiguous runs, so the document keeps the original stacking order.
      const under = (k, j) => { while (k >= 0) { if (k === j) return true; k = parent[k]; } return false; };
      L.forEach((l, i) => {
        for (let j = i - 1; j >= 0; j--) {
          if (!(L[j].kind === 'rect' && L[j].fill && inside(L[j], l) && L[j].w * L[j].h > l.w * l.h * 1.05)) continue;
          let ok = true; for (let m = j + 1; m < i && ok; m++) ok = under(m, j);
          if (ok) { parent[i] = j; break; }
        }
      });
      const hasKids = L.map((_, i) => parent.includes(i));
      L.forEach((l, i) => {
        const p = parent[i], ox = p >= 0 ? L[p].x : 0, oy = p >= 0 ? L[p].y : 0;
        const n = {id: ids[i], parent: p >= 0 ? ids[p] : sid, name: l.name, x: l.x - ox, y: l.y - oy, w: l.w, h: l.h};
        if (l.opacity !== undefined) n.opacity = l.opacity;
        if (l.kind === 'text') Object.assign(n, {type: 'text', text: l.text, size: l.size, weight: l.weight, color: l.fill, align: l.align, lh: l.lh, wrap: false});
        else if (l.kind === 'line') Object.assign(n, {type: 'line', points: l.points, color: l.stroke, sw: l.sw});
        else if (l.kind === 'icon') Object.assign(n, {type: 'icon', icon: l.icon, color: l.stroke, size: l.w});
        else {
          Object.assign(n, {type: hasKids[i] ? 'frame' : 'shape', layout: hasKids[i] ? 'stack' : undefined, shape: l.kind === 'ellipse' ? 'ellipse' : undefined, fill: l.fill || undefined});
          if (l.r) n.r = l.r; if (l.stroke) { n.stroke = l.stroke; n.sw = l.sw; } if (l.shadow) n.shadow = true;
        }
        for (const key of Object.keys(n)) if (n[key] === undefined) delete n[key];
        doc.nodes.push(n);
      });
    });
    return clean(doc);
  }

  /* ---------- fold manual edits made in Figma back into the document ---------- */
  function merge(doc0, board, read) {
    const doc = copy(doc0), notes = [];
    const byId = new Map(doc.nodes.map(n => [n.id, n])), list = read.nodes || [], seen = new Set(list.map(r => r.id)), present = new Set(read.screens || []);
    for (const S of board.screens) for (const L of S.layers) {
      if (L.id.includes('~')) continue;
      const n = byId.get(L.id); if (!n) continue;
      if (!seen.has(L.id)) { if (present.has(S.id)) { doc.nodes = doc.nodes.filter(x => !subtree(doc, n.id).has(x.id)); notes.push('removed ' + n.name); } continue; }
      const r = list.find(x => x.id === L.id);
      if (L.kind === 'text' && typeof r.text === 'string' && r.text.replace(/\s+/g, ' ').trim() !== L.text.replace(/\s+/g, ' ').trim()) { n.text = r.text; notes.push('retyped ' + n.name); }
      const color = hex(r.fill);
      if (color) {
        const now = L.kind === 'text' ? L.fill : L.kind === 'icon' || L.kind === 'line' ? L.stroke : typeof L.fill === 'string' ? L.fill : null;
        if (now && color !== now) { if (n.type === 'text' || n.type === 'icon' || n.type === 'line') n.color = color; else { n.fill = color; delete n.fill2; } notes.push('recoloured ' + n.name); }
      }
      // Only boxes have trustworthy sizes in Figma; lines and icons report their drawn outline.
      const boxy = L.kind === 'rect' || L.kind === 'ellipse';
      if (boxy && Number.isFinite(r.w) && Number.isFinite(r.h) && (Math.abs(r.w - L.w) > 1 || Math.abs(r.h - L.h) > 1)) { n.w = Math.round(r.w); n.h = Math.round(r.h); notes.push('resized ' + n.name); }
      const parent = byId.get(n.parent), inStack = n.parent && (parent ? parent.layout === 'stack' : (doc.screens.find(s => s.id === n.parent) || {}).layout === 'stack');
      if (inStack && boxy && Number.isFinite(r.x) && (Math.abs(r.x - L.x) > 1 || Math.abs(r.y - L.y) > 1)) { n.x = num(n.x, 0) + r.x - L.x; n.y = num(n.y, 0) + r.y - L.y; notes.push('moved ' + n.name); }
    }
    return {doc: clean(doc), notes};
  }

  return {clean, compile, pin, apply, fromBoard, merge, measure, wrap, NODE_KEYS, SCREEN_KEYS, TYPES};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Doc;
