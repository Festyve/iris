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
