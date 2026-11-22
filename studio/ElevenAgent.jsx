import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { createAgentClientTools, safeAgentMessage } from '../ops/elevenlabs/client-tools.mjs';

/** api may be a base URL string or an authenticated request(path, fetchOptions) function. */
function LiveAgent(props) {
  const latest = useRef(props); latest.current = props;
  const [phase, setPhase] = useState('idle');
  const [problem, setProblem] = useState('');
  const [micMuted, setMicMuted] = useState(false);
  const [replyMuted, setReplyMuted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [tool, setTool] = useState(null);
  const [draft, setDraft] = useState('');
  const mounted = useRef(true), attempt = useRef(0), requestController = useRef(null), conversationRef = useRef(null);

  async function request(path, options = {}) {
    const { api, token } = latest.current;
    if (!token) throw Error('Open the studio session link printed by the local server.');
    const init = { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers, Authorization: 'Bearer ' + token } };
    const response = typeof api === 'function' ? await api(path, init) : await fetch((api || '') + path, init);
    if (typeof response?.json === 'function') {
      const body = await response.json();
      if (!response.ok) throw Error(body.error || 'The local agent service could not complete the request.');
      return body;
    }
    if (response?.error || response == null) throw Error(response?.error || 'The local agent service returned no result.');
    return response;
  }
  const requestRef = useRef(request); requestRef.current = request;
  const tools = useMemo(() => createAgentClientTools({
    async getContext() {
      const repository = await requestRef.current('/repo-context', { method: 'GET' });
      const design = await latest.current.getContext?.();
      return { repository, design: design ?? null };
    },
    onBrief: (...args) => latest.current.onBrief?.(...args),
    onBuild: (...args) => latest.current.onBuild?.(...args),
    onCancel: () => latest.current.onCancel?.(),
    onRepoTask: instruction => latest.current.onRepoTask
      ? latest.current.onRepoTask(instruction)
      : requestRef.current('/repo-task', { method: 'POST', body: JSON.stringify({ instruction }) }),
    onRepoTaskStatus: taskId => latest.current.onRepoTaskStatus
      ? latest.current.onRepoTaskStatus(taskId)
      : requestRef.current('/repo-task-status?taskId=' + encodeURIComponent(taskId), { method: 'GET' }),
    onToolState: update => { if (mounted.current) setTool(update); },
  }), []);

  const conversation = useConversation({
    micMuted,
    volume: replyMuted ? 0 : 1,
    clientTools: tools,
    onConnect() {
      if (mounted.current) { setPhase('connected'); setProblem(''); }
      conversationRef.current?.sendContextualUpdate('You are connected to the Second Cursor design studio. Call get_project_context for fresh, authenticated repository and canvas context before answering repository-specific questions.');
    },
    onDisconnect() { if (mounted.current) setPhase('disconnected'); },
    onError(error) { if (mounted.current) { setPhase('error'); setProblem(safeAgentMessage(error)); } },
    onMessage(message) {
      if (!mounted.current || typeof message?.message !== 'string') return;
      setMessages(previous => [...previous.slice(-11), { who: message.source === 'user' || message.role === 'user' ? 'You' : 'Agent', text: message.message.slice(0, 1800) }]);
    },
    onUnhandledClientToolCall() { if (mounted.current) setProblem('The agent requested a tool this app does not provide. Check the configured client tool names.'); },
  });
  conversationRef.current = conversation;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false; attempt.current++;
      requestController.current?.abort();
      Promise.resolve(conversationRef.current?.endSession()).catch(() => {});
    };
  }, []);

  async function stop() {
    attempt.current++; requestController.current?.abort();
    setPhase('disconnecting');
    try { await conversationRef.current.endSession(); }
    catch { /* A connection cancelled before session creation may already be closed. */ }
    if (mounted.current) { setPhase('disconnected'); setMicMuted(false); }
  }

  async function start() {
    const current = ++attempt.current;
    requestController.current?.abort();
    const controller = requestController.current = new AbortController();
    setProblem(''); setTool(null); setPhase('connecting');
    try {
      const session = await request('/eleven-agent/session', { method: 'POST', body: '{}', signal: controller.signal });
      if (current !== attempt.current) return;
      if (!navigator.mediaDevices?.getUserMedia) throw Error('Microphone access requires localhost or HTTPS and a supported browser.');
      setPhase('microphone');
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStream.getTracks().forEach(track => track.stop());
      if (current !== attempt.current) return;
      setPhase('connecting'); setMicMuted(false);
      // Current React SDK controls return void; callbacks determine the actual connection outcome.
      conversationRef.current.startSession({ signedUrl: session.signedUrl, connectionType: 'websocket' });
    } catch (error) {
      if (current !== attempt.current || !mounted.current) return;
      try { conversationRef.current.endSession(); } catch { /* A failed start may already be closed. */ }
      setPhase('error');
      setProblem(error?.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow it in the browser and try again, or use the typed companion.' : safeAgentMessage(error));
    }
  }

  const connected = conversation.status === 'connected';
  const busy = connected || ['connecting', 'microphone', 'disconnecting'].includes(phase);
  const state = connected ? micMuted ? 'Microphone muted' : conversation.isSpeaking ? 'Speaking' : 'Listening' : {
    idle: 'Ready to connect', connecting: 'Connecting', microphone: 'Waiting for microphone permission',
    disconnecting: 'Ending conversation', disconnected: 'Disconnected', error: 'Connection failed',
  }[phase] || phase;

  return <details className="voice eleven-agent" open>
    <summary>Talk to your repository</summary>
    <p>Have a live conversation with your ElevenLabs agent. Ask about the code, request a design, or send a coding task to Codevisor.</p>
    <div className="actions">
      <button className="ink" disabled={!props.token || busy} onClick={start}>Start conversation</button>
      {busy && <button onClick={stop}>End conversation</button>}
      <button disabled={!connected} aria-pressed={micMuted} onClick={() => setMicMuted(value => !value)}>{micMuted ? 'Unmute microphone' : 'Mute microphone'}</button>
      <button disabled={!connected} aria-pressed={replyMuted} onClick={() => {
        setReplyMuted(value => !value);
      }}>{replyMuted ? 'Unmute replies' : 'Mute replies'}</button>
    </div>
    <output role="status" aria-live="polite">{state}{tool ? ' · ' + tool.name.replaceAll('_', ' ') + ': ' + tool.status : ''}</output>
    {problem && <p role="alert">{problem}</p>}
    {!props.token && <p>Open the authenticated studio link printed by the local server to enable conversations.</p>}
    <form className="actions" onSubmit={event => {
      event.preventDefault();
      if (!connected || !draft.trim()) return;
      conversation.sendUserMessage(draft.trim()); setDraft('');
    }}>
      <label>Message during the call<input value={draft} maxLength={2400} disabled={!connected} onChange={event => {
        setDraft(event.target.value); if (connected) conversation.sendUserActivity();
      }}/></label><button disabled={!connected || !draft.trim()}>Send</button>
    </form>
    {messages.length > 0 && <details><summary>Conversation transcript</summary><ol aria-label="Conversation transcript" style={{ maxHeight: '16rem', overflowY: 'auto', paddingInlineStart: '1.3rem' }}>
      {messages.map((message, index) => <li key={index}><strong>{message.who}</strong> {message.text}</li>)}
    </ol></details>}
    <small>The microphone starts only after you choose Start. Repo changes are confirmed by tool receipts, with actual task status and test results.</small>
  </details>;
}

export default function ElevenAgent(props) {
  return <ConversationProvider><LiveAgent {...props}/></ConversationProvider>;
}
