// Local service for Iris: Claude designs and edits; ElevenLabs transcribes spoken briefs and runs the Talk to Iris voice agent.
import Anthropic from '@anthropic-ai/sdk';
import {outputCaps} from './studio/provider-budget.mjs';
import {budget,studioRoute} from './studio-http.mjs';
import {sponsors} from './studio/services.mjs';
import {serveStudio} from './studio/server.mjs';
import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFile, readdir, stat} from 'node:fs/promises';
import {readFileSync, writeFileSync} from 'node:fs';
import {join, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ElevenLabsClient} from '@elevenlabs/elevenlabs-js';
import {createElevenAgentService} from './studio/elevenagent-service.mjs';
import {edit} from './designer.mjs';
import {composeBrief,planBrief} from './references/compose.mjs';
import {editBrief} from './references/brief-edit.mjs';
import {createExpectedParrotReviewer} from './providers/expected-parrot/index.mjs';
import {loadProfiles, profileStyle} from './profiles.mjs';
import {capture} from './references/captures.mjs';
import {websiteEdit} from './references/planner.mjs';

// The session key survives restarts (kept in .iris-session, never committed), so you paste it
// into the browser or the Figma plugin once and it keeps working.
const keyFile = new URL('./.iris-session', import.meta.url);
let secret = '';
try { secret = readFileSync(keyFile, 'utf8').trim(); } catch { /* first run */ }
if (!/^[0-9a-f]{48}$/.test(secret)) { secret = randomBytes(24).toString('hex'); writeFileSync(keyFile, secret + '\n', {mode: 0o600}); }
const port = Number(process.env.STUDIO_PORT || 4739);
const origin = 'http://localhost:'+port;
const voiceKey = process.env.ELEVENLABS_API_KEY;
const MODEL = 'claude-opus-5-5';
const EDIT_MODEL = process.env.IRIS_EDIT_MODEL || 'claude-haiku-5-5';
const contentPlanner=createExpectedParrotReviewer({timeoutMs:32000});
let agentId = process.env.ELEVENLABS_AGENT_ID || '';
if (!agentId) try { agentId = JSON.parse(await readFile(new URL('./.iris-agent.json', import.meta.url), 'utf8')).agentId || ''; } catch (e) { /* run npm run agent */ }
const irisVoice = createElevenAgentService({apiKey: voiceKey, agentId});
let vaultDir = process.env.IRIS_VAULT || '';
if (!vaultDir) try { if ((await stat(new URL('./vault', import.meta.url))).isDirectory()) vaultDir = fileURLToPath(new URL('./vault', import.meta.url)); } catch (e) { /* no reference vault */ }

// Credentials come from ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN or an `ant auth login` profile.
let client = null;
try { client = new Anthropic(); } catch (e) { console.warn('No Anthropic credentials found: ' + e.message); }

// The SDK can construct a client even when its credential chain is empty.
function claudeConfigured() {
  return Boolean(client && (client.apiKey || client.authToken || client.credentials));
}

// The design format has more optional fields than structured outputs allow (24), so Claude
// answers in plain JSON described by the prompt, and designer.mjs validates and repairs it.
function parseJson(text) {
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw Error('no JSON object');
  return JSON.parse(text.slice(start, end + 1));
}
function reserve(path) {
  if (!budget.admit(path)) throw Object.assign(Error('Daily provider allowance reached. It resets at midnight UTC.'),{status:429});
}
async function ask(system, user) {
  reserve('/iris-edit');
  const message=await client.messages.create({
    model:EDIT_MODEL,max_tokens:outputCaps.irisEdit,output_config:{effort:'low'},
    system,messages:[{role:'user',content:user}]
  },{timeout:30000,maxRetries:0});
  if(message.stop_reason==='refusal')throw Object.assign(Error('Claude declined this edit.'),{status:422});
  if(message.stop_reason==='max_tokens')throw Object.assign(Error('That edit is too large. Try a smaller change.'),{status:422});
  return parseJson(message.content.filter(b=>b.type==='text').map(b=>b.text).join(''));
}

async function collect(req, limit) { const chunks = []; let total = 0; for await (const c of req) { total += c.length; if (total > limit) throw Object.assign(Error('Request is too large.'), {status: 413}); chunks.push(c); } return Buffer.concat(chunks); }
function json(res, status, value) { res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(value)); }
function failure(e) {
  if (e instanceof Anthropic.AuthenticationError) return [401, 'Claude rejected the credentials. Check ANTHROPIC_API_KEY.'];
  if (e instanceof Anthropic.RateLimitError) return [429, 'Claude is rate limited right now. Try again in a moment.'];
  if (e instanceof Anthropic.BadRequestError) return [400, 'Claude could not accept that request: ' + e.message];
  if (e instanceof Anthropic.APIConnectionError) return [502, 'Could not reach Claude. Check your connection.'];
  if (e instanceof Anthropic.APIError) return [502, 'Claude service error' + (e.status ? ' ' + e.status : '') + '. Try again.'];
  return [e.status || 500, e.message || 'Something went wrong.'];
}

async function voice(req, res) {
  if (!voiceKey) return json(res, 503, {error: 'Set ELEVENLABS_API_KEY and restart the server.'});
  const bytes = await collect(req, 6_000_000), mime = (req.headers['content-type'] || 'audio/webm').split(';')[0];
  const form = new FormData(); form.append('model_id', 'scribe_v2'); form.append('file', new Blob([bytes], {type: mime}), 'note.' + (mime.split('/')[1] || 'webm'));
  const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {method: 'POST', headers: {'xi-api-key': voiceKey}, body: form, signal: AbortSignal.timeout(28000)});
  if (!r.ok) return json(res, 502, {error: 'ElevenLabs returned ' + r.status + '. Check audio, key and quota.'});
  const result = await r.json(); json(res, 200, {text: String(result.text || '').slice(0, 400)});
}


// ---------- Talk to Iris: ElevenLabs agent sessions, plugin bridge, critique, references ----------
async function voiceSession(res, transport) {
  if (!transport || transport === 'webrtc') {
    if (!voiceKey || !agentId) return json(res,503,{error:'Configure the Iris ElevenLabs key and agent ID.'});
    try {
      const client = new ElevenLabsClient({apiKey:voiceKey});
      const {token} = await client.conversationalAi.conversations.getWebrtcToken({agentId});
      return json(res,200,{conversationToken:token});
    } catch { return json(res,502,{error:'ElevenLabs could not issue a WebRTC token for this agent.'}); }
  }
  if (transport !== 'websocket') return json(res,400,{error:'Unsupported voice transport.'});
  try { json(res, 200, await irisVoice.createSession()); }
  catch (error) { json(res, error.status || 502, {error: error.message}); }
}
// The Figma plugin holds an event stream open here; a voice session in the browser sends tool calls through it.
const studios = new Set(), pending = new Map(); let commandNo = 0;
function openBridge(req, res) {
  res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive'});
  res.write('retry: 2000\n\n'); studios.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => { clearInterval(ping); studios.delete(res); });
}
async function relay(req, res) {
  const {tool, args} = JSON.parse((await collect(req, 20000)).toString());
  const studio = [...studios].pop();
  if (!studio) return json(res, 409, {error: 'No Figma plugin is connected.'});
  const id = ++commandNo;
  const result = await new Promise(resolve => {
    const timer = setTimeout(() => { pending.delete(id); resolve({error: 'Figma did not answer in time.'}); }, 280000);
    pending.set(id, {resolve, timer});
    studio.write('data: ' + JSON.stringify({id, tool: String(tool), args: args || {}}) + '\n\n');
  });
  json(res, 200, {result});
}
async function relayResult(req, res) {
  const {id, result} = JSON.parse((await collect(req, 400000)).toString());
  const p = pending.get(id); if (p) { clearTimeout(p.timer); pending.delete(id); p.resolve(result); }
  json(res, 200, {ok: !!p});
}
async function critique(req, res) {
  const d = JSON.parse((await collect(req, 6_000_000)).toString());
  const question = String(d.question || 'general critique').slice(0, 300);
  if (!claudeConfigured()) return json(res, 200, {critique: '', note: 'No Anthropic credentials, so there is no visual critique.'});
  const content = [];
  if (typeof d.png === 'string' && d.png.startsWith('iVBOR') && /^[A-Za-z0-9+/=]+$/.test(d.png)) content.push({type: 'image', source: {type: 'base64', media_type: 'image/png', data: d.png}});
  const style = await profileStyle(vaultDir, d.profile, 0);
  content.push({type: 'text', text: (style ? 'Judge it against this house style.\n' + style.text + '\n\n' : '') + 'Question: ' + question + '\nFrame: ' + JSON.stringify(d.frame || {}) + '\nVisible copy: ' + JSON.stringify((d.texts || []).slice(0, 40))});
  reserve('/critique');
  const message = await client.messages.create({
    model: MODEL, max_tokens: outputCaps.irisCritique, thinking: {type: 'adaptive'}, output_config: {effort: 'low'},
    system: 'You are Iris, a senior product designer looking over a colleague\'s shoulder at their Figma frame. Answer their question, or give a general critique. Reply in at most four short plain sentences meant to be spoken aloud: one thing that works, then the two highest-impact, specific improvements (hierarchy, spacing, alignment, contrast, type, copy). Name elements by what they are, never by hex code or layer id. No markdown.',
    messages: [{role: 'user', content}]
  });
  json(res, 200, {critique: message.content.filter(b => b.type === 'text').map(b => b.text).join('').trim().slice(0, 900)});
}
let vaultCache = null;
async function vaultNotes() {
  if (vaultCache) return vaultCache; const notes = [];
  async function walk(dir, depth) {
    if (depth > 6 || notes.length >= 3000) return;
    for (const e of await readdir(dir, {withFileTypes: true})) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'assets') continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) await walk(full, depth + 1);
      else if (e.name.endsWith('.md')) notes.push({title: basename(e.name, '.md'), body: (await readFile(full, 'utf8')).slice(0, 20000)});
    }
  }
  await walk(vaultDir, 0); vaultCache = notes; setTimeout(() => { vaultCache = null; }, 60000); return notes;
}
async function references(url, res) {
  if (!vaultDir) return json(res, 200, {results: [], note: 'No reference vault is connected (add a vault folder or set IRIS_VAULT).'});
  const terms = (url.searchParams.get('q') || '').toLowerCase().slice(0, 120).split(/[^a-z0-9]+/).filter(w => w.length > 2);
  const scored = (await vaultNotes()).map(n => { const t = n.title.toLowerCase(), b = n.body.toLowerCase();
    return {n, score: terms.reduce((s, w) => s + (t.includes(w) ? 5 : 0) + Math.min(5, b.split(w).length - 1), 0)}; })
    .filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  json(res, 200, {results: scored.map(({n}) => ({title: n.title, excerpt: n.body.replace(/^---[\s\S]*?---/, '').replace(/!\[\[[^\]]*\]\]|!\[[^\]]*\]\([^)]*\)/g, '').replace(/[#*>`\[\]|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 420)}))});
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  try {
    if (!['localhost:'+port, '127.0.0.1:'+port].includes(req.headers.host)) return json(res, 403, {error: 'Local host required.'});
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (await serveStudio(req,res)) return;
    if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) { res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'}); return res.end(await readFile(new URL('./ui.html', import.meta.url))); }
    const url = new URL(req.url, origin);
    if (req.method === 'GET' && url.pathname === '/voice.js') { res.writeHead(200, {'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store'}); return res.end(await readFile(new URL('./voice.bundle.js', import.meta.url))); }
    if (req.method === 'GET' && url.pathname === '/bridge') { if (url.searchParams.get('key') !== secret) return json(res, 401, {error: 'Invalid session key.'}); return openBridge(req, res); }
    if (req.headers.authorization !== 'Bearer ' + secret) return json(res, 401, {error: 'Invalid session key.'});
    if (req.method === 'GET' && req.url === '/status') return json(res, 200, {design: claudeConfigured(), vaultWebsites: true, voice: !!voiceKey, model: EDIT_MODEL, agent: irisVoice.status().configured, studio: studios.size > 0});
    if (req.method === 'GET' && url.pathname === '/voice/session') { reserve('/eleven-agent/session'); return await voiceSession(res,url.searchParams.get('transport')); }
    if (req.method === 'POST' && url.pathname === '/bridge/command') return await relay(req, res);
    if (req.method === 'POST' && url.pathname === '/bridge/result') return await relayResult(req, res);
    if (req.method === 'POST' && url.pathname === '/critique') return await critique(req, res);
    if (req.method === 'GET' && url.pathname === '/references') return await references(url, res);
    if (req.method === 'GET' && url.pathname === '/vault-capture') {
      const bytes=await capture(vaultDir,url.searchParams.get('id'));
      return json(res,200,{png:bytes.toString('base64')});
    }
    if (req.method === 'GET' && url.pathname === '/profiles') return json(res, 200, {profiles: (await loadProfiles(vaultDir)).map(({id, name, tagline}) => ({id, name, tagline}))});
    if (req.method === 'POST' && ['/brief-plan','/board','/edit'].includes(url.pathname)) {
      const body = JSON.parse((await collect(req,url.pathname==='/edit' ? 4_000_000 : 12000)).toString());
      if(typeof body.note!=='string' || !body.note.trim() || body.note.length>1500) return json(res,400,{error:'Enter a brief of up to 1500 characters.'});
      const note=body.note.trim();
      const profile=await profileStyle(vaultDir,body.profile,0);
      if (url.pathname==='/edit') {
        if (!body.doc || !Array.isArray(body.doc.nodes)) return json(res,400,{error:'Select an existing board to revise.'});
        const local=editBrief(body.doc,note);
        if(local) return json(res,200,local);
        if(!claudeConfigured()) return json(res,422,{error:'Try “Change headline to …”, “Set accent to #225577”, or “Replace "old text" with "new text"”. Free-form layer editing requires Claude.'});
        const out=body.doc.reference ? await websiteEdit(body.doc,note,ask,profile?.name) : await edit(body.doc,note,ask,profile);
        return json(res,200,out);
      }
      const proposal=planBrief(note,profile);
      if (url.pathname==='/brief-plan') return json(res,200,proposal);
      const direction=body.direction ?? proposal.recommended;
      if (!proposal.directions.some(d=>d.id===direction)) return json(res,400,{error:'Select a direction offered for this brief.'});
      const controller=new AbortController();
      res.once('close',()=>{if(!res.writableFinished) controller.abort()});
      const result=await sponsors.withTrace({runId:randomBytes(12).toString('hex'),taskId:'compose-board'},async()=>{
        let content, reason;
        const {configured,runtimeReady}=contentPlanner.status();
        if(configured && runtimeReady) {
          try {
            reserve('/brief-content');
            content=await contentPlanner.draftContent({brief:note,direction,signal:controller.signal});
          } catch(error) {
            if(controller.signal.aborted) throw error;
            reason=error.code || (error.status===429 ? 'daily_provider_limit' : 'provider_unavailable');
          }
        }
        const out=await composeBrief({note,profile,direction,content});
        const execution=content ? 'expected-parrot' : 'local';
        return {...out,execution,direction,references:proposal.references.filter(r=>r.direction===direction),
          summary:out.summary+(content ? ' Copy planned with Expected Parrot.' : ' Local composition.'),
          ...(reason && {fallbackReason:reason})};
      });
      return json(res,200,result);
    }
    if (req.method === 'POST' && req.url === '/voice') { reserve('/voice'); return await voice(req, res); }
    return await studioRoute(req,res);
  } catch (e) {
    if (res.headersSent) return res.end();
    const [status, message] = failure(e);
    if (status >= 500) console.error(e);
    json(res, status, {error: message});
  }
});
server.on('error', e => { console.error('Could not start local service: ' + e.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log([
  'Iris is running.', 'Designer: ' + (claudeConfigured() ? MODEL : 'not configured (set ANTHROPIC_API_KEY)'), '',
  'Studio: '+origin+'/studio/#key='+secret,
  'Browser:  ' + origin + '/#key=' + secret,
  'Figma:    open the Iris plugin, click the gear (⚙) and paste this session key once:', '          ' + secret, '',
  'Leave this running while you design. Press Ctrl-C to stop.'].join('\n')));

let stopping = false;
async function stopServer() {
  if (stopping) return;
  stopping = true;
  // Close long-lived Figma event streams before draining the telemetry batch.
  const deadline = setTimeout(() => server.closeAllConnections(), 2500);
  deadline.unref();
  try {
    await new Promise(resolve => server.close(resolve));
    await sponsors.close();
  } catch {
    console.warn('Trace export did not finish before shutdown.');
  } finally {
    clearTimeout(deadline);
    budget.close();
  }
}
process.once('SIGTERM', stopServer);
process.once('SIGINT', stopServer);
