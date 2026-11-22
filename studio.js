/* Iris studio: design from a brief, change it with words, and watch the crew do the work,
   either on the pannable canvas here or live in Figma through the plugin. */
(() => {
  const $ = id => document.getElementById(id);
  const query = new URLSearchParams(location.search);
  const isPlugin = query.has('plugin') || (window.parent !== window && !query.has('browser'));
  if (isPlugin) document.body.classList.add('plugin');
  const api = isPlugin ? 'http://localhost:4739' : location.origin;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const COUNTS = isPlugin ? [25, 50, 100, 250] : [50, 100, 250, 500, 1000];
  const SPEEDS = [.5, 1, 2, 4];
  const KIND_STYLE = {
    frame: ['#8B6CFF', '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M9 4v16"/>'],
    paint: ['#D46CFF', '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'],
    draw: ['#3D8BFF', '<rect x="5" y="5" width="14" height="14" rx="1"/><path d="M3 3l3 3M21 21l-3-3"/>'],
    fill: ['#FF6FB1', '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3" fill="currentColor"/>'],
    round: ['#FFB86B', '<path d="M5 19V11a6 6 0 0 1 6-6h8"/>'],
    snap: ['#FF3D7F', '<path d="M4 12h16M12 4v16"/><rect x="8" y="8" width="8" height="8"/>'],
    type: ['#3DDC97', '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'],
    trace: ['#1FC7E8', '<path d="M3 17c3-8 6 2 9-5s6-3 9-7"/>'],
    icon: ['#A78BFA', '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'],
    erase: ['#FF6B6B', '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>']
  };
  const PLACEHOLDER = Crew.PLACEHOLDER;

  let count = isPlugin ? 100 : 250, speed = 1, mode = 'new';
  let doc = null, board = null, P = null, t = 0, playing = false, finishedShown = false, lastFrame = performance.now();
  let revisions = [], rev = -1, busy = false;
  let cam = {x: 0, y: 0, z: .3}, camGoal = null, userMoved = false;
  let service = {design: false, voice: false}, token = '', connected = false;
  let pluginState = 'idle';
  const canvas = $('board'), ctx = canvas.getContext('2d');
  let W = 1, H = 1, dpr = 1;

  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lum = hex => { const n = parseInt(String(hex).slice(1), 16); return ((n >> 16 & 255) * .299 + (n >> 8 & 255) * .587 + (n & 255) * .114) / 255; };
  const easeOut = p => 1 - Math.pow(1 - p, 3);
  const initials = name => name.replace(/\s\d+$/, '').slice(0, 2).toUpperCase();
  const canDesign = () => connected;

  /* ---------- controls ---------- */
  const seg = $('crew-size');
  COUNTS.forEach(n => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = n >= 1000 ? (n / 1000) + 'k' : n; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(n === count));
    b.title = n + ' cursors';
    b.onclick = () => { count = n; for (const x of seg.children) x.setAttribute('aria-checked', String(x === b)); if (board && !isPlugin && !busy) start(board, true, P ? P.prev : null); };
    seg.appendChild(b);
  });

  const sugg = $('suggest'), brief = $('brief');
  const dots = ['#6E56F8', '#FF5A4E', '#2D6BFF', '#C5F23A', '#EA7212', '#0E9F6E', '#E13F7A'];
  const edits = ['Set accent to #146C94', 'Change headline to Field Notes'];
  const samples = ['A coffee shop called “Daybreak”','A Tokyo travel planner','An agency called “West Fold”', 'A developer handbook called “Fieldwork”', 'A product called “Northline”', 'A poker website called “River Room”', ...Kit.samples];
  function fillSuggestions() {
    const list = mode === 'edit' ? edits : samples;
    sugg.innerHTML = '<div class="hint">' + (mode === 'edit' ? 'Try a change' : 'Try a brief') + '</div>' + list.map((s, i) => '<button type="button" data-i="' + i + '"><i style="background:' + dots[i % dots.length] + '"></i>' + esc(s) + '</button>').join('');
  }
  sugg.addEventListener('mousedown', e => e.preventDefault());
  sugg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; brief.value = (mode === 'edit' ? edits : samples)[+b.dataset.i]; sugg.hidden = true; go(); });
  $('samples').innerHTML = samples.map((x, i) => '<button type="button" data-i="' + i + '">' + esc(x) + '</button>').join('');
  $('samples').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; setMode('new'); brief.value = samples[+b.dataset.i]; go(); });
  brief.addEventListener('focus', () => { fillSuggestions(); sugg.hidden = false; });
  brief.addEventListener('blur', () => { sugg.hidden = true; });
  brief.addEventListener('input', () => { sugg.hidden = !!brief.value.trim(); });
  $('prompt').addEventListener('submit', e => { e.preventDefault(); sugg.hidden = true; brief.blur(); go(); });
  $('dice').onclick = () => { setMode('new'); const pool = samples.filter(s => s !== brief.value); brief.value = pool[Math.floor(Math.random() * pool.length)]; go(); };

  function setMode(m) {
    mode = m === 'edit' && doc ? 'edit' : 'new';
    $('mode').textContent = mode === 'edit' ? 'Edit ' + (doc.name.length > 12 ? doc.name.slice(0, 11) + '…' : doc.name) : 'New';
    $('mode').setAttribute('aria-pressed', String(mode === 'edit'));
    $('mode').title = mode === 'edit' ? 'Changing the current design. Click to start a new one.' : 'Starting a new design. Click to change the current one.';
    $('workflow').hidden = mode === 'edit';
    brief.placeholder = mode==='edit' && doc?.reference?.kind==='html-css' ? 'Replace “old text” with “new text”' : mode === 'edit' ? 'Describe a change, like “Change headline to Field Notes”' : 'Describe a website or product';
    $('build-label').textContent = mode === 'edit' ? 'Apply' : $('workflow').value === 'guided' ? 'Plan' : 'Build';
    brief.setAttribute('aria-label', mode === 'edit' ? 'Describe a change' : 'Describe a product');
    $('prompt').classList.toggle('editing', mode === 'edit');
  }
  if(isPlugin)$('workflow').value='vault';
  $('workflow').onchange = () => setMode(mode);
  $('mode').onclick = () => { if (!doc) return; setMode(mode === 'edit' ? 'new' : 'edit'); brief.value = ''; brief.focus(); };

  $('gear').onclick = e => { e.stopPropagation(); $('settings').hidden = !$('settings').hidden; if (!$('settings').hidden) $('token').focus(); };
  document.addEventListener('click', e => { if (!$('settings').hidden && !e.target.closest('#settings') && !e.target.closest('#gear')) $('settings').hidden = true; });

  async function call(path, body, type, timeout = 300000) {
    const headers = {Authorization: 'Bearer ' + token};
    if (body) headers['Content-Type'] = type || 'application/json';
    const r = await fetch(api + path, {method: body ? 'POST' : 'GET', headers, body, signal: AbortSignal.timeout(timeout)});
    const data = await r.json(); if (!r.ok) throw Error(data.error || 'Service unavailable');
    return data;
  }
  function updateNotice(problem) {
    $('template-notice').hidden = canDesign();
    $('notice-title').textContent = 'Connect to Iris';
    $('notice-text').textContent = problem || 'Open the private browser link printed by node server.mjs, or enter the session key in Settings.';
  }
  $('connect-cta').onclick = e => { e.stopPropagation(); $('settings').hidden = false; $('token').focus(); };
  async function connect() {
    token = $('token').value.trim(); connected = false;
    if (!token) { $('ai-state').textContent = 'Paste the session key that node server.mjs prints.'; updateNotice(); return; }
    try {
      service = await call('/status', null, null, 8000); connected = true;
      try { localStorage.setItem('iris-key', token); } catch (e) { /* storage may be unavailable */ }
      if (isPlugin) parent.postMessage({pluginMessage: {kind: 'save-key', key: token}}, '*');
      $('ai-state').textContent = 'Connected.' + (service.voice ? ' Voice is on.' : '');
      $('mode-label').textContent = 'Connected';
      $('mic').hidden = !service.voice;
      if (doc && !busy) setMode('edit');
      updateNotice();
      $('settings').hidden = true;
      loadProfiles();
    } catch (e) {
      const why = /401|unauthorized|session key/i.test(e.message) ? 'The session key doesn’t match. Copy the key that node server.mjs prints.' : 'Can’t reach the Iris service. Start it with node server.mjs in the iris folder.';
      $('ai-state').textContent = why;
      updateNotice(why);
    }
  }
  $('connect').onclick = connect;

  /* ---------- design profiles (house styles from the reference vault) ---------- */
  let profiles = [];
  const profileSel = $('profile');
  const profileName = () => { const p = profiles.find(x => x.id === profileSel.value); return p ? p.name : 'No house style'; };
  function showProfile() {
    const p = profiles.find(x => x.id === profileSel.value);
    $('profile-note').textContent = !canDesign() ? 'Connect Iris to design in a house style from the reference vault.'
      : p ? p.tagline : profiles.length ? 'Choose a house style to steer it.' : 'No profiles found. Add notes to vault/Profiles.';
  }
  function setProfile(id) {
    id = String(id || '').trim(); if (id === 'none') id = '';
    if (id && !profiles.some(p => p.id === id)) return false;
    profileSel.value = id; showProfile();
    try { localStorage.setItem('iris-profile', id); } catch (e) { /* storage may be unavailable */ }
    return true;
  }
  async function loadProfiles() {
    try { profiles = (await call('/profiles', null, null, 8000)).profiles || []; } catch (e) { profiles = []; }
    profileSel.replaceChildren(new Option('No house style', ''), ...profiles.map(p => new Option(p.name, p.id)));
    profileSel.disabled = busy || !canDesign() || !profiles.length;
    let saved = null; try { saved = localStorage.getItem('iris-profile'); } catch (e) { /* storage may be unavailable */ }
    profileSel.value = saved !== null && (saved === '' || profiles.some(p => p.id === saved)) ? saved : profiles.some(p => p.id === 'general') ? 'general' : '';
    showProfile();
  }
  profileSel.onchange = () => setProfile(profileSel.value);

  let recorder = null;
  $('mic').onclick = async () => {
    if (recorder && recorder.state === 'recording') { recorder.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true}), chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(x => x.stop()); $('mic').classList.remove('recording');
        try { const r = await call('/voice', new Blob(chunks, {type: recorder.mimeType}), recorder.mimeType || 'audio/webm', 60000); brief.value = r.text; go(); }
        catch (e) { toast(e.message); }
      };
      recorder.start(); $('mic').classList.add('recording');
      setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 15000);
    } catch (e) { toast('Microphone unavailable here. Type instead.'); }
  };

  let libraryBusy=false;
  let nextCapture=null;
  let librarySite=null;
  function libraryStatus(message,active) {
    $('library-status').hidden=!message;
    libraryBusy=active; $('build-library').disabled=active; $('library-status').textContent=message;
    $('build').disabled=active || busy;
  }
  $('build-library').onclick=()=>{
    if(!isPlugin || busy || libraryBusy || pluginState==='running' || pluginState==='starting')return;
    libraryStatus('Opening the website library…',true);
    parent.postMessage({pluginMessage:{kind:'library-open'}},'*');
  };
  async function importedDesign(note,match){
    const name=Websites.brandOf(note,match),measurements={};
    await Promise.all(CodeSites.panels(match.id).map(async panel=>{
      measurements[panel.id]=await measureCodePage(CodeMarkup[panel.source],panel.width,name);
    }));
    return Doc.clean(Websites.build(note,match,measurements));
  }
  async function reflowWebsite(next){
    const names=new Set(next.nodes.filter(n=>n.copyRole==='brand').map(n=>n.text));
    if(names.size===1){
      const name=[...names][0].slice(0,60);
      for(const screen of next.screens)if(screen.name.startsWith(next.name+' · '))screen.name=name+screen.name.slice(next.name.length);
      next.name=name;
    }
    for(const screen of next.screens){
      const html=CodeMarkup[screen.vaultSource];
      if(!html)continue;
      const children=next.nodes.filter(n=>n.parent===screen.id);
      const copy=Object.fromEntries(children.filter(n=>n.type==='text').map(n=>[n.slot,n.text]));
      const layout=await measureCodePage(html,screen.w,next.name,copy);
      const measured=new Map(layout.nodes.map(n=>[n.id,n]));
      screen.h=layout.h;
      for(const n of children){
        const box=measured.get(n.slot);
        if(box)Object.assign(n,{x:box.x,y:box.y,w:box.w,h:box.h,displayText:box.displayText,measuredText:box.text});
      }
    }
  }
  async function libraryEntry(m) {
    try {
      const site=CodeIndex.find(s=>s.id===m.id);
      libraryStatus((m.done+1)+' of '+m.total+' · '+site.title,true);
      const next=await importedDesign(site.title,{id:site.id,site});
      revisions=[];rev=-1;librarySite=m.id;nextCapture=null;
      setMode('new'); brief.value='';
      commit(next,'Building '+next.name,null,'Website library');
    } catch(error) {libraryStatus('Paused. '+error.message+' Open the library again to resume.',false);}
  }

  /* ---------- designing and editing ---------- */
  // While Claude works, the headline counts the seconds so it's clear something is happening.
  let busyTimer = 0, busyHead = '';
  function setBusy(on, head, sub) {
    for (const control of [brief, profileSel, $('workflow'), $('mode'), $('dice')]) {
      control.disabled = on || (control === profileSel && !profiles.length);
    }
    $('request-status').textContent = head ? [head, sub].filter(Boolean).join(' · ') : '';
    busy = on; $('build').disabled = on; document.body.classList.toggle('thinking', on);
    clearInterval(busyTimer);
    if (head) { busyHead = head; setHead(head, sub || ''); }
    if (on) {
      const t0 = Date.now();
      busyTimer = setInterval(() => {
        const s = Math.round((Date.now() - t0) / 1000);
        $('headline').textContent = busyHead + ' ' + (s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's');
      }, 1000);
    }
  }
  function chooseDirection(plan) {
    const dialog = $('direction-dialog');
    const choices = $('directions');
    choices.replaceChildren();
    for (const item of plan.directions) {
      const button = document.createElement('button');
      button.type = 'button';
      const title = document.createElement('strong');
      title.textContent = item.label + (item.id === plan.recommended ? ' · Recommended' : '');
      button.append(title, document.createTextNode(item.reason));
      button.onclick = () => dialog.close(item.id);
      choices.append(button);
    }
    const references = (plan.references || []).map(ref => typeof ref === 'string' ? ref : ref.source || ref.title || ref.name).filter(Boolean);
    $('plan-refs').textContent = references.length ? 'References · ' + references.join(', ') : '';
    dialog.returnValue = '';
    return new Promise(resolve => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue), {once: true});
      dialog.showModal();
    });
  }

  async function go(automatic = false) {
    if (busy || libraryBusy) return;
    const note = brief.value.trim();
    if (!note) { brief.focus(); return; }
    if(mode==='new' && ($('workflow').value==='vault' || /\b(website|homepage|landing page|web site)\b/i.test(note))) {
      try {
        const reference=Websites.match(note);
        nextCapture=null;
        setBusy(true,'Measuring the source layout…',reference.site.title);
        const next=await importedDesign(note,reference);
        setBusy(false);
        commit(next,'Built from “'+note+'”',null,'Vault · '+reference.site.title);
        setMode('edit');brief.value='';
      } catch(error){setBusy(false,'Could not build the vault website',error.message);}
      return;
    }
    if (mode === 'edit' && doc) { await change(note); return; }
    if (!connected) {
      $('settings').hidden = false;
      $('token').focus();
      return;
    }
    const request = {note, profile: profileSel.value};
    const guided = !automatic && $('workflow').value === 'guided';
    try {
      setBusy(true, 'Planning directions…', note);
      const plan = await call('/brief-plan', JSON.stringify(request));
      if (!Array.isArray(plan.directions) || !plan.directions.length ||
          !plan.directions.every(d => d && d.id && d.label && d.reason)) {
        throw Error('The planner returned no usable directions. Try the brief again.');
      }
      let direction = plan.recommended;
      if (guided) {
        setBusy(true, 'Choose a direction', note);
        direction = await chooseDirection(plan);
        if (!direction) { setBusy(false, 'Plan closed', 'Your brief is ready to revise.'); return; }
      }
      const chosen = plan.directions.find(d => d.id === direction);
      setBusy(true, 'Building your design…', chosen?.label || note);
      const result = await call('/board', JSON.stringify({...request, direction: chosen?.id}));
      if (result.doc?.reference?.setups || result.summary === 'Built locally.') {
        throw Error('The service returned a legacy template. Restart Iris with the brief composer enabled.');
      }
      const next = Doc.clean(result.doc);
      setBusy(false);
      const reference = plan.references?.find(ref => ref.direction === chosen?.id);
      const decision = chosen && [chosen.label + (chosen.id === plan.recommended ? ' (recommended)' : ''), chosen.reason, reference?.source].filter(Boolean).join(' · ');
      commit(next, result.summary || 'Built from “' + note + '”', null, decision);
      $('mode-label').textContent = result.execution === 'expected-parrot' ? 'Expected Parrot interpretation'
        : result.execution === 'local' ? 'Local composition' : 'Connected';
      setMode('edit'); brief.value = '';
    } catch (error) { setBusy(false, 'Could not build that', error.message); }
  }
  async function change(text) {
    const replace=doc?.reference?.kind==='html-css' && text.match(/^replace\s+["“]([^"”]+)["”]\s+with\s+["“]([^"”]{1,300})["”]\s*[.!]?$/i);
    if (!canDesign() && !replace) {
      setHead('Connect to Iris to make changes', 'Open ⚙ and connect the local Iris service, then describe the change again.');
      $('settings').hidden = false; return;
    }
    try {
      setBusy(true, 'Iris is changing ' + doc.name + '…', '“' + text + '” · Applying a targeted edit.');
      let base = doc, baseBoard = board;
      if (isPlugin) {
        const read = await readback();
        if (read) {
          const m = Doc.merge(doc, board, read);
          if (m.notes.length) { base = m.doc; baseBoard = Screens.checkBoard(Doc.compile(base), true); setHead(busyHead, 'Including your edits in Figma: ' + m.notes.slice(0, 3).join(', ') + (m.notes.length > 3 ? '…' : '')); }
        }
      }
      const r = replace ? {
        ops:base.nodes.filter(n=>n.type==='text' && n.text===replace[1]).map(n=>({op:'set',id:n.id,node:{text:replace[2]}})),
        summary:'Replace “'+replace[1]+'” with “'+replace[2]+'”'
      } : await call('/edit', JSON.stringify({doc: base, note: text, profile: profileSel.value}));
      const res = Doc.apply(base, r.ops || []);
      if (!res.applied.length) { setBusy(false, 'No changes made', r.summary || 'Iris could not map that request onto this design. Try rephrasing it.'); return; }
      if(res.doc.reference?.kind==='html-css' && res.applied.length)await reflowWebsite(res.doc);
      setBusy(false);
      commit(res.doc, r.summary || text, baseBoard, res.skipped.length ? res.skipped.length + ' step' + (res.skipped.length > 1 ? 's' : '') + ' skipped' : null);
      brief.value = '';
    } catch (e) { setBusy(false, 'Could not make that change', e.message); }
  }
  function commit(nextDoc, label, prevBoard, note) {
    const b = Screens.checkBoard(Doc.compile(nextDoc), true);
    Doc.pin(nextDoc, b);
    doc = nextDoc;
    revisions = prevBoard ? revisions.slice(0, rev + 1) : [];
    revisions.push({doc: nextDoc, board: b, label, note, at: new Date()});
    rev = revisions.length - 1;
    renderHistory();
    start(b, !!prevBoard, prevBoard);
  }
  function restore(i) {
    if (busy || i === rev || !revisions[i]) return;
    const from = board; rev = i; doc = revisions[i].doc;
    renderHistory();
    start(revisions[i].board, true, from);
  }
  function renderHistory() {
    $('history-block').hidden = !revisions.length;
    $('history').innerHTML = revisions.map((r, i) => '<li><button data-i="' + i + '" class="' + (i === rev ? 'on' : '') + '"' + (i > rev ? ' data-ahead="1"' : '') + '><b class="num">v' + (i + 1) + '</b><span>' + esc(r.label) + (r.note ? '<small>' + esc(r.note) + '</small>' : '') + '</span></button></li>').reverse().join('');
    $('undo').disabled = rev <= 0; $('redo').disabled = rev >= revisions.length - 1;
  }
  $('history').addEventListener('click', e => { const b = e.target.closest('button'); if (b) restore(+b.dataset.i); });
  $('undo').onclick = () => restore(rev - 1);
  $('redo').onclick = () => restore(rev + 1);

  function start(b, keepCamera, prevBoard) {
    board = b;
    P = Crew.plan(board, count, {prev: prevBoard || null});
    for (const E of P.screens) E.S.dark = lum(E.S.background) < .4;
    t = reducedMotion.matches && !isPlugin ? P.total : 0; finishedShown = false; playing = t < P.total;
    $('toast').classList.remove('show');
    $('done-actions').hidden = true;
    $('board-chip').hidden = false; $('empty').hidden = true;
    const n = board.screens.reduce((s, x) => s + x.layers.length, 0);
    $('board-name').textContent = board.name;
    $('board-meta').textContent = board.screens.length + (board.screens.length===1?' screen · ':' screens · ') + n + ' layers' + (doc?.reference ? ' · '+doc.reference.title : '');
    status = new Array(P.layers.length).fill(-1); who = new Array(P.layers.length).fill(-1); lastRow.length = 0;
    buildTree(); buildActs(); lastFeedKey = '';
    if (!keepCamera || !userMoved) { fit(true); userMoved = false; }
    if (isPlugin) { pluginState = 'starting'; parent.postMessage({pluginMessage: {kind: 'build', board, images:buildImages(board,prevBoard), prev: prevBoard || null, doc, count, speed: reducedMotion.matches ? Number.MAX_SAFE_INTEGER : librarySite ? 4 : speed,png:nextCapture,libraryId:librarySite}}, '*'); nextCapture=null; librarySite=null; }
    setPlayIcon();
  }

  /* ---------- camera ---------- */
  function resize() {
    const r = canvas.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gridKey = '';
    if (P && !userMoved) fit(true);
  }
  new ResizeObserver(resize).observe(canvas);
  function frameRect(x, y, w, h, padX = 70, padTop = 70, padBottom = 96) {
    const z = clamp(Math.min((W - padX * 2) / w, (H - padTop - padBottom) / h), .04, 4);
    return {z, x: x + w / 2 - W / 2 / z, y: y + h / 2 - (padTop + (H - padTop - padBottom) / 2) / z};
  }
  function fit(instant) {
    if (!P) return;
    const B = P.bounds, m = Math.max(B.w, B.h) * .05;
    const goal = frameRect(B.x - m, B.y - m, B.w + 2 * m, B.h + 2 * m, 40, 60, 80);
    if (instant) { cam = goal; camGoal = null; } else camGoal = goal;
  }
  function zoomAt(px, py, factor) {
    const z = clamp(cam.z * factor, .04, 6);
    cam.x += px / cam.z - px / z; cam.y += py / cam.z - py / z; cam.z = z; camGoal = null; userMoved = true;
  }
  $('zoom-in').onclick = () => zoomAt(W / 2, H / 2, 1.25);
  $('zoom-out').onclick = () => zoomAt(W / 2, H / 2, 1 / 1.25);
  $('fit').onclick = () => { userMoved = false; fit(false); };
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    if (e.ctrlKey || e.metaKey) zoomAt(px, py, Math.exp(-e.deltaY * .01));
    else { cam.x += e.deltaX / cam.z; cam.y += e.deltaY / cam.z; camGoal = null; userMoved = true; }
  }, {passive: false});
  const pointers = new Map(); let pinch = null, drag = null, hover = null;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = {d: Math.hypot(a.x - b.x, a.y - b.y)}; drag = null; }
    else { drag = {x: e.clientX, y: e.clientY}; canvas.classList.add('panning'); }
    $('tip').hidden = true;
  });
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, d / pinch.d); pinch.d = d; return;
    }
    if (drag) { cam.x -= (e.clientX - drag.x) / cam.z; cam.y -= (e.clientY - drag.y) / cam.z; drag = {x: e.clientX, y: e.clientY}; camGoal = null; userMoved = true; return; }
    hover = {x: e.clientX - r.left, y: e.clientY - r.top};
  });
  const release = e => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; if (!pointers.size) { drag = null; canvas.classList.remove('panning'); } };
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => { hover = null; $('tip').hidden = true; });
  canvas.addEventListener('dblclick', e => {
    if (!board) return;
    const r = canvas.getBoundingClientRect(), bx = (e.clientX - r.left) / cam.z + cam.x, by = (e.clientY - r.top) / cam.z + cam.y;
    const s = board.screens.find(s => bx >= s.x && bx <= s.x + s.width && by >= s.y && by <= s.y + s.height);
    if (s) { camGoal = frameRect(s.x, s.y, s.width, s.height); userMoved = true; } else { userMoved = false; fit(false); }
  });

  /* ---------- playback ---------- */
  function setPlayIcon() {
    const on = isPlugin ? pluginState === 'running' : playing;
    $('play-ico').innerHTML = on ? '<rect x="5" y="4" width="5" height="16" rx="1.5"/><rect x="14" y="4" width="5" height="16" rx="1.5"/>' : '<path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z"/>';
    $('play').setAttribute('aria-label', on ? 'Pause' : 'Play');
  }
  function togglePlay() {
    if (!P) { go(); return; }
    if (isPlugin) {
      if (pluginState === 'running') parent.postMessage({pluginMessage: {kind: 'pause'}}, '*');
      else if (pluginState === 'paused') parent.postMessage({pluginMessage: {kind: 'resume'}}, '*');
      return;
    }
    if (!playing && t >= P.total) { t = 0; finishedShown = false; $('done-actions').hidden = true; }
    playing = !playing; setPlayIcon();
  }
  $('play').onclick = togglePlay;
  const replay = () => { if (!P || isPlugin) return; t = 0; playing = true; finishedShown = false; $('done-actions').hidden = true; $('toast').classList.remove('show'); setPlayIcon(); };
  $('restart').onclick = replay; $('replay').onclick = replay;
  $('speed').onclick = () => {
    speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; $('speed').textContent = speed + '×';
    if (isPlugin) parent.postMessage({pluginMessage: {kind: 'speed', speed}}, '*');
  };
  $('cancel').onclick = () => parent.postMessage({pluginMessage: {kind: 'cancel'}}, '*');
  const scrub = $('scrub');
  let scrubbing = null;
  function scrubTo(e) { const r = scrub.getBoundingClientRect(); t = clamp((e.clientX - r.left) / r.width, 0, 1) * P.total; if (t < P.total) { finishedShown = false; $('done-actions').hidden = true; } }
  scrub.addEventListener('pointerdown', e => { if (!P || isPlugin) return; scrub.setPointerCapture(e.pointerId); scrubbing = {resume: playing}; playing = false; scrubTo(e); });
  scrub.addEventListener('pointermove', e => { if (scrubbing) scrubTo(e); });
  scrub.addEventListener('pointerup', () => { if (!scrubbing) return; playing = scrubbing.resume && t < P.total; scrubbing = null; setPlayIcon(); });
  scrub.addEventListener('keydown', e => { if (!P || isPlugin) return; if (e.key === 'ArrowRight') t = Math.min(P.total, t + 1); if (e.key === 'ArrowLeft') t = Math.max(0, t - 1); });
  document.addEventListener('keydown', e => {
    if (e.target.closest('input,textarea')) { if (e.key === 'Escape') e.target.blur(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); restore(e.shiftKey ? rev + 1 : rev - 1); return; }
    if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    else if (e.key === 'f' || e.key === 'F') { userMoved = false; fit(false); }
    else if (e.key === 'r' || e.key === 'R') replay();
    else if (e.key === '=' || e.key === '+') zoomAt(W / 2, H / 2, 1.25);
    else if (e.key === '-') zoomAt(W / 2, H / 2, .8);
    else if (e.key === 'Escape') $('settings').hidden = true;
    else if (e.key === '/') { e.preventDefault(); brief.focus(); }
    else if (P && !isPlugin && e.key === 'ArrowRight') t = Math.min(P.total, t + 1);
    else if (P && !isPlugin && e.key === 'ArrowLeft') t = Math.max(0, t - 1);
  });

  /* ---------- canvas drawing ---------- */
  let gridKey = '', gridPattern = null;
  function grid() {
    let step = 24 * cam.z; while (step < 14) step *= 4;
    const key = step.toFixed(2) + '|' + dpr;
    if (key !== gridKey) {
      const c = document.createElement('canvas'), s = Math.max(1, Math.round(step * dpr));
      c.width = c.height = s; const g = c.getContext('2d');
      g.fillStyle = '#2A2A2A'; g.beginPath(); g.arc(1.2 * dpr, 1.2 * dpr, .9 * dpr, 0, Math.PI * 2); g.fill();
      gridPattern = ctx.createPattern(c, 'repeat'); gridKey = key;
    }
    const s = Math.round(step * dpr) / dpr, ox = (-cam.x * cam.z) % s, oy = (-cam.y * cam.z) % s;
    gridPattern.setTransform(new DOMMatrix().scale(1 / dpr).translate(ox * dpr, oy * dpr));
    ctx.fillStyle = gridPattern; ctx.fillRect(0, 0, W, H);
  }
  function shape(kind, x, y, w, h, r) {
    ctx.beginPath();
    if (kind === 'ellipse') ctx.ellipse(x + w / 2, y + h / 2, Math.max(.1, w / 2), Math.max(.1, h / 2), 0, 0, Math.PI * 2);
    else if (r > .4 && ctx.roundRect) ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
    else ctx.rect(x, y, w, h);
  }
  function paintOf(f, x, y, w, h) {
    if (!f || typeof f === 'string') return f || 'rgba(0,0,0,0)';
    const g = f.dir === 'v' ? ctx.createLinearGradient(x, y, x, y + h) : ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, f.from); g.addColorStop(1, f.to); return g;
  }
  function imageUri(id){
    const bytes=RasterImages[id];
    return 'data:image/'+(bytes.startsWith('/9j/')?'jpeg':'png')+';base64,'+bytes;
  }
  const fontOf = (L, px) => L.weight + ' ' + px + 'px Inter, ui-sans-serif, system-ui, sans-serif';
  const iconPaths = new Map();
  const iconPath = name => { let p = iconPaths.get(name); if (!p) { p = new Path2D(Icons.path(name)); iconPaths.set(name, p); } return p; };

  let status = [], who = [];
  let frameStats = {active: 0};

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#141414'; ctx.fillRect(0, 0, W, H);
    grid();
    if (!P) return;
    const z = cam.z, over = [];
    P.screens.forEach((E, si) => {
      const S = E.S, ox = (S.x - cam.x) * z, oy = (S.y - cam.y) * z;
      const st = Crew.screenAt(P, si, t);
      const [a, b] = E.range;
      if (!st) { for (let li = a; li < b; li++) status[li] = E.ghost ? 4 : 0; return; }
      const fw = st.w * z, fh = st.h * z, sa = st.alpha;
      const visible = ox < W && oy < H && ox + fw > 0 && oy + fh > -30;
      if (visible) {
        ctx.globalAlpha = st.labelAlpha * sa; ctx.fillStyle = E.ghost ? '#F24822' : '#B3B3B3'; ctx.font = '500 12px Inter, -apple-system, system-ui, sans-serif'; ctx.textBaseline = 'alphabetic';
        let label = S.name.split(' · ').pop(); const room = Math.max(fw, S.width * z) - 4;
        while (label.length > 1 && ctx.measureText(label).width > room) label = label.slice(0, -2) + '…';
        if (room > 18) ctx.fillText(label, ox, oy - 9);
        ctx.globalAlpha = sa;
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
        ctx.fillStyle = st.paint >= 1 ? st.paintTo : st.paintFrom; ctx.fillRect(ox, oy, fw, fh); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, fw, fh); ctx.clip();
        if (st.paint > 0 && st.paint < 1) {
          const cx = ox + st.click.x * z, cy = oy + st.click.y * z, R = Math.hypot(Math.max(cx - ox, ox + S.width * z - cx), Math.max(cy - oy, oy + S.height * z - cy));
          ctx.fillStyle = st.paintTo; ctx.beginPath(); ctx.arc(cx, cy, R * easeOut(st.paint), 0, Math.PI * 2); ctx.fill();
        }
      }
      for (let li = a; li < b; li++) {
        const ls = Crew.layerAt(P, li, t);
        if (!ls) { status[li] = P.layers[li].ghost ? 4 : 0; continue; }
        status[li] = ls.active ? 2 : ls.final ? 3 : 1; who[li] = ls.active ? ls.active.cursor : -1;
        if (visible) drawLayer(P.layers[li], ls, ox, oy, z, S, over, sa);
      }
      if (visible) {
        ctx.restore(); ctx.globalAlpha = 1;
        if (st.drawing) over.push({type: 'sel', x: ox, y: oy, w: fw, h: fh, color: P.crew[st.frameCursor].color, label: Math.round(st.w) + ' × ' + Math.round(st.h)});
        if (st.erasing) over.push({type: 'sel', x: ox, y: oy, w: fw, h: fh, color: '#FF6B6B', label: 'Delete screen'});
      }
    });
    overlays(over);
    cursors();
  }

  const vectorPaths = new Map();
  const rasterCache=new Map();
  function rasterImage(id) {
    if(!rasterCache.has(id)) {
      const img=new Image();
      img.src=imageUri(id);
      rasterCache.set(id,img);
    }
    return rasterCache.get(id);
  }
  function buildImages(board,prev) {
    const images={};
    for(const s of [...board.screens,...(prev?prev.screens:[])]) for(const layer of s.layers) {
      if(layer.art && RasterImages[layer.art])images[layer.art]=RasterImages[layer.art];
    }
    return images;
  }
  function drawLayer(ref, ls, ox, oy, z, S, over, sa) {
    const L = ref.L, b = ls.box, x = ox + b.x * z, y = oy + b.y * z, w = b.w * z, h = b.h * z;
    const op = (L.opacity === undefined ? 1 : L.opacity) * ls.alpha * sa;
    if (L.kind !== 'line' && (x > W || y > H || x + w < 0 || y + h < 0)) return;
    if (L.kind === 'text') drawText(ls, x, y, w, h, z, op, over);
    else if (L.art && RasterImages[L.art]) {
      const img=rasterImage(L.art);
      if(img.complete && img.naturalWidth) {
        ctx.save();ctx.globalAlpha=op;
        const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight);
        const sw=w/scale,sh=h/scale;
        if(w>0 && h>0)ctx.drawImage(img,(img.naturalWidth-sw)/2,(img.naturalHeight-sh)/2,sw,sh,x,y,w,h);
        ctx.restore();
      }
    }
    else if (Websites.artwork(L.art)) {
      const vector = Websites.artwork(L.art);
      if (!vectorPaths.has(L.art)) vectorPaths.set(L.art,new Path2D(vector.path));
      ctx.save(); ctx.translate(x,y); ctx.scale(w/vector.w,h/vector.h); ctx.globalAlpha=op;
      ctx.fillStyle=paintOf(ls.fill < .45 ? ls.fillFrom : ls.fillTo,0,0,vector.w,vector.h);
      ctx.fill(vectorPaths.get(L.art),'evenodd'); ctx.restore();
    }
    else if (L.kind === 'line') drawLine(ref, ls, ox, oy, z, op, over);
    else if (L.kind === 'icon') {
      ctx.save(); ctx.globalAlpha = op; ctx.translate(x + w / 2, y + h / 2); ctx.scale(ls.scale, ls.scale); ctx.translate(-w / 2, -h / 2); ctx.scale(w / 24, h / 24);
      ctx.strokeStyle = ls.color; ctx.lineWidth = L.sw || 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(iconPath(ls.icon)); ctx.restore();
    } else {
      const r = ls.radius * z, from = ls.fillFrom, to = ls.fillTo;
      if (ls.fill < 1) {
        ctx.globalAlpha = from === PLACEHOLDER ? Math.min(1, (.3 + (L.opacity ?? 1) * .7) * ls.alpha * sa) : op; shape(L.kind, x, y, w, h, r);
        if (L.fill || (from && from !== PLACEHOLDER)) { ctx.fillStyle = paintOf(from, x, y, w, h); ctx.fill(); }
        else { ctx.strokeStyle = PLACEHOLDER; ctx.lineWidth = Math.max(1, L.sw * z); ctx.stroke(); }
      }
      if (ls.fill > 0) {
        const full = ls.fill >= 1;
        ctx.globalAlpha = op;
        if (!full) {
          ctx.save(); shape(L.kind, x, y, w, h, r); ctx.clip();
          const cx = x + ls.click.x * z, cy = y + ls.click.y * z, R = Math.hypot(Math.max(cx - x, x + w - cx), Math.max(cy - y, y + h - cy));
          ctx.beginPath(); ctx.arc(cx, cy, Math.max(.5, R * easeOut(ls.fill)), 0, Math.PI * 2); ctx.clip();
        }
        if (full && L.shadow && z > .08 && ls.alpha > .5) {
          ctx.save(); ctx.shadowColor = S.dark ? 'rgba(0,0,0,.5)' : 'rgba(22,22,48,.13)'; ctx.shadowBlur = 30 * z; ctx.shadowOffsetY = 10 * z;
          shape(L.kind, x, y, w, h, r); ctx.fillStyle = to ? paintOf(to, x, y, w, h) : 'rgba(0,0,0,0)'; ctx.fill(); ctx.restore();
        }
        shape(L.kind, x, y, w, h, r);
        if (to) { ctx.fillStyle = paintOf(to, x, y, w, h); ctx.fill(); }
        if (L.stroke) { ctx.strokeStyle = L.stroke; ctx.lineWidth = Math.max(.5, L.sw * z); ctx.stroke(); }
        if (!full) ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    const a = ls.active;
    if (!a || L.kind === 'text' || L.kind === 'line') return;
    const color = P.crew[a.cursor].color;
    if (a.kind === 'draw') over.push({type: 'sel', x, y, w, h, color, label: Math.round(b.w) + ' × ' + Math.round(b.h)});
    else if (a.kind === 'round') over.push({type: 'sel', x, y, w, h, color, label: 'Radius ' + Math.max(0, Math.round(ls.radius)), radius: {x: x + w, y, r: ls.radius * z}});
    else if (a.kind === 'snap') over.push({type: 'sel', x, y, w, h, color, label: ref.prev ? Math.round(b.x) + ', ' + Math.round(b.y) : null, guides: a.p > .5 ? {sx: ox, sy: oy, sw: S.width * z, sh: S.height * z, x: ox + L.x * z, y: oy + L.y * z, w: L.w * z, h: L.h * z, alpha: Math.min(1, (a.p - .5) * 4)} : null});
    else if (a.kind === 'erase') over.push({type: 'sel', x, y, w, h, color: '#FF6B6B', label: 'Delete'});
    else if (a.kind === 'icon' || (a.kind === 'fill' && ref.prev)) over.push({type: 'sel', x, y, w, h, color, label: null});
  }

  function drawText(ls, x, y, w, h, z, op, over) {
    const L = ls.layer, px = L.size * z, line = L.size * L.lh * z, lines = String(ls.text).split('\n');
    let left = ls.chars, caret = null;
    if (ls.select > 0 && ls.active) {
      ctx.globalAlpha = .28 * op; ctx.fillStyle = P.crew[ls.active.cursor].color;
      ctx.fillRect(x - 2, y, Math.max(2, (w + 4) * Math.min(1, ls.select)), Math.max(line * lines.length, h));
    }
    ctx.globalAlpha = op;
    if (px < 3.2) {
      ctx.fillStyle = ls.color; ctx.globalAlpha = op * .45;
      lines.forEach((s, i) => {
        if (left <= 0) return; const n = Math.min(s.length, left); left -= s.length + 1;
        const lw = Math.min(w, Doc.measure(s.slice(0, n), L.size, L.weight) * z), lx = L.align === 'center' ? x + (w - lw) / 2 : L.align === 'right' ? x + w - lw : x;
        ctx.fillRect(lx, y + line * i + line * .3, lw, Math.max(.6, line * .38));
      });
    } else {
      ctx.font = fontOf(L, px); ctx.textBaseline = 'middle'; ctx.fillStyle = ls.color;
      if ('letterSpacing' in ctx) ctx.letterSpacing = L.size >= 28 ? (-.02 * px).toFixed(2) + 'px' : '0px';
      lines.forEach((s, i) => {
        if (left <= 0) return; const part = s.slice(0, left); left -= s.length + 1;
        const tw = ctx.measureText(part).width, lx = L.align === 'center' ? x + (w - tw) / 2 : L.align === 'right' ? x + w - tw : x, ly = y + line * (i + .5);
        ctx.fillText(part, lx, ly); caret = {x: lx + tw + 1, y: ly};
      });
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    }
    ctx.globalAlpha = 1;
    if (ls.active) {
      const color = ls.active.kind === 'erase' ? '#FF6B6B' : P.crew[ls.active.cursor].color;
      if (ls.active.kind === 'erase' || ls.active.kind === 'snap' || ls.active.kind === 'fill') over.push({type: 'sel', x, y, w, h, color, label: ls.active.kind === 'erase' ? 'Delete' : null});
      else over.push({type: 'text', x, y, w, h, color, caret: !ls.select && caret || {x: L.align === 'center' ? x + w / 2 : L.align === 'right' ? x + w : x, y: y + line / 2}, caretH: Math.max(4, px * 1.05), showCaret: !ls.select});
    }
  }

  function drawLine(ref, ls, ox, oy, z, op, over) {
    const L = ls.layer, S = P.screens[ref.screen].S;
    const pts = ls.pts || ref.pts || (ref.pts = L.points.map(p => ({x: S.x + L.x + p[0] * L.w, y: S.y + L.y + p[1] * L.h})));
    const stroke = (list, upto, at) => {
      ctx.beginPath(); ctx.moveTo((list[0].x - cam.x) * z, (list[0].y - cam.y) * z);
      for (let i = 1; i <= upto; i++) ctx.lineTo((list[i].x - cam.x) * z, (list[i].y - cam.y) * z);
      if (at) ctx.lineTo((at.x - cam.x) * z, (at.y - cam.y) * z);
      ctx.stroke();
    };
    ctx.lineWidth = Math.max(.6, L.sw * z); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (ls.prevPts) { ctx.globalAlpha = op * Math.max(0, 1 - ls.trace * 2); ctx.strokeStyle = ref.prev.stroke; stroke(ls.prevPts, ls.prevPts.length - 1); }
    const at = Crew.polyPoint(pts, ls.trace);
    ctx.globalAlpha = op; ctx.strokeStyle = ls.color || L.stroke;
    stroke(pts, ls.trace >= 1 ? pts.length - 1 : at.index, ls.trace < 1 ? at : null);
    ctx.globalAlpha = 1;
    if (ls.active) over.push({type: 'dot', x: (at.x - cam.x) * z, y: (at.y - cam.y) * z, color: ls.active.kind === 'erase' ? '#FF6B6B' : P.crew[ls.active.cursor].color});
  }

  function pill(text, x, y, color, fg) {
    ctx.font = '600 10.5px Inter, system-ui, sans-serif'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 12;
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y, w, 18, 5) : ctx.rect(x - w / 2, y, w, 18); ctx.fill();
    ctx.fillStyle = fg || '#FFFFFF'; ctx.fillText(text, x - w / 2 + 6, y + 9.5);
  }
  const fgFor = c => lum(c) > .62 ? '#101014' : '#FFFFFF';

  function overlays(list) {
    const blink = Math.floor(performance.now() / 420) % 2 === 0;
    for (const o of list) {
      if (o.type === 'sel') {
        if (o.guides) {
          const g = o.guides; ctx.globalAlpha = g.alpha * .9; ctx.strokeStyle = '#FF3D7F'; ctx.lineWidth = 1;
          ctx.beginPath();
          for (const gx of [g.x, g.x + g.w / 2, g.x + g.w]) { ctx.moveTo(Math.round(gx) + .5, g.sy); ctx.lineTo(Math.round(gx) + .5, g.sy + g.sh); }
          for (const gy of [g.y, g.y + g.h]) { ctx.moveTo(g.sx, Math.round(gy) + .5); ctx.lineTo(g.sx + g.sw, Math.round(gy) + .5); }
          ctx.stroke(); ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = o.color; ctx.lineWidth = 1.5; ctx.strokeRect(o.x, o.y, o.w, o.h);
        if (o.w > 14 && o.h > 10) {
          ctx.fillStyle = '#FFFFFF';
          for (const [hx, hy] of [[o.x, o.y], [o.x + o.w, o.y], [o.x, o.y + o.h], [o.x + o.w, o.y + o.h]]) { ctx.fillRect(hx - 3, hy - 3, 6, 6); ctx.strokeRect(hx - 3, hy - 3, 6, 6); }
        }
        if (o.radius) { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(o.radius.x - Math.max(6, o.radius.r), o.radius.y + Math.max(6, o.radius.r), 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        if (o.label && o.w > 26) pill(o.label, o.x + o.w / 2, o.y + o.h + 7, o.color, fgFor(o.color));
      } else if (o.type === 'text') {
        ctx.strokeStyle = o.color; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.strokeRect(o.x - 2, o.y - 1, o.w + 4, o.h + 2); ctx.setLineDash([]);
        if (blink && o.showCaret) { ctx.fillStyle = o.color; ctx.fillRect(o.caret.x, o.caret.y - o.caretH / 2, 1.5, o.caretH); }
      } else if (o.type === 'dot') {
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(o.x, o.y, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = o.color; ctx.beginPath(); ctx.arc(o.x, o.y, 2.8, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  const arrow = new Path2D('M0 0L0 16.2L4.4 12.1L7.4 18.8L10.2 17.6L7.3 11L13 11Z');
  const nameWidth = new Map();
  const doing = {drew: 'drawing', filled: 'filling', rounded: 'rounding', aligned: 'aligning', typed: 'typing', traced: 'tracing', framed: 'framing', painted: 'painting', placed: 'placing', deleted: 'deleting', moved: 'moving', recoloured: 'recolouring', retyped: 'retyping', reshaped: 'reshaping', resized: 'resizing', repainted: 'repainting', redrew: 'redrawing'};
  function cursors() {
    const z = cam.z, wantLabels = z > .2, now = performance.now() / 1000, small = P.count >= 500 ? .82 : 1;
    let labels = 0, active = 0, best = null, bestD = 196;
    ctx.lineJoin = 'round';
    for (const c of P.crew) {
      const s = Crew.cursorAt(P, c, t);
      if (!s) continue;
      if (s.mode === 'move' || s.mode === 'work') active++;
      let x = (s.x - cam.x) * z, y = (s.y - cam.y) * z;
      if (s.mode === 'idle') { x += Math.sin(now * 1.7 + c.id) * 1.3; y += Math.cos(now * 2.1 + c.id * 1.3) * 1.3; }
      if (x < -30 || y < -30 || x > W + 30 || y > H + 30) continue;
      if (hover) { const d = (hover.x - x) ** 2 + (hover.y - y) ** 2; if (d < bestD) { bestD = d; best = {c, s, x, y}; } }
      ctx.globalAlpha = s.alpha * (s.mode === 'idle' ? .5 : 1);
      ctx.save(); ctx.translate(x, y); if (small !== 1) ctx.scale(small, small);
      ctx.fillStyle = c.color; ctx.fill(arrow); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.4; ctx.stroke(arrow);
      ctx.restore();
      if (s.mode === 'work' && wantLabels && labels < 110) {
        labels++;
        const task = P.tasks[s.task], target = task.layer >= 0 ? P.layers[task.layer].L : null;
        const swatch = task.kind === 'fill' && target && (target.kind === 'icon' || target.kind === 'line' ? target.stroke : target.fill);
        ctx.font = '600 10.5px Inter, system-ui, sans-serif'; ctx.textBaseline = 'middle';
        let tw = nameWidth.get(c.id); if (tw === undefined) { tw = ctx.measureText(c.name).width; nameWidth.set(c.id, tw); }
        const bw = tw + 12 + (swatch ? 14 : 0), bx = x + 11, by = y + 16;
        ctx.fillStyle = c.color; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by, bw, 18, 5) : ctx.rect(bx, by, bw, 18); ctx.fill();
        ctx.fillStyle = fgFor(c.color); ctx.fillText(c.name, bx + 6, by + 9.5);
        if (swatch) { ctx.fillStyle = typeof swatch === 'string' ? swatch : swatch.from; ctx.fillRect(bx + bw - 15, by + 4, 10, 10); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1; ctx.strokeRect(bx + bw - 15, by + 4, 10, 10); }
      }
    }
    ctx.globalAlpha = 1;
    frameStats.active = active;
    const tip = $('tip');
    if (best && !drag) {
      const s = best.s, what = s.mode === 'work' ? Crew.describe(P, P.tasks[s.task]).replace(/^(\w+)/, m => doing[m] || m) : s.mode === 'move' ? 'heading to the next task' : 'waiting for work';
      tip.style.setProperty('--who', best.c.color);
      tip.innerHTML = '<b>' + esc(best.c.name) + '</b> · ' + esc(what) + ' <span style="color:#808080">· ' + best.c.jobs + ' tasks</span>';
      tip.style.left = Math.min(W - 260, best.x + 18) + 'px'; tip.style.top = (best.y - 34) + 'px'; tip.hidden = false;
    } else tip.hidden = true;
  }

  /* ---------- panels ---------- */
  function setHead(a, b) { $('headline').textContent = a; $('subline').textContent = b; }
  const kindIcon = k => '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + KIND_STYLE[k][1] + '</svg>';
  const layerIcon = L => '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    (L.kind === 'text' ? '<path d="M5 6V4h14v2M12 4v16"/>' : L.kind === 'ellipse' ? '<circle cx="12" cy="12" r="8"/>' : L.kind === 'line' ? '<path d="M3 17c3-8 6 2 9-5s6-3 9-7"/>' : L.kind === 'icon' ? '<path d="' + Icons.path(L.icon) + '"/>' : '<rect x="4" y="5" width="16" height="14" rx="2"/>') + '</svg>';
  let rowEls = [], scrEls = [], lastTreeUpdate = 0;
  const lastRow = [];
  function buildTree() {
    const tree = $('tree'); tree.innerHTML = ''; rowEls = []; scrEls = [];
    $('layer-count').textContent = board.screens.reduce((s, x) => s + x.layers.length, 0);
    P.screens.forEach((E, si) => {
      const S = E.S, wrap = document.createElement('div'); wrap.className = 'scr' + (si > 1 && !P.edit ? ' closed' : '') + (E.ghost ? ' gone' : '');
      wrap.innerHTML = '<button class="scr-head"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M6 8l6 8 6-8z"/></svg><span>' + esc(S.name.split(' · ').pop()) + '</span><em class="num"></em><span class="bar"><i></i></span></button><div class="rows"></div>';
      const head = wrap.firstChild, rows = wrap.lastChild;
      head.onclick = e => { if (e.detail === 2) return; wrap.classList.toggle('closed'); };
      head.ondblclick = () => { camGoal = frameRect(S.x, S.y, S.width, S.height); userMoved = true; };
      const frag = document.createDocumentFragment();
      for (let li = E.range[0]; li < E.range[1]; li++) {
        const ref = P.layers[li], L = ref.L, row = document.createElement('div');
        row.className = 'row'; row.innerHTML = '<i class="k">' + layerIcon(L) + '</i><span>' + esc(L.name) + '</span><b></b>';
        if (ref.ghost) row.dataset.ghost = '1';
        row.onclick = () => { const p = 60 / Math.max(1, cam.z); camGoal = frameRect(S.x + L.x - p, S.y + L.y - p, L.w + p * 2, L.h + p * 2); camGoal.z = Math.min(camGoal.z, 2.2); userMoved = true; };
        frag.appendChild(row); rowEls.push(row);
      }
      rows.appendChild(frag); tree.appendChild(wrap); scrEls.push(wrap);
    });
  }
  // Status without drawing (used inside Figma, where the canvas is hidden).
  function statusPass() {
    for (let li = 0; li < P.layers.length; li++) {
      const ls = Crew.layerAt(P, li, t);
      status[li] = !ls ? (P.layers[li].ghost ? 4 : 0) : ls.active ? 2 : ls.final ? 3 : 1;
      who[li] = ls && ls.active ? ls.active.cursor : -1;
    }
  }
  function updateTree() {
    for (let li = 0; li < rowEls.length; li++) {
      const s = status[li], w = who[li], key = s * 10000 + w;
      if (lastRow[li] === key) continue; lastRow[li] = key;
      const row = rowEls[li];
      row.className = 'row' + (s === 3 || s === 1 ? ' done' : s === 2 ? ' live' : s === 4 ? ' gone' : '') + (row.dataset.ghost && s !== 4 ? ' doomed' : '');
      if (s === 2 && w >= 0) { row.style.setProperty('--who', P.crew[w].color); row.lastChild.textContent = P.crew[w].name; }
    }
    P.screens.forEach((E, si) => {
      let done = 0, total = 0;
      for (let li = E.range[0]; li < E.range[1]; li++) { if (P.layers[li].ghost) continue; total++; if (status[li] === 3) done++; }
      const el = scrEls[si]; el.querySelector('em').textContent = E.ghost ? 'deleted' : done + '/' + total;
      el.querySelector('.bar i').style.width = (total ? done / total * 100 : 100) + '%';
    });
  }
  function buildActs() {
    $('acts').innerHTML = Crew.KINDS.filter(k => P.byKind[k].length || !P.edit).map(k => '<div class="act" style="--c:' + KIND_STYLE[k][0] + '"><span class="ico">' + kindIcon(k) + '</span><span>' + Crew.labels[k] + '</span><em class="num" data-k="' + k + '">0 / ' + P.byKind[k].length + '</em><span class="track"><i data-k="' + k + '"></i></span></div>').join('') || '<p class="note">Nothing to change.</p>';
  }
  let lastFeedKey = '';
  function updatePanels() {
    const time = $('time');
    if (!P) { time.innerHTML = '0.0s <span>/ 0.0s</span>'; drawSpark(); return; }
    if (isPlugin && performance.now() - lastTreeUpdate > 90) statusPass();
    const st = Crew.stats(P, t), pct = st.total ? st.done / st.total : 1;
    $('pct').textContent = Math.round(pct * 100) + '%';
    $('ring-arc').setAttribute('stroke-dashoffset', (201.06 * (1 - pct)).toFixed(2));
    let built = 0, all = 0; for (let i = 0; i < status.length; i++) { if (P.layers[i] && P.layers[i].ghost) continue; all++; if (status[i] === 3) built++; }
    const active = isPlugin ? (P.bins[Math.min(P.bins.length - 1, Math.floor(t * 10))] || 0) : frameStats.active;
    $('s-active').textContent = active; $('s-active-bar').style.width = (active / P.count * 100) + '%';
    $('s-done').innerHTML = st.done + ' <span>/ ' + st.total + '</span>'; $('s-done-bar').style.width = (pct * 100) + '%';
    $('s-layers').innerHTML = built + ' <span>/ ' + all + '</span>';
    $('s-time').innerHTML = Math.min(t, P.finish).toFixed(1) + '<span>s</span>';
    for (const k of Crew.KINDS) {
      const d = st.kinds[k];
      const em = $('acts').querySelector('em[data-k="' + k + '"]'), bar = $('acts').querySelector('i[data-k="' + k + '"]');
      if (em) { em.textContent = d.done + ' / ' + d.total; bar.style.width = (d.total ? d.done / d.total * 100 : 0) + '%'; }
    }
    const items = Crew.feed(P, t, 8), key = items.map(x => x.id).join(',');
    if (key !== lastFeedKey) {
      lastFeedKey = key;
      $('feed').innerHTML = items.length ? items.map(task => { const c = P.crew[task.cursor]; return '<li style="--who:' + c.color + '"><span class="av" style="color:' + fgFor(c.color) + '">' + esc(initials(c.name)) + '</span><p><b>' + esc(c.name) + '</b> ' + esc(Crew.describe(P, task)) + '</p><time class="num">' + task.end.toFixed(1) + 's</time></li>'; }).join('') : '<li class="none">Cursors are getting into position…</li>';
      $('feed-count').textContent = st.done ? st.done + ' events' : '';
    }
    const finished = t >= P.finish, what = P.edit ? (revisions[rev] && revisions[rev].label || 'Change') : board.name;
    if (!busy) {
      if (finished) setHead(P.edit ? 'Change applied' : board.name + ' is ready', P.edit ? what + ' · ' + P.workCount + ' tasks by ' + P.count + ' cursors in ' + P.finish.toFixed(1) + 's' : 'Built in ' + P.finish.toFixed(1) + 's by ' + P.count + ' cursors, ' + P.workCount + ' tasks.' + (canDesign() ? ' Describe a change to keep going.' : ''));
      else if (st.done === 0) setHead(P.edit ? 'Crew of ' + P.count + ' on it' : 'Crew of ' + P.count + ' assembling', P.edit ? what : board.screens.length + ' screens, ' + all + ' layers to build.');
      else setHead(P.edit ? 'Applying the change' : 'Building ' + board.name, (isPlugin ? 'Live in your Figma file · ' : '') + active + ' cursors working right now.');
    }
    time.innerHTML = t.toFixed(1) + 's <span>/ ' + P.total.toFixed(1) + 's</span>';
    if (rowEls.length && performance.now() - lastTreeUpdate > 90) { lastTreeUpdate = performance.now(); updateTree(); }
    if (finished && !finishedShown) {
      finishedShown = true; $('done-actions').hidden = false;
      toast(P.edit ? 'Change applied' : board.name + ' is ready', P.edit ? P.workCount + ' tasks · ' + P.count + ' cursors · ' + P.finish.toFixed(1) + 's' : all + ' layers · ' + P.count + ' cursors · ' + P.finish.toFixed(1) + 's');
    }
    drawSpark();
    scrub.setAttribute('aria-valuemax', P.total.toFixed(1)); scrub.setAttribute('aria-valuenow', t.toFixed(1));
  }
  let toastTimer = 0;
  function toast(text, sub) {
    $('toast-text').innerHTML = esc(text) + (sub ? ' <small>' + esc(sub) + '</small>' : '');
    $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 4200);
  }

  const spark = $('spark'), sctx = spark.getContext('2d');
  function drawSpark() {
    const r = spark.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height);
    if (spark.width !== Math.round(w * dpr)) { spark.width = Math.round(w * dpr); spark.height = Math.round(h * dpr); }
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0); sctx.clearRect(0, 0, w, h);
    sctx.fillStyle = '#1E1E1E'; sctx.fillRect(0, 0, w, h);
    if (!P) return;
    const n = P.bins.length, bw = w / n, ph = t / P.total * w;
    const grad = '#0D99FF';
    for (let i = 0; i < n; i++) {
      const v = P.bins[i] / Math.max(1, P.busiest), bh = Math.max(1.5, v * (h - 10)), x = i * bw;
      sctx.fillStyle = x + bw <= ph ? grad : '#3A3A3A';
      sctx.fillRect(x + .15, h - 5 - bh, Math.max(.6, bw - .3), bh);
    }
    sctx.fillStyle = '#FFFFFF'; sctx.fillRect(Math.min(w - 2, ph), 3, 2, h - 6);
  }

  /* ---------- export ---------- */
  function exportSvg() {
    if (!board) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of board.screens) { x0 = Math.min(x0, s.x); y0 = Math.min(y0, s.y); x1 = Math.max(x1, s.x + s.width); y1 = Math.max(y1, s.y + s.height); }
    const pad = 80, gw = x1 - x0 + pad * 2, gh = y1 - y0 + pad * 2;
    let defs = '<filter id="sh" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#161630" flood-opacity=".14"/></filter>', body = '', gid = 0;
    const fillRef = (f, x, y, w, h) => {
      if (!f) return 'none'; if (typeof f === 'string') return f;
      const id = 'g' + gid++;
      defs += '<linearGradient id="' + id + '" gradientUnits="userSpaceOnUse" x1="' + x + '" y1="' + y + '" x2="' + (f.dir === 'v' ? x : x + w) + '" y2="' + (y + h) + '"><stop offset="0" stop-color="' + f.from + '"/><stop offset="1" stop-color="' + f.to + '"/></linearGradient>';
      return 'url(#' + id + ')';
    };
    const r2 = v => Math.round(v * 100) / 100;
    board.screens.forEach((S, si) => {
      defs += '<clipPath id="c' + si + '"><rect width="' + S.width + '" height="' + S.height + '"/></clipPath>';
      body += '<g transform="translate(' + (S.x - x0 + pad) + ' ' + (S.y - y0 + pad) + ')"><text y="-14" font-family="Inter, sans-serif" font-size="14" font-weight="600" fill="#8D8DA3">' + esc(S.name) + '</text><g clip-path="url(#c' + si + ')"><rect width="' + S.width + '" height="' + S.height + '" fill="' + S.background + '"/>';
      for (const L of S.layers) {
        const op = L.opacity !== undefined ? ' opacity="' + L.opacity + '"' : '';
        if (L.kind === 'text') {
          const ax = L.align === 'center' ? L.x + L.w / 2 : L.align === 'right' ? L.x + L.w : L.x, anchor = L.align === 'center' ? 'middle' : L.align === 'right' ? 'end' : 'start';
          body += '<text font-family="Inter, sans-serif" font-size="' + L.size + '" font-weight="' + L.weight + '" fill="' + L.fill + '" text-anchor="' + anchor + '"' + (L.size >= 28 ? ' letter-spacing="' + r2(-L.size * .02) + '"' : '') + op + '>' +
            L.text.split('\n').map((s, i) => '<tspan x="' + r2(ax) + '" y="' + r2(L.y + L.size * L.lh * (i + .5)) + '" dominant-baseline="central">' + esc(s) + '</tspan>').join('') + '</text>';
        } else if (L.art && RasterImages[L.art]) {
          body+='<image x="'+L.x+'" y="'+L.y+'" width="'+L.w+'" height="'+L.h+'" preserveAspectRatio="xMidYMid slice" href="'+imageUri(L.art)+'"'+op+'/>';
        } else if (Websites.artwork(L.art)) {
          const a=Websites.artwork(L.art);
          body+='<path transform="translate('+L.x+' '+L.y+') scale('+L.w/a.w+' '+L.h/a.h+')" fill-rule="evenodd" fill="'+fillRef(L.fill,0,0,a.w,a.h)+'" d="'+a.path+'"'+op+'/>';
        } else if (L.kind === 'line') {
          body += '<polyline points="' + L.points.map(p => r2(L.x + p[0] * L.w) + ',' + r2(L.y + p[1] * L.h)).join(' ') + '" fill="none" stroke="' + L.stroke + '" stroke-width="' + L.sw + '" stroke-linecap="round" stroke-linejoin="round"' + op + '/>';
        } else if (L.kind === 'icon') {
          body += '<path transform="translate(' + r2(L.x) + ' ' + r2(L.y) + ') scale(' + r2(L.w / 24) + ')" d="' + Icons.path(L.icon) + '" fill="none" stroke="' + L.stroke + '" stroke-width="' + (L.sw || 2) + '" stroke-linecap="round" stroke-linejoin="round"' + op + '/>';
        } else {
          const paint = ' fill="' + fillRef(L.fill, L.x, L.y, L.w, L.h) + '"' + (L.stroke ? ' stroke="' + L.stroke + '" stroke-width="' + L.sw + '"' : '') + (L.shadow ? ' filter="url(#sh)"' : '') + op;
          body += L.kind === 'ellipse' ? '<ellipse cx="' + r2(L.x + L.w / 2) + '" cy="' + r2(L.y + L.h / 2) + '" rx="' + r2(L.w / 2) + '" ry="' + r2(L.h / 2) + '"' + paint + '/>'
            : '<rect x="' + r2(L.x) + '" y="' + r2(L.y) + '" width="' + r2(L.w) + '" height="' + r2(L.h) + '"' + (L.r ? ' rx="' + r2(L.r) + '"' : '') + paint + '/>';
        }
      }
      body += '</g></g>';
    });
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + gw + '" height="' + gh + '" viewBox="0 0 ' + gw + ' ' + gh + '"><defs>' + defs + '</defs><rect width="100%" height="100%" fill="#0E0E13"/>' + body + '</svg>';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
    a.download = board.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-iris.svg'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  $('export').onclick = exportSvg;

  /* ---------- plugin bridge ---------- */
  let readSeq = 0;
  function readback() {
    const id = ++readSeq;
    return new Promise(resolve => {
      const done = e => { const m = e.data && e.data.pluginMessage; if (m && m.kind === 'readback' && m.id === id) { clearTimeout(timer); window.removeEventListener('message', done); resolve(m.read || null); } };
      const timer = setTimeout(() => { window.removeEventListener('message', done); resolve(null); }, 6000);
      window.addEventListener('message', done);
      parent.postMessage({pluginMessage: {kind: 'readback', id, design: doc && doc.id}}, '*');
    });
  }
  window.addEventListener('message', e => {
    const m = e.data && e.data.pluginMessage; if (!m) return;
    if(m.kind==='library-next') {libraryEntry(m);return;}
    if(m.kind==='library-done') {
      if(P)t=P.total;
      P=null;board=null;setHead('Website library ready',m.total+' sections on this page.');
      playing=false; pluginState='done'; revisions=[]; rev=-1; doc=null;
      renderHistory();setMode('new');brief.value='';setPlayIcon();
      libraryStatus(m.total+' sections · '+(m.total*4)+' panels ready',false);return;
    }
    if(libraryBusy && ['error','library-error','cancelled'].includes(m.kind)) {
      libraryStatus(m.text || 'Import paused. Open the library to resume.',false);pluginState='idle';return;
    }
    if (m.kind === 'tick') { t = m.t; pluginState = m.state; setPlayIcon(); }
    if (m.kind === 'done') { t = P ? P.total : 0; pluginState = 'done'; setPlayIcon(); }
    if (m.kind === 'cancelled') {
      pluginState = 'idle'; setPlayIcon();
      if (rev > 0) { revisions = revisions.slice(0, rev); rev--; doc = revisions[rev].doc; board = revisions[rev].board; P = Crew.plan(board, count); t = P.total; status = new Array(P.layers.length).fill(-1); who = status.slice(); lastRow.length = 0; renderHistory(); buildTree(); buildActs(); }
      else { P = null; doc = null; board = null; revisions = []; rev = -1; renderHistory(); setMode('new'); }
      setHead('Run cancelled', 'Unfinished work was removed from the page.');
    }
    if (m.kind === 'error') { pluginState = 'idle'; setHead('Something went wrong', m.text); setPlayIcon(); }
    if (m.kind === 'key' && m.key && !connected) { $('token').value = m.key; connect(); }
    if (m.kind === 'restore' && m.doc) {
      try {
        doc = Doc.clean(m.doc); board = Screens.checkBoard(Doc.compile(doc), true);
        revisions = [{doc, board, label: 'Opened from this Figma file'}]; rev = 0; renderHistory();
        P = Crew.plan(board, count); t = P.total; pluginState = 'done';
        status = new Array(P.layers.length).fill(-1); who = new Array(P.layers.length).fill(-1); lastRow.length = 0;
        buildTree(); buildActs(); setMode(canDesign() ? 'edit' : 'new');
        setHead(board.name + ' is on this page', 'Connect Iris (⚙) and describe a change to keep designing.');
      } catch (err) { /* ignore a stale or foreign document */ }
    }
  });

  /* ---------- hooks for the voice agent (voice.js) ---------- */
  const runFinished = () => !!P && (isPlugin ? pluginState === 'done' : !playing && t >= P.total);
  // Resolves when the crew finishes (or is stopped) the run that a build or change just started.
  function settle(limit) {
    const began = Date.now();
    return new Promise(resolve => {
      const timer = setInterval(() => {
        const stopped = isPlugin && pluginState === 'idle';
        if (runFinished() || stopped || Date.now() - began > limit) { clearInterval(timer); resolve(runFinished() ? 'done' : stopped ? 'stopped' : 'running'); }
      }, 200);
    });
  }
  const headText = () => ($('headline').textContent + '. ' + $('subline').textContent).replace(/\.\.\s*$/, '.');
  function outline() {
    if (!board) return null;
    return {product: board.name, screens: board.screens.map(s => ({name: s.name, size: s.width + ' by ' + s.height,
      copy: s.layers.filter(L => L.kind === 'text').map(L => L.text.replace(/\n/g, ' ')).filter(x => x.trim()).slice(0, 12)}))};
  }
  window.Iris = {
    isPlugin, call, setProfile,
    get profile() { return {id: profileSel.value, name: profileName()}; }, get profiles() { return profiles.map(({id, name, tagline}) => ({id, name, tagline})); },
    get connected() { return connected; }, get service() { return service; }, get busy() { return busy; },
    state: () => ({design: outline(), version: rev + 1, versions: revisions.length, running: !!P && !runFinished(), status: headText(), canEdit: canDesign()}),
    async build(text) {
      if (busy) return {error: 'Iris is still working on the last request.'};
      setMode('new'); brief.value = String(text || '').slice(0, 1500);
      const before = revisions.length ? revisions[rev] : null;
      await go(true);
      if (!revisions.length || revisions[rev] === before) return {error: headText()};
      const run = await settle(240000);
      return {built: true, crew: run, reference: doc.reference || null, designer: revisions[rev].label, summary: revisions[rev].label, design: outline()};
    },
    async change(text) {
      if (!doc) return {error: 'There is no design yet. Build one first.'};
      if (!canDesign()) return {error: 'Connect to Iris to make changes.'};
      if (busy) return {error: 'Iris is still working on the last request.'};
      setMode('edit'); const before = revisions[rev];
      await change(String(text || '').slice(0, 1500));
      if (revisions[rev] === before) return {changed: false, reason: headText()};
      const run = await settle(180000);
      return {changed: true, crew: run, summary: revisions[rev].label, note: revisions[rev].note || undefined};
    },
    history(action) {
      if (busy) return {error: 'Iris is still working on the last request.'};
      const target = action === 'undo' ? rev - 1 : rev + 1;
      if (!revisions[target]) return {error: action === 'undo' ? 'Nothing to undo.' : 'Nothing to redo.'};
      restore(target);
      return {version: rev + 1, of: revisions.length, label: revisions[rev].label};
    },
    control(action) {
      if (!P || runFinished()) return {note: 'Nothing is running.'};
      if (action === 'cancel') { if (isPlugin) parent.postMessage({pluginMessage: {kind: 'cancel'}}, '*'); else { t = P.total; playing = false; setPlayIcon(); } return {done: true}; }
      const running = isPlugin ? pluginState === 'running' : playing;
      if ((action === 'pause' && running) || (action === 'resume' && !running)) togglePlay();
      return {done: true};
    }
  };

  /* ---------- loop ---------- */
  function loop(now) {
    const dt = Math.min(.1, (now - lastFrame) / 1000); lastFrame = now;
    if (P && playing && !isPlugin) { t = Math.min(P.total, t + dt * speed); if (t >= P.total) { playing = false; setPlayIcon(); } }
    if (camGoal) {
      const k = reducedMotion.matches ? 1 : 1 - Math.pow(.0008, dt);
      const lz = Math.log(cam.z) + (Math.log(camGoal.z) - Math.log(cam.z)) * k;
      const cx = cam.x + W / 2 / cam.z, cy = cam.y + H / 2 / cam.z, gx = camGoal.x + W / 2 / camGoal.z, gy = camGoal.y + H / 2 / camGoal.z;
      const nz = Math.exp(lz), nx = cx + (gx - cx) * k, ny = cy + (gy - cy) * k;
      cam = {z: nz, x: nx - W / 2 / nz, y: ny - H / 2 / nz};
      if (Math.abs(nz - camGoal.z) / camGoal.z < .002 && Math.abs(nx - gx) * nz < .5 && Math.abs(ny - gy) * nz < .5) { cam = camGoal; camGoal = null; }
    }
    if (!isPlugin) render();
    $('zoom-val').textContent = Math.round(cam.z * 100) + '%';
    updatePanels();
    requestAnimationFrame(loop);
  }
  resize();
  setPlayIcon(); setMode('new'); renderHistory(); updateNotice();
  requestAnimationFrame(loop);

  let saved = '';
  try { saved = localStorage.getItem('iris-key') || ''; } catch (e) { /* storage may be unavailable */ }
  const hash = location.hash.match(/key=([^&]+)/);
  if (hash) { $('token').value = decodeURIComponent(hash[1]); history.replaceState(null, '', location.pathname + location.search); connect(); }
  else if (saved) { $('token').value = saved; connect(); }
  // Development hook: render a saved design document without calling Claude (open with ?dev&idle).
  if (query.has('dev')) window.irisLoad = d => { revisions = []; rev = -1; commit(Doc.clean(d), 'Loaded “' + (d.name || 'design') + '”', null, null); };
  if (isPlugin) { parent.postMessage({pluginMessage: {kind: 'ui-ready'}}, '*'); brief.value = Kit.samples[0]; }
  else $('empty').hidden = false;
})();
