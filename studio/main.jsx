import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Library from './Library.jsx';
import Companion from './Companion.jsx';
import { localSession } from './session.mjs';
import Voice from './Voice.jsx';
import { rankReferences } from './vault.mjs';
import { compileArtifact, planBuild, verifyArtifact } from './compiler.mjs';
import { currentArtifact, projectController } from './project.mjs';
import { loadProject, saveProject } from './store.mjs';
import { inspectPreview } from './check-preview.mjs';
import desktopShot from '../design-vault/assets/after-hours-desktop.png';
import mobileShot from '../design-vault/assets/after-hours-mobile.png';
import './studio.css';

async function makePlan(options, key, useModel) {
  if (!useModel) return { ...planBuild(options), planningMode: 'local' };
  const {brief, refs, previous, direction, signal} = options;
  const references = refs.map(({id,title,tags,observation,adaptation}) => ({id,title,tags,observation,adaptation}));
  const response = await fetch('/studio-plan', { method:'POST', signal, headers: {
    'Content-Type':'application/json', Authorization:'Bearer ' + key
  }, body: JSON.stringify({brief, references, previous, direction}) });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Planning failed. Retry the request.');
  return result;
}


function retrieve(refs, brief, pinned) {
  const attached = refs.filter(r => pinned.includes(r.id));
  const ranked = rankReferences(refs, brief, attached.flatMap(r => r.tags));
  const matches = new Map(ranked.slice(0, 4).map(hit => [hit.id, hit]));
  for (const ref of attached) {
    matches.set(ref.id, { ...matches.get(ref.id), id: ref.id, reason: 'Selected for this brief' + (matches.has(ref.id) ? ' · ' + matches.get(ref.id).reason : '') });
  }
  return Array.from(matches.values(), hit => ({ ...hit, title: refs.find(r => r.id === hit.id).title }));
}

function ask(text) {
  window.dispatchEvent(new CustomEvent('studio:ask', { detail: { text } }));
}

function download(artifact) {
  const url = URL.createObjectURL(new Blob([artifact.html], { type: 'text/html' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = (artifact.plan.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 64) || 'studio') + '-v' + artifact.version + '.html';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function Tasks({ run, onCancel, onRetry }) {
  if (!run) return null;
  return <section className="task-log" aria-label="Execution record">
    <header><h2>Execution</h2><small>Local tools</small></header>
    <ol>{run.tasks.map(task => <li key={task.id} data-state={task.status}>
      <span className="marker" aria-hidden="true">{task.status === 'running' ? '➤' : task.status === 'succeeded' ? '✓' : '·'}</span>
      <span>{task.label}<small>{task.artifact}</small></span><b>{task.status}</b>
    </li>)}</ol>
    {run.error && <p role="alert">{run.error}</p>}
    {['queued', 'running'].includes(run.status) && <button onClick={onCancel}>Cancel run</button>}
    {['failed', 'cancelled'].includes(run.status) && <button onClick={onRetry}>Retry run</button>}
  </section>;
}

function Studio({ initial }) {
  const [project, setProject] = useState(initial);
  const [refs, setRefs] = useState([]);
  const [selectedIds, setSelectedIds] = useState(initial.selectedIds);
  const selectionChange = useRef(0);
  const [problem, setProblem] = useState('');
  const [narrow, setNarrow] = useState(false);
  const [key] = useState(localSession);
  const [services, setServices] = useState({});
  const [useModel,setUseModel] = useState(false);
  const modelMode = useRef(false);
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    fetch('/status', {signal:controller.signal, headers:{Authorization:'Bearer '+key}})
      .then(async response => {
        if (!response.ok) throw Error('Session expired. Open the studio link printed by the server.');
        const status = await response.json();
        setServices(status); setUseModel(status.design);
      }).catch(e => { if (!controller.signal.aborted) setProblem(e.message); });
    return () => controller.abort();
  }, [key]);
  modelMode.current = useModel;
  const controller = useRef(null);
  if (!controller.current) controller.current = projectController(initial, { save: saveProject, notify: setProject,
    retrieve, planBuild: options => makePlan(options, key, modelMode.current), compile: compileArtifact, async verify(html, plan) {
      const checks = verifyArtifact(html, plan);
      for (const width of [390, 1024]) checks.push(await inspectPreview(html, width));
      return checks;
    } });
  const studio = controller.current;
  const error = e => setProblem(e?.message || String(e));
  useEffect(() => { studio.resume().catch(error); }, [studio]);
  function select(ids) {
    const change = ++selectionChange.current;
    setSelectedIds(ids);
    studio.select(ids).catch(e => {
      if (change === selectionChange.current) setSelectedIds(studio.read().selectedIds);
      error(e);
    });
  }
  const current = currentArtifact(project);
  const plan = project.pending || current?.plan;
  const onBrief = (text, ids = []) => studio.brief(text, ids, refs);
  const onBuild = direction => studio.build(direction, refs);
  const onCancel = () => studio.cancel().catch(error);
  const onRetry = async () => {
    try {
      const state = studio.read();
      const { plan } = await onBrief(state.run.brief, state.pending?.pinned || []);
      if (plan) return await onBuild(plan.direction);
    } catch (e) { error(e); }
  };
  const sample = !current;
  const begin = async () => {
    try { await studio.fresh(); ask(''); } catch (e) { error(e); }
  };
  return <>
    <header className="mast"><a className="wordmark" href="#canvas"><i aria-hidden="true"/>Second Cursor</a>
      <nav aria-label="Workspace"><a href="#canvas">Canvas</a><a href="#library">Library</a><a href="poster.html" target="_blank" rel="noreferrer">Poster adapter ↗</a></nav></header>
    <main className="workspace">
      {problem && <div className="notice" role="alert">{problem} <button onClick={() => setProblem('')}>Dismiss</button></div>}
      <section className="canvas-section" id="canvas">
        <div className="section-title"><h1>Design studio</h1><span className="local-dot">Local workspace</span></div>
        <div className="workbench"><div className="canvas">
          <div className="canvas-bar"><span>{sample ? 'Poster study' : 'Live preview'}</span>
            {sample ? <span>Desktop + mobile</span> : <div className="device"><button aria-pressed={!narrow} onClick={() => setNarrow(false)}>Wide</button><button aria-pressed={narrow} onClick={() => setNarrow(true)}>Mobile</button></div>}</div>
          {sample ? <div className="proof-sheet"><img className="desktop-proof" src={desktopShot} alt="After Hours desktop poster with oversized black type and orange flower"/><img className="mobile-proof" src={mobileShot} alt="Mobile composition of the same editable poster"/></div>
            : <div className="preview-well"><iframe sandbox="allow-scripts" title="Delivered interface" className={narrow ? 'narrow' : ''} srcDoc={current.html}/></div>}
          <div className="canvas-foot"><strong>{sample ? 'After Hours' : current.plan.title}</strong>{sample
            ? <a href="poster.html" target="_blank" rel="noreferrer">Edit poster ↗</a>
            : <button onClick={() => download(current)}>Download HTML ↓</button>}</div>
        </div>
        <aside className="sheet">
          <h2>{current ? 'Design record' : 'Start a design'}</h2>
          <p>{current ? current.plan.mechanism : 'Give the companion a brief and a few references. Build a landing page or an interactive app, then revise it on the canvas.'}</p>
          <button className="ink" onClick={() => ask()}>{current ? 'Request a revision' : 'Write a brief'} <span aria-hidden="true">↗</span></button>
          {current && <button onClick={begin}>New design</button>}
          <dl><div><dt>Planner</dt><dd>{services.design ? <select aria-label="Design planner" value={useModel ? 'gemini' : 'local'} onChange={e=>setUseModel(e.target.value==='gemini')}><option value="gemini">Gemini</option><option value="local">Local rules</option></select> : 'Local rules'}</dd></div><div><dt>References</dt><dd>{project.selectedIds.length} selected</dd></div>
            <div><dt>Artifact</dt><dd>{current?.path || 'Awaiting brief'}</dd></div></dl>
          {current && <details className="checks"><summary>Build checks</summary><p>{current.plan.review || 'Checked the title, primary action, and narrow-screen layout against the design plan.'}</p>
            <small>{current.plan.planningMode === 'gemini' ? 'Gemini plan' : 'Rule-based plan'} · Local HTML compiler</small><ul>{current.checks.map(check => <li key={check}>{check}</li>)}</ul></details>}
          {current && <label className="version-picker">Restore saved version <select value={project.currentVersion} onChange={e => studio.restore(Number(e.target.value)).catch(error)}>
              {project.versions.map(v => <option value={v.version} key={v.version}>v{v.version} · {v.plan.title}</option>)}</select></label>}
          <Voice config={services} sessionKey={key} reply={plan?.mechanism || ''} onTranscript={ask}/>
        </aside></div>
        <Tasks run={project.run} onCancel={onCancel} onRetry={onRetry}/>
      </section>
      <div id="library"><Library onChange={setRefs} selectedIds={selectedIds} onSelect={select} onError={error}/></div>
    </main>
    <Companion refs={refs} selectedIds={selectedIds} project={{ ...project, current }} run={project.run}
      onBrief={onBrief} onBuild={onBuild} onCancel={onCancel} onRetry={onRetry} onError={error}/>
  </>;
}

const root = createRoot(document.getElementById('root'));
root.render(<p role="status">Opening your design studio…</p>);
loadProject().then(initial => root.render(<Studio initial={initial}/>)).catch(e => root.render(
  <main className="workspace"><h1>Local project storage unavailable</h1><p>{e.message}</p><button onClick={() => location.reload()}>Retry</button></main>
));
