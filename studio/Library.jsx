import React, { useEffect, useRef, useState } from 'react';
import { droppedFiles, importFiles, readLibrary, referenceOrigin, removeReference, saveReferences } from './vault.mjs';
import './library.css';

const demoNotes = import.meta.glob('../design-vault/references/**/*.md', { query: '?raw', import: 'default' });
const demoAssets = import.meta.glob('../design-vault/assets/**/*.{png,jpg,jpeg,gif,webp,avif,svg,bmp}', { query: '?url', import: 'default' });

async function demoFiles() {
  const loaders = { ...demoNotes, ...demoAssets };
  return Promise.all(Object.entries(loaders).map(async ([key, load]) => {
    const path = key.slice(3);
    const name = path.split('/').pop();
    try {
      const content = await load();
      if (demoNotes[key]) return { path, file: new File([content], name) };
      const response = await fetch(content);
      if (!response.ok) throw new Error('Could not load demo asset');
      return { path, file: new File([await response.blob()], name) };
    } catch (error) { return { path, error: error.message }; }
  }));
}

function OriginBadge({ item }) {
  return <span className="vault-origin">{referenceOrigin(item) === 'demo' ? 'Design-vault demo' : 'Imported snapshot'}</span>;
}

function Thumbnail({ asset }) {
  const [url, setUrl] = useState('');
  const [failedUrl, setFailedUrl] = useState(null);
  useEffect(() => {
    const url = URL.createObjectURL(asset.blob);
    setUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [asset.blob]);
  if (url === failedUrl) return <span className="vault-decode-error" role="status">Could not decode image: {asset.path}</span>;
  return url && <img loading="lazy" src={url} alt={asset.path.split('/').pop()} onError={() => setFailedUrl(url)} />;
}

function Detail({ item, close, remove, busy }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, []);
  return <dialog ref={dialog} className="vault-detail" aria-labelledby="vault-detail-title" onCancel={close}>
    <div className="vault-detail-head"><span>Reference detail</span><button type="button" onClick={close}>Close</button></div>
    <h2 id="vault-detail-title">{item.title}</h2>
    <OriginBadge item={item} />
    <p className="vault-path">{item.path}</p>
    {item.author && <p>By {item.author}</p>}
    {item.warnings?.length > 0 && <div className="vault-errors"><strong>Unresolved images</strong>
      <ul>{item.warnings.map((message, i) => <li key={i}>{message}</li>)}</ul>
    </div>}
    {item.tags.length > 0 && <p className="vault-tags">{item.tags.join(' · ')}</p>}
    {item.images.map(asset => <Thumbnail key={asset.path} asset={asset} />)}
    {item.observation && <><h3>Observation</h3><p>{item.observation}</p></>}
    {item.adaptation && <><h3>Adaptation</h3><p>{item.adaptation}</p></>}
    {typeof item.originalMarkdown === 'string'
      ? <details><summary>Original Markdown</summary><pre>{item.originalMarkdown}</pre></details>
      : typeof item.body === 'string' && <details><summary>Saved note body</summary>
        <p>Re-import this note to capture its original Markdown and frontmatter.</p><pre>{item.body}</pre>
      </details>}
    <div className="vault-detail-foot">
      {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">Visit source ↗</a>}
      <button type="button" disabled={busy} onClick={remove}>Remove reference</button>
    </div>
  </dialog>;
}

export default function Library({ onChange, selectedIds = [], onSelect, onError }) {
  const [refs, setRefs] = useState([]);
  const [phase, setPhase] = useState('loading');
  const [issues, setIssues] = useState([]);
  const [status, setStatus] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');
  const [detailId, setDetailId] = useState('');
  const [drag, setDrag] = useState(false);
  const fileInput = useRef(null);
  const folderInput = useRef(null);
  const locked = useRef(false);
  const callbacks = useRef({});
  callbacks.current = { onChange, onError, onSelect, selectedIds };

  function publish(next) {
    setRefs(next);
    callbacks.current.onChange?.(next);
  }
  function report(errors) {
    setIssues(errors);
    if (errors.length) callbacks.current.onError?.(errors.map(e => [e.path, e.message].filter(Boolean).join(' — ')).join('\n'));
  }
  useEffect(() => {
    let active = true;
    setPhase('loading');
    readLibrary().then(next => {
      if (active) { publish(next); report([]); setPhase('ready'); }
    }).catch(error => {
      if (active) { report([{ message: error.message }]); setPhase('failed'); }
    });
    return () => { active = false; };
  }, [attempt]);

  const busy = phase !== 'ready';
  async function run(task) {
    if (busy || locked.current) return;
    locked.current = true;
    setPhase('working');
    setStatus('');
    try { await task(); }
    catch (error) { report([{ message: error.message }]); }
    finally { locked.current = false; setPhase('ready'); }
  }
  function ingest(getFiles, batch) {
    return run(async () => {
      const result = await importFiles(await getFiles(), batch, refs);
      if (result.refs.length) await saveReferences(result.refs);
      publish(await readLibrary());
      report(result.errors);
      setStatus(result.refs.length + (result.refs.length === 1 ? ' reference imported.' : ' references imported.'));
    });
  }
  function picked(event) {
    const files = Array.from(event.target.files);
    event.target.value = '';
    if (files.length) ingest(() => files);
  }
  function remove(item) {
    return run(async () => {
      await removeReference(item.id);
      const next = await readLibrary();
      publish(next);
      const { selectedIds, onSelect } = callbacks.current;
      if (selectedIds.includes(item.id)) onSelect?.(selectedIds.filter(id => id !== item.id));
      setDetailId('');
      report([]);
      setStatus('Removed ' + item.title + '.');
    });
  }
  const tags = [...new Set(refs.flatMap(ref => ref.tags))].sort();
  const activeTag = tags.includes(tag) ? tag : '';
  const query = search.trim().toLowerCase();
  const visible = refs.filter(ref => (!activeTag || ref.tags.includes(activeTag)) &&
    [ref.title, ref.author, ref.path, ref.sourceUrl, ref.observation, ref.adaptation, ref.body, ...ref.tags].join(' ').toLowerCase().includes(query));
  const detail = refs.find(ref => ref.id === detailId);
  return <section className={'vault-library' + (drag ? ' vault-over' : '')} aria-label="Reference library"
    onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDrag(true); } }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDrag(false); }}
    onDrop={event => { event.preventDefault(); setDrag(false); ingest(() => droppedFiles(event.dataTransfer)); }}>
    <header className="vault-heading">
      <h2>Reference library</h2>
      <span>{refs.length} {refs.length === 1 ? 'reference' : 'references'}</span>
    </header>
    <div className="vault-import">
      <div><strong>Drop your references here</strong><p>Markdown notes, images, or an Obsidian folder.</p>
        <p className="vault-access">Imports are local snapshots. No live folder access.</p></div>
      <div className="vault-actions">
        <button type="button" className="vault-primary" disabled={busy} onClick={() => fileInput.current.click()}>Choose files</button>
        <button type="button" disabled={busy} onClick={() => folderInput.current.click()}>Choose folder</button>
      </div>
      <input hidden type="file" multiple accept=".md,.mdown,.markdown,.png,.jpg,.jpeg,.webp,.gif,.avif,.bmp,.svg" ref={fileInput} onChange={picked} />
      <input hidden type="file" multiple webkitdirectory="" ref={folderInput} onChange={picked} />
    </div>
    <div className="vault-tools">
      <button type="button" className="vault-link" disabled={busy} onClick={() => ingest(demoFiles, 'design-vault-demo')}>Load design-vault demo</button>
      {refs.length > 0 && <div className="vault-filters">
        <input type="search" aria-label="Search references" placeholder="Search references" value={search} onChange={e => setSearch(e.target.value)} />
        <select aria-label="Filter by tag" value={activeTag} onChange={e => setTag(e.target.value)}>
          <option value="">All tags</option>{tags.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>}
    </div>
    <div role="status" className="vault-status">{phase === 'loading' ? 'Opening library…' : phase === 'working' ? 'Saving changes…' : status}</div>
    {issues.length > 0 && <div className="vault-errors" role="alert"><strong>Library issues</strong>
      <ul>{issues.map((issue, i) => <li key={i}>{issue.path && <b>{issue.path} — </b>}{issue.message}</li>)}</ul>
      {phase === 'failed' && <button type="button" onClick={() => setAttempt(attempt + 1)}>Retry opening library</button>}
    </div>}
    {visible.length === 0 && refs.length > 0 && <p>No matching references.</p>}
    <div className="vault-grid">{visible.map(item => <article key={item.id} className="vault-card">
      <button type="button" className="vault-open" onClick={() => setDetailId(item.id)} aria-label={'Open ' + item.title}>
        <div className={'vault-preview' + (item.images.length ? '' : ' vault-excerpt')}>{item.images.length
          ? <Thumbnail asset={item.images[0]} /> : <span>{item.observation || item.title}</span>}</div>
        <h3>{item.title}</h3>
      </button>
      <div className="vault-card-meta"><OriginBadge item={item} />
        {item.warnings?.length > 0 && <span className="vault-warning-count">{item.warnings.length} unresolved image {item.warnings.length === 1 ? 'link' : 'links'}</span>}
      </div>
      {item.tags.length > 0 && <span className="vault-tags">{item.tags.join(' · ')}</span>}
      <label><input type="checkbox" aria-label={'Select ' + item.title} checked={selectedIds.includes(item.id)} onChange={e => {
        onSelect?.(e.target.checked ? [...selectedIds, item.id] : selectedIds.filter(id => id !== item.id));
      }} />Use in project</label>
    </article>)}</div>
    {detail && <Detail item={detail} close={() => setDetailId('')} remove={() => remove(detail)} busy={busy} />}
  </section>;
}
