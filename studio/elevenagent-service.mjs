/** Private ElevenAgents session issuance. Keep this module on the server. */
export class ElevenAgentError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ElevenAgentError';
    this.status = status;
    this.code = code;
  }
}

const fail = (status, code, message) => new ElevenAgentError(status, code, message);
function safeError(error, signal) {
  if (error instanceof ElevenAgentError) return error;
  if (signal.aborted) return signal.reason?.name === 'TimeoutError'
    ? fail(504, 'eleven_agent_timeout', 'ElevenLabs did not issue a conversation session in time. Try again.')
    : fail(499, 'eleven_agent_cancelled', 'Conversation connection cancelled.');
  return fail(502, 'eleven_agent_unavailable', 'Could not reach ElevenLabs. Try again.');
}

/**
 * Authenticate the local route BEFORE calling createSession().
 * A signed URL is a temporary conversation credential; never cache or log it.
 */
export function createElevenAgentService({ apiKey = '', agentId = '', fetchImpl = globalThis.fetch, timeoutMs = 20_000 } = {}) {
  if (typeof fetchImpl !== 'function' || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError('Invalid ElevenAgents service configuration.');
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  const id = typeof agentId === 'string' ? agentId.trim() : '';
  const keyConfigured = !!key && !/\s/.test(key);
  const agentConfigured = /^[A-Za-z0-9_-]{1,128}$/.test(id);
  return {
    status: () => ({ configured: keyConfigured && agentConfigured, provider: 'elevenlabs', transport: 'websocket' }),
    async createSession({ signal: externalSignal } = {}) {
      if (!keyConfigured) throw fail(503, 'eleven_agent_not_configured', 'Set ELEVENLABS_API_KEY on the server to start a live agent conversation.');
      if (!agentConfigured) throw fail(503, 'eleven_agent_missing', 'Set ELEVENLABS_AGENT_ID on the server to start a live agent conversation.');
      const signal = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(externalSignal ? [externalSignal] : [])]);
      if (signal.aborted) throw safeError(null, signal);
      try {
        const url = new URL('https://api.elevenlabs.io/v1/convai/conversation/get-signed-url');
        url.searchParams.set('agent_id', id);
        url.searchParams.set('include_conversation_id', 'true');
        const response = await fetchImpl(url.href, {
          method: 'GET', headers: { 'xi-api-key': key }, signal,
        });
        if (!response.ok) {
          response.body?.cancel().catch(() => {});
          if ([401, 403].includes(response.status)) throw fail(502, 'eleven_agent_auth', 'ElevenLabs rejected conversation access. Check the server key, Agents permission and ownership of the configured agent.');
          if (response.status === 404) throw fail(503, 'eleven_agent_missing', 'The configured ElevenLabs agent could not be found. Check ELEVENLABS_AGENT_ID.');
          if (response.status === 429) throw fail(429, 'eleven_agent_quota', 'ElevenLabs conversation quota or rate limit reached. Try again later.');
          throw fail(502, 'eleven_agent_rejected', 'ElevenLabs could not start a conversation. Check the agent configuration.');
        }
        let result;
        try { result = await response.json(); }
        catch (error) {
          if (signal.aborted) throw error;
          throw fail(502, 'eleven_agent_invalid_session', 'ElevenLabs returned an unreadable conversation session. Try again.');
        }
        if (typeof result?.signed_url !== 'string' || result.signed_url.length > 8192) throw fail(502, 'eleven_agent_invalid_session', 'ElevenLabs returned an incomplete conversation session. Try again.');
        let signed;
        try { signed = new URL(result.signed_url); } catch { throw fail(502, 'eleven_agent_invalid_session', 'ElevenLabs returned an invalid conversation session. Try again.'); }
        if (signed.protocol !== 'wss:' || signed.hostname !== 'api.elevenlabs.io' || signed.pathname !== '/v1/convai/conversation' || signed.username || signed.password || signed.port) {
          throw fail(502, 'eleven_agent_invalid_session', 'ElevenLabs returned an invalid conversation session. Try again.');
        }
        return { signedUrl: result.signed_url, connectionType: 'websocket' };
      } catch (error) { throw safeError(error, signal); }
    },
  };
}
