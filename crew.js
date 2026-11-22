/* The crew turns a board, or the difference between two boards, into real design work.
   New layers become a short chain of tasks (draw, fill, round, align, type, trace, place icon);
   changed layers get only the work the change needs (move, recolour, re-round, retype, redraw);
   removed layers are deleted by a cursor. Containers finish before what sits on them, and
   each task is done by one cursor that travels there and performs the gesture. The run is a
   pure function of (board, previous board, crew size), so the browser and Figma replay the
   same timeline and it can be scrubbed. */
const Crew = (() => {
  const colors = ['#7C5CFF', '#FF5C8A', '#00B8A3', '#FFA620', '#3D8BFF', '#FF6A3D', '#8BD43B', '#D45CFF', '#1FC7E8', '#F43F5E', '#14B86F', '#F2B705', '#5B6CFF', '#EC4899', '#0EA5A4', '#A3B90B'];
  const names = ['Ava', 'Kai', 'Mira', 'Leo', 'Noa', 'Ivy', 'Remy', 'Zia', 'Theo', 'Luna', 'Ezra', 'Juno', 'Milo', 'Nia', 'Otto', 'Pia', 'Rio', 'Sage', 'Tess', 'Uma', 'Vic', 'Wren', 'Yara', 'Zane', 'Ari', 'Bea', 'Cy', 'Dex', 'Eli', 'Fern', 'Gus', 'Hana', 'Ines', 'Jax', 'Kit', 'Lux', 'Max', 'Nell', 'Oz', 'Pax', 'Quin', 'Rue', 'Sol', 'Tao', 'Ula', 'Vera', 'Wes', 'Yuki', 'Zoe', 'Ada', 'Bo', 'Cleo', 'Dara', 'Emi', 'Fox', 'Gia', 'Hugo', 'Isla', 'Joss', 'Kira'];
  const labels = {frame: 'Frame', paint: 'Paint', draw: 'Draw', fill: 'Fill', round: 'Round', snap: 'Align', type: 'Type', trace: 'Trace', icon: 'Icon', erase: 'Delete'};
  const KINDS = Object.keys(labels);
  const PLACEHOLDER = '#D9D9D9';

  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const ease = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const easeOut = p => 1 - Math.pow(1 - p, 3);
  const settle = p => { const c = 1.4; const q = p - 1; return 1 + (c + 1) * q * q * q + c * q * q; };
  function hash(a, b) {
    let h = Math.imul(a + 0x9e3779b9 | 0, 374761393) ^ Math.imul(b + 1 | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const cursorName = i => names[i % names.length] + (i >= names.length ? ' ' + (Math.floor(i / names.length) + 1) : '');
  const area = L => L.w * L.h;
  const contains = (a, b) => b.x >= a.x - 1 && b.y >= a.y - 1 && b.x + b.w <= a.x + a.w + 1 && b.y + b.h <= a.y + a.h + 1;
  const textWidth = L => Math.min(L.w, Math.max(...L.text.split('\n').map(s => s.length)) * L.size * (L.weight >= 600 ? .58 : .54));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const travelTime = d => .2 + .95 * Math.sqrt(Math.min(d, 4200) / 4200);
  const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
  const near = (a, b) => Math.abs(a - b) < .5;
  const paintOf = L => L.kind === 'line' || L.kind === 'icon' ? L.stroke : L.fill;

  function polyPoint(pts, p) {
    if (pts.length < 2) return pts[0];
    let total = 0; const seg = [];
    for (let i = 1; i < pts.length; i++) { const d = dist(pts[i - 1], pts[i]); seg.push(d); total += d; }
    let goal = total * clamp(p);
    for (let i = 0; i < seg.length; i++) {
      if (goal <= seg[i] || i === seg.length - 1) { const k = seg[i] ? clamp(goal / seg[i]) : 1; return {x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k, index: i, k}; }
      goal -= seg[i];
    }
    return pts[pts.length - 1];
  }
  function smooth(pts) {
    if (pts.length < 3) return pts;
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let k = 0; k < 10; k++) {
        const u = k / 10, u2 = u * u, u3 = u2 * u;
        out.push({x: .5 * (2 * p1.x + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3),
          y: .5 * (2 * p1.y + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3)});
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  const linePts = (L, at) => smooth(L.points.map(p => at(L.x + p[0] * L.w, L.y + p[1] * L.h)));

  /* ---------- planning ---------- */
  function plan(board, count, opts = {}) {
    const prev = opts.prev || null;
    const tasks = [], layers = [], screens = [];
    const add = t => { t.id = tasks.length; t.next = []; t.deps = t.deps.filter(d => d >= 0); for (const d of t.deps) tasks[d].next.push(t.id); tasks.push(t); return t.id; };
    const jitter = (id, s) => .88 + .24 * hash(id, s);
    const prevScreens = new Map((prev ? prev.screens : []).map(s => [s.id, s]));
    const nextIds = new Set(board.screens.map(s => s.id));

    const addScreen = (S, ps, ghost) => {
      const si = screens.length, at = (x, y) => ({x: S.x + x, y: S.y + y});
      const entry = {S, prev: ps || null, ghost: !!ghost, tasks: {}, range: [layers.length, layers.length]};
      screens.push(entry);
      if (ghost) {
        const c = at(S.width * .5, Math.min(60, S.height * .1));
        entry.tasks.erase = add({kind: 'erase', screen: si, layer: -1, deps: [], dur: .7, from: c, to: c});
      } else if (!ps) {
        entry.tasks.frame = add({kind: 'frame', screen: si, layer: -1, deps: [], dur: 1.0, from: at(0, 0), to: at(S.width, S.height)});
        const click = at(S.width * (.3 + .4 * hash(si, 3)), S.height * (.25 + .3 * hash(si, 4)));
        entry.tasks.paint = add({kind: 'paint', screen: si, layer: -1, deps: [entry.tasks.frame], dur: .6, from: click, to: click});
      } else {
        if (ps.width !== S.width || ps.height !== S.height) entry.tasks.frame = add({kind: 'frame', screen: si, layer: -1, deps: [], dur: .8, from: at(ps.width, ps.height), to: at(S.width, S.height)});
        if (ps.background !== S.background) {
          const click = at(S.width * (.3 + .4 * hash(si, 3)), S.height * (.25 + .3 * hash(si, 4)));
          entry.tasks.paint = add({kind: 'paint', screen: si, layer: -1, deps: [entry.tasks.frame ?? -1], dur: .6, from: click, to: click});
        }
      }
      return {entry, si, at};
    };

    // Ghosts first, so a screen's removed layers can be erased before new work lands on it.
    board.screens.forEach(S => {
      const ps = prevScreens.get(S.id);
      const {entry, si, at} = addScreen(S, ps, false);
      const base = !ps ? entry.tasks.paint : entry.tasks.paint ?? -1;
      const prevLayers = new Map(ps ? ps.layers.map((L, i) => [L.id, {L, i}]) : []);
      const keep = new Set(S.layers.map(L => L.id));
      const erases = [];
      const ghosts = ps ? ps.layers.filter(L => !keep.has(L.id)) : [];
      const parents = S.layers.map((L, i) => {
        for (let j = i - 1; j >= 0; j--) {
          const C = S.layers[j];
          if ((C.kind === 'rect' || C.kind === 'ellipse') && C.fill && contains(C, L) && area(C) > area(L) * 1.05) return j;
        }
        return -1;
      });
      const kids = S.layers.map(() => 0); parents.forEach(p => { if (p >= 0) kids[p]++; });
      const refs = [];
      // Removed layers on a surviving screen.
      const ghostRefs = ghosts.map(L => {
        const li = layers.length + S.layers.length + erases.length;
        const c = at(L.x + L.w / 2, L.y + L.h / 2);
        const id = add({kind: 'erase', screen: si, layer: li, deps: [], dur: .5 * jitter(li, 40), from: c, to: c});
        erases.push(id);
        return {L, prev: L, ghost: true, screen: si, tasks: {erase: id}, last: id, parent: -1, pts: L.kind === 'line' ? linePts(L, at) : undefined};
      });
      const cleared = erases.length ? add({kind: 'join', screen: si, layer: -1, deps: erases, dur: 0, from: null, to: null}) : -1;

      S.layers.forEach((L, i) => {
        const li = layers.length, ref = {id: li, screen: si, index: i, L, parent: parents[i], tasks: {}, last: -1};
        const old = prevLayers.get(L.id);
        ref.prev = old ? old.L : null;
        layers.push(ref); refs.push(ref);
        const parentRef = parents[i] >= 0 ? refs[parents[i]] : null;
        const after = parentRef ? parentRef.last : base;
        const chain = [after, ref.prev ? -1 : cleared];
        const step = (kind, dur, from, to, extra) => {
          const id = add(Object.assign({kind, screen: si, layer: li, deps: chain.slice(), dur, from, to}, extra || {}));
          ref.tasks[kind] = id; chain.length = 0; chain.push(id); ref.last = id; return id;
        };

        if (ref.prev) {
          const P0 = ref.prev;
          const moved = !(near(P0.x, L.x) && near(P0.y, L.y) && near(P0.w, L.w) && near(P0.h, L.h));
          // Children that move exactly with their container ride along instead of being dragged one by one.
          if (moved && parentRef && parentRef.prev && parentRef.tasks.snap !== undefined && !parentRef.ride) {
            const dx = parentRef.L.x - parentRef.prev.x, dy = parentRef.L.y - parentRef.prev.y;
            if (near(L.x - P0.x, dx) && near(L.y - P0.y, dy) && near(L.w, P0.w) && near(L.h, P0.h)) ref.ride = parentRef;
          } else if (moved && parentRef && parentRef.ride) {
            const top = parentRef.ride, dx = top.L.x - top.prev.x, dy = top.L.y - top.prev.y;
            if (near(L.x - P0.x, dx) && near(L.y - P0.y, dy) && near(L.w, P0.w) && near(L.h, P0.h)) ref.ride = top;
          }
          if (moved && !ref.ride) step('snap', .7 * jitter(li, 14), at(P0.x + P0.w / 2, P0.y + P0.h / 2), at(L.x + L.w / 2, L.y + L.h / 2));
          if (L.kind === 'text' && (P0.text !== L.text || P0.size !== L.size || P0.weight !== L.weight || P0.align !== L.align)) {
            const tw = textWidth(L);
            step('type', clamp(.45 + L.text.length / 30, .5, 2) * jitter(li, 1), at(L.x, L.y + L.size * L.lh * .55), at(L.x + tw, L.y + L.size * L.lh * (L.text.split('\n').length - .45)));
          }
          if (L.kind === 'line' && !same(P0.points, L.points)) { ref.pts = linePts(L, at); step('trace', 1.1, ref.pts[0], ref.pts[ref.pts.length - 1], {pts: ref.pts}); }
          if (!same(paintOf(P0), paintOf(L)) || !same(P0.stroke, L.stroke) || (P0.icon !== L.icon)) {
            const c = at(L.x + L.w * (.3 + .4 * hash(li, 10)), L.y + L.h * (.3 + .4 * hash(li, 11)));
            step('fill', .5 * jitter(li, 12), c, c, {click: {x: c.x - S.x - L.x, y: c.y - S.y - L.y}});
          }
          if (L.kind === 'rect' && !near(P0.r || 0, L.r || 0)) {
            const k = Math.min(Math.max(L.r || 0, 8), 36) * .75 + 3;
            step('round', .42, at(L.x + L.w - 2, L.y + 2), at(L.x + L.w - k, L.y + k));
          }
          if (L.kind === 'line' && !ref.pts) ref.pts = linePts(L, at);
          if (ref.prev.kind === 'line') ref.prevPts = linePts(ref.prev, at);
          return;
        }

        if (L.kind === 'text') {
          const tw = textWidth(L), lines = L.text.split('\n').length;
          const x0 = L.align === 'center' ? L.x + (L.w - tw) / 2 : L.align === 'right' ? L.x + L.w - tw : L.x;
          step('type', clamp(.25 + L.text.length / 30, .35, 1.9) * jitter(li, 1), at(x0, L.y + L.size * L.lh * .55), at(x0 + tw, L.y + L.size * L.lh * (lines - .45)));
          return;
        }
        if (L.kind === 'line') {
          ref.pts = linePts(L, at);
          step('trace', clamp(.6 + L.w / 900, .6, 1.4) * jitter(li, 2), ref.pts[0], ref.pts[ref.pts.length - 1], {pts: ref.pts});
          return;
        }
        if (L.kind === 'icon') {
          const c = at(L.x + L.w / 2, L.y + L.h / 2);
          step('icon', .4 * jitter(li, 3), c, c);
          return;
        }
        // Containers are sketched slightly off on a first build, then dragged onto the grid.
        const drafty = !prev && kids[i] > 0 && L.kind === 'rect' && L.w >= 44 && L.h >= 26 && L.w < S.width * .96;
        const d = drafty ? {
          x: L.x + Math.round((hash(li, 5) - .5) * 30), y: L.y + Math.round((hash(li, 6) - .5) * 24),
          w: Math.max(12, L.w * (1 + (hash(li, 7) - .5) * .12)), h: Math.max(10, L.h * (1 + (hash(li, 8) - .5) * .14))
        } : {x: L.x, y: L.y, w: L.w, h: L.h};
        ref.draft = d;
        const draw = step('draw', clamp(.34 + Math.sqrt(d.w * d.h) / 620, .34, 1.3) * jitter(li, 9), at(d.x, d.y), at(d.x + d.w, d.y + d.h));
        const cx = d.x + d.w * (.3 + .4 * hash(li, 10)), cy = d.y + d.h * (.3 + .4 * hash(li, 11));
        const fill = add({kind: 'fill', screen: si, layer: li, deps: [draw], dur: .45 * jitter(li, 12), from: at(cx, cy), to: at(cx, cy), click: {x: cx - d.x, y: cy - d.y}});
        ref.tasks.fill = fill;
        let tail = [fill];
        if (L.r >= 6 && Math.min(L.w, L.h) >= 18 && L.kind === 'rect') {
          const k = Math.min(L.r, 36) * .75 + 3;
          ref.tasks.round = add({kind: 'round', screen: si, layer: li, deps: [draw], dur: .42 * jitter(li, 13), from: at(d.x + d.w - 2, d.y + 2), to: at(d.x + d.w - k, d.y + k)});
          tail.push(ref.tasks.round);
        }
        if (drafty) {
          ref.tasks.snap = add({kind: 'snap', screen: si, layer: li, deps: tail, dur: .7 * jitter(li, 14), from: at(d.x + d.w / 2, d.y + d.h / 2), to: at(L.x + L.w / 2, L.y + L.h / 2)});
          tail = [ref.tasks.snap];
        }
        ref.last = tail.length > 1 ? add({kind: 'join', screen: si, layer: li, deps: tail, dur: 0, from: null, to: null}) : tail[0];
      });
      ghostRefs.forEach(g => { g.id = layers.length; layers.push(g); });
      entry.range = [entry.range[0], layers.length];
    });
    // Screens that were removed.
    for (const ps of prev ? prev.screens : []) {
      if (nextIds.has(ps.id)) continue;
      const {entry, si, at} = addScreen(ps, ps, true);
      ps.layers.forEach(L => layers.push({id: layers.length, L, prev: L, ghost: true, screen: si, tasks: {}, last: -1, parent: -1, withScreen: true, pts: L.kind === 'line' ? linePts(L, at) : undefined}));
      entry.range = [entry.range[0], layers.length];
    }

    for (let k = tasks.length - 1; k >= 0; k--) {
      const t = tasks[k]; let m = 0;
      for (const n of t.next) m = Math.max(m, tasks[n].cp);
      t.cp = t.dur + (t.kind === 'join' ? 0 : .5) + m;
    }
    const work = tasks.filter(t => t.kind !== 'join');
    // A small edit doesn't need the whole crew on the canvas.
    count = Math.max(1, Math.min(1000, Math.round(count), prev ? Math.max(12, work.length) : 1000));

    const B = bounds(board, prev), center = {x: B.x + B.w / 2, y: B.y + B.h / 2};
    const margin = Math.max(B.w, B.h) * .05;
    const ring = {x: B.x - margin, y: B.y - margin, w: B.w + margin * 2, h: B.h + margin * 2};
    const per = 2 * (ring.w + ring.h);
    function perimeter(u) {
      let d = ((u % 1) + 1) % 1 * per;
      if (d < ring.w) return {x: ring.x + d, y: ring.y};
      d -= ring.w; if (d < ring.h) return {x: ring.x + ring.w, y: ring.y + d};
      d -= ring.h; if (d < ring.w) return {x: ring.x + ring.w - d, y: ring.y + ring.h};
      d -= ring.w; return {x: ring.x, y: ring.y + ring.h - d};
    }
    const crew = [];
    for (let i = 0; i < count; i++) {
      const edge = perimeter(hash(i, 20) * .999 + .13), o = {x: edge.x - center.x, y: edge.y - center.y}, ol = Math.hypot(o.x, o.y) || 1;
      const depth = margin * (hash(i, 23) * 2.2 - .6);
      const spot = {x: edge.x + o.x / ol * depth, y: edge.y + o.y / ol * depth};
      const out = {x: spot.x - center.x, y: spot.y - center.y}, len = Math.hypot(out.x, out.y) || 1;
      const push = 120 + hash(i, 21) * 220;
      const far = {x: spot.x + out.x / len * push, y: spot.y + out.y / len * push};
      const enter = .05 + (i / count) * (prev ? .5 : 1.15) + hash(i, 22) * .25;
      crew.push({id: i, name: cursorName(i), color: colors[i % colors.length], x: spot.x, y: spot.y, free: enter + .6, jobs: 0,
        segs: [{kind: 'enter', t0: enter, t1: enter + .6, from: far, to: {x: spot.x, y: spot.y}}]});
    }

    const waiting = tasks.map(t => t.deps.length), avail = [];
    const release = id => {
      const t = tasks[id];
      t.ready = t.deps.reduce((m, d) => Math.max(m, tasks[d].end), 0);
      if (t.kind === 'join') { t.start = t.end = t.ready; t.cursor = -1; for (const n of t.next) if (--waiting[n] === 0) release(n); return; }
      avail.push(id);
    };
    tasks.forEach(t => { if (!t.deps.length) release(t.id); });
    while (avail.length) {
      let bi = 0;
      for (let i = 1; i < avail.length; i++) {
        const a = tasks[avail[i]], b = tasks[avail[bi]];
        if (a.ready < b.ready - 1e-9 || (Math.abs(a.ready - b.ready) < 1e-9 && a.cp > b.cp)) bi = i;
      }
      const t = tasks[avail[bi]]; avail[bi] = avail[avail.length - 1]; avail.pop();
      let best = null, bestArrive = Infinity, bestScore = Infinity;
      for (const c of crew) {
        const d = dist(c, t.from), arrive = Math.max(c.free + travelTime(d), t.ready);
        const score = c.jobs + d / 900;
        if (arrive < bestArrive - 1e-6 || (arrive < bestArrive + 1e-6 && score < bestScore)) { best = c; bestArrive = arrive; bestScore = score; }
      }
      const c = best, tr = travelTime(dist(c, t.from)), depart = Math.max(c.free, t.ready - tr);
      c.segs.push({kind: 'move', t0: depart, t1: depart + tr, from: {x: c.x, y: c.y}, to: {x: t.from.x, y: t.from.y}, bend: (hash(t.id, 30) - .5) * .5});
      t.start = depart + tr; t.end = t.start + t.dur; t.cursor = c.id;
      c.segs.push({kind: 'work', t0: t.start, t1: t.end, task: t.id, to: {x: t.to.x, y: t.to.y}});
      c.x = t.to.x; c.y = t.to.y; c.free = t.end + .05 + hash(t.id, 31) * .12; c.jobs++;
      for (const n of t.next) if (--waiting[n] === 0) release(n);
    }

    let end = 0;
    for (const t of tasks) end = Math.max(end, t.end || 0);
    for (const c of crew) {
      const last = c.segs[c.segs.length - 1], t0 = Math.max(last.t1 + .35, c.jobs ? 0 : end * .3);
      const out = {x: c.x - center.x, y: c.y - center.y}, len = Math.hypot(out.x, out.y) || 1;
      c.segs.push({kind: 'exit', t0, t1: t0 + .7, from: {x: c.x, y: c.y}, to: {x: c.x + out.x / len * 40, y: c.y + out.y / len * 40}});
      end = Math.max(end, t0 + .7);
    }
    const order = work.map(t => t.id).sort((a, b) => tasks[a].end - tasks[b].end);
    const ends = order.map(id => tasks[id].end);
    const byKind = {}; for (const k of KINDS) byKind[k] = [];
    for (const id of order) byKind[tasks[id].kind].push(tasks[id].end);
    const bins = new Array(Math.ceil(end * 10) + 1).fill(0);
    for (const c of crew) {
      let lastBin = -1;
      for (const s of c.segs) if (s.kind === 'move' || s.kind === 'work') for (let b = Math.max(lastBin + 1, Math.floor(s.t0 * 10)); b < Math.min(bins.length, Math.ceil(s.t1 * 10)); b++) { bins[b]++; lastBin = b; }
    }
    const busiest = bins.reduce((m, v) => Math.max(m, v), 0);
    const finish = work.reduce((m, t) => Math.max(m, t.end), 0);
    return {board, prev, count, tasks, layers, screens, crew, order, ends, byKind, bins, busiest, total: end + .25, finish, workCount: work.length, bounds: B, edit: !!prev};
  }

  function bounds(board, prev) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of [...board.screens, ...(prev ? prev.screens : [])]) { x0 = Math.min(x0, s.x); y0 = Math.min(y0, s.y); x1 = Math.max(x1, s.x + s.width); y1 = Math.max(y1, s.y + s.height); }
    return {x: x0, y: y0, w: x1 - x0, h: y1 - y0};
  }

  /* ---------- sampling ---------- */
  const progress = (t, task) => task.end <= task.start ? (t >= task.end ? 1 : 0) : clamp((t - task.start) / (task.end - task.start));
  const upper = (arr, t) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] <= t) lo = m + 1; else hi = m; } return lo; };
  const lerp = (a, b, k) => ({x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k});

  function gesture(P, task, p) {
    switch (task.kind) {
      case 'frame': case 'draw': case 'round': return lerp(task.from, task.to, ease(p));
      case 'snap': return lerp(task.from, task.to, settle(clamp((p - .12) / .76)));
      case 'type': return lerp(task.from, task.to, clamp((p - (P.layers[task.layer] && P.layers[task.layer].prev ? .3 : 0)) / (P.layers[task.layer] && P.layers[task.layer].prev ? .7 : 1)));
      case 'trace': return polyPoint(task.pts, ease(p));
      default: { const press = Math.sin(clamp(p) * Math.PI) * 2.5; return {x: task.from.x + press * .4, y: task.from.y + press}; }
    }
  }

  function cursorAt(P, c, t) {
    const segs = c.segs;
    if (t < segs[0].t0) return null;
    let lo = 0, hi = segs.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (segs[m].t0 <= t) lo = m; else hi = m - 1; }
    const s = segs[lo];
    if (s.kind === 'exit') { if (t >= s.t1) return null; const k = easeOut(clamp((t - s.t0) / (s.t1 - s.t0))); const q = lerp(s.from, s.to, k); return {x: q.x, y: q.y, alpha: 1 - k, mode: 'exit'}; }
    if (t > s.t1) return {x: s.to.x, y: s.to.y, alpha: 1, mode: 'idle'};
    const k = clamp((t - s.t0) / Math.max(1e-6, s.t1 - s.t0));
    if (s.kind === 'enter') { const q = lerp(s.from, s.to, easeOut(k)); return {x: q.x, y: q.y, alpha: Math.min(1, k * 2), mode: 'idle'}; }
    if (s.kind === 'move') {
      const e = ease(k), d = {x: s.to.x - s.from.x, y: s.to.y - s.from.y}, bow = Math.sin(Math.PI * e) * s.bend;
      return {x: s.from.x + d.x * e - d.y * bow, y: s.from.y + d.y * e + d.x * bow, alpha: 1, mode: 'move'};
    }
    const task = P.tasks[s.task], q = gesture(P, task, k);
    return {x: q.x, y: q.y, alpha: 1, mode: 'work', task: s.task, p: k};
  }

  // A screen's visual state at time t: size, background paint and fade.
  function screenAt(P, si, t) {
    const E = P.screens[si], S = E.S, T = E.tasks, tk = P.tasks;
    const out = {w: S.width, h: S.height, alpha: 1, drawing: false, paint: 1, paintFrom: S.background, paintTo: S.background, click: {x: S.width / 2, y: S.height / 2}, labelAlpha: 1, frameCursor: -1};
    if (E.ghost) {
      const e = tk[T.erase], p = progress(t, e);
      if (t >= e.end) return null;
      out.alpha = 1 - easeOut(p); out.erasing = t >= e.start ? {cursor: e.cursor, p} : null;
      return out;
    }
    if (T.frame !== undefined) {
      const fr = tk[T.frame];
      if (!E.prev && t < fr.start) return null;
      const dp = progress(t, fr), e = ease(dp), w0 = E.prev ? E.prev.width : 0, h0 = E.prev ? E.prev.height : 0;
      out.w = w0 + (S.width - w0) * e; out.h = h0 + (S.height - h0) * e;
      out.drawing = t >= fr.start && dp < 1; out.frameCursor = fr.cursor; out.labelAlpha = E.prev ? 1 : clamp(dp * 3);
    }
    if (T.paint !== undefined) {
      const pa = tk[T.paint];
      out.paint = progress(t, pa); out.paintFrom = E.prev ? E.prev.background : '#FFFFFF';
      out.click = {x: pa.from.x - S.x, y: pa.from.y - S.y}; out.painting = t >= pa.start && t < pa.end;
    }
    return out;
  }

  function boxOf(P, ref, t) {
    const L = ref.L, T = ref.tasks, tk = P.tasks;
    if (ref.ride) {
      const pb = boxOf(P, ref.ride, t), P0 = ref.prev, r = ref.ride;
      return {x: P0.x + pb.x - r.prev.x, y: P0.y + pb.y - r.prev.y, w: P0.w, h: P0.h};
    }
    const P0 = ref.prev;
    let b = P0 ? {x: P0.x, y: P0.y, w: P0.w, h: P0.h} : ref.draft || {x: L.x, y: L.y, w: L.w, h: L.h};
    if (T.snap !== undefined) {
      const sn = tk[T.snap], k = settle(clamp((progress(t, sn) - .12) / .76));
      b = {x: b.x + (L.x - b.x) * k, y: b.y + (L.y - b.y) * k, w: b.w + (L.w - b.w) * k, h: b.h + (L.h - b.h) * k};
    }
    return b;
  }

  // Everything a renderer needs to draw one layer at time t. Boxes are relative to the screen.
  function layerAt(P, li, t) {
    const ref = P.layers[li], L = ref.L, T = ref.tasks, tk = P.tasks, P0 = ref.prev;
    if (ref.ghost) {
      const look = {color: paintOf(L), icon: L.icon, pts: ref.pts};
      if (ref.withScreen) return Object.assign({kind: L.kind, layer: L, box: L, fill: 1, fillFrom: paintOf(L), fillTo: paintOf(L), radius: L.r || 0, text: L.text, chars: L.text ? L.text.length : 0, trace: 1, scale: 1, alpha: 1, final: true}, look);
      const e = tk[T.erase], p = progress(t, e);
      if (t >= e.end) return null;
      const s = 1 - .12 * easeOut(p);
      return Object.assign({kind: L.kind, layer: L, box: {x: L.x + L.w * (1 - s) / 2, y: L.y + L.h * (1 - s) / 2, w: L.w * s, h: L.h * s}, fill: 1, fillFrom: paintOf(L), fillTo: paintOf(L), radius: L.r || 0,
        text: L.text, chars: L.text ? L.text.length : 0, trace: 1, scale: s, alpha: 1 - easeOut(p), active: t >= e.start ? {kind: 'erase', cursor: e.cursor, p} : null, final: false}, look);
    }
    const first = T.draw ?? T.type ?? T.trace ?? T.icon;
    if (!P0 && first !== undefined && t < tk[first].start) return null;
    let active = null;
    const mark = (kind, id) => { if (active || id === undefined) return; const k = tk[id]; if (t >= k.start && t < k.end) active = {kind, cursor: k.cursor, p: progress(t, k)}; };
    let box;
    if (!P0 && T.draw !== undefined) {
      const draw = tk[T.draw], dp = progress(t, draw), d = ref.draft;
      if (dp < 1) { const e = ease(dp); box = {x: d.x, y: d.y, w: Math.max(1, d.w * e), h: Math.max(1, d.h * e)}; mark('draw', T.draw); }
      else box = boxOf(P, ref, t);
    } else box = boxOf(P, ref, t);
    mark('snap', T.snap);
    const fl = T.fill !== undefined ? tk[T.fill] : null, fp = fl ? progress(t, fl) : 1;
    const fillFrom = P0 ? paintOf(P0) : PLACEHOLDER, fillTo = paintOf(L);
    let radius = L.r || 0;
    if (T.round !== undefined) { const rp = progress(t, tk[T.round]); const r0 = P0 ? P0.r || 0 : 0; radius = r0 + ((L.r || 0) - r0) * ease(rp); mark('round', T.round); }
    else if (P0 && T.snap === undefined && !ref.ride) radius = L.r || 0;
    mark('fill', T.fill);
    const out = {kind: L.kind, layer: L, box, fill: fp, fillFrom, fillTo, click: fl ? fl.click : {x: 0, y: 0}, radius: Math.min(radius, box.w / 2, box.h / 2), alpha: 1, scale: 1, active};
    if (L.kind === 'text') {
      const k = T.type !== undefined ? tk[T.type] : null, p = k ? progress(t, k) : 1;
      if (P0 && k) {
        if (p < .3) { Object.assign(out, {layer: P0, text: P0.text, chars: P0.text.length, select: t >= k.start ? p / .3 : 0}); out.box = Object.assign({}, out.box, {w: P0.w, h: P0.h}); }
        else Object.assign(out, {text: L.text, chars: Math.round(L.text.length * (p - .3) / .7)});
      } else Object.assign(out, {text: L.text, chars: Math.round(L.text.length * p)});
      if (k && t >= k.start && p < 1 && !active) out.active = {kind: 'type', cursor: k.cursor, p};
      out.color = fp >= .5 ? fillTo : fillFrom;
      if (!P0) out.color = fillTo;
    }
    if (L.kind === 'line') {
      const k = T.trace !== undefined ? tk[T.trace] : null, p = k ? progress(t, k) : 1;
      out.trace = ease(p); out.pts = ref.pts; out.prevPts = P0 && k && p < .5 ? ref.prevPts : null;
      if (k && t >= k.start && p < 1 && !out.active) out.active = {kind: 'trace', cursor: k.cursor, p};
      out.color = fp >= .5 ? fillTo : fillFrom; if (!P0) out.color = fillTo;
    }
    if (L.kind === 'icon') {
      const k = T.icon !== undefined ? tk[T.icon] : null, p = k ? progress(t, k) : 1;
      out.scale = k ? Math.max(.01, settle(p)) : 1;
      out.icon = P0 && fp < .5 ? P0.icon : L.icon; out.color = fp >= .5 ? fillTo : fillFrom; if (!P0) out.color = fillTo;
      if (k && t >= k.start && p < 1 && !out.active) out.active = {kind: 'icon', cursor: k.cursor, p};
    }
    out.final = ref.last < 0 || t >= tk[ref.last].end;
    return out;
  }

  function stats(P, t) {
    const done = upper(P.ends, t), kinds = {};
    for (const k of KINDS) kinds[k] = {done: upper(P.byKind[k], t), total: P.byKind[k].length};
    return {done, total: P.workCount, kinds};
  }
  function feed(P, t, n = 7) {
    const k = upper(P.ends, t), out = [];
    for (let i = k - 1; i >= 0 && out.length < n; i--) out.push(P.tasks[P.order[i]]);
    return out;
  }
  function describe(P, task) {
    const edit = task.layer >= 0 ? !!P.layers[task.layer].prev && !P.layers[task.layer].ghost : !!P.screens[task.screen].prev;
    const verbs = {frame: edit ? 'resized' : 'framed', paint: edit ? 'repainted' : 'painted', draw: 'drew', fill: edit ? 'recoloured' : 'filled', round: edit ? 'reshaped' : 'rounded',
      snap: edit ? 'moved' : 'aligned', type: edit ? 'retyped' : 'typed', trace: edit ? 'redrew' : 'traced', icon: 'placed', erase: 'deleted'};
    if (task.layer < 0) {
      const S = P.screens[task.screen].S, label = S.name.split(' · ').pop();
      return verbs[task.kind] + ' ' + (task.kind === 'paint' ? label + ' background' : label);
    }
    const L = P.layers[task.layer].L;
    if (task.kind === 'type') { const s = L.text.replace(/\n/g, ' '); return verbs.type + ' “' + (s.length > 26 ? s.slice(0, 25) + '…' : s) + '”'; }
    return verbs[task.kind] + ' ' + L.name;
  }

  return {plan, cursorAt, screenAt, layerAt, stats, feed, describe, progress, polyPoint, ease, colors, labels, KINDS, cursorName, PLACEHOLDER};
})();
