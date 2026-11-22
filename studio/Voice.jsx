import React, { useEffect, useRef, useState } from 'react';

export default function Voice({ reply, onTranscript, sessionKey: key, config }) {
  const [phase, setPhase] = useState('idle');
  const [status, setStatus] = useState('');
  const [muted, setMuted] = useState(() => localStorage.getItem('studio.voice.muted') === 'yes');
  const op = useRef({});
  const input = useRef(null);
  function stop() {
    const current = op.current;
    op.current = {};
    current.controller?.abort();
    if (current.recorder?.state === 'recording') current.recorder.stop();
    current.stream?.getTracks().forEach(track => track.stop());
    current.audio?.pause();
    if (current.url) URL.revokeObjectURL(current.url);
    setPhase('idle');
  }
  useEffect(() => () => stop(), []);
  function start(next) {
    stop();
    const current = { controller: new AbortController() };
    op.current = current;
    setPhase(next);
    setStatus('');
    return current;
  }
  async function request(current, path, body, type) {
    const res = await fetch(path, { method: 'POST', body, signal: current.controller.signal,
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': type } });
    if (!res.ok) throw Error((await res.json()).error || 'Voice service unavailable.');
    return res;
  }
  function failure(current, e) {
    if (op.current !== current) return;
    stop();
    setStatus(e.message);
  }
  async function transcribe(blob) {
    const current = start('Transcribing');
    try {
      if (blob.size > 6000000) throw Error('Choose a recording under 6 MB.');
      const res = await request(current, '/voice', blob, blob.type || 'application/octet-stream');
      const { text, truncated } = await res.json();
      if (op.current !== current) return;
      stop();
      onTranscript(text);
      setStatus(truncated ? 'Transcript shortened. Review it in the companion.' : 'Review the transcript in the companion before sending.');
    } catch (e) { failure(current, e); }
  }
  async function record() {
    const current = start('Opening microphone');
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw Error('Microphone unavailable. Choose an audio file.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (op.current !== current) { stream.getTracks().forEach(t => t.stop()); return; }
      current.stream = stream;
      const recorder = current.recorder = new MediaRecorder(stream);
      const chunks = [];
      let size = 0;
      recorder.ondataavailable = event => {
        chunks.push(event.data);
        size += event.data.size;
        if (size >= 5900000 && recorder.state === 'recording') recorder.stop();
      };
      recorder.onerror = () => failure(current, Error('Recording failed. Choose an audio file or retry.'));
      recorder.onstop = () => {
        if (op.current === current) transcribe(new Blob(chunks, { type: recorder.mimeType }));
      };
      recorder.start(300);
      setPhase('Recording');
    } catch (e) { failure(current, Error(e.message + ' You can also choose an audio file.')); }
  }
  async function speak() {
    const current = start('Preparing speech');
    try {
      const res = await request(current, '/speech', JSON.stringify({ text: reply }), 'application/json');
      const blob = await res.blob();
      if (op.current !== current) return;
      current.url = URL.createObjectURL(blob);
      current.audio = new Audio(current.url);
      current.audio.onended = () => { if (op.current === current) stop(); };
      current.audio.onerror = () => failure(current, Error('Audio playback failed.'));
      await current.audio.play();
      if (op.current === current) setPhase('Speaking');
    } catch (e) { failure(current, e); }
  }
  const busy = phase !== 'idle';
  return <details className="voice"><summary>Voice notes &amp; playback</summary>
    <p>{!key ? 'For voice, open the session link printed by node server.mjs.' : !config.transcriptionConfigured
      ? 'Spoken briefs need ELEVENLABS_API_KEY on the server.' : 'Record a brief, then edit the transcript in the companion.'}</p>
    <div className="actions">
      <button disabled={!config.transcriptionConfigured || (busy && phase !== 'Recording')} onClick={phase === 'Recording' ? () => op.current.recorder.stop() : record}>{phase === 'Recording' ? 'Finish recording' : 'Record brief'}</button>
      <button disabled={!config.transcriptionConfigured || busy} onClick={() => input.current.click()}>Choose audio file</button>
      <input hidden ref={input} type="file" accept="audio/*" onChange={e => { const f = e.target.files[0]; e.target.value = ''; if (f) transcribe(f); }}/>
      <button disabled={!config.speechConfigured || !reply || muted || busy} onClick={speak}>Read design feedback</button>
      {busy && <button onClick={stop}>Cancel {phase.toLowerCase()}</button>}
      <label><input type="checkbox" checked={muted} onChange={e => {
        setMuted(e.target.checked); localStorage.setItem('studio.voice.muted', e.target.checked ? 'yes' : 'no');
        if (['Speaking', 'Preparing speech'].includes(phase)) stop();
      }}/> Mute speech</label>
    </div>
    {key && !config.speechConfigured && <p>Playback needs ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID.</p>}
    <output>{busy ? phase + '…' : status}</output>
  </details>;
}
