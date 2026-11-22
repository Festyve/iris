/* Talk to Iris: a live ElevenLabs voice agent whose client tools drive the studio (window.Iris).
   Figma plugin windows usually block the microphone, so the plugin also listens on the server's
   /bridge: a voice session in a browser tab then builds and edits in the Figma file. */
(() => {
  const $ = id => document.getElementById(id);
  const Iris = window.Iris, api = 'http://localhost:4739';
  if (!Iris || !$('talk')) return;
  let talk = null, meter = 0, bridge = null, lastKey = '';
  const LABELS = {look_at_canvas: 'Looking at the design', build_design: 'Designing a new product', change_design: 'Changing the design', get_design: 'Reading the design', undo_redo: 'Stepping through versions', control_build: 'Directing the crew', find_references: 'Searching the reference vault'};
  const token = () => { try { return $('token').value.trim(); } catch (e) { return ''; } };

  function line(who, text) {
    text = String(text || '').replace(/\[[a-z][a-z ]{0,24}\]\s*/gi, '').trim();
    if (!text) return;
    const list = $('transcript'), li = document.createElement('li');
    li.className = who; li.textContent = text; list.appendChild(li);
    while (list.children.length > 14) list.firstChild.remove();
    list.hidden = false; list.scrollTop = list.scrollHeight;
  }
  function state(mode, text) {
    const b = $('talk'); b.dataset.mode = mode; b.setAttribute('aria-pressed', String(mode !== 'idle'));
    b.setAttribute('aria-label', mode === 'idle' ? 'Talk to Iris' : 'End the conversation');
    $('talk-label').textContent = mode === 'idle' ? 'Tap to talk' : mode === 'connecting' ? 'Connecting…' : mode === 'speaking' ? 'Iris is speaking' : 'Listening';
    if (text !== undefined) $('talk-state').textContent = text;
  }

  /* ---------- tools ---------- */
  let lookSeq = 0;
  function figmaLook() {
    const id = ++lookSeq;
    return new Promise((resolve, reject) => {
      const done = e => { const m = e.data && e.data.pluginMessage; if (!m || m.kind !== 'look' || m.id !== id) return; clearTimeout(timer); window.removeEventListener('message', done); if (m.error) reject(Error(m.error)); else resolve(m); };
      const timer = setTimeout(() => { window.removeEventListener('message', done); reject(Error('Figma did not return the frame in time.')); }, 12000);
      window.addEventListener('message', done); parent.postMessage({pluginMessage: {kind: 'look', id}}, '*');
    });
  }
  function canvasLook() {
    const src = $('board'), w = Math.min(1000, src.width), h = Math.round(src.height * w / Math.max(1, src.width));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(src, 0, 0, w, h);
    const s = Iris.state().design;
    return {png: c.toDataURL('image/png').split(',')[1], frame: {name: s ? s.product + ' (whole board)' : 'Empty canvas', width: w, height: h}, selected: [], texts: s ? s.screens.flatMap(x => x.copy).slice(0, 40) : []};
  }
  const tools = {
    async look_at_canvas({question}) {
      const seen = Iris.isPlugin ? await figmaLook() : canvasLook();
      let critique = '';
      if (Iris.connected && Iris.service.design) try { critique = (await Iris.call('/critique', JSON.stringify({png: seen.png, frame: seen.frame, texts: seen.texts, question}), null, 90000)).critique; } catch (e) { critique = ''; }
      return {frame: seen.frame.name, size: seen.frame.width + ' by ' + seen.frame.height, selected: seen.selected, copy: seen.texts.slice(0, 25),
        critique: critique || 'No visual critique is available (Claude is not connected), so judge from the copy and say you cannot see the pixels.'};
    },
    build_design: ({brief}) => Iris.build(brief),
    change_design: ({change}) => Iris.change(change),
    get_design: () => Iris.state(),
    undo_redo: ({action}) => Iris.history(action === 'redo' ? 'redo' : 'undo'),
    control_build: ({action}) => Iris.control(action),
    async find_references({query}) {
      if (!Iris.connected) return {results: [], note: 'The local service is not connected.'};
      return await Iris.call('/references?q=' + encodeURIComponent(String(query || '').slice(0, 120)), null, null, 15000);
    }
  };
  async function runTool(name, args) {
    if (!tools[name]) return {error: 'Unknown tool ' + name};
    try { return await tools[name](args || {}); } catch (e) { return {error: e.message || String(e)}; }
  }

  // Voice side. A connected Figma plugin does the work; otherwise this window does.
  // Agent tool calls time out at 120 s, so slow work answers "still working" and reports back when done.
  async function voiceTool(name, args) {
    line('tool', LABELS[name] || name);
    const work = (async () => {
      const remote = !Iris.isPlugin && Iris.connected && (await Iris.call('/status', null, null, 8000)).studio;
      if (!remote) return await runTool(name, args);
      return (await Iris.call('/bridge/command', JSON.stringify({tool: name, args}), null, 290000)).result;
    })().catch(e => ({error: e.message}));
    const early = await Promise.race([work, new Promise(r => setTimeout(() => r(null), 100000))]);
    if (early) { if (early.error) line('tool', '⚠ ' + early.error); return JSON.stringify(early); }
    work.then(result => {
      line('tool', result && result.error ? '⚠ ' + result.error : '✓ ' + (LABELS[name] || name) + ' finished');
      if (talk) talk.sendContextualUpdate('Update on your earlier ' + name + ' request, which has now finished: ' + JSON.stringify(result).slice(0, 1800) + '. Tell the user briefly.');
    });
    return JSON.stringify({status: 'still working', note: 'This takes a little longer. The crew is still going; you will get an update when it is finished. Tell the user to watch the canvas.'});
  }

  /* ---------- conversation ---------- */
  function loadClient() {
    if (window.IrisVoice) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script'); s.src = api + '/voice.js';
      s.onload = () => window.IrisVoice ? resolve() : reject(Error('The voice client did not load. Run npm run build and restart the server.'));
      s.onerror = () => reject(Error('The voice client did not load. Is node server.mjs running?'));
      document.head.appendChild(s);
    });
  }
  function animate() {
    cancelAnimationFrame(meter);
    const step = () => {
      if (!talk) { $('talk').style.setProperty('--level', 0); return; }
      const v = $('talk').dataset.mode === 'speaking' ? talk.getOutputVolume() : talk.getInputVolume();
      $('talk').style.setProperty('--level', Math.min(1, v * 2.2).toFixed(3));
      meter = requestAnimationFrame(step);
    };
    meter = requestAnimationFrame(step);
  }
  async function start() {
    if (!Iris.connected) { $('settings').hidden = false; state('idle', 'Connect the local service first: paste the session key in ⚙.'); return; }
    if (!Iris.service.agent) { state('idle', 'No voice agent. Set ELEVENLABS_API_KEY, run npm run agent and restart the server.'); return; }
    state('connecting', 'Asking for the microphone…');
    try { const s = await navigator.mediaDevices.getUserMedia({audio: true}); s.getTracks().forEach(x => x.stop()); }
    catch (e) {
      if (Iris.isPlugin) { $('talk-open').hidden = false; state('idle', 'Figma blocks the microphone in plugins. Open voice in your browser and Iris will still work in this file.'); }
      else state('idle', 'Microphone access was blocked. Allow it for localhost:4739 and try again.');
      return;
    }
    try {
      state('connecting', 'Connecting to Iris…');
      await loadClient();
      const {conversationToken} = await Iris.call('/voice/session', null, null, 15000);
      const clientTools = {}; for (const name of Object.keys(tools)) clientTools[name] = args => voiceTool(name, args);
      talk = await window.IrisVoice.Conversation.startSession({
        conversationToken, connectionType: 'webrtc', clientTools,
        onConnect: () => { state('listening', 'Say what you want to design or change.'); animate(); },
        onDisconnect: () => { talk = null; state('idle', 'Conversation ended.'); },
        onError: m => state(talk ? 'listening' : 'idle', String(m || 'Voice error')),
        onModeChange: ({mode}) => { if (talk) state(mode === 'speaking' ? 'speaking' : 'listening'); },
        onMessage: m => line((m.role || m.source) === 'user' ? 'you' : 'iris', m.message)
      });
      const s = Iris.state();
      talk.sendContextualUpdate((Iris.isPlugin ? 'The designer is in the Iris Figma plugin.' : (await Iris.call('/status', null, null, 8000)).studio ? 'The designer has the Iris plugin open in Figma; your tools act on their live Figma file.' : 'The designer is in the Iris browser studio.') +
        (s.design ? ' The current design is ' + s.design.product + ' with screens: ' + s.design.screens.map(x => x.name).join(', ') + '.' : ' There is no design yet.') +
        (s.canEdit ? '' : ' Claude is not connected, so changes are unavailable and new builds use the built-in kit.'));
    } catch (e) { talk = null; state('idle', e.message || 'Could not start the conversation.'); }
  }
  $('talk').onclick = () => {
    if (talk) { const t = talk; talk = null; t.endSession(); state('idle', 'Conversation ended.'); }
    else if ($('talk').dataset.mode !== 'connecting') start();
  };
  $('talk-open').onclick = () => parent.postMessage({pluginMessage: {kind: 'open-url', url: api + '/#key=' + encodeURIComponent(token())}}, '*');

  /* ---------- plugin side of the bridge ---------- */
  function openBridge() {
    if (bridge) bridge.close();
    bridge = new EventSource(api + '/bridge?key=' + encodeURIComponent(token()));
    bridge.onmessage = async e => {
      let cmd; try { cmd = JSON.parse(e.data); } catch (err) { return; }
      line('tool', (LABELS[cmd.tool] || cmd.tool) + ' (from voice)');
      const result = await runTool(cmd.tool, cmd.args);
      try { await Iris.call('/bridge/result', JSON.stringify({id: cmd.id, result}), null, 15000); } catch (err) { /* server gone */ }
    };
  }
  // Follow the studio's connection state (connect() lives inside studio.js).
  setInterval(() => {
    const key = Iris.connected ? token() + '|' + !!Iris.service.agent : '';
    if (key === lastKey) return; lastKey = key;
    if (!Iris.connected) { if (bridge) { bridge.close(); bridge = null; } if (!talk) state('idle', 'Connect the local service (⚙) to talk.'); return; }
    if (Iris.isPlugin) openBridge();
    if (!talk) state('idle', Iris.service.agent ? (Iris.isPlugin ? 'Tap to talk, or speak from the browser; Iris works in this file either way.' : 'Ready. Tap to talk.') : 'No voice agent. Run npm run agent and restart the server.');
  }, 700);
  state('idle', 'Connect the local service (⚙) to talk.');
})();
