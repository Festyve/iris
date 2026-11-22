import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { retrieve } from './retrieve.mjs';
import Library from './Library.jsx';
import Companion from './Companion.jsx';
import { localSession, studioRequest } from './session.mjs';
import Archive from './Archive.jsx';
import ProjectTools from './ProjectTools.jsx';
import Review from './Review.jsx';
import Voice from './Voice.jsx';
import { importFiles, saveReferences } from './vault.mjs';
import { compileArtifact, planBuild, verifyArtifact } from './compiler.mjs';
import { currentArtifact, projectController } from './project.mjs';
import { loadProject, saveProject } from './store.mjs';
import { inspectPreview } from './check-preview.mjs';
import desktopShot from '../design-vault/assets/after-hours-desktop.png';
import mobileShot from '../design-vault/assets/after-hours-mobile.png';
import './studio.css';

const ElevenAgent = React.lazy(() => import('./ElevenAgent.jsx'));

async function makePlan(options, key, useModel) {
  if (!useModel) return { ...planBuild(options), planningMode: 'local' };
  const {brief, refs, previous, direction, signal} = options;
  const references = refs.map(({id,title,tags,observation,adaptation}) => ({id,title,tags,observation,adaptation}));
  const response = await fetch('/studio-plan', { method:'POST', signal, headers: {
    'Content-Type':'application/json', Authorization:'Bearer ' + key
  }, body: JSON.stringify({brief, references, previous, direction, runId:options.runId}) });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Planning failed. Retry the request.');
  return result;
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
  const [libraryRevision,refreshLibrary] = useState(0);
  async function addNote({title,tags,source,provider,observation,adaptation}) {
    const note = ['---','title: '+JSON.stringify(title),'features: '+JSON.stringify(tags),'source_url: '+JSON.stringify(source),
      'author: '+JSON.stringify(provider),'---','# '+title,'','## Observation',observation,'','## Adaptation',adaptation].join('\n');
    const {refs:imported,errors} = await importFiles([new File([note],provider+'-research.md')], undefined, refs);
    if (!imported.length) throw Error(errors[0]?.message || 'Could not import research.');
    await saveReferences(imported);
    await studio.select([...new Set([...studio.read().selectedIds,imported[0].id])]);
    setSelectedIds(studio.read().selectedIds);
    refreshLibrary(v=>v+1);
  }
  const [selectedIds, setSelectedIds] = useState(initial.selectedIds);
  const selectionChange = useRef(0);
  const [problem, setProblem] = useState('');
  const [narrow, setNarrow] = useState(false);
  const [key] = useState(localSession);
  const [services, setServices] = useState({});
  const [useModel,setUseModel] = useState(false);
  const modelMode = useRef(false);
  const tracing = useRef(false);
  tracing.current = services.sponsors?.some(s=>s.id==='traceroot' && s.configured);
  const session = useRef('');
  session.current = key;
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
    retrieve: (items, brief, pinned, runId) => {
      if (!session.current || !tracing.current) return retrieve(items,brief,pinned);
      const sources = items.map(({id,title,tags,observation,adaptation})=>({id,title,tags,observation,adaptation}));
      const data = {refs:sources,brief,pinned,runId};
      if (new Blob([JSON.stringify(data)]).size > 170000) return retrieve(items,brief,pinned);
      return studioRequest(session.current,'/reference-search',data).then(r=>r.matches);
    }, planBuild: options => makePlan(options, key, modelMode.current), compile: async plan => session.current
      ? (await studioRequest(session.current, '/artifact-build', {plan})).html : compileArtifact(plan), async verify(html, plan) {
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
      <nav aria-label="Workspace"><a href="#canvas">Canvas</a><a href="#library">Library</a><a href="poster.html" target="_blank" rel="noreferrer">Iris adapter ↗</a></nav></header>
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
          {current && <details className="checks"><summary>Editable Figma screen</summary><p>Iris builds single screens from editable layers. Its local starters cover transit, a task board, and spending.</p>
            <a href={'poster.html#studio-brief=' + encodeURIComponent(current.plan.brief)} target="_blank" rel="noreferrer">Open this brief in Iris ↗</a></details>}
          {current && <Review key={current.id} artifact={current} references={refs} sessionKey={key}
            configured={services.reviewer?.configured && services.reviewer?.runtimeReady} onSave={studio.saveReview}/>}
          {current && <Archive project={project} sessionKey={key}/>}
          <ProjectTools refresh={async()=>setServices(await studioRequest(key,'/status'))} sessionKey={key} services={services} artifact={current} addNote={addNote}/>
          {services.elevenAgent?.configured ? <React.Suspense fallback={<p>Loading voice tools…</p>}>
            <ElevenAgent api="" token={key} onBrief={onBrief} onBuild={onBuild}
              onCancel={async () => { await studio.cancel(); return studio.read().run; }}
              getContext={() => ({projectId:project.id,run:project.run,selectedIds,
                references:refs.map(({id,title,tags})=>({id,title,tags})),plan:project.pending?.mechanism,
                artifact: current && {version:current.version,title:current.plan.title,path:current.path}})}
              onRepoTask={instruction=>studioRequest(key,'/repo/tasks',{instruction})}
              onRepoTaskStatus={id=>studioRequest(key,'/repo/tasks/'+encodeURIComponent(id))}/>
            </React.Suspense> : <details className="checks"><summary>Talk to your repository</summary>
              <p>{key ? 'Live conversations require ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID on the server.' : 'Open the private studio link printed by the server for live conversations.'}</p></details>}
          <Voice config={services} sessionKey={key} reply={plan?.mechanism || ''} onTranscript={ask}/>
        </aside></div>
        <Tasks run={project.run} onCancel={onCancel} onRetry={onRetry}/>
      </section>
      <div id="library"><Library key={libraryRevision} onChange={setRefs} selectedIds={selectedIds} onSelect={select} onError={error}/></div>
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
