import React, { useEffect, useRef, useState } from 'react';
import { studioRequest } from './session.mjs';

const storageKey = 'studio.wasp.archive.v1';
function receipt() {
  const stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
  if (stored) return stored;
  const value = { id:crypto.randomUUID(), revision:0, signature:'' };
  localStorage.setItem(storageKey, JSON.stringify(value));
  return value;
}

function manifest(project) {
  const current = project.versions.find(v => v.version === project.currentVersion);
  return {
    title:current.plan.title, currentVersion:current.version,
    versions:project.versions.map(({version,id,path,runId,plan,saved,checks}) => ({
      version, id, path, runId, saved, title:plan.title, brief:plan.brief, kind:plan.kind,
      direction:plan.direction, referenceIds:plan.referenceIds, decisions:plan.decisions,
      planningMode:plan.planningMode, checks
    }))
  };
}

export default function Archive({ project, sessionKey }) {
  const [status,setStatus] = useState('Saved on this device');
  const [attempt,retry] = useState(0);
  const writer = useRef(Promise.resolve());
  useEffect(() => {
    if (!sessionKey || !project.versions.length) return;
    let active = true;
    const sync = async () => {
      if (!active) return;
      const saved = receipt();
      const signature = project.versions.at(-1).id + '/' + project.currentVersion;
      if (saved.signature === signature) { setStatus('Wasp archive · revision ' + saved.revision); return; }
      await studioRequest(sessionKey,'/archive/health');
      if (active) setStatus('Saving version manifest to Wasp…');
      const answer = await studioRequest(sessionKey,'/archive/projects/' + saved.id, {expectedRevision:saved.revision, project:manifest(project)});
      localStorage.setItem(storageKey,JSON.stringify({...saved,revision:answer.revision,signature}));
      if (active) setStatus('Wasp archive · revision ' + answer.revision);
    };
    writer.current = writer.current.then(sync).catch(e => { if (active) setStatus(e.message); });
    return () => { active = false; };
  }, [sessionKey,project.versions,project.currentVersion,attempt]);
  return <details className="checks"><summary>Project archive</summary><p role="status">{status}</p>
    <p>HTML and reference images stay in this browser. Wasp stores version manifests and the decisions behind them.</p>
    <button disabled={!sessionKey} onClick={()=>retry(n=>n+1)}>Sync archive</button>
  </details>;
}
