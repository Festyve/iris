/* A board is a set of screens made of ordered primitives (back to front).
   It is the contract between the planners (local kit or Gemini) and both renderers. */
const Screens = (() => {
  const HEX = /^#[a-f0-9]{6}$/i;
  const OVERFLOW = 260; // screens clip their content, so shapes may bleed a little past the edge
  const isHex = v => typeof v === 'string' && HEX.test(v);
  const num = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;

  function paint(v) {
    if (isHex(v)) return v.toUpperCase();
    if (v && typeof v === 'object' && isHex(v.from) && isHex(v.to)) return {from: v.from.toUpperCase(), to: v.to.toUpperCase(), dir: v.dir === 'v' ? 'v' : 'd'};
    return null;
  }

  function layer(v, width, height, fallbackId) {
    if (!v || typeof v !== 'object') throw Error('Invalid layer in the screen plan.');
    const kind = v.kind;
    if (!['rect', 'ellipse', 'text', 'line', 'icon'].includes(kind)) throw Error('Unknown layer kind: ' + kind);
    if (typeof v.name !== 'string' || !v.name.trim()) throw Error('Every layer needs a name.');
    if (![v.x, v.y, v.w, v.h].every(Number.isFinite) || v.w < 0.5 || v.h < 0.5 ||
      v.x < -OVERFLOW || v.y < -OVERFLOW || v.x + v.w > width + OVERFLOW || v.y + v.h > height + OVERFLOW)
      throw Error('Invalid geometry in the screen plan (' + v.name + ').');
    const out = {id: typeof v.id === 'string' && v.id ? v.id : fallbackId, kind, name: v.name.trim().slice(0, 60), x: v.x, y: v.y, w: v.w, h: v.h};
    if (v.opacity !== undefined) { if (!num(v.opacity, 0, 1)) throw Error('Invalid opacity.'); if (v.opacity < 1) out.opacity = v.opacity; }
    if (kind === 'icon') {
      const stroke = paint(v.stroke || v.fill);
      if (!isHex(stroke) || typeof v.icon !== 'string') throw Error('An icon needs a name and a colour.');
      return Object.assign(out, {icon: v.icon, stroke, sw: num(v.sw, 0.5, 6) ? v.sw : 2, fill: null});
    }
    if (kind === 'line') {
      const stroke = paint(v.stroke || v.fill);
      if (!isHex(stroke)) throw Error('A line needs a stroke colour.');
      if (!Array.isArray(v.points) || v.points.length < 2 || v.points.length > 64 ||
        !v.points.every(p => Array.isArray(p) && num(p[0], 0, 1) && num(p[1], 0, 1))) throw Error('Invalid line points.');
      return Object.assign(out, {stroke, sw: num(v.sw, 0.5, 24) ? v.sw : 2, points: v.points.map(p => [p[0], p[1]]), fill: null});
    }
    const fill = v.fill === null || v.fill === undefined ? null : paint(v.fill);
    if (v.fill && !fill) throw Error('Invalid fill colour (' + v.name + ').');
    out.fill = fill;
    if (kind === 'text') {
      const size = v.size;
      if (typeof v.text !== 'string' || !v.text.length || v.text.length > 800) throw Error('Invalid text in the screen plan.');
      if (!num(size, 6, 120)) throw Error('Invalid text size.');
      if (!isHex(fill)) throw Error('Text needs a solid colour.');
      const weight = v.bold ? 700 : num(v.weight, 100, 900) ? Math.round(v.weight / 100) * 100 : 400;
      return Object.assign(out, {text: v.text, size, weight, align: ['center', 'right'].includes(v.align) ? v.align : 'left', lh: num(v.lh, 0.8, 2.2) ? v.lh : 1.3});
    }
    const radius = v.r !== undefined ? v.r : v.radius;
    if (radius !== undefined && !num(radius, 0, 2000)) throw Error('Invalid corner radius.');
    if (radius) out.r = Math.min(radius, v.w / 2, v.h / 2);
    if (v.stroke !== undefined && v.stroke !== null) { if (!isHex(v.stroke)) throw Error('Invalid stroke.'); out.stroke = v.stroke.toUpperCase(); out.sw = num(v.sw, 0.5, 24) ? v.sw : 1; }
    if (!fill && !out.stroke) throw Error('A shape needs a fill or a stroke (' + v.name + ').');
    if (v.shadow) out.shadow = true;
    return out;
  }

  // Lenient checking drops individual bad layers (model output) instead of failing the screen.
  function check(screen, lenient, index = 0) {
    const {name, width, height, background, layers} = screen || {};
    if (typeof name !== 'string' || !name.trim() || name.length > 90 || !isHex(background) ||
      !Number.isInteger(width) || width < 240 || width > 1920 || !Number.isInteger(height) || height < 240 || height > 2400 ||
      !Array.isArray(layers) || layers.length > 600) throw Error('Invalid screen definition.');
    const id = typeof screen.id === 'string' && screen.id ? screen.id : 'screen' + (index + 1);
    const out = [];
    layers.forEach((v, i) => { try { out.push(layer(v, width, height, id + ':' + i)); } catch (e) { if (!lenient) throw e; } });
    if (!out.length && !lenient) throw Error('Invalid screen definition.');
    const s = {id, name: name.trim(), width, height, background: background.toUpperCase(), layers: out};
    if (Number.isFinite(screen.x) && Number.isFinite(screen.y)) { s.x = screen.x; s.y = screen.y; }
    return s;
  }

  // Phones and tablets share the first row; wide screens go on the second.
  function arrange(screens, gap = 120) {
    const fixed = screens.filter(s => Number.isFinite(s.x)), loose = screens.filter(s => !Number.isFinite(s.x));
    if (fixed.length) {
      // Keep everything already on the board where it is; new screens join the end of their row.
      for (const s of loose) {
        const wide = s.width >= 700, row = fixed.filter(f => (f.width >= 700) === wide);
        const ref = row.length ? row : fixed;
        s.x = Math.max(...ref.map(f => f.x + f.width)) + gap;
        s.y = row.length ? Math.min(...row.map(f => f.y)) : Math.max(...fixed.map(f => f.y + f.height)) + gap * 1.4;
        fixed.push(s);
      }
      return screens;
    }
    const rows = [screens.filter(s => s.width < 700), screens.filter(s => s.width >= 700)].filter(r => r.length);
    const widths = rows.map(r => r.reduce((sum, s) => sum + s.width, 0) + gap * (r.length - 1));
    const total = Math.max(...widths);
    let y = 0;
    rows.forEach((row, i) => {
      let x = (total - widths[i]) / 2;
      for (const s of row) { s.x = Math.round(x); s.y = y; x += s.width + gap; }
      y += Math.max(...row.map(s => s.height)) + gap * 1.4;
    });
    return screens;
  }

  function checkBoard(board, lenient) {
    if (!board || !Array.isArray(board.screens) || !board.screens.length || board.screens.length > 12) throw Error('Invalid board.');
    const screens = arrange(board.screens.map((s, i) => check(s, lenient, i)));
    const total = screens.reduce((n, s) => n + s.layers.length, 0);
    if (total > 2400) throw Error('That board is too large for one run.');
    const out = {name: String(board.name || screens[0].name).slice(0, 60), screens};
    if (typeof board.id === 'string' && board.id) out.id = board.id;
    return out;
  }

  function bounds(board) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of board.screens) { x0 = Math.min(x0, s.x); y0 = Math.min(y0, s.y); x1 = Math.max(x1, s.x + s.width); y1 = Math.max(y1, s.y + s.height); }
    return {x: x0, y: y0, w: x1 - x0, h: y1 - y0};
  }

  return {check, checkBoard, arrange, bounds, isHex, paint};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Screens;

/* A small stroke icon set on a 24-unit grid (2px stroke, round caps and joins). */
const Icons = (() => {
  const ring = (cx, cy, r) => 'M' + cx + ' ' + (cy - r) + 'a' + r + ' ' + r + ' 0 1 0 0 ' + 2 * r + 'a' + r + ' ' + r + ' 0 1 0 0 ' + -2 * r + 'z';
  const paths = {
    home: 'M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-6h4v6',
    search: ring(11, 11, 7) + 'M20 20l-4-4',
    user: ring(12, 8, 4) + 'M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6',
    users: ring(9, 8, 3.5) + 'M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .6 3.2 2.5 3.8 5.5',
    settings: ring(12, 12, 3) + 'M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
    bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
    heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z',
    star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
    plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', x: 'M6 6l12 12M18 6L6 18', check: 'M5 12.5l4.5 4.5L19 7',
    'chevron-right': 'M9 5l7 7-7 7', 'chevron-left': 'M15 5l-7 7 7 7', 'chevron-down': 'M5 9l7 7 7-7', 'chevron-up': 'M5 15l7-7 7 7',
    'arrow-right': 'M4 12h16M14 6l6 6-6 6', 'arrow-left': 'M20 12H4M10 6l-6 6 6 6', 'arrow-up-right': 'M7 17L17 7M8 7h9v9', 'arrow-down': 'M12 4v16M6 14l6 6 6-6', 'arrow-up': 'M12 20V4M6 10l6-6 6 6',
    menu: 'M4 6h16M4 12h16M4 18h16', more: 'M5 12h.01M12 12h.01M19 12h.01',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4', clock: ring(12, 12, 9) + 'M12 7v5l3 2',
    'map-pin': 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z' + ring(12, 10, 2.5), map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
    mail: 'M3 6h18v12H3zM3 7l9 6 9-6', message: 'M4 5h16v11H9l-5 4z', phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z',
    camera: 'M4 8h4l2-3h4l2 3h4v11H4z' + ring(12, 13, 3), image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01', video: 'M3 6h12v12H3zM15 10l6-3v10l-6-3z',
    play: 'M7 4.5l12.5 7.5L7 19.5z', pause: 'M8 5v14M16 5v14', music: 'M9 18V5l11-2v13' + ring(6, 18, 3) + ring(17, 16, 3), headphones: 'M4 16v-4a8 8 0 0 1 16 0v4M4 15h4v5H4zM16 15h4v5h-4z', mic: 'M9 3h6v11H9zM5 11a7 7 0 0 0 14 0M12 18v3',
    cart: 'M3 4h2l2.5 11h11L21 7H6M9 20h.01M18 20h.01', bag: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2', store: 'M3 9l2-5h14l2 5zM5 9v11h14V9M10 20v-5h4v5',
    card: 'M3 6h18v12H3zM3 10h18M7 15h4', wallet: 'M4 6h14v3M4 6v12h16V9H4M16 14h.01', dollar: 'M12 3v18M17 7h-7a2.5 2.5 0 0 0 0 5h4a2.5 2.5 0 0 1 0 5H7', tag: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01', gift: 'M4 10h16v4H4zM6 14v7h12v-7M12 10v11M12 10C10 6 8 5 7 6.5S8 10 12 10zM12 10c2-4 4-5 5-3.5S16 10 12 10z',
    'bar-chart': 'M5 20V10M12 20V4M19 20v-7', 'line-chart': 'M3 17l6-6 4 4 8-8M15 7h6v6', activity: 'M3 12h4l3-8 4 16 3-8h4', pie: 'M12 3v9h9a9 9 0 1 1-9-9zM15 3.5A9 9 0 0 1 20.5 9H15z', target: ring(12, 12, 9) + ring(12, 12, 4.5),
    filter: 'M4 5h16l-6 8v6l-4-2v-4z', sliders: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4', grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01', layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
    lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z' + ring(12, 12, 3), key: ring(8, 15, 4) + 'M11 12l9-9M17 6l3 3',
    share: 'M12 3v12M7 8l5-5 5 5M5 14v6h14v-6', download: 'M12 4v12M7 11l5 5 5-5M5 20h14', upload: 'M12 20V8M7 13l5-5 5 5M5 4h14', link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1', send: 'M21 3L3 11l7 3 3 7zM10 14L21 3',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', refresh: 'M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3M4 4v4h4M20 20v-4h-4', logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10', bookmark: 'M6 3h12v18l-6-4-6 4z',
    info: ring(12, 12, 9) + 'M12 11v6M12 7.5h.01', alert: 'M12 3l10 18H2zM12 10v5M12 18h.01', 'check-circle': ring(12, 12, 9) + 'M8 12.5l3 3 5-6', circle: ring(12, 12, 9),
    sun: ring(12, 12, 4) + 'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5', moon: 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z', cloud: 'M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.5 4.5 0 0 0 7 18z',
    globe: ring(12, 12, 9) + 'M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18', flame: 'M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 3 5 1-2 1-6 1-9z', zap: 'M13 2L4 14h7l-1 8 9-12h-7z', leaf: 'M5 19c0-9 6-14 15-14 0 9-5 15-14 15zM5 19l8-8',
    sparkles: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2 2.2.8-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z', smile: ring(12, 12, 9) + 'M8 14s1.5 2 4 2 4-2 4-2M9 9.5h.01M15 9.5h.01', wifi: 'M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01',
    car: 'M5 16v-5l2-5h10l2 5v5zM3 11h18M7 19v-3M17 19v-3M7.5 13.5h.01M16.5 13.5h.01', plane: 'M10.5 21l1.5-6-6 2-2-2 7-4V5a1 1 0 0 1 2 0v6l7 4-2 2-6-2 1.5 6z', bike: ring(6, 16, 3.5) + ring(18, 16, 3.5) + 'M6 16l4-8h5l3 8M9 6h3',
    coffee: 'M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h2a2 2 0 0 1 0 4h-2M8 2.5v3M12 2.5v3', book: 'M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z', file: 'M6 3h8l4 4v14H6zM14 3v4h4', dumbbell: 'M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12'
  };
  const names = Object.keys(paths);
  const aliases = {settings2: 'settings', gear: 'settings', profile: 'user', account: 'user', notification: 'bell', notifications: 'bell', like: 'heart', favorite: 'heart', add: 'plus', close: 'x', done: 'check', back: 'chevron-left', next: 'chevron-right', forward: 'arrow-right', chat: 'message', inbox: 'mail', location: 'map-pin', pin: 'map-pin', time: 'clock', date: 'calendar', shopping: 'bag', basket: 'cart', payment: 'card', 'credit-card': 'card', money: 'dollar', chart: 'bar-chart', stats: 'bar-chart', analytics: 'line-chart', trend: 'line-chart', 'trending-up': 'line-chart', delete: 'trash', pencil: 'edit', bolt: 'zap', fire: 'flame', photo: 'image', picture: 'image', dots: 'more', ellipsis: 'more', help: 'info', warning: 'alert', security: 'shield', password: 'lock', run: 'activity', fitness: 'dumbbell', food: 'coffee', travel: 'plane', flight: 'plane', world: 'globe', weather: 'cloud', star2: 'star'};
  const resolve = name => { const n = String(name || '').toLowerCase().trim(); return paths[n] ? n : aliases[n] || (paths[n.replace(/-\w+$/, '')] ? n.replace(/-\w+$/, '') : 'circle'); };
  const path = name => paths[resolve(name)];
  const svg = (name, size, color, sw = 2) => '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"><path d="' + path(name) + '"/></svg>';
  return {names, resolve, path, svg};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Icons;

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
      const lines = n.wrap === false ? String(n.text).split('\n') : wrap(n.text, size, weight, Math.max(size, limit));
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
    } else if (n.type === 'shape') out.push(extras(Object.assign(base, {kind: n.shape === 'ellipse' ? 'ellipse' : 'rect', fill: paintOf(n)})));
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
  const NODE_KEYS = ['name', 'layout', 'gap', 'pad', 'align', 'alignSelf', 'justify', 'cols', 'w', 'h', 'x', 'y', 'grow', 'fill', 'fill2', 'fillDir', 'stroke', 'sw', 'r', 'shadow', 'opacity', 'text', 'size', 'weight', 'color', 'lh', 'wrap', 'icon', 'shape', 'points'];
  const SCREEN_KEYS = ['name', 'w', 'h', 'fill', 'layout', 'gap', 'pad', 'align', 'justify'];
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
      if (Number.isFinite(r.w) && Number.isFinite(r.h) && (Math.abs(r.w - L.w) > 1 || Math.abs(r.h - L.h) > 1) && L.kind !== 'text') { n.w = Math.round(r.w); n.h = Math.round(r.h); notes.push('resized ' + n.name); }
      const parent = byId.get(n.parent), inStack = n.parent && (parent ? parent.layout === 'stack' : (doc.screens.find(s => s.id === n.parent) || {}).layout === 'stack');
      if (inStack && L.kind !== 'text' && Number.isFinite(r.x) && (Math.abs(r.x - L.x) > 1 || Math.abs(r.y - L.y) > 1)) { n.x = num(n.x, 0) + r.x - L.x; n.y = num(n.y, 0) + r.y - L.y; notes.push('moved ' + n.name); }
    }
    return {doc: clean(doc), notes};
  }

  return {clean, compile, pin, apply, fromBoard, merge, measure, wrap, NODE_KEYS, SCREEN_KEYS, TYPES};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Doc;

/* Local design planner. Turns any brief into a full product board:
   five phone screens, a web dashboard and a marketing page, in one palette. */
const Kit = (() => {
  const hues = {
    violet: {accent: '#6E56F8', accent2: '#FF8A5B', grad: ['#6E56F8', '#B26BFF'], on: '#FFFFFF'},
    coral: {accent: '#FF5A4E', accent2: '#FFB938', grad: ['#FF4E50', '#FF9A5A'], on: '#FFFFFF'},
    ocean: {accent: '#2D6BFF', accent2: '#16C3DF', grad: ['#2D6BFF', '#5AB4FF'], on: '#FFFFFF'},
    lime: {accent: '#C5F23A', accent2: '#8C6CFF', grad: ['#B8F02E', '#4FE0A4'], on: '#0C0C11'},
    sun: {accent: '#EA7212', accent2: '#E8445A', grad: ['#FF9F1C', '#FF6B3D'], on: '#FFFFFF'},
    emerald: {accent: '#0E9F6E', accent2: '#FFAA33', grad: ['#0E9F6E', '#34CFA0'], on: '#FFFFFF'},
    rose: {accent: '#E13F7A', accent2: '#8B5CF6', grad: ['#F2508A', '#FF92AE'], on: '#FFFFFF'}
  };
  const bases = {
    light: {bg: '#F5F5F8', surface: '#FFFFFF', surface2: '#F2F2F6', ink: '#15151E', muted: '#6E6E82', faint: '#E7E7EE', nav: '#15151E', line2: '#C9C9D6'},
    dark: {bg: '#0C0C11', surface: '#17171F', surface2: '#1F1F29', ink: '#F4F4F8', muted: '#9A9AAE', faint: '#2A2A36', nav: '#23232E', line2: '#4A4A5C'}
  };
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase();

  function theme(hue, mode) {
    const h = hues[hue], b = bases[mode], light = mode === 'light';
    const good = light ? '#11A05A' : '#3DDC84';
    return Object.assign({}, b, {
      mode, hue, accent: h.accent, accent2: h.accent2, on: h.on,
      grad: {from: h.grad[0], to: h.grad[1], dir: 'd'},
      soft: light ? mix(h.accent, '#FFFFFF', .87) : mix(h.accent, b.surface, .8),
      soft2: light ? mix(h.accent2, '#FFFFFF', .85) : mix(h.accent2, b.surface, .8),
      good, goodSoft: light ? mix(good, '#FFFFFF', .86) : mix(good, b.surface, .82),
      bad: light ? '#E5484D' : '#FF6B6B'
    });
  }

  const packs = {
    finance: {kw: /financ|budget|money|bank|spend|expense|wallet|invest|saving|payment|fintech|crypto|ledger/i, hue: 'violet', mode: 'light', name: 'Penny',
      hero: ['Know where', 'every dollar goes'], heroSub: ['Smart budgets that adapt to', 'the way you actually spend.'], cta: 'Get started', chip: '+4.2%',
      user: 'Ava Chen', handle: '@avachen', balLabel: 'Total balance', bal: '$12,480.20', delta: '+4.2% this month',
      actions: [['Send', 'plus'], ['Request', 'dot'], ['Top up', 'bars'], ['Cards', 'card']],
      listTitle: 'Recent activity', items: [['Blue Bottle Coffee', 'Today · Food', '-$6.40'], ['Salary', 'Yesterday · Income', '+$3,200'], ['Fresh Market', 'Mon · Groceries', '-$64.18']],
      detail: {kicker: 'Budget', title: 'Groceries', meta: 'Resets in 12 days', big: '$342', bigSub: 'of $500 spent this month', pct: .68, tiles: [['Avg / week', '$85.50'], ['Top store', 'Fresh Co.']], desc: ['You’re 18% under your usual pace.', 'Keep it up to save $64 this month.'], cta: 'Adjust budget'},
      stats: {title: 'Insights', segs: ['Week', 'Month', 'Year'], value: '$2,140', sub: 'Spent in October · 8% less than September', tip: '$312', list: 'Top categories', cats: [['Food & drink', 38], ['Transport', 22], ['Shopping', 18], ['Bills', 14]]},
      settings: ['Notifications', 'Linked accounts', 'Security', 'Appearance', 'Help & support'], pstats: [['24', 'Goals'], ['$4.2k', 'Saved'], ['12', 'Day streak']],
      web: {nav: ['Overview', 'Budgets', 'Accounts', 'Reports', 'Settings'], title: 'Overview', kpis: [['Net worth', '$84,210', '+2.4%'], ['Saved', '$1,320', '+12%'], ['Invested', '$22,400', '+5.6%'], ['Credit score', '782', '+14']], chart: 'Cash flow', side: 'Spending mix', rowsTitle: 'Latest transactions', cols: ['Merchant', 'Category', 'Date', 'Amount'], rows: [['Blue Bottle', 'Food', 'Oct 24', '-$6.40'], ['Salary', 'Income', 'Oct 23', '+$3,200']]},
      land: {nav: ['Product', 'Pricing', 'Stories', 'Help'], kicker: 'New · Shared budgets', title: ['Money, minus', 'the mess.'], sub: ['One calm, clear plan for every card and account,', 'so you always know exactly what’s left.'], cta: 'Start for free', cta2: 'See how it works', proof: '12,000+ households', proofSub: 'Rated 4.9 out of 5', features: [['Auto-budgets', 'Plans that adapt to real life.'], ['Shared goals', 'Save together with anyone.'], ['Bank-grade', 'Encrypted, private, always.']]}},
    fitness: {kw: /fitness|\brun|workout|gym|training|exercise|sport|cycling|athlet|marathon|coach/i, hue: 'coral', mode: 'dark', name: 'Stride',
      hero: ['Every run,', 'coached by you.'], heroSub: ['Adaptive plans that learn your pace', 'and grow with every mile.'], cta: 'Start running', chip: '+12%',
      user: 'Jordan Lee', handle: '@jordanruns', balLabel: 'This week', bal: '32.4 km', delta: '+12% vs last week',
      actions: [['Run', 'wave'], ['Plans', 'grid'], ['Stats', 'bars'], ['Gear', 'dot']],
      listTitle: 'Recent runs', items: [['Morning tempo', 'Today · 6:12 /km', '8.2 km'], ['River loop', 'Tue · 5:58 /km', '10.0 km'], ['Easy recovery', 'Sun · 6:40 /km', '5.1 km']],
      detail: {kicker: 'Workout', title: 'Sunset Tempo', meta: 'Today · 45 min · Riverside', big: '8.2 km', bigSub: 'Goal 10 km · 82% complete', pct: .82, tiles: [['Avg pace', '6:12 /km'], ['Heart rate', '152 bpm']], desc: ['Hold a comfortable-hard pace for 20 min,', 'then cool down with an easy 2 km.'], cta: 'Start workout'},
      stats: {title: 'Progress', segs: ['Week', 'Month', 'Year'], value: '128 km', sub: 'Run in October · 14 km more than September', tip: '22 km', list: 'Training mix', cats: [['Easy runs', 42], ['Tempo', 24], ['Long runs', 20], ['Intervals', 14]]},
      settings: ['Notifications', 'Connected watch', 'Audio coaching', 'Units & pace', 'Privacy'], pstats: [['86', 'Runs'], ['642', 'Kilometres'], ['21', 'Day streak']],
      web: {nav: ['Dashboard', 'Plans', 'Athletes', 'Races', 'Settings'], title: 'Training dashboard', kpis: [['Distance', '128 km', '+14%'], ['Avg pace', '6:04', '-0:08'], ['Elevation', '1,920 m', '+6%'], ['Recovery', '86%', '+3%']], chart: 'Weekly volume', side: 'Training mix', rowsTitle: 'Upcoming sessions', cols: ['Session', 'Type', 'Date', 'Distance'], rows: [['Sunset tempo', 'Tempo', 'Oct 24', '8 km'], ['Long Sunday', 'Endurance', 'Oct 26', '18 km']]},
      land: {nav: ['Coaching', 'Plans', 'Community', 'Pricing'], kicker: 'New · Race-day mode', title: ['Run further.', 'Feel better.'], sub: ['Stride builds a plan around your pace and your week,', 'then adapts it after every single run.'], cta: 'Start free trial', cta2: 'Explore plans', proof: '250,000+ runners', proofSub: 'Training in 120 countries', features: [['Adaptive plans', 'Every run tunes the next.'], ['Live coaching', 'Pacing cues in your ear.'], ['Recovery', 'Know when to push.']]}},
    travel: {kw: /travel|trip|flight|hotel|vacation|holiday|tour|journey|transit|metro|train|\bbus\b|commut|booking|itinerar/i, hue: 'ocean', mode: 'light', name: 'Wander',
      hero: ['Plan less.', 'Wander more.'], heroSub: ['Flights, stays and day plans', 'gathered in one calm itinerary.'], cta: 'Plan a trip', chip: '4 nights',
      user: 'Sam Rivera', handle: '@samwanders', balLabel: 'Next trip · Kyoto', bal: '12 days', delta: 'Departs Nov 3 · SFO to KIX',
      actions: [['Flights', 'wave'], ['Stays', 'grid'], ['Maps', 'pin'], ['Wallet', 'card']],
      listTitle: 'Itinerary', items: [['Fushimi Inari', 'Day 1 · 7:30 AM', 'Hike'], ['Nishiki Market', 'Day 1 · 12:00 PM', 'Food'], ['Arashiyama', 'Day 2 · 8:00 AM', 'Walk']],
      detail: {kicker: 'Stay', title: 'Riverside Ryokan', meta: 'Nov 3 – 7 · 4 nights · Arashiyama', big: '$1,240', bigSub: 'Total · free cancellation until Oct 30', pct: .55, tiles: [['Check-in', '3:00 PM'], ['Rating', '4.9 · 812']], desc: ['A quiet riverside inn reached by boat,', 'minutes from the bamboo grove.'], cta: 'Reserve stay'},
      stats: {title: 'Travel log', segs: ['2024', '2025', 'All'], value: '14 cities', sub: 'Visited this year across 6 countries', tip: '3 trips', list: 'Where you went', cats: [['Japan', 36], ['Portugal', 26], ['Mexico', 20], ['Iceland', 18]]},
      settings: ['Notifications', 'Travel documents', 'Payment methods', 'Offline maps', 'Help'], pstats: [['14', 'Cities'], ['38k', 'Miles'], ['6', 'Countries']],
      web: {nav: ['Trips', 'Explore', 'Bookings', 'Wallet', 'Settings'], title: 'Upcoming trips', kpis: [['Trips planned', '4', '+1'], ['Nights booked', '23', '+6'], ['Saved', '$860', '+18%'], ['Points', '42,800', '+3.2k']], chart: 'Spending by month', side: 'Budget split', rowsTitle: 'Bookings', cols: ['Booking', 'Type', 'Date', 'Price'], rows: [['SFO to KIX', 'Flight', 'Nov 3', '$842'], ['Riverside Ryokan', 'Stay', 'Nov 3', '$1,240']]},
      land: {nav: ['Explore', 'Guides', 'Pricing', 'Help'], kicker: 'New · Group trips', title: ['Plan less.', 'Wander more.'], sub: ['Wander turns bookings, maps and recommendations', 'into one beautiful itinerary you can share.'], cta: 'Plan a trip', cta2: 'Browse guides', proof: '1.2M trips planned', proofSub: 'By travellers in 140 countries', features: [['Smart itinerary', 'Bookings sorted for you.'], ['Offline maps', 'Never lost, even off-grid.'], ['Shared plans', 'Plan together, live.']]}},
    music: {kw: /music|song|playlist|audio|podcast|album|listen|radio|\bdj\b|band|concert/i, hue: 'lime', mode: 'dark', name: 'Echo',
      hero: ['Music that', 'moves with you.'], heroSub: ['Mixes tuned to your day, your mood', 'and the moment you are in.'], cta: 'Start listening', chip: 'Now live',
      user: 'Riley Park', handle: '@rileyp', balLabel: 'Now playing', bal: 'Midnight Drive', delta: 'Nova Lights · 2:14 / 3:48',
      actions: [['Mixes', 'wave'], ['Radio', 'ring'], ['Library', 'grid'], ['Live', 'dot']],
      listTitle: 'Jump back in', items: [['Golden Hour', 'Mira Sol · Single', '3:12'], ['Static Bloom', 'The Parallels', '4:05'], ['Low Tide', 'Kaia · Shorelines', '2:58']],
      detail: {kicker: 'Album', title: 'Afterglow', meta: 'Nova Lights · 2025 · 11 songs', big: '48 min', bigSub: 'Played 23 times this month', pct: .4, tiles: [['Top track', 'Low Tide'], ['Genre', 'Synth pop']], desc: ['Warm synths and late-night drums,', 'recorded live over one weekend.'], cta: 'Play album'},
      stats: {title: 'Listening', segs: ['Week', 'Month', 'Year'], value: '62 hours', sub: 'Listened in October · your top month yet', tip: '7.4 h', list: 'Top genres', cats: [['Synth pop', 34], ['Indie', 26], ['Lo-fi', 22], ['Jazz', 18]]},
      settings: ['Notifications', 'Audio quality', 'Downloads', 'Connected devices', 'Privacy'], pstats: [['1,284', 'Songs'], ['62h', 'This month'], ['48', 'Playlists']],
      web: {nav: ['Home', 'Discover', 'Library', 'Artists', 'Settings'], title: 'Artist studio', kpis: [['Listeners', '182k', '+9.4%'], ['Streams', '2.4M', '+12%'], ['Saves', '48.2k', '+6%'], ['Followers', '31.9k', '+4.1%']], chart: 'Streams over time', side: 'Top genres', rowsTitle: 'Top tracks', cols: ['Track', 'Album', 'Released', 'Streams'], rows: [['Midnight Drive', 'Afterglow', 'Sep 12', '812k'], ['Golden Hour', 'Single', 'Aug 2', '604k']]},
      land: {nav: ['Discover', 'Artists', 'Pricing', 'Help'], kicker: 'New · Live mixes', title: ['Sound that', 'follows you.'], sub: ['Echo learns what you love and builds a soundtrack', 'for every part of your day, automatically.'], cta: 'Try Echo free', cta2: 'Hear a mix', proof: '8M listeners', proofSub: 'Streaming in 90 countries', features: [['Daily mixes', 'Fresh picks every morning.'], ['Lossless audio', 'Studio quality, anywhere.'], ['Live sessions', 'Front row from the sofa.']]}},
    food: {kw: /food|meal|recipe|restaurant|cook|kitchen|grocer|deliver|cafe|coffee|\beat|dinner|lunch|bakery|pizza/i, hue: 'sun', mode: 'light', name: 'Ladle',
      hero: ['Fresh dinners,', 'zero guesswork.'], heroSub: ['Chef-built recipes, every ingredient', 'measured and delivered to your door.'], cta: 'Choose meals', chip: '30 min',
      user: 'Maya Ortiz', handle: '@mayacooks', balLabel: 'Next delivery', bal: 'Thursday', delta: '3 meals · arrives 4 – 6 PM',
      actions: [['Menu', 'grid'], ['Recipes', 'card'], ['Pantry', 'bars'], ['Offers', 'dot']],
      listTitle: 'This week’s menu', items: [['Miso salmon bowl', '25 min · 540 kcal', '$11.99'], ['Charred corn tacos', '20 min · 480 kcal', '$9.49'], ['Lemon orzo', '30 min · 610 kcal', '$10.99']],
      detail: {kicker: 'Recipe', title: 'Miso Salmon Bowl', meta: '25 min · Easy · Serves 2', big: '540', bigSub: 'Calories per serving · 38 g protein', pct: .6, tiles: [['Prep time', '10 min'], ['Difficulty', 'Easy']], desc: ['Glazed salmon over sushi rice with crisp', 'cucumber, edamame and toasted sesame.'], cta: 'Add to box'},
      stats: {title: 'Nutrition', segs: ['Day', 'Week', 'Month'], value: '1,860 kcal', sub: 'Daily average · right on target', tip: '2,040', list: 'Macros', cats: [['Carbs', 42], ['Protein', 28], ['Fat', 22], ['Fibre', 8]]},
      settings: ['Notifications', 'Delivery address', 'Dietary needs', 'Payment', 'Help'], pstats: [['46', 'Meals'], ['18', 'Recipes'], ['4.9', 'Avg rating']],
      web: {nav: ['Orders', 'Menu', 'Kitchens', 'Customers', 'Settings'], title: 'Kitchen overview', kpis: [['Orders today', '1,284', '+8.2%'], ['Revenue', '$18,940', '+11%'], ['Avg prep', '14 min', '-2 min'], ['Rating', '4.86', '+0.04']], chart: 'Orders this week', side: 'Popular dishes', rowsTitle: 'Live orders', cols: ['Order', 'Dish', 'Time', 'Total'], rows: [['#4821', 'Miso salmon', '6:42 PM', '$24.50'], ['#4822', 'Corn tacos', '6:44 PM', '$18.00']]},
      land: {nav: ['Menu', 'How it works', 'Pricing', 'Gifts'], kicker: 'New · Family plans', title: ['Dinner,', 'sorted.'], sub: ['Chef-built recipes and perfectly portioned ingredients,', 'delivered on your schedule. Cook in 30 minutes.'], cta: 'See the menu', cta2: 'How it works', proof: '3M meals delivered', proofSub: 'Fresh from 40 local farms', features: [['Chef recipes', 'A new menu every week.'], ['Zero waste', 'Exactly what you need.'], ['Flexible plans', 'Skip or pause anytime.']]}},
    tasks: {kw: /task|todo|to-do|project|kanban|sprint|team|productiv|planner|workflow|calendar|notes|crm/i, hue: 'emerald', mode: 'light', name: 'Orbit',
      hero: ['Your work,', 'finally in orbit.'], heroSub: ['Plans, tasks and teammates in one', 'calm space that keeps you moving.'], cta: 'Create workspace', chip: '3 done',
      user: 'Alex Kim', handle: '@alexk', balLabel: 'Today', bal: '7 tasks', delta: '3 done · 2 due before noon',
      actions: [['New task', 'plus'], ['Projects', 'grid'], ['Calendar', 'card'], ['Reports', 'bars']],
      listTitle: 'Up next', items: [['Review launch plan', 'Product · 10:00 AM', 'High'], ['Design sync', 'Team · 11:30 AM', 'Meet'], ['Write release notes', 'Docs · 2:00 PM', 'Med']],
      detail: {kicker: 'Project', title: 'Website Relaunch', meta: 'Due Nov 14 · 6 members', big: '68%', bigSub: 'Complete · 24 of 35 tasks done', pct: .68, tiles: [['Milestone', 'Beta'], ['Days left', '12']], desc: ['Ship the new marketing site with', 'refreshed pricing and case studies.'], cta: 'Open board'},
      stats: {title: 'Velocity', segs: ['Sprint', 'Month', 'Quarter'], value: '142 tasks', sub: 'Completed this month · 18% faster', tip: '19', list: 'By team', cats: [['Product', 34], ['Design', 28], ['Engineering', 24], ['Marketing', 14]]},
      settings: ['Notifications', 'Workspace', 'Integrations', 'Shortcuts', 'Help'], pstats: [['142', 'Completed'], ['9', 'Projects'], ['15', 'Day streak']],
      web: {nav: ['Home', 'My tasks', 'Projects', 'Inbox', 'Settings'], title: 'Product sprint', kpis: [['Open tasks', '38', '-6'], ['Completed', '142', '+18%'], ['On track', '92%', '+4%'], ['Cycle time', '2.4 d', '-0.3 d']], chart: 'Burndown', side: 'Workload', rowsTitle: 'Due this week', cols: ['Task', 'Project', 'Due', 'Owner'], rows: [['Launch checklist', 'Website', 'Nov 12', 'Alex'], ['Pricing page', 'Website', 'Nov 13', 'Priya']]},
      land: {nav: ['Product', 'Templates', 'Pricing', 'Customers'], kicker: 'New · AI summaries', title: ['Work that', 'flows.'], sub: ['Orbit brings plans, tasks and conversations together', 'so your team always knows what matters next.'], cta: 'Start for free', cta2: 'Book a demo', proof: '40,000+ teams', proofSub: 'From startups to enterprises', features: [['Boards & lists', 'See work your way.'], ['Automations', 'Busywork, handled.'], ['Insights', 'Know where time goes.']]}},
    wellness: {kw: /meditat|sleep|calm|mindful|wellness|wellbeing|yoga|breath|therapy|mood|journal|mental/i, hue: 'rose', mode: 'light', name: 'Hush',
      hero: ['Breathe in.', 'Sleep deeper.'], heroSub: ['Guided sessions and soundscapes', 'that help you unwind in minutes.'], cta: 'Begin a session', chip: '+38 min',
      user: 'Noor Haddad', handle: '@noorbreathes', balLabel: 'Mindful minutes', bal: '214 min', delta: '+38 min this week',
      actions: [['Breathe', 'ring'], ['Sleep', 'dot'], ['Focus', 'wave'], ['Journal', 'card']],
      listTitle: 'For tonight', items: [['Ocean wind-down', 'Sleep story', '20 min'], ['Body scan', 'Guided · Relax', '12 min'], ['Box breathing', 'Breathwork', '5 min']],
      detail: {kicker: 'Session', title: 'Evening Reset', meta: 'Guided · Noor · 15 min', big: '15 min', bigSub: 'Day 6 of your 10-day calm series', pct: .6, tiles: [['Focus', 'Unwinding'], ['Played', '2.1k today']], desc: ['Release the day with slow breathing', 'and a gentle full-body scan.'], cta: 'Play session'},
      stats: {title: 'Your calm', segs: ['Week', 'Month', 'Year'], value: '7h 42m', sub: 'Average sleep · 26 min more than last month', tip: '8h 10m', list: 'Sessions', cats: [['Sleep', 40], ['Breathing', 25], ['Focus', 20], ['Movement', 15]]},
      settings: ['Reminders', 'Sleep schedule', 'Health sync', 'Downloads', 'Help'], pstats: [['21', 'Day streak'], ['214', 'Minutes'], ['48', 'Sessions']],
      web: {nav: ['Today', 'Library', 'Programs', 'Members', 'Settings'], title: 'Studio overview', kpis: [['Members', '24,180', '+5.2%'], ['Minutes', '1.8M', '+12%'], ['Retention', '78%', '+2%'], ['Avg session', '14 min', '+1 min']], chart: 'Minutes listened', side: 'Popular programs', rowsTitle: 'New sessions', cols: ['Session', 'Category', 'Published', 'Plays'], rows: [['Evening reset', 'Sleep', 'Oct 20', '21.4k'], ['Desk stretch', 'Movement', 'Oct 18', '9.8k']]},
      land: {nav: ['Sessions', 'Sleep', 'Teams', 'Pricing'], kicker: 'New · Sleep stories', title: ['Calm,', 'on demand.'], sub: ['Short guided sessions and soundscapes that help you', 'focus by day and fall asleep faster at night.'], cta: 'Try Hush free', cta2: 'Hear a sample', proof: '5M mindful minutes', proofSub: 'Every single week', features: [['Sleep stories', 'Drift off in minutes.'], ['Breathwork', 'Reset in one minute.'], ['Daily streaks', 'Tiny habits that stick.']]}}
  };

  function generic(name) {
    return {hue: 'violet', mode: 'light', name,
      hero: ['Meet ' + name + '.', 'Built for your flow.'], heroSub: ['Everything you need in one calm,', 'beautifully simple space.'], cta: 'Get started', chip: '+12%',
      user: 'Taylor Brooks', handle: '@taylor', balLabel: 'This week', bal: '1,284', delta: '+12% since last week',
      actions: [['Create', 'plus'], ['Browse', 'grid'], ['Saved', 'dot'], ['Stats', 'bars']],
      listTitle: 'Recent', items: [['Weekly review', 'Today · 9:00 AM', 'New'], ['Team update', 'Yesterday · Post', '3 min'], ['Starter guide', 'Mon · Guide', '5 min']],
      detail: {kicker: 'Featured', title: name + ' Essentials', meta: 'Updated today · 6 min read', big: '92%', bigSub: 'Of people finish this in a week', pct: .72, tiles: [['Steps', '8'], ['Level', 'Beginner']], desc: ['A quick tour of everything you can do,', 'with tips from the people who built it.'], cta: 'Continue'},
      stats: {title: 'Insights', segs: ['Week', 'Month', 'Year'], value: '1,284', sub: 'Actions this month · 12% more than last', tip: '164', list: 'Breakdown', cats: [['Created', 38], ['Shared', 26], ['Saved', 20], ['Archived', 16]]},
      settings: ['Notifications', 'Account', 'Privacy', 'Appearance', 'Help & support'], pstats: [['128', 'Items'], ['24', 'Shared'], ['9', 'Day streak']],
      web: {nav: ['Home', 'Explore', 'Library', 'Team', 'Settings'], title: 'Overview', kpis: [['Active users', '12,480', '+8.4%'], ['Sessions', '48.2k', '+12%'], ['Conversion', '4.6%', '+0.4%'], ['Revenue', '$32.1k', '+9%']], chart: 'Activity', side: 'Top sources', rowsTitle: 'Recent activity', cols: ['Name', 'Type', 'Date', 'Status'], rows: [['Weekly review', 'Report', 'Oct 24', 'Done'], ['Team update', 'Post', 'Oct 23', 'Live']]},
      land: {nav: ['Product', 'Pricing', 'Customers', 'Help'], kicker: 'New · Version 2.0', title: ['Meet ' + name + '.', 'Simply better.'], sub: ['The simplest way to get it done, designed for', 'people who care about the details.'], cta: 'Get started', cta2: 'Watch the demo', proof: '20,000+ people', proofSub: 'Use it every single day', features: [['Fast by default', 'Everything in one click.'], ['Works everywhere', 'Phone, tablet and web.'], ['Private', 'Your data stays yours.']]}};
  }

  const stop = new Set('a an the app apps application ui ux screen screens design designs mobile web website site for with and of to my our that which simple modern beautiful clean minimal minimalist dark light mode new platform tool dashboard called named me make build create i want need some please using in on like style based about'.split(' '));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function productName(brief) {
    const quoted = brief.match(/["“]([^"“”\n]{1,24})["”]/);
    if (quoted) return quoted[1].trim();
    const called = brief.match(/\b(?:called|named)\s+([A-Za-z][\w-]{1,18})/i);
    if (called) return cap(called[1]);
    return null;
  }

  function pick(brief) {
    const text = brief || '';
    let key = Object.keys(packs).find(k => packs[k].kw.test(text));
    const named = productName(text);
    let pack;
    if (key) pack = Object.assign({}, packs[key]);
    else {
      const word = (text.toLowerCase().match(/[a-z]{3,}/g) || []).find(w => !stop.has(w));
      pack = generic((named || (word ? cap(word) : 'Nova')).slice(0, 14));
      key = 'generic';
    }
    let hue = pack.hue, mode = pack.mode;
    const colours = [[/purple|violet|lavender/i, 'violet'], [/\bred\b|coral|crimson/i, 'coral'], [/blue|ocean|navy|cyan/i, 'ocean'], [/lime|neon|electric/i, 'lime'], [/orange|yellow|gold|amber/i, 'sun'], [/green|emerald|mint|teal/i, 'emerald'], [/pink|rose|magenta/i, 'rose']];
    for (const [re, h] of colours) if (re.test(text)) { hue = h; break; }
    if (/\bdark|night|black|midnight/i.test(text)) mode = 'dark';
    else if (/\blight\b|white|bright|airy/i.test(text)) mode = 'light';
    if (hue === 'lime' && mode === 'light') hue = 'emerald';
    if (named && key !== 'generic') {
      const old = pack.name, swap = s => typeof s === 'string' ? s.split(old).join(named) : s;
      pack.name = named.slice(0, 14);
      pack.land = Object.assign({}, pack.land, {sub: pack.land.sub.map(swap)});
    }
    return {pack, theme: theme(hue, mode), domain: key};
  }

  /* ---------- drawing helpers ---------- */
  const est = (text, size, weight) => Math.ceil(Math.max(...String(text).split('\n').map(l => l.length)) * size * (weight >= 600 ? .58 : .54));
  function builder(name, width, height, background) {
    const layers = [];
    const push = o => (layers.push(o), o);
    const extra = (o, keys) => { const out = {}; for (const k of keys) if (o[k] !== undefined) out[k] = o[k]; return out; };
    const b = {
      screen: () => ({name, width, height, background, layers}),
      rect: (n, x, y, w, h, fill, o = {}) => push(Object.assign({kind: 'rect', name: n, x, y, w, h, fill}, extra(o, ['r', 'stroke', 'sw', 'shadow', 'opacity']))),
      oval: (n, x, y, w, h, fill, o = {}) => push(Object.assign({kind: 'ellipse', name: n, x, y, w, h, fill}, extra(o, ['stroke', 'sw', 'shadow', 'opacity']))),
      text: (n, text, x, y, size, fill, o = {}) => {
        const weight = o.weight || 400, lh = o.lh || 1.3, lines = String(text).split('\n').length;
        return push(Object.assign({kind: 'text', name: n, text, x, y, w: o.w || est(text, size, weight), h: Math.ceil(lines * size * lh), size, fill, weight, align: o.align || 'left', lh}, extra(o, ['opacity'])));
      },
      center: (n, text, cx, y, size, fill, o = {}) => { const w = o.w || est(text, size, o.weight || 400) + 8; return b.text(n, text, cx - w / 2, y, size, fill, Object.assign({}, o, {w, align: 'center'})); },
      right: (n, text, right, y, size, fill, o = {}) => { const w = o.w || est(text, size, o.weight || 400) + 4; return b.text(n, text, right - w, y, size, fill, Object.assign({}, o, {w, align: 'right'})); },
      line: (n, x, y, w, h, points, stroke, sw = 2.5) => push({kind: 'line', name: n, x, y, w, h, points, stroke, sw, fill: null})
    };
    return b;
  }

  function glyph(b, kind, cx, cy, s, color, label = 'Icon') {
    const n = label + ' glyph';
    switch (kind) {
      case 'plus': b.rect(n, cx - s / 2, cy - 1.25, s, 2.5, color, {r: 1.25}); b.rect(n, cx - 1.25, cy - s / 2, 2.5, s, color, {r: 1.25}); break;
      case 'ring': b.oval(n, cx - s / 2 + 1, cy - s / 2 + 1, s - 2, s - 2, null, {stroke: color, sw: 2.2}); break;
      case 'bars': [.45, .75, 1].forEach((k, i) => b.rect(n, cx - s / 2 + i * s * .38, cy + s / 2 - s * k, s * .24, s * k, color, {r: 1.5})); break;
      case 'grid': [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([i, j]) => b.rect(n, cx - s / 2 + i * s * .56, cy - s / 2 + j * s * .56, s * .44, s * .44, color, {r: 2})); break;
      case 'card': b.rect(n, cx - s / 2, cy - s * .36, s, s * .72, null, {r: 3, stroke: color, sw: 2}); b.rect(n, cx - s / 2, cy - s * .12, s, 2.4, color); break;
      case 'wave': b.line(n, cx - s / 2, cy - s * .32, s, s * .64, [[0, .6], [.25, 0], [.5, .85], [.75, .15], [1, .55]], color, 2.2); break;
      case 'pin': b.oval(n, cx - s / 2 + 1, cy - s / 2 + 1, s - 2, s - 2, null, {stroke: color, sw: 2.2}); b.oval(n, cx - s * .16, cy - s * .16, s * .32, s * .32, color); break;
      default: b.oval(n, cx - s * .32, cy - s * .32, s * .64, s * .64, color);
    }
  }
  function status(b, color) {
    b.text('Time', '9:41', 30, 15, 15, color, {weight: 600});
    [5, 7.5, 10].forEach((h, i) => b.rect('Signal', 292 + i * 5.5, 29 - h, 3.5, h, color, {r: 1}));
    b.rect('Battery', 318, 18.5, 25, 12.5, null, {r: 4, stroke: color, sw: 1.2, opacity: .45});
    b.rect('Battery level', 320.5, 21, 17, 7.5, color, {r: 2});
    b.rect('Battery cap', 344.5, 22.5, 1.8, 4.5, color, {r: 1, opacity: .45});
  }
  const indicator = (b, color) => b.rect('Home indicator', 128, 830, 134, 5, color, {r: 2.5});
  const initials = name => name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const trend = [[0, .72], [.12, .58], [.24, .64], [.37, .42], [.5, .5], [.62, .3], [.75, .38], [.88, .16], [1, .08]];
  const bars12 = [38, 52, 44, 61, 48, 72, 66, 58, 80, 74, 92, 86];
  const curveA = [[0, .78], [.1, .7], [.2, .74], [.3, .56], [.4, .6], [.5, .42], [.6, .48], [.7, .3], [.8, .36], [.9, .16], [1, .1]];
  const curveB = [[0, .86], [.1, .82], [.2, .8], [.3, .72], [.4, .76], [.5, .64], [.6, .66], [.7, .58], [.8, .6], [.9, .5], [1, .46]];
  const icons = ['dot', 'bars', 'grid', 'card', 'ring', 'wave', 'plus', 'pin'];

  /* ---------- screens ---------- */
  function onboarding(P, T) {
    const b = builder(P.name + ' · Welcome', 390, 844, T.bg), sheet = T.mode === 'light' ? T.surface : T.bg;
    b.rect('Hero', 0, 0, 390, 540, T.grad);
    b.oval('Hero glow', -90, 40, 300, 300, '#FFFFFF', {opacity: .13});
    b.oval('Hero glow', 220, 250, 260, 260, '#FFFFFF', {opacity: .1});
    status(b, T.on);
    b.rect('Preview card', 58, 156, 274, 176, T.surface, {r: 26, shadow: true});
    b.rect('Preview icon', 80, 178, 40, 40, T.soft, {r: 12}); glyph(b, P.actions[0][1], 100, 198, 16, T.accent, 'Preview');
    b.text('Preview label', P.balLabel, 132, 178, 12.5, T.muted, {weight: 500});
    b.text('Preview value', P.bal, 132, 195, 19, T.ink, {weight: 700});
    bars12.slice(4, 11).forEach((v, i) => { const h = v * .62; b.rect('Preview bar', 80 + i * 34, 312 - h, 18, h, i === 5 ? T.accent : T.soft, {r: 5}); });
    b.rect('Delta chip', 216, 116, 136, 40, T.surface, {r: 20, shadow: true});
    b.oval('Delta dot', 232, 130, 12, 12, T.good);
    b.text('Delta chip label', P.chip, 252, 127, 13, T.ink, {weight: 600});
    b.rect('Sheet', 0, 500, 390, 400, sheet, {r: 34});
    b.rect('Page dot', 24, 532, 26, 8, T.accent, {r: 4});
    b.oval('Page dot', 56, 532, 8, 8, T.faint); b.oval('Page dot', 70, 532, 8, 8, T.faint);
    b.text('Headline', P.hero.join('\n'), 24, 558, 32, T.ink, {weight: 700, lh: 1.15});
    b.text('Subhead', P.heroSub.join('\n'), 24, 644, 16, T.muted, {lh: 1.45});
    b.rect('Primary button', 24, 722, 342, 58, T.accent, {r: 18});
    b.center('Primary button label', P.cta, 195, 740.6, 16, T.on, {weight: 600, w: 300});
    b.center('Sign in link', 'I already have an account', 195, 796, 14, T.muted, {weight: 500, w: 300});
    indicator(b, T.ink);
    return b.screen();
  }

  function home(P, T) {
    const b = builder(P.name + ' · Home', 390, 844, T.bg), light = T.mode === 'light';
    status(b, T.ink);
    b.oval('Avatar', 24, 62, 46, 46, {from: T.accent2, to: T.accent, dir: 'd'});
    b.center('Avatar initials', initials(P.user), 47, 74.6, 16, '#FFFFFF', {weight: 700, w: 46});
    b.text('Greeting', 'Good morning', 84, 64, 13, T.muted, {weight: 500});
    b.text('User name', P.user, 84, 82, 18, T.ink, {weight: 700});
    b.rect('Notifications', 322, 62, 44, 44, T.surface, light ? {r: 22, stroke: T.faint, sw: 1} : {r: 22});
    glyph(b, 'ring', 344, 84, 16, T.ink, 'Notifications');
    b.oval('Unread badge', 352, 68, 10, 10, T.accent2);
    b.rect('Balance card', 24, 126, 342, 200, T.grad, {r: 28, shadow: true});
    b.oval('Card glow', 246, 140, 104, 104, '#FFFFFF', {opacity: .12});
    b.oval('Card glow', 188, 214, 96, 96, '#FFFFFF', {opacity: .08});
    b.text('Balance label', P.balLabel, 48, 150, 14, T.on, {weight: 500, opacity: .82});
    b.text('Balance', P.bal, 48, 172, 34, T.on, {weight: 700, lh: 1.2});
    const dw = est(P.delta, 12, 600) + 24;
    b.rect('Delta pill', 48, 222, dw, 28, '#FFFFFF', {r: 14, opacity: .2});
    b.text('Delta', P.delta, 60, 228.2, 12, T.on, {weight: 600});
    b.line('Balance trend', 48, 264, 294, 44, trend, T.on, 2.5);
    P.actions.forEach(([label, kind], k) => {
      const x = 24 + k * 90;
      b.rect(label + ' action', x, 350, 72, 72, T.surface, light ? {r: 22, stroke: T.faint, sw: 1} : {r: 22});
      glyph(b, kind, x + 36, 386, 20, T.accent, label);
      b.center(label + ' label', label, x + 36, 430, 12.5, T.muted, {weight: 500, w: 84});
    });
    b.text('Section title', P.listTitle, 24, 470, 18, T.ink, {weight: 700});
    b.right('See all', 'See all', 366, 473, 14, T.accent, {weight: 600, w: 80});
    b.rect('List card', 24, 506, 342, 222, T.surface, {r: 24, shadow: light});
    P.items.slice(0, 3).forEach(([title, meta, value], i) => {
      const y = 516 + i * 70;
      b.rect(title + ' icon', 40, y + 12, 44, 44, i % 2 ? T.soft2 : T.soft, {r: 14});
      glyph(b, icons[(i + 1) % icons.length], 62, y + 34, 16, i % 2 ? T.accent2 : T.accent, title);
      b.text(title, title, 98, y + 14, 15, T.ink, {weight: 600});
      b.text(title + ' meta', meta, 98, y + 36, 12.5, T.muted);
      b.right(title + ' value', value, 350, y + 24, 15, value.startsWith('+') ? T.good : T.ink, {weight: 600, w: 90});
      if (i < 2) b.rect('Divider', 98, y + 69, 252, 1, T.faint);
    });
    b.rect('Tab bar', 58, 750, 274, 62, T.nav, {r: 31, shadow: true});
    b.rect('Active tab', 66, 758, 96, 46, T.accent, {r: 23});
    glyph(b, 'grid', 90, 781, 15, T.on, 'Home tab');
    b.text('Home tab label', 'Home', 104, 772.5, 13, T.on, {weight: 600});
    const dim = mix('#FFFFFF', T.nav, .45);
    ['bars', 'ring', 'dot'].forEach((k, i) => glyph(b, k, 202 + i * 50, 781, 17, dim, ['Stats', 'Search', 'Profile'][i] + ' tab'));
    indicator(b, T.ink);
    return b.screen();
  }

  function detail(P, T) {
    const D = P.detail, light = T.mode === 'light';
    const b = builder(P.name + ' · ' + D.kicker, 390, 844, light ? T.surface : T.bg);
    b.rect('Cover', 0, 0, 390, 380, T.grad);
    b.oval('Cover shape', 170, -70, 300, 300, '#FFFFFF', {opacity: .12});
    b.oval('Cover shape', -70, 170, 230, 230, T.accent2, {opacity: .35});
    b.oval('Cover shape', 250, 196, 120, 120, '#FFFFFF', {opacity: .16});
    status(b, T.on);
    b.rect('Back button', 24, 58, 44, 44, '#FFFFFF', {r: 22, opacity: .22});
    b.center('Back arrow', '‹', 46, 61, 26, T.on, {weight: 500, w: 44});
    b.rect('Save button', 322, 58, 44, 44, '#FFFFFF', {r: 22, opacity: .22});
    glyph(b, 'dot', 344, 80, 14, T.on, 'Save');
    const kicker = D.kicker.toUpperCase(), kw = est(kicker, 11.5, 700) + 24;
    b.rect('Kicker', 24, 270, kw, 28, '#FFFFFF', {r: 14, opacity: .24});
    b.text('Kicker label', kicker, 36, 276.5, 11.5, T.on, {weight: 700});
    b.text('Title', D.title, 24, 306, 30, T.on, {weight: 700, lh: 1.2});
    b.rect('Sheet', 0, 360, 390, 540, light ? T.surface : T.bg, {r: 32});
    b.text('Meta', D.meta, 24, 392, 14, T.muted, {weight: 500});
    b.text('Big number', D.big, 24, 418, 44, T.ink, {weight: 700, lh: 1.15});
    b.text('Big number label', D.bigSub, 24, 472, 14.5, T.muted);
    b.rect('Progress track', 24, 508, 342, 10, T.faint, {r: 5});
    b.rect('Progress', 24, 508, Math.round(342 * D.pct), 10, T.accent, {r: 5});
    D.tiles.forEach(([label, value], k) => {
      const x = 24 + k * 179;
      b.rect(label + ' tile', x, 544, 163, 92, light ? T.bg : T.surface, {r: 20});
      b.text(label, label, x + 18, 564, 12.5, T.muted, {weight: 500});
      b.text(label + ' value', value, x + 18, 586, 19, T.ink, {weight: 700});
    });
    b.text('Description', D.desc.join('\n'), 24, 662, 15, T.muted, {lh: 1.5});
    b.rect('Primary button', 24, 740, 342, 58, T.accent, {r: 18, shadow: light});
    b.center('Primary button label', D.cta, 195, 758.6, 16, T.on, {weight: 600, w: 300});
    indicator(b, T.ink);
    return b.screen();
  }

  function insights(P, T) {
    const S = P.stats, light = T.mode === 'light';
    const b = builder(P.name + ' · ' + S.title, 390, 844, T.bg);
    status(b, T.ink);
    b.text('Title', S.title, 24, 62, 30, T.ink, {weight: 700, lh: 1.2});
    b.rect('Filter button', 322, 60, 44, 44, T.surface, light ? {r: 22, stroke: T.faint, sw: 1} : {r: 22});
    glyph(b, 'grid', 344, 82, 14, T.ink, 'Filter');
    b.rect('Segmented control', 24, 116, 342, 44, light ? '#EBEBF1' : T.surface, {r: 14});
    const seg = 334 / 3;
    b.rect('Selected segment', 28 + seg, 120, seg, 36, light ? T.surface : T.surface2, {r: 11, shadow: light});
    S.segs.forEach((s, k) => b.center(s + ' segment', s, 28 + seg * (k + .5), 128.9, 14, k === 1 ? T.ink : T.muted, {weight: k === 1 ? 600 : 500, w: 100}));
    b.text('Total', S.value, 24, 182, 34, T.ink, {weight: 700, lh: 1.2});
    b.text('Total label', S.sub, 24, 228, 14, T.muted);
    b.rect('Chart card', 24, 264, 342, 238, T.surface, {r: 24, shadow: light});
    b.text('Chart caption', 'Last 12 months', 44, 284, 13, T.muted, {weight: 500});
    const max = Math.max(...bars12);
    bars12.forEach((v, i) => {
      const h = v / max * 128, x = 46 + i * 25;
      b.rect('Bar ' + (i + 1), x, 462 - h, 14, h, i === 10 ? T.accent : T.soft, {r: 5});
      b.center('Month', 'JFMAMJJASOND'[i], x + 7, 470, 11, i === 10 ? T.ink : T.muted, {weight: 500, w: 16});
    });
    b.rect('Tooltip', 269, 300, 68, 26, light ? T.ink : T.surface2, {r: 9});
    b.center('Tooltip value', S.tip, 303, 305.4, 12, light ? '#FFFFFF' : T.ink, {weight: 600, w: 64});
    b.text('Section title', S.list, 24, 526, 18, T.ink, {weight: 700});
    const top = Math.max(...S.cats.map(c => c[1]));
    S.cats.forEach(([cat, pct], i) => {
      const y = 562 + i * 64, col = i % 2 ? T.accent2 : T.accent;
      b.rect(cat + ' icon', 24, y, 44, 44, i % 2 ? T.soft2 : T.soft, {r: 14});
      glyph(b, icons[(i + 2) % icons.length], 46, y + 22, 16, col, cat);
      b.text(cat, cat, 82, y + 3, 15, T.ink, {weight: 600});
      b.rect(cat + ' track', 82, y + 30, 214, 6, T.faint, {r: 3});
      b.rect(cat + ' fill', 82, y + 30, Math.round(214 * pct / top), 6, col, {r: 3});
      b.right(cat + ' share', pct + '%', 366, y + 12, 15, T.ink, {weight: 600, w: 56});
    });
    indicator(b, T.ink);
    return b.screen();
  }

  function profile(P, T) {
    const light = T.mode === 'light', b = builder(P.name + ' · Profile', 390, 844, T.bg);
    b.rect('Header', 0, 0, 390, 256, T.grad);
    b.oval('Header glow', -60, -80, 240, 240, '#FFFFFF', {opacity: .12});
    b.oval('Header glow', 262, 116, 200, 200, '#FFFFFF', {opacity: .1});
    status(b, T.on);
    b.text('Header title', 'Profile', 24, 64, 20, T.on, {weight: 700});
    b.rect('Settings button', 322, 56, 44, 44, '#FFFFFF', {r: 22, opacity: .22});
    glyph(b, 'grid', 344, 78, 14, T.on, 'Settings');
    b.oval('Avatar ring', 143, 178, 104, 104, T.bg);
    b.oval('Avatar', 149, 184, 92, 92, {from: T.accent2, to: T.accent, dir: 'd'});
    b.center('Avatar initials', initials(P.user), 195, 210.5, 30, '#FFFFFF', {weight: 700, w: 92});
    b.oval('Status ring', 219, 254, 22, 22, T.bg);
    b.oval('Online', 223, 258, 14, 14, T.good);
    b.center('Name', P.user, 195, 294, 22, T.ink, {weight: 700, w: 300});
    b.center('Handle', P.handle, 195, 324, 14, T.muted, {weight: 500, w: 300});
    b.rect('Stats card', 24, 362, 342, 88, T.surface, {r: 22, shadow: light});
    P.pstats.forEach(([v, label], k) => {
      const cx = 81 + k * 114;
      b.center(label + ' value', v, cx, 378, 20, T.ink, {weight: 700, w: 104});
      b.center(label, label, cx, 408, 12.5, T.muted, {weight: 500, w: 104});
      if (k < 2) b.rect('Divider', 138 + k * 114, 380, 1, 52, T.faint);
    });
    b.rect('Settings card', 24, 472, 342, 300, T.surface, {r: 22, shadow: light});
    P.settings.forEach((s, i) => {
      const y = 472 + i * 60;
      b.rect(s + ' icon', 40, y + 12, 36, 36, i % 2 ? T.soft2 : T.soft, {r: 11});
      glyph(b, icons[(i + 4) % icons.length], 58, y + 30, 14, i % 2 ? T.accent2 : T.accent, s);
      b.text(s, s, 90, y + 20, 15, T.ink, {weight: 500});
      if (i === 0) { b.rect('Toggle', 308, y + 18, 42, 24, T.accent, {r: 12}); b.oval('Toggle knob', 328, y + 21, 18, 18, '#FFFFFF'); }
      else b.right('Chevron', '›', 352, y + 15.7, 22, T.muted, {w: 16});
      if (i < 4) b.rect('Divider', 90, y + 59.5, 260, 1, T.faint);
    });
    b.center('Sign out', 'Sign out', 195, 792, 15, T.bad, {weight: 600, w: 200});
    indicator(b, T.ink);
    return b.screen();
  }

  function dashboard(P, T) {
    const W = P.web, light = T.mode === 'light', b = builder(P.name + ' · Dashboard', 1280, 800, T.bg);
    b.rect('Sidebar', 0, 0, 248, 800, T.surface);
    b.rect('Sidebar border', 247, 0, 1, 800, T.faint);
    b.rect('Logo', 28, 28, 36, 36, T.grad, {r: 11}); glyph(b, 'dot', 46, 46, 16, T.on, 'Logo');
    b.text('Product name', P.name, 76, 35, 18, T.ink, {weight: 700});
    W.nav.forEach((label, i) => {
      const y = 100 + i * 48;
      if (!i) b.rect('Active nav', 16, y, 216, 40, T.soft, {r: 12});
      glyph(b, icons[i % icons.length], 40, y + 20, 15, i ? T.muted : T.accent, label);
      b.text(label + ' nav', label, 62, y + 10.6, 14.5, i ? T.muted : (light ? T.accent : T.ink), {weight: i ? 500 : 600});
    });
    b.rect('Upgrade card', 16, 620, 216, 160, T.grad, {r: 20});
    b.oval('Upgrade glow', 150, 640, 70, 70, '#FFFFFF', {opacity: .14});
    b.text('Upgrade title', 'Go Pro', 36, 642, 17, T.on, {weight: 700});
    b.text('Upgrade copy', 'Unlock reports, exports\nand unlimited history.', 36, 670, 12.5, T.on, {lh: 1.45, opacity: .85});
    b.rect('Upgrade button', 36, 726, 112, 36, '#FFFFFF', {r: 11});
    b.center('Upgrade label', 'Upgrade', 92, 735.2, 13, '#15151E', {weight: 700, w: 100});
    b.text('Page title', W.title, 288, 34, 26, T.ink, {weight: 700, lh: 1.2});
    b.text('Date', 'Thursday, October 24', 288, 70, 14, T.muted);
    b.rect('Search', 720, 34, 300, 44, T.surface, {r: 14, stroke: T.faint, sw: 1});
    glyph(b, 'ring', 746, 56, 14, T.muted, 'Search');
    b.text('Search placeholder', 'Search anything…', 766, 47, 14, T.muted);
    b.rect('Notifications', 1036, 34, 44, 44, T.surface, {r: 14, stroke: T.faint, sw: 1});
    glyph(b, 'ring', 1058, 56, 15, T.ink, 'Notifications');
    b.oval('Unread badge', 1066, 42, 9, 9, T.accent2);
    b.oval('Avatar', 1094, 34, 44, 44, {from: T.accent2, to: T.accent, dir: 'd'});
    b.center('Avatar initials', initials(P.user), 1116, 46.2, 15, '#FFFFFF', {weight: 700, w: 44});
    b.text('User name', P.user, 1150, 37, 14, T.ink, {weight: 600});
    b.text('User role', 'Admin', 1150, 57, 12.5, T.muted);
    W.kpis.forEach(([label, value, delta], k) => {
      const x = 288 + k * 243;
      b.rect(label + ' card', x, 112, 223, 132, T.surface, {r: 20, shadow: light});
      b.rect(label + ' icon', x + 20, 132, 38, 38, k % 2 ? T.soft2 : T.soft, {r: 12});
      glyph(b, icons[(k + 1) % icons.length], x + 39, 151, 16, k % 2 ? T.accent2 : T.accent, label);
      const dw = est(delta, 12, 600) + 20;
      b.rect(label + ' delta', x + 203 - dw, 138, dw, 26, T.goodSoft, {r: 13});
      b.text(label + ' delta label', delta, x + 213 - dw, 143.2, 12, T.good, {weight: 600});
      b.text(label, label, x + 20, 186, 13, T.muted, {weight: 500});
      b.text(label + ' value', value, x + 20, 206, 24, T.ink, {weight: 700, lh: 1.2});
    });
    b.rect('Chart card', 288, 268, 620, 316, T.surface, {r: 20, shadow: light});
    b.text('Chart title', W.chart, 312, 290, 17, T.ink, {weight: 700});
    b.oval('Legend', 712, 297, 10, 10, T.accent); b.text('Legend label', 'This year', 728, 292.5, 13, T.muted, {weight: 500});
    b.oval('Legend', 808, 297, 10, 10, T.line2); b.text('Legend label', 'Last year', 824, 292.5, 13, T.muted, {weight: 500});
    [350, 400, 450, 500].forEach(y => b.rect('Grid line', 312, y, 572, 1, T.faint));
    b.line('Last year', 312, 334, 572, 186, curveB, T.line2, 2.5);
    b.line('This year', 312, 334, 572, 186, curveA, T.accent, 3);
    ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].forEach((m, i) => b.center(m, m, 332 + i * 106, 540, 12, T.muted, {weight: 500, w: 40}));
    b.rect('Breakdown card', 928, 268, 312, 316, T.surface, {r: 20, shadow: light});
    b.text('Breakdown title', W.side, 952, 290, 17, T.ink, {weight: 700});
    const cats = P.stats.cats, sum = cats.reduce((n, c) => n + c[1], 0), cols = [T.accent, T.accent2, mix(T.accent, T.ink, .35), T.line2];
    let x = 952;
    cats.forEach(([cat, v], i) => { const w = Math.max(8, 264 * v / sum - 4); b.rect(cat + ' segment', x, 334, w, 14, cols[i], {r: 5}); x += w + 4; });
    cats.forEach(([cat, v], i) => {
      const y = 378 + i * 50;
      b.oval(cat + ' dot', 952, y + 4.5, 10, 10, cols[i]);
      b.text(cat + ' name', cat, 972, y, 14, T.ink, {weight: 500});
      b.right(cat + ' share', Math.round(v / sum * 100) + '%', 1216, y, 14, T.ink, {weight: 600, w: 50});
      if (i < 3) b.rect('Divider', 952, y + 33, 264, 1, T.faint);
    });
    b.rect('Table card', 288, 604, 952, 176, T.surface, {r: 20, shadow: light});
    b.text('Table title', W.rowsTitle, 312, 624, 17, T.ink, {weight: 700});
    b.right('View all', 'View all', 1216, 626, 13.5, light ? T.accent : T.ink, {weight: 600, w: 80});
    const cx = [312, 620, 860];
    W.cols.forEach((c, i) => i < 3 ? b.text(c + ' column', c.toUpperCase(), cx[i], 664, 11.5, T.muted, {weight: 600}) : b.right(c + ' column', c.toUpperCase(), 1216, 664, 11.5, T.muted, {weight: 600, w: 100}));
    b.rect('Header divider', 312, 688, 904, 1, T.faint);
    W.rows.forEach((row, j) => {
      const y = 700 + j * 40, col = j ? T.accent2 : T.accent;
      b.oval(row[0] + ' avatar', 312, y + 2, 26, 26, j ? T.soft2 : T.soft);
      b.center(row[0] + ' initial', row[0].replace(/[^A-Za-z0-9]/g, '')[0] || '#', 325, y + 7.2, 12, light ? col : T.ink, {weight: 700, w: 26});
      b.text(row[0], row[0], 350, y + 5.9, 14, T.ink, {weight: 600});
      const cw = est(row[1], 12, 600) + 20;
      b.rect(row[1] + ' tag', 620, y + 3, cw, 24, j ? T.soft2 : T.soft, {r: 12});
      b.text(row[1] + ' tag label', row[1], 630, y + 7.2, 12, light ? col : T.ink, {weight: 600});
      b.text(row[0] + ' date', row[2], 860, y + 5.9, 14, T.muted);
      b.right(row[0] + ' amount', row[3], 1216, y + 5.9, 14, row[3].startsWith('+') ? T.good : T.ink, {weight: 600, w: 100});
      if (!j) b.rect('Divider', 312, y + 36, 904, 1, T.faint);
    });
    return b.screen();
  }

  function landing(P, T) {
    const L = P.land, light = T.mode === 'light', bg = light ? T.surface : T.bg;
    const b = builder(P.name + ' · Landing', 1280, 800, bg);
    b.oval('Glow', 720, -220, 720, 720, T.soft);
    b.oval('Glow', 1000, 320, 460, 460, T.soft2, {opacity: .8});
    b.rect('Logo', 64, 32, 34, 34, T.grad, {r: 10}); glyph(b, 'dot', 81, 49, 14, T.on, 'Logo');
    b.text('Product name', P.name, 108, 38, 18, T.ink, {weight: 700});
    L.nav.forEach((n, i) => b.text(n + ' link', n, 470 + i * 112, 41, 14.5, T.muted, {weight: 500}));
    b.text('Sign in', 'Sign in', 1030, 41, 14.5, T.ink, {weight: 600});
    b.rect('Nav button', 1104, 30, 112, 40, T.ink, {r: 12});
    b.center('Nav button label', 'Get started', 1160, 40.6, 13.5, light ? '#FFFFFF' : '#0C0C11', {weight: 600, w: 104});
    const kw = est(L.kicker, 13, 600) + 44;
    b.rect('Kicker', 64, 148, kw, 34, T.soft, {r: 17});
    b.oval('Kicker dot', 80, 161, 8, 8, T.accent);
    b.text('Kicker label', L.kicker, 96, 156.5, 13, light ? T.accent : T.ink, {weight: 600});
    b.text('Headline', L.title.join('\n'), 64, 204, 64, T.ink, {weight: 800, lh: 1.05});
    b.text('Subhead', L.sub.join('\n'), 64, 362, 18, T.muted, {lh: 1.5});
    const cw = est(L.cta, 16, 600) + 56, c2 = est(L.cta2, 16, 600) + 56;
    b.rect('Primary CTA', 64, 452, cw, 58, T.accent, {r: 16, shadow: true});
    b.center('Primary CTA label', L.cta, 64 + cw / 2, 470.6, 16, T.on, {weight: 600, w: cw - 16});
    b.rect('Secondary CTA', 78 + cw, 452, c2, 58, T.surface, {r: 16, stroke: T.faint, sw: 1.5});
    b.center('Secondary CTA label', L.cta2, 78 + cw + c2 / 2, 470.6, 16, T.ink, {weight: 600, w: c2 - 16});
    [T.accent, T.accent2, mix(T.accent, T.ink, .35), mix(T.accent2, '#FFFFFF', .3)].forEach((c, k) => b.oval('Customer avatar', 64 + k * 26, 552, 38, 38, c, {stroke: bg, sw: 3}));
    b.text('Social proof', L.proof, 190, 552, 15, T.ink, {weight: 700});
    b.text('Social proof detail', L.proofSub, 190, 573, 13, T.muted);
    const body = light ? '#15151E' : '#2A2A34';
    b.rect('Phone', 820, 96, 280, 560, body, {r: 46, shadow: true});
    b.rect('Phone screen', 832, 108, 256, 536, T.bg, {r: 36});
    b.rect('Phone notch', 920, 118, 80, 22, body, {r: 11});
    b.rect('Mini card', 848, 158, 224, 132, T.grad, {r: 22});
    b.text('Mini label', P.balLabel, 866, 176, 11, T.on, {weight: 500, opacity: .85});
    b.text('Mini value', P.bal, 866, 192, 22, T.on, {weight: 700});
    b.line('Mini trend', 866, 238, 188, 34, trend, T.on, 2);
    [96, 120, 80].forEach((w, k) => {
      const y = 306 + k * 62;
      b.rect('Mini row', 848, y, 224, 50, T.surface, {r: 14});
      b.rect('Mini icon', 858, y + 9, 32, 32, k % 2 ? T.soft2 : T.soft, {r: 10});
      b.rect('Skeleton', 900, y + 14, w, 8, T.line2, {r: 4});
      b.rect('Skeleton', 900, y + 29, [64, 52, 72][k], 7, T.faint, {r: 3.5});
    });
    b.rect('Mini chart', 848, 498, 224, 76, T.surface, {r: 14});
    [24, 36, 28, 44, 32, 40].forEach((h, k) => b.rect('Mini bar', 866 + k * 33, 562 - h, 18, h, k === 3 ? T.accent : T.soft, {r: 4}));
    b.rect('Mini button', 848, 588, 224, 40, T.accent, {r: 14});
    b.rect('Floating card', 690, 470, 214, 92, T.surface, {r: 22, shadow: true});
    b.rect('Floating icon', 708, 490, 52, 52, T.soft2, {r: 16});
    glyph(b, 'bars', 734, 516, 20, T.accent2, 'Floating');
    b.text('Floating label', P.web.kpis[1][0], 772, 494, 12.5, T.muted, {weight: 500});
    b.text('Floating value', P.web.kpis[1][1], 772, 512, 20, T.ink, {weight: 700});
    b.rect('Floating chip', 1040, 200, 190, 70, T.surface, {r: 20, shadow: true});
    b.oval('Chip dot', 1058, 221, 28, 28, T.goodSoft);
    b.oval('Chip dot inner', 1066, 229, 12, 12, T.good);
    b.text('Chip label', P.chip, 1098, 214, 15, T.ink, {weight: 700});
    b.text('Chip detail', 'this week', 1098, 236, 12.5, T.muted);
    L.features.forEach(([title, desc], k) => {
      const x = 64 + k * 392;
      b.rect(title + ' card', x, 668, 368, 100, light ? '#F6F6FA' : T.surface, {r: 22});
      b.rect(title + ' icon', x + 24, 692, 52, 52, k % 2 ? T.soft2 : T.soft, {r: 16});
      glyph(b, ['wave', 'grid', 'ring'][k], x + 50, 718, 20, k % 2 ? T.accent2 : T.accent, title);
      b.text(title, title, x + 92, 696, 17, T.ink, {weight: 700});
      b.text(title + ' copy', desc, x + 92, 722, 14, T.muted);
    });
    return b.screen();
  }

  function build(brief) {
    const {pack, theme: T, domain} = pick(brief);
    const screens = [onboarding, home, detail, insights, profile, dashboard, landing].map(f => f(pack, T));
    return {name: pack.name, domain, theme: {mode: T.mode, hue: T.hue, accent: T.accent}, screens};
  }

  const samples = [
    'A budgeting app called "Penny"',
    'Running coach app, dark mode',
    'Travel planner for trips to Japan',
    'Late-night music player in neon lime',
    'Meal kit delivery app called "Ladle"',
    'Team task manager in emerald green',
    'Sleep and meditation app in rose pink'
  ];
  return {build, pick, samples, hues: Object.keys(hues)};
})();

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

// Find what Iris built earlier for this design, by the ids stored on each node.
function scan(design) {
  const frames = new Map(), nodes = new Map();
  for (const f of figma.currentPage.children) {
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
  if (prev && anchor) { const f = found.frames.get(anchor.id); dx = f.x - anchor.x; dy = f.y - anchor.y; }
  else {
    let ox = Math.round(figma.viewport.center.x - B.w / 2), oy = Math.round(figma.viewport.center.y - B.h / 2);
    const existing = page.children.map(n => n.absoluteBoundingBox).filter(Boolean);
    if (existing.length) { ox = Math.max(...existing.map(b => b.x + b.width)) + 400; oy = Math.min(...existing.map(b => b.y)); }
    dx = ox - B.x; dy = oy - B.y;
  }
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
  run = {P, board, prev, design, doc: m.doc, dx, dy, fonts, crewLayer, t: 0, speed: m.speed || 1, paused: false, last: Date.now(), lastPost: 0,
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
  const wantType = L.kind === 'text' ? 'TEXT' : L.kind === 'line' ? 'VECTOR' : L.kind === 'icon' ? 'FRAME' : L.kind === 'ellipse' ? 'ELLIPSE' : 'RECTANGLE';
  // Icons are rebuilt when their glyph or colour changes; any node of the wrong type is replaced.
  if (n && (n.type !== wantType || (L.kind === 'icon' && c.glyph !== undefined && c.glyph !== ls.icon + ls.color) || (L.kind === 'icon' && c.glyph === undefined && ref.prev && (ref.prev.icon !== ls.icon || ref.prev.stroke !== ls.color)))) { n.remove(); n = null; }
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
  const paint = ls.fill >= .45 ? ls.fillTo : ls.fillFrom, look = key([paint, L.stroke, L.sw, L.shadow, S.dark]);
  if (c.look !== look) {
    c.look = look;
    const placeholder = paint === Crew.PLACEHOLDER;
    n.fills = L.fill || (paint && !placeholder) ? paints(paint) : [];
    if (L.stroke || (!L.fill && placeholder)) { n.strokes = [solid(placeholder && !L.fill ? Crew.PLACEHOLDER : L.stroke)]; n.strokeWeight = L.sw || 1; n.strokeAlign = 'CENTER'; } else n.strokes = [];
    n.effects = L.shadow && !placeholder ? [{type: 'DROP_SHADOW', color: S.dark ? {r: 0, g: 0, b: 0, a: .5} : {r: .086, g: .086, b: .19, a: .13}, offset: {x: 0, y: 10}, radius: 30, spread: 0, visible: true, blendMode: 'NORMAL', showShadowBehindNode: false}] : [];
  }
  if (L.kind === 'rect') { const rad = exact ? ls.radius : Math.round(ls.radius * 2) / 2; if (c.r !== rad) { c.r = rad; n.cornerRadius = rad; } }
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
  if (r.doc) figma.currentPage.setPluginData(DOC_KEY, JSON.stringify(r.doc));
  figma.commitUndo();
  if (silent) return;
  const frames = r.board.screens.map(S => r.frames.get(S.id)).filter(f => f && !f.removed);
  if (!r.prev) { figma.currentPage.selection = frames; figma.viewport.scrollAndZoomIntoView(frames); }
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
    else if (n.type === 'VECTOR') out.fill = first(n.strokes);
    else if (n.type === 'RECTANGLE' || n.type === 'ELLIPSE') out.fill = first(n.fills);
    nodes.push(out);
  }
  return {screens: [...found.frames.keys()], nodes};
}

figma.ui.onmessage = async m => {
  try {
    if (m.kind === 'ui-ready') {
      try { const k = await figma.clientStorage.getAsync('iris-key'); if (k) post({kind: 'key', key: k}); } catch (e) { /* storage unavailable */ }
      const saved = figma.currentPage.getPluginData(DOC_KEY);
      if (saved) { try { const doc = JSON.parse(saved); if (scan(doc.id).frames.size) post({kind: 'restore', doc}); } catch (e) { /* ignore a damaged record */ } }
    } else if (m.kind === 'save-key') await figma.clientStorage.setAsync('iris-key', String(m.key || ''));
    else if (m.kind === 'build') await start(m);
    else if (m.kind === 'readback') post({kind: 'readback', id: m.id, read: run ? null : readback(m.design)});
    else if (m.kind === 'pause' && run) { run.paused = true; post({kind: 'tick', t: run.t, state: 'paused'}); }
    else if (m.kind === 'resume' && run) { run.paused = false; run.last = Date.now(); post({kind: 'tick', t: run.t, state: 'running'}); }
    else if (m.kind === 'speed' && run) run.speed = m.speed;
    else if (m.kind === 'cancel') cancel();
  } catch (e) { stop(); post({kind: 'error', text: String(e && e.message || e)}); }
};
figma.on('close', () => { if (run) finish(true); });
