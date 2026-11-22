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
    if (kind === 'rect' && typeof v.art === 'string' && /^[a-z0-9-]+\/(?:v2\/)?\d{1,3}$/.test(v.art)) out.art = v.art;
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
