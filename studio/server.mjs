import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { VoiceServiceError } from '../voice-service.mjs';

const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', png: 'image/png', md: 'text/plain', webp: 'image/webp', jpg: 'image/jpeg' };

export async function serveStudio(req, res) {
  if (req.method !== 'GET') return false;
  const path = req.url.split('?')[0];
  if (path === '/studio') {
    res.writeHead(302, { Location: '/studio/' }).end();
    return true;
  }
  if (!path.startsWith('/studio/')) return false;
  const name = path.slice(8) || 'index.html';
  if (!/^(?:index\.html|poster\.html|assets\/[\w.-]+)$/.test(name)) {
    res.writeHead(404).end();
    return true;
  }
  try {
    const body = await readFile(new URL('../dist/' + name, import.meta.url));
    res.writeHead(200, { 'Content-Type': types[name.split('.').pop()] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Build the studio with npm run build:studio.');
  }
  return true;
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new VoiceServiceError(413, 'upload_too_large', 'Choose a smaller audio file.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function handleVoice(req, res, service) {
  const stop = new AbortController();
  res.on('close', () => { if (!res.writableFinished) stop.abort(); });
  if (req.url === '/studio-voice') {
    const bytes = await readBody(req, 6_000_000);
    const result = await service.transcribe({ bytes, mimeType: req.headers['content-type'], signal: stop.signal });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(result));
    return;
  }
  const { text } = JSON.parse((await readBody(req, 24_000)).toString());
  const audio = await service.synthesize({ text, signal: stop.signal });
  res.writeHead(200, Object.fromEntries(audio.headers));
  await pipeline(Readable.fromWeb(audio.body), res, { signal: stop.signal });
}
