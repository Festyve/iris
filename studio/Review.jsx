import React, { useEffect, useRef, useState } from 'react';
import { studioRequest } from './session.mjs';

export default function Review({ artifact, references, sessionKey, configured, onSave }) {
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  async function review() {
    if (busy) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError('');
    try {
      const {plan, checks} = artifact;
      const result = await studioRequest(sessionKey, '/persona-review', {
        runId:artifact.runId, brief: plan.brief, plan, references: references.filter(r => plan.referenceIds.includes(r.id))
          .map(({id,title,tags,observation,adaptation})=>({id,title,tags,observation,adaptation})),
        htmlSummary: [plan.title, plan.kind, plan.mechanism, ...checks].join('\n')
      }, controller.signal);
      if (!controller.signal.aborted) await onSave(artifact.id,result);
    } catch(e) { if (!controller.signal.aborted) setError(e.message); }
    finally { if (request.current === controller) setBusy(false); }
  }
  return <details className="checks"><summary>Simulated audience review</summary>
    <p>{configured ? 'Expected Parrot reviews this version’s brief, reference decisions and checked layout.' : 'Expected Parrot inference access is required for a persona review.'}</p>
    <button disabled={!configured || busy} onClick={review}>{busy ? 'Reviewing…' : artifact.review ? 'Review this version again' : 'Request review'}</button>
    {busy && <button onClick={() => request.current?.abort()}>Cancel review</button>}
    {error && <p role="alert">{error}</p>}
    {artifact.review?.reviews?.map((r,i)=><p key={i}><strong>{r.persona}</strong><br/>{r.critique}</p>)}
  </details>;
}
