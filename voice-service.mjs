/** Server-side ElevenLabs adapter. No credentials or raw provider errors leave this module. */
export class VoiceServiceError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'VoiceServiceError';
    this.status = status;
    this.code = code;
  }
}

const audioFormats = new Map([
  ['audio/webm', 'webm'], ['audio/ogg', 'ogg'], ['audio/mp4', 'm4a'],
  ['audio/x-m4a', 'm4a'], ['audio/mpeg', 'mp3'], ['audio/mp3', 'mp3'],
  ['audio/mpga', 'mp3'], ['audio/wav', 'wav'], ['audio/x-wav', 'wav'],
  ['audio/wave', 'wav'], ['audio/aac', 'aac'], ['audio/flac', 'flac'],
  ['audio/x-flac', 'flac'],
]);
const fail = (status, code, message) => new VoiceServiceError(status, code, message);

function safeError(error, signal) {
  if (error instanceof VoiceServiceError) return error;
  if (signal.aborted) {
    return signal.reason?.name === 'TimeoutError'
      ? fail(504, 'voice_timeout', 'ElevenLabs timed out. Try a shorter recording or reply.')
      : fail(499, 'voice_cancelled', 'Voice request cancelled.');
  }
  return fail(502, 'voice_unavailable', 'Could not reach ElevenLabs. Try again.');
}

function requireSuccess(response) {
  if (response.ok) return;
  // Provider bodies can include account details. Never echo them to the caller.
  response.body?.cancel().catch(() => {});
  if (response.status === 401 || response.status === 403) {
    throw fail(502, 'voice_provider_auth', 'ElevenLabs rejected the server credentials. Check the key and its permissions.');
  }
  if (response.status === 429) {
    throw fail(429, 'voice_rate_limited', 'ElevenLabs quota or rate limit reached. Check available credits and try again later.');
  }
  throw fail(502, 'voice_provider_rejected', 'ElevenLabs could not complete this request. Check the selected model, voice and input.');
}

/**
 * createVoiceService({ apiKey, voiceId, fetchImpl?, sttModel?, ttsModel?, timeoutMs? })
 * transcribe({ bytes: Uint8Array|ArrayBuffer, mimeType, signal? }) -> { text, truncated }
 * synthesize({ text, signal? }) -> Response with a streaming audio body.
 * The caller owns its local authentication, request-body collection and HTTP routing.
 */
export function createVoiceService({
  apiKey = '', voiceId = '', fetchImpl = globalThis.fetch,
  sttModel = 'scribe_v2', ttsModel = 'eleven_flash_v2_5', timeoutMs = 28_000,
  maxAudioBytes = 6_000_000, maxTextChars = 1_200, maxTranscriptChars = 700,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function.');
  for (const value of [timeoutMs, maxAudioBytes, maxTextChars, maxTranscriptChars]) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError('Voice limits must be positive integers.');
  }
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  const id = typeof voiceId === 'string' ? voiceId.trim() : '';
  const keyConfigured = !!key && !/\s/.test(key);
  const voiceConfigured = /^[A-Za-z0-9_-]{1,128}$/.test(id);
  const modelConfigured = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);

  function requireKey() {
    if (!keyConfigured) throw fail(503, 'voice_not_configured', 'Set ELEVENLABS_API_KEY on the server to enable voice.');
  }

  function operation(externalSignal) {
    const controller = new AbortController();
    const signals = [controller.signal, AbortSignal.timeout(timeoutMs)];
    if (externalSignal) signals.push(externalSignal);
    const signal = AbortSignal.any(signals);
    if (signal.aborted) throw safeError(null, signal);
    return { signal, controller };
  }

  async function transcribe({ bytes, mimeType, signal: externalSignal } = {}) {
    requireKey();
    if (!modelConfigured(sttModel)) throw fail(503, 'voice_model_not_configured', 'Configure a valid ElevenLabs transcription model on the server.');
    let data;
    if (bytes instanceof ArrayBuffer) data = new Uint8Array(bytes);
    else if (ArrayBuffer.isView(bytes)) data = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (!data?.byteLength) throw fail(400, 'empty_audio', 'Record or select an audio file first.');
    if (data.byteLength > maxAudioBytes) throw fail(413, 'audio_too_large', 'The recording is too large. Try a shorter clip.');
    const mime = typeof mimeType === 'string' ? mimeType.split(';', 1)[0].trim().toLowerCase() : '';
    const extension = audioFormats.get(mime);
    if (!extension) throw fail(415, 'unsupported_audio', 'Use a WebM, Ogg, MP4, MP3, WAV, AAC or FLAC audio recording.');
    const { signal } = operation(externalSignal);
    try {
      const form = new FormData();
      form.append('model_id', sttModel);
      form.append('file', new Blob([data], { type: mime }), `note.${extension}`);
      const response = await fetchImpl('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST', headers: { 'xi-api-key': key }, body: form, signal,
      });
      requireSuccess(response);
      let result;
      try { result = await response.json(); }
      catch (error) {
        if (signal.aborted) throw error;
        throw fail(502, 'invalid_transcript', 'ElevenLabs returned an unreadable transcript. Try again.');
      }
      if (typeof result?.text !== 'string') throw fail(502, 'invalid_transcript', 'ElevenLabs returned an incomplete transcript. Try again.');
      const text = result.text.trim();
      if (!text) throw fail(422, 'no_speech', 'No speech was recognized. Try another recording.');
      return { text: text.slice(0, maxTranscriptChars), truncated: text.length > maxTranscriptChars };
    } catch (error) { throw safeError(error, signal); }
  }

  async function synthesize({ text, signal: externalSignal } = {}) {
    requireKey();
    if (!voiceConfigured) throw fail(503, 'speech_not_configured', 'Set ELEVENLABS_VOICE_ID on the server to enable spoken replies.');
    if (!modelConfigured(ttsModel)) throw fail(503, 'voice_model_not_configured', 'Configure a valid ElevenLabs speech model on the server.');
    if (typeof text !== 'string' || !text.trim()) throw fail(400, 'empty_speech', 'Provide a reply to speak.');
    const content = text.trim();
    if (content.length > maxTextChars) throw fail(400, 'speech_too_long', `Keep spoken replies to ${maxTextChars} characters or fewer.`);
    const { signal, controller } = operation(externalSignal);
    try {
      const response = await fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(id)}/stream?output_format=mp3_44100_128`, {
        method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, model_id: ttsModel }), signal,
      });
      requireSuccess(response);
      const type = response.headers.get('content-type') || 'audio/mpeg';
      if (!response.body || (!/^audio\//i.test(type) && !/^application\/octet-stream(?:;|$)/i.test(type))) {
        await response.body?.cancel().catch(() => {});
        throw fail(502, 'invalid_speech', 'ElevenLabs returned no playable audio. Try again.');
      }
      const reader = response.body.getReader();
      const body = new ReadableStream({
        async pull(stream) {
          try {
            if (signal.aborted) throw safeError(null, signal);
            const result = await reader.read();
            if (result.done) { stream.close(); reader.releaseLock(); }
            else stream.enqueue(result.value);
          } catch (error) {
            stream.error(safeError(error, signal));
            await reader.cancel().catch(() => {});
            reader.releaseLock();
          }
        },
        async cancel() {
          controller.abort();
          await reader.cancel().catch(() => {});
          reader.releaseLock();
        },
      });
      return new Response(body, { headers: {
        'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      } });
    } catch (error) { throw safeError(error, signal); }
  }

  return {
    transcribe, synthesize,
    status: () => ({ transcriptionConfigured: keyConfigured && modelConfigured(sttModel), speechConfigured: keyConfigured && voiceConfigured && modelConfigured(ttsModel) }),
  };
}
