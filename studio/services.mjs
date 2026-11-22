import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createRepoGateway, RepoGatewayError } from './repo-gateway.mjs';
import { createElevenAgentService, ElevenAgentError } from './elevenagent-service.mjs';

import { createExpectedParrotReviewer, ExpectedParrotError } from '../providers/expected-parrot/index.mjs';
import { createSponsorHub, SponsorError } from '../providers/sponsors/index.mjs';
import { archiveRoute } from './archive.mjs';
import { compileArtifact, verifyArtifact } from './compiler.mjs';
export const sponsors = createSponsorHub({});
const reviewer = createExpectedParrotReviewer();
const repo = createRepoGateway({ repoPath: fileURLToPath(new URL('../', import.meta.url)) });
const agent = createElevenAgentService({ apiKey: process.env.ELEVENLABS_API_KEY, agentId: process.env.ELEVENLABS_AGENT_ID });
export function integrationStatus() {
  return { elevenAgent: agent.status(), repo: repo.status(), reviewer:reviewer.status(), sponsors:sponsors.status() };
}

// Called only after the local session bearer and Host have been checked.
export async function serviceRoute(req, res, json, collect) {
  const url = new URL(req.url, 'http://localhost');
  const stop = new AbortController();
  res.once('close', () => { if (!res.writableFinished) stop.abort(); });
  const body = async () => JSON.parse((await collect(req, 180_000)).toString() || '{}');
  try {
    let result;
    if (req.method === 'POST' && url.pathname === '/eleven-agent/session') result = await agent.createSession({signal:stop.signal});
    else if (req.method === 'POST' && url.pathname === '/repo/question') {
      const {question} = await body();
      const endpoint = new URL(process.env.REPO_BACKEND_URL || 'http://127.0.0.1:3002');
      if (!(endpoint.protocol === 'https:' || (endpoint.protocol === 'http:' && endpoint.hostname === '127.0.0.1')) ||
          !process.env.REPO_QUESTION_TOKEN) {
        json(res,503,{error:'Configure REPO_BACKEND_URL and REPO_QUESTION_TOKEN on the studio server.'}); return true;
      }
      const receipt = {};
      const reply = await sponsors.withTrace({runId:randomUUID(),taskId:'repo-question',receipt},async () => {
        const remote = await fetch(new URL('/studio-api/repo/question',endpoint),{method:'POST',redirect:'error',
          headers:{Authorization:'Bearer '+process.env.REPO_QUESTION_TOKEN,'Content-Type':'application/json'},
          body:JSON.stringify({question}),signal:AbortSignal.any([stop.signal,AbortSignal.timeout(60000)])});
        return {status:remote.status,data:await remote.json()};
      });
      json(res,reply.status,{...reply.data,...(receipt.id ? {trace:receipt} : {})}); return true;
    }
    else if (req.method === 'GET' && ['/repo/context','/repo-context'].includes(url.pathname)) result = await repo.getContext();
    else if (req.method === 'POST' && url.pathname === '/repo/tasks') {
      const {instruction} = await body();
      result = await repo.startTask({instruction});
      if (!result.started) { json(res,409,{error:'An existing repository task is still active.',taskId:result.agentId}); return true; }
    } else if (req.method === 'GET' && /^\/repo\/tasks\/[\w-]+$/.test(url.pathname)) {
      result = await repo.taskStatus({agentId:url.pathname.split('/').at(-1)});
    } else if (req.method === 'GET' && url.pathname === '/archive/health') {
      const answer = await archiveRoute('health', undefined, stop.signal);
      json(res, answer.status, answer.data); return true;
    } else if (['GET','POST'].includes(req.method) && /^\/archive\/projects\/[a-zA-Z0-9_-]{1,80}$/.test(url.pathname)) {
      const record = req.method === 'GET' ? undefined : await body();
      if (record && !(Number.isInteger(record.expectedRevision) && record.expectedRevision >= 0)) {
        json(res,400,{error:'Provide the previous Wasp archive revision.'}); return true;
      }
      const answer = await archiveRoute(url.pathname.slice('/archive/'.length), record, stop.signal);
      json(res,answer.status,answer.data); return true;
    } else if (req.method === 'GET' && url.pathname === '/maritime/status') {
      try {
        const {stdout} = await promisify(execFile)(process.env.MARITIME_BIN || 'maritime',['whoami','--json','--no-input'], {
          timeout:8000, maxBuffer:100000, signal:stop.signal,
          env:{PATH:process.env.PATH,HOME:process.env.HOME,...(process.env.MARITIME_TOKEN ? {MARITIME_TOKEN:process.env.MARITIME_TOKEN} : {})}
        });
        const response = JSON.parse(stdout);
        const identity = response.data || response.result || response;
        result = {state:identity.authenticated === true ? 'verified' : 'unavailable', operation:'CLI account check', provisionedByStudio:0};
      } catch { result = {state:'unavailable', operation:'CLI account check', provisionedByStudio:0}; }
    } else if (req.method === 'POST' && url.pathname === '/reference-search') {
      const {refs,brief,pinned,runId} = await body();
      if (!Array.isArray(refs) || !Array.isArray(pinned) || typeof brief !== 'string') {
        json(res,400,{error:'Invalid reference collection.'}); return true;
      }
      const {retrieve} = await import('./retrieve.mjs');
      result = await sponsors.withTrace({runId,taskId:'reference-research'},()=>({matches:retrieve(refs,brief,pinned)}));
    } else if (req.method === 'POST' && url.pathname === '/persona-review') {
      const data = await body();
      result = await sponsors.withTrace({runId:data.runId || 'studio',taskId:'persona-review'},
        () => reviewer.review({...data, signal:stop.signal}));
    } else if (req.method === 'POST' && url.pathname === '/artifact-build') {
      const {plan} = await body();
      result = await sponsors.withTrace({runId:plan.id,taskId:'implementation'}, () => {
        const html = compileArtifact(plan);
        verifyArtifact(html,plan);
        return {html};
      });
    } else if (req.method === 'POST' && url.pathname.startsWith('/project-tools/')) {
      const methods = {
        company: 'companyContext', audience: 'audienceSearch', decision: 'saveDecision', memory:'readMemory', identity:'scopedAction', 'repo-permission':'scopedAction'
      };
      const tool = url.pathname.slice('/project-tools/'.length);
      if (!Object.hasOwn(methods,tool)) return false;
      const input = await body();
      const args = tool === 'identity' ? {actionId:'github-profile',context:{projectId:'local-studio'}}
        : tool === 'repo-permission' ? {actionId:'github-iris-metadata',context:{repo:input.repo ?? 'Festyve/iris',method:input.method ?? 'GET',projectId:'local-studio'}}
        : ['decision','memory'].includes(tool) ? {...input,projectId:'local-studio'} : input;
      result = await sponsors[methods[tool]]({...args,signal:stop.signal});
      if (result.error) { json(res,result.status || 503,result); return true; }
    } else return false;
    json(res, 200, result?.agentId ? {...result,taskId:result.agentId} : result);
  } catch (e) {
    if (!(e instanceof ElevenAgentError || e instanceof RepoGatewayError || e instanceof SponsorError || e instanceof ExpectedParrotError)) throw e;
    json(res, e.status, {error:e.message, code:e.code});
  }
  return true;
}
