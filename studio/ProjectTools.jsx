import React, { useState } from 'react';
import { studioRequest } from './session.mjs';

export default function ProjectTools({ sessionKey, services, artifact, addNote, refresh }) {
  const [query,setQuery] = useState('');
  const [busy,setBusy] = useState(false);
  const [result,setResult] = useState('');
  const [error,setError] = useState('');
  const [evidence, setEvidence] = useState({});
  const configured = name => services.sponsors?.some(service => service.id === name && service.configured);
  async function run(task) {
    setBusy(true); setError(''); setResult('');
    try { setResult(await task()); } catch(e) { setError(e.message); }
    finally { try { await refresh(); } catch {} setBusy(false); }
  }
  const call = (name,args) => studioRequest(sessionKey,'/project-tools/'+name,args);
  async function research(company) {
    const answer = await call(company ? 'company' : 'audience',{ query,limit:3 });
    const entries = company ? answer.data.companies : answer.data.people;
    if (!entries.length) return 'No matches for this query.';
    const lines = entries.map(r => company
      ? [r.name || r.companyName || r.company?.name,r.description || r.headline || r.domain].filter(v=>typeof v==='string').join(' — ')
      : [r.title,r.company].filter(v=>typeof v==='string').join(' · ')).filter(Boolean);
    if (!lines.length) return 'Matches returned without usable company or role details.';
    const title = (company ? 'Company context' : 'Audience roles') + ' · ' + query;
    const tags = company ? ['company','landing'] : ['audience','onboarding'];
    await addNote({ title, tags, source:answer.data.source, provider:answer.provider, observation:lines.join('\n'),
      adaptation: company ? 'Use the company context to explain the offer before the primary action.' : 'Name the target role in the introduction and place its first task near the top.' });
    return 'Saved and selected ' + title + ' for the next design brief.';
  }
  const memory = artifact && { projectId:'local-studio',title:artifact.plan.title,revision:artifact.version,referenceIds:artifact.plan.referenceIds,decision:artifact.plan.mechanism };
  return <details className="checks"><summary>Research &amp; delivery tools</summary>
    <label>Company or professional audience<input value={query} maxLength={200} onChange={e=>setQuery(e.target.value)}/></label>
    <div className="actions">
      <button disabled={busy || !query.trim() || !configured('fiber')} onClick={()=>run(()=>research(true))}>Find company context</button>
      <button disabled={busy || !query.trim() || !configured('ploid')} onClick={()=>run(()=>research(false))}>Find audience roles</button>
      <button disabled={busy || !memory || !configured('rowboat')} onClick={()=>run(async()=>{const r=await call('decision',memory); return 'Rowboat saved ' + r.data.path + ' · ' + r.state;})}>Save design decision</button>
      <button disabled={busy || !configured('rowboat')} onClick={()=>run(async()=>{const r=await call('memory',{projectId:'local-studio'}); return r.data.content || 'No saved decisions in this project.';})}>Read decision history</button>
      <button disabled={busy || !sessionKey} onClick={()=>run(async()=>{
        const r=await call('repo-permission',{repo:'Festyve/iris'});
        return r.data.pending ? 'Awaiting Alter approval '+r.data.approvalId : 'Alter approved repository read · '+r.data.data.full_name+' · '+r.data.data.default_branch;
      })}>Check repository read permission</button>
      <button disabled={busy || !configured('alter')} onClick={()=>run(async()=>{const r=await call('identity',{});return r.data.pending ? 'Awaiting Alter approval ' + r.data.approvalId : 'Delegated GitHub account · ' + (r.data.data?.login || r.data.statusCode);})}>Verify delivery account</button>
      <button disabled={busy || !sessionKey} onClick={()=>run(async()=>{
        const receipt = await studioRequest(sessionKey,'/repo/context');
        setEvidence(v=>({...v,Codevisor:'verified'}));
        return receipt.branch+' · '+receipt.files.length+' source paths';
      })}>Inspect repository</button>
      <button disabled={busy || !sessionKey} onClick={()=>run(async()=>{
        const receipt = await studioRequest(sessionKey,'/maritime/status');
        setEvidence(v=>({...v,Maritime:receipt.state}));
        return 'Maritime account '+receipt.state+'. No computers provisioned by this check.';
      })}>Check remote compute</button>
      <button disabled={busy || !artifact || !configured('traceroot')} onClick={()=>run(async()=>{
        const result=await studioRequest(sessionKey,'/artifact-build',{plan:artifact.plan});
        if(result.html!==artifact.html) throw Error('Rebuild differs from the saved artifact.');
        return 'Traced rebuild matches the saved HTML. Check TraceRoot for the exported span.';
      })}>Trace saved build</button>
    </div>
    {sessionKey ? <details><summary>Provider status</summary><dl className="provider-status">
      {(services.sponsors||[]).map(s=><div key={s.id}><dt>{s.id}</dt><dd>{s.state}{s.missing?.length ? ' · '+s.missing.join(', ') : ''}</dd></div>)}
      {Object.entries({Codevisor:evidence.Codevisor || (services.repo?.configured ? 'configured' : 'unavailable'),Maritime:evidence.Maritime || 'unchecked',
        'ElevenAgent':services.elevenAgent?.configured ? 'configured' : 'unavailable',
        'Expected Parrot':services.reviewer?.configured && services.reviewer?.runtimeReady ? 'configured' : 'unavailable'
      }).map(([name,state])=><div key={name}><dt>{name}</dt><dd>{state}</dd></div>)}
    </dl></details> : <p>Open the private session link printed by the server to use project services.</p>}
    <output>{busy ? 'Working…' : result}</output>{error && <p role="alert">{error}</p>}
  </details>;
}
