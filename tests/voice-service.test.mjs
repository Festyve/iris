import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceService, VoiceServiceError } from '../voice-service.mjs';

const audio = { bytes: new Uint8Array([1, 2, 3]), mimeType: 'audio/webm;codecs=opus' };
const configured = extra => createVoiceService({ apiKey: 'test-server-key', voiceId: 'testVoice', ...extra });
const errorIs = (status, code) => error => error instanceof VoiceServiceError && error.status === status && error.code === code;

test('transcription sends an actual multipart recording with a server-only API key', async () => {
  let calls = 0;
  const service = configured({ fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.elevenlabs.io/v1/speech-to-text');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['xi-api-key'], 'test-server-key');
    assert.equal(options.headers['Content-Type'], undefined, 'fetch must set the multipart boundary');
    assert.equal(options.body.get('model_id'), 'scribe_v2');
    const file = options.body.get('file');
    assert.equal(file.name, 'note.webm');
    assert.equal(file.type, 'audio/webm');
    assert.deepEqual(new Uint8Array(await file.arrayBuffer()), audio.bytes);
    return Response.json({ text: '  Stack the title.  ' });
  } });
  assert.deepEqual(await service.transcribe(audio), { text: 'Stack the title.', truncated: false });
  assert.equal(calls, 1);
});

test('transcript truncation is explicit so the UI can warn instead of hiding lost text', async () => {
  const service = configured({ maxTranscriptChars: 5, fetchImpl: async () => Response.json({ text: 'A longer brief' }) });
  assert.deepEqual(await service.transcribe(audio), { text: 'A lon', truncated: true });
});

test('speech returns a playable response and only forwards safe response headers', async () => {
  const service = configured({ fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.elevenlabs.io/v1/text-to-speech/testVoice/stream?output_format=mp3_44100_128');
    assert.deepEqual(JSON.parse(options.body), { text: 'The mobile layout is ready.', model_id: 'eleven_flash_v2_5' });
    assert.equal(options.headers['xi-api-key'], 'test-server-key');
    return new Response(new Uint8Array([7, 8, 9]), { headers: { 'Content-Type': 'audio/mpeg', 'X-Private-Provider-Data': 'do-not-forward' } });
  } });
  const response = await service.synthesize({ text: ' The mobile layout is ready. ' });
  assert.equal(response.headers.get('content-type'), 'audio/mpeg');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-private-provider-data'), null);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([7, 8, 9]));
});

test('status distinguishes transcription and speech configuration without exposing credentials', async () => {
  const service = createVoiceService({ apiKey: 'test-server-key' });
  assert.deepEqual(service.status(), { transcriptionConfigured: true, speechConfigured: false });
  assert(!JSON.stringify(service.status()).includes('test-server-key'));
  await assert.rejects(service.synthesize({ text: 'Hello' }), errorIs(503, 'speech_not_configured'));
});

test('missing or malformed keys stop before any provider call', async () => {
  for (const apiKey of ['', 'bad\nkey']) {
    const service = createVoiceService({ apiKey, voiceId: 'testVoice', fetchImpl: () => { throw Error('must not call'); } });
    await assert.rejects(service.transcribe(audio), errorIs(503, 'voice_not_configured'));
    await assert.rejects(service.synthesize({ text: 'Hello' }), errorIs(503, 'voice_not_configured'));
  }
});

test('invalid uploads and oversized speech fail locally', async () => {
  let calls = 0;
  const service = configured({ maxAudioBytes: 3, maxTextChars: 10, fetchImpl: () => { calls++; } });
  await assert.rejects(service.transcribe({ ...audio, bytes: new Uint8Array() }), errorIs(400, 'empty_audio'));
  await assert.rejects(service.transcribe({ ...audio, bytes: new Uint8Array(4) }), errorIs(413, 'audio_too_large'));
  await assert.rejects(service.transcribe({ ...audio, mimeType: 'text/html' }), errorIs(415, 'unsupported_audio'));
  await assert.rejects(service.synthesize({ text: '  ' }), errorIs(400, 'empty_speech'));
  await assert.rejects(service.synthesize({ text: 'A reply that is too long.' }), errorIs(400, 'speech_too_long'));
  assert.equal(calls, 0);
});

test('401, 403, 429 and upstream failures have actionable errors without exposing provider bodies', async () => {
  for (const [providerStatus, status, code] of [[401, 502, 'voice_provider_auth'], [403, 502, 'voice_provider_auth'], [429, 429, 'voice_rate_limited'], [500, 502, 'voice_provider_rejected']]) {
    const service = configured({ fetchImpl: async () => new Response('SECRET account details test-server-key', { status: providerStatus }) });
    for (const run of [() => service.transcribe(audio), () => service.synthesize({ text: 'Hello' })]) {
      await assert.rejects(run(), error => {
        assert(errorIs(status, code)(error));
        assert(!error.message.includes('SECRET'));
        assert(!error.message.includes('test-server-key'));
        return true;
      });
    }
  }
});

test('invalid and empty provider transcripts are distinguished from successful transcription', async () => {
  for (const [response, status, code] of [
    [new Response('not json'), 502, 'invalid_transcript'],
    [Response.json({ wrong: 'shape' }), 502, 'invalid_transcript'],
    [Response.json({ text: ' ' }), 422, 'no_speech'],
  ]) {
    await assert.rejects(configured({ fetchImpl: async () => response }).transcribe(audio), errorIs(status, code));
  }
});

test('an upstream JSON response cannot be mistaken for playable speech', async () => {
  const service = configured({ fetchImpl: async () => Response.json({ error: 'not audio' }) });
  await assert.rejects(service.synthesize({ text: 'Hello' }), errorIs(502, 'invalid_speech'));
});

test('already cancelled requests never reach the provider', async () => {
  const controller = new AbortController(); controller.abort();
  let calls = 0;
  const service = configured({ fetchImpl: async () => { calls++; } });
  await assert.rejects(service.transcribe({ ...audio, signal: controller.signal }), errorIs(499, 'voice_cancelled'));
  await assert.rejects(service.synthesize({ text: 'Hello', signal: controller.signal }), errorIs(499, 'voice_cancelled'));
  assert.equal(calls, 0);
});

test('in-flight cancellation reaches fetch and produces a safe cancellation error', async () => {
  const controller = new AbortController();
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const service = configured({ fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    started();
  }) });
  const pending = service.transcribe({ ...audio, signal: controller.signal });
  await ready; controller.abort('private user-provided reason');
  await assert.rejects(pending, errorIs(499, 'voice_cancelled'));
});

test('provider timeouts produce 504 while network error details remain private', async () => {
  // Keep the test alive while AbortSignal.timeout uses an unref timer.
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const stalled = configured({ timeoutMs: 5, fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }) });
    await assert.rejects(stalled.transcribe(audio), errorIs(504, 'voice_timeout'));
    const failed = configured({ fetchImpl: async () => { throw Error('private test-server-key'); } });
    await assert.rejects(failed.transcribe(audio), error => errorIs(502, 'voice_unavailable')(error) && !error.message.includes('test-server-key'));
  } finally { clearTimeout(keepAlive); }
});

test('cancelling an audio response aborts and releases the upstream stream', async () => {
  let upstreamCancelled = false;
  let providerSignal;
  const service = configured({ fetchImpl: async (_url, { signal }) => {
    providerSignal = signal;
    return new Response(new ReadableStream({
      pull(controller) { controller.enqueue(new Uint8Array([1])); },
      cancel() { upstreamCancelled = true; },
    }), { headers: { 'content-type': 'audio/mpeg' } });
  } });
  const response = await service.synthesize({ text: 'Hello' });
  await response.body.cancel();
  assert.equal(providerSignal.aborted, true);
  assert.equal(upstreamCancelled, true);
});
