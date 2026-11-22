import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  AssistantRuntimeProvider, AttachmentPrimitive, ComposerPrimitive,
  MessagePrimitive, ThreadPrimitive, useAuiState, useExternalStoreRuntime,
} from "@assistant-ui/react";
import "./companion.css";

const Controls = createContext(null);
const prefix = "second-cursor.companion.v1.";
const active = status => ["queued", "running", "pending", "in_progress"].includes(status);
const uid = () => crypto.randomUUID();
const identity = value => value;
const textPart = text => ({ type: "text", text });
const tool = (toolName, toolCallId, result) => ({ type: "tool-call", toolCallId, toolName, args: {}, result });

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(prefix + key)) ?? fallback; }
  catch { return fallback; }
}

function write(key, value) {
  try { localStorage.setItem(prefix + key, JSON.stringify(value)); return true; }
  catch { return false; }
}

const suggestionDetails = {
  "Add search": "Add a search field above the entry list so readers can find an entry by its title or notes.",
  "Remove search": "Remove the search field above the list to give the entries more space.",
  "Add filter": "Add a shortlist filter above the entries so readers can return to the items they saved.",
  "Remove filter": "Remove the shortlist filter to simplify browsing the full collection.",
  "Switch to the editorial layout": "Give the introduction a wide opening spread so readers see the project story before the entries.",
  "Switch to the index layout": "Place the introduction beside the ruled list on wide screens so readers can scan entries sooner.",
};

function PlannerLabel({ mode }) {
  return <small className="sc-planner">{mode === "gemini" ? "Gemini planning" : "Local rule-based planning"}</small>;
}

function referenceFor(plan) {
  const decisions = plan.decisions || [];
  const related = decisions.find(d => plan.suggestion?.toLowerCase().includes(d.feature));
  return related?.source || decisions.find(d => plan.referenceIds?.includes(d.id))?.source ||
    plan.matches?.find(m => plan.referenceIds?.includes(m.id))?.title;
}

function PlanCard({ result: plan, toolCallId }) {
  const { build, eligible, busy } = useContext(Controls);
  const live = eligible(toolCallId, plan);
  const [direction, setDirection] = useState(plan.approvedDirection || plan.direction || "editorial");
  return <section className="sc-card" aria-label="Proposed plan">
    <PlannerLabel mode={plan.planningMode} />
    <strong>{plan.title || "Proposed design"}</strong>

    {plan.matches?.length > 0 && <details><summary>Reference decisions ({plan.matches.length})</summary>
      <ul>{plan.matches.map(match => <li key={match.id}><b>{match.title}</b> {match.reason}</li>)}</ul>
    </details>}
    <label>Layout direction
      <select value={direction} disabled={!live || busy} onChange={event => setDirection(event.target.value)}>
        <option value="editorial">Editorial · wide opening spread</option>
        <option value="index">Index · side introduction and ruled list</option>
      </select>
    </label>
    <button type="button" className="sc-primary" disabled={!live || busy} onClick={() => build(toolCallId, plan, direction)}>
      {plan.baseVersion != null || plan.revision ? "Apply plan" : "Build plan"}
    </button>

  </section>;
}

function describe(value) {
  if (typeof value === "string") return value;
  return value?.message || value?.title || value?.path || (value ? JSON.stringify(value) : "");
}

function RunCard({ result }) {
  const { run, onCancel, onRetry, perform, report, busy } = useContext(Controls);
  const live = result.id === run?.id;
  return <section className="sc-card sc-activity" aria-label="Build activity">
    <strong>Build activity <small>{result.status}</small></strong>
    {result.error && <p>{result.error}</p>}
    <ul>{result.tasks.map(task => <li key={task.id}>
      <span>{task.label}</span><small>{task.status}</small>
      {(task.error || task.artifact) && <details><summary>{task.error ? "Error" : "Artifact"}</summary>
        <p>{describe(task.error || task.artifact)}</p>{task.detail && <p>{task.detail}</p>}</details>}
    </li>)}</ul>
    {live && active(result.status) && onCancel &&
      <button type="button" onClick={() => Promise.resolve().then(() => onCancel()).catch(report)}>Cancel build</button>}
    {live && ["failed", "cancelled", "canceled"].includes(result.status) && onRetry &&
      <button type="button" disabled={busy} onClick={() => perform(onRetry)}>Retry build</button>}
  </section>;
}

function DeliveryCard({ result }) {
  const { current, pending, versions, run, busy, change } = useContext(Controls);
  const editable = current?.version === result.version && current?.plan?.id === result.planId;
  const plan = editable ? current.plan : versions?.find(v => v.version === result.version && v.plan?.id === result.planId)?.plan;
  const source = result.source || (plan && referenceFor(plan));
  return <section className="sc-card" aria-label="Delivered design">
    <PlannerLabel mode={result.planningMode || plan?.planningMode} />
    <strong>{result.title} · v{result.version}</strong>
    <p>{result.path}</p>
    {result.suggestion && <>
      <p>{suggestionDetails[result.suggestion]}</p>
      {source && <p className="sc-source">Design reference · {source}</p>}
      <button type="button" className="sc-primary" disabled={!editable || busy || Boolean(pending) || active(run?.status)}
        onClick={() => change(result)}>Apply change · {result.suggestion}</button>
    </>}
  </section>;
}

const parts = { tools: { by_name: { proposeDesign: PlanCard, buildActivity: RunCard, deliverDesign: DeliveryCard } } };

function Attachment({ removable }) {
  const name = useAuiState(s => s.attachment.name);
  return <AttachmentPrimitive.Root className="sc-attachment">
    <AttachmentPrimitive.Name />
    {removable && <AttachmentPrimitive.Remove aria-label={'Remove ' + name}>×</AttachmentPrimitive.Remove>}
  </AttachmentPrimitive.Root>;
}

function Surface({ runtime, refs, selectedIds, project, run, busy, report, storageError, mode, setMode }) {
  const [placement, setPlacement] = useState(() => read("placement", { side: "right", open: false }));
  const input = useRef(null);
  const launcher = useRef(null);
  const frame = useRef();
  const panelId = React.useId();
  const composer = runtime.thread.composer;
  const attachments = useAuiState(s => s.composer.attachments);
  function open(text) {
    if (typeof text === "string") composer.setText(text);
    setPlacement(p => ({ ...p, open: true }));
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => input.current?.focus());
  }
  function dismiss() {
    setPlacement(p => ({ ...p, open: false }));
    frame.current = requestAnimationFrame(() => launcher.current?.focus());
  }
  useEffect(() => { write("placement", placement); }, [placement]);
  useEffect(() => {
    const ask = event => open(event.detail?.text);
    window.addEventListener("studio:ask", ask);
    return () => { window.removeEventListener("studio:ask", ask); cancelAnimationFrame(frame.current); };
  }, [composer]);

  const selected = refs.filter(note => selectedIds.includes(note.id));
  const missing = selected.filter(note => !attachments.some(a => a.id === note.id));
  const canvas = project.current;
  const canvasId = 'canvas:' + JSON.stringify([canvas?.plan?.id, canvas?.version]);
  async function attach(id, name, text) {
    try { await composer.addAttachment({ id, name, type: "document", content: [textPart(text)] }); }
    catch (error) { report(error); }
  }
  function keyboard(event) {
    if (event.key === "Escape") dismiss();
    else if (event.altKey && ["Home", "ArrowRight", "ArrowLeft"].includes(event.key)) {
      setPlacement(p => ({ ...p, side: event.key === "ArrowLeft" ? "left" : "right" }));
    } else return;
    event.preventDefault();
    event.stopPropagation();
  }
  const dockLeft = placement.side === "left";
  return <aside className={'sc-companion ' + (dockLeft ? "sc-left" : "sc-right")} aria-label="Studio companion" onKeyDown={keyboard}>
    {!placement.open && <button className="sc-launch" type="button" ref={launcher} aria-controls={panelId}
      aria-expanded={false} onClick={() => open()}><span className="sc-mark" aria-hidden="true" /> Ask Second Cursor
      {active(run?.status) && <small>{run.status}</small>}</button>}
    {placement.open && <ThreadPrimitive.Root className="sc-panel" id={panelId}>
      <header className="sc-head"><span className="sc-mark" aria-hidden="true" /><strong>Second Cursor</strong>
        <button type="button" title="Dock left or right (Alt + arrow)" onClick={() => setPlacement(p => ({ ...p, side: dockLeft ? "right" : "left" }))}>
          Dock {dockLeft ? "right" : "left"}</button>
        <button type="button" title="Reset placement (Alt + Home)" onClick={() => setPlacement(p => ({ ...p, side: "right" }))}>Reset</button>
        <button type="button" aria-label="Dismiss companion" title="Dismiss (Escape)" onClick={dismiss}>×</button>
      </header>
      <ThreadPrimitive.Viewport className="sc-log" role="log" aria-label="Design conversation" tabIndex={0} aria-live="polite">
        <ThreadPrimitive.Empty><p className="sc-empty">What would you like to build?</p></ThreadPrimitive.Empty>
        <ThreadPrimitive.Messages>{({ message }) => <MessagePrimitive.Root className="sc-message">
          <b className="sc-author">{message.role === "user" ? "You" : "Second Cursor"}</b>
          <MessagePrimitive.Attachments>{() => <Attachment />}</MessagePrimitive.Attachments>
          <MessagePrimitive.Parts components={parts}/>
        </MessagePrimitive.Root>}</ThreadPrimitive.Messages>
      </ThreadPrimitive.Viewport>
      <ComposerPrimitive.Root className="sc-compose">
        <div className="sc-modes" role="group" aria-label="Build mode">
          {[["guide", "Guide me"], ["build", "Build end-to-end"]].map(([value, label]) =>
            <button key={value} type="button" disabled={busy} aria-pressed={mode === value}
              onClick={() => setMode(value)}>{label}</button>)}
        </div>
        <p className="sc-mode-hint">{mode === "guide" ? "Review the plan before building." : "Build as soon as the brief is clear."}</p>
        <div className="sc-context">
          <button type="button" disabled={!missing.length || busy} onClick={async () => {
            for (const note of missing) await attach(note.id, note.title || note.name || note.id, note.observation || note.body || note.title || note.id);
          }}>+ Selected notes{selected.length ? ' (' + selected.length + ')' : ''}</button>
          <button type="button" disabled={!canvas || busy || attachments.some(a => a.id === canvasId)}
            onClick={() => attach(canvasId, "Canvas · " + (canvas.plan?.title || "Current design"),
              JSON.stringify({ title: canvas.plan?.title, brief: canvas.plan?.brief, mechanism: canvas.plan?.mechanism, version: canvas.version, path: canvas.path }))}>+ Canvas</button>
        </div>
        <div className="sc-attached"><ComposerPrimitive.Attachments>{() => <Attachment removable />}</ComposerPrimitive.Attachments></div>
        <div className="sc-entry"><ComposerPrimitive.Input ref={input} aria-label="Design brief or change" placeholder="Ask for a design, change, or /repo question…" />
          <ComposerPrimitive.Send className="sc-primary" disabled={busy}>Send</ComposerPrimitive.Send></div>
        <span role="status" className="sc-status">{storageError || (busy ? "Working…" : "")}</span>
      </ComposerPrimitive.Root>
    </ThreadPrimitive.Root>}
  </aside>;
}

export default function Companion(props) {
  return <Conversation key={props.project?.id || "studio"} {...props}/>;
}

function Conversation({ refs = [], selectedIds = [], project = {}, run, onBrief, onBuild, onCancel, onRetry, onError }) {
  const key = "thread." + (project.id || "studio");
  const [messages, setMessages] = useState(() => {
    const saved = read(key, []);
    return Array.isArray(saved) ? saved : [];
  });
  const [mode, setMode] = useState(() => read(key + ".mode", "guide"));
  useEffect(() => { write(key + ".mode", mode); }, [key, mode]);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [storageError, setStorageError] = useState("");
  useEffect(() => {
    setStorageError(write(key, messages) ? "" : "Thread could not be saved on this device.");
  }, [key, messages]);

  // A run owns one transcript entry. Replacing its snapshot never rewrites an earlier run.
  useEffect(() => {
    if (!run?.id) return;
    const id = 'run:' + run.id;
    const snapshot = { id: run.id, status: run.status, error: describe(run.error), tasks: (run.tasks || []).map(({ id, label, status, artifact, error, detail }) =>
      ({ id, label, status, artifact: describe(artifact), error: describe(error), detail: describe(detail) })) };
    const entry = { id, role: "assistant", content: [tool("buildActivity", id, snapshot)] };
    setMessages(list => {
      const prior = list.find(m => m.id === id);
      if (!prior) return [...list, entry];
      if (JSON.stringify(prior.content) === JSON.stringify(entry.content)) return list;
      return list.map(m => m.id === id ? entry : m);
    });
  }, [run, run?.status, run?.tasks]);

  const append = (role, content, extra) => setMessages(list => [...list, { id: uid(), role, content, ...extra }]);
  function report(error) {
    const message = error?.message || String(error);
    append("assistant", message);
    onError?.(message);
  }
  async function perform(action) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try { await action(); } catch (error) { report(error); }
    finally { lock.current = false; setBusy(false); }
  }

  async function stage(text, ids, userMessage, attachments = []) {
    append("user", userMessage, { attachments, request: true });
    const { message, plan } = await onBrief(text, ids);
    const reply = message || plan?.mechanism || (plan ? "Plan ready." : "What would you like to clarify?");
    const content = [textPart(reply)];
    if (plan?.mechanism && !reply.includes(plan.mechanism)) content.push(textPart(plan.mechanism));
    const callId = uid();
    if (plan) content.push(tool("proposeDesign", callId, { ...plan, revision: Boolean(project.current && !project.startFresh) }));
    append("assistant", content, { response: true });
    return { plan, callId };
  }

  function brief(text, attachments = []) {
    const prior = project.clarification ? messages.findLast(m => m.request && m.content === project.clarification)?.attachments || [] : [];
    const ids = [...prior, ...attachments].filter(a => !a.id.startsWith("canvas:")).map(a => a.id);
    return perform(async () => {
      const { plan, callId } = await stage(text, ids, text, attachments);
      if (plan && mode === "build") await executePlan(callId, plan.direction);
    });
  }

  function change(delivery) {
    const current = project.current;
    if (project.startFresh || project.pending || active(run?.status) ||
        current?.version !== delivery.version || current?.plan?.id !== delivery.planId) return;
    return perform(async () => {
      const { plan, callId } = await stage(delivery.suggestion, current.plan.referenceIds || [],
        "Apply change · " + delivery.suggestion + " · v" + delivery.version);
      if (plan) await executePlan(callId, plan.direction);
    });
  }

  useEffect(() => {
    const plan = project.pending;
    if (!plan?.id || busy) return;
    setMessages(list => {
      const recorded = list.some(m => Array.isArray(m.content) && m.content.some(
        part => part.toolName === "proposeDesign" && part.result?.id === plan.id));
      if (recorded) return list;
      return [...list, { id: uid(), role: "assistant", response: true, content: [tool("proposeDesign", uid(), plan)] }];
    });
  }, [project.pending, busy]);

  const latest = messages.findLast(m => m.response || m.request);
  function eligible(callId, plan) {
    return plan.id != null && plan.id === project.pending?.id && (!run || run.status === "queued") &&
      latest?.response && latest.content.some(part => part.toolCallId === callId) && !latest.applied;
  }
  function build(callId, plan, direction) {
    if (!eligible(callId, plan)) return;
    return perform(async () => {
      const action = project.current && !project.startFresh ? "Apply plan" : "Build plan";
      append("user", [action, plan.title, direction].join(" · "));
      await executePlan(callId, direction);
    });
  }

  async function executePlan(callId, direction) {
    const artifact = await onBuild(direction);
    if (artifact === null) {
      append("assistant", "The build did not deliver a new version.");
      return;
    }
    setMessages(list => list.map(m => {
      if (!m.response || !m.content.some(part => part.toolCallId === callId)) return m;
      return { ...m, applied: true, content: m.content.map(part => part.toolCallId === callId
        ? { ...part, result: { ...part.result, approvedDirection: direction } } : part) };
    }));
    if (artifact?.plan) {
      const { plan, version, path } = artifact;
      append("assistant", [tool("deliverDesign", uid(), {
        version, path, title: plan.title, planId: plan.id, suggestion: plan.suggestion,
        planningMode: plan.planningMode, source: referenceFor(plan),
      })]);
    }
  }

  const runtime = useExternalStoreRuntime({
    messages, convertMessage: identity, isRunning: busy,
    onNew: message => brief(message.content.filter(p => p.type === "text").map(p => p.text).join("\n").trim(), message.attachments),
  });
  return <AssistantRuntimeProvider runtime={runtime}>
    <Controls.Provider value={{ build, eligible, current: project.startFresh ? null : project.current, pending: project.pending, versions: project.versions, busy, run, onCancel, onRetry, perform, report, change }}>
      <Surface {...{ runtime, refs, selectedIds: Array.from(selectedIds), project, run, busy, report, storageError, mode, setMode }}/>
    </Controls.Provider>
  </AssistantRuntimeProvider>;
}
