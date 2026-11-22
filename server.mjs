// Local service for Iris: Claude designs and edits, ElevenLabs transcribes spoken briefs.
import Anthropic from '@anthropic-ai/sdk';
import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {readFileSync, writeFileSync} from 'node:fs';
import {design, edit} from './designer.mjs';

// The session key survives restarts (kept in .iris-session, never committed), so you paste it
// into the browser or the Figma plugin once and it keeps working.
const keyFile = new URL('./.iris-session', import.meta.url);
let secret = '';
try { secret = readFileSync(keyFile, 'utf8').trim(); } catch { /* first run */ }
if (!/^[0-9a-f]{48}$/.test(secret)) { secret = randomBytes(24).toString('hex'); writeFileSync(keyFile, secret + '\n', {mode: 0o600}); }
const origin = 'http://localhost:4739';
const voiceKey = process.env.ELEVENLABS_API_KEY;
const MODEL = 'claude-opus-5-5';

// Credentials come from ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN or an `ant auth login` profile.
let client = null;
try { client = new Anthropic(); } catch (e) { console.warn('No Anthropic credentials found: ' + e.message); }

// The design format has more optional fields than structured outputs allow (24), so Claude
// answers in plain JSON described by the prompt, and designer.mjs validates and repairs it.
function parseJson(text) {
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw Error('no JSON object');
  return JSON.parse(text.slice(start, end + 1));
}
async function ask(system, user) {
  for (let attempt = 0; ; attempt++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      // Opus 5.5 always thinks; effort sets how hard. On a policy decline, retry on the recommended model.
      thinking: {type: 'adaptive'},
      output_config: {effort: 'medium'},
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{type: 'text', text: system, cache_control: {type: 'ephemeral'}}],
      messages: [{role: 'user', content: user}]
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') throw Object.assign(Error('Claude declined this request. Try describing it differently.'), {status: 422});
    if (message.stop_reason === 'max_tokens') throw Object.assign(Error('The design was too large to finish. Ask for fewer screens.'), {status: 422});
    const text = message.content.filter(b => b.type === 'text').map(b => b.text).join('');
    try { return parseJson(text); }
    catch (e) { if (attempt >= 1) throw Object.assign(Error('Claude returned an incomplete design. Try again.'), {status: 502}); }
  }
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

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  try {
    if (!['localhost:4739', '127.0.0.1:4739'].includes(req.headers.host)) return json(res, 403, {error: 'Local host required.'});
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) { res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'}); return res.end(await readFile(new URL('./ui.html', import.meta.url))); }
    if (req.headers.authorization !== 'Bearer ' + secret) return json(res, 401, {error: 'Invalid session key.'});
    if (req.method === 'GET' && req.url === '/status') return json(res, 200, {design: !!client, voice: !!voiceKey, model: MODEL});
    if (req.method === 'POST' && (req.url === '/board' || req.url === '/edit')) {
      if (!client) return json(res, 503, {error: 'Set ANTHROPIC_API_KEY (or run ant auth login) and restart the server.'});
      const body = JSON.parse((await collect(req, 4_000_000)).toString());
      const started = Date.now();
      const out = req.url === '/board' ? await design(body.note, ask) : await edit(body.doc, body.note, ask);
      console.log((req.url === '/board' ? 'Designed ' : 'Edited ') + 'in ' + ((Date.now() - started) / 1000).toFixed(1) + 's: ' + (out.summary || ''));
      return json(res, 200, out);
    }
    if (req.method === 'POST' && req.url === '/voice') return await voice(req, res);
    json(res, 404, {error: 'Unknown endpoint.'});
  } catch (e) {
    const [status, message] = failure(e);
    if (status >= 500) console.error(e);
    json(res, status, {error: message});
  }
});
server.on('error', e => { console.error('Could not start local service: ' + e.message); process.exitCode = 1; });
server.listen(4739, '127.0.0.1', () => console.log([
  'Iris is running.', 'Designer: ' + (client ? MODEL : 'not configured (set ANTHROPIC_API_KEY)'), '',
  'Browser:  ' + origin + '/#key=' + secret,
  'Figma:    open the Iris plugin, click the gear (⚙) and paste this session key once:', '          ' + secret, '',
  'Leave this running while you design. Press Ctrl-C to stop.'].join('\n')));
