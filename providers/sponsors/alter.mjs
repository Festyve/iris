import { createOperation, publicUrl, SponsorError, text } from './common.mjs';

const defaults = Object.freeze({
  'github-profile': { method: 'GET', url: 'https://api.github.com/user', reason: 'Verify delegated repository-account identity before delivering a design build.' }
});

export async function defaultAlterFactory({ apiKey, timeoutMs }) {
  const { Agent } = await import('@alter-ai/alter-sdk');
  return new Agent({ apiKey, timeout: timeoutMs, caller: 'second-cursor', logger: { warn() {}, error() {}, info() {}, debug() {} } });
}

export function createAlter({ env, alterFactory = defaultAlterFactory, alterActions = defaults, timeoutMs }) {
  const op = createOperation('alter', ['ALTER_API_KEY', 'ALTER_GRANT_ID'], env);
  return {
    status: () => ({ ...op.status(), actions: Object.keys(alterActions) }),
    scopedAction({ actionId, context = {}, signal } = {}) {
      const id = text(actionId, 'actionId', 100);
      const action = Object.hasOwn(alterActions, id) ? alterActions[id] : null;
      if (!action) throw new SponsorError('This external action is not registered by the server.', { code: 'action_not_allowed', status: 403 });
      const url = publicUrl(action.url, 'Alter action URL');
      if (!['GET', 'HEAD'].includes(action.method)) throw new SponsorError('This hub permits only registered read operations.', { code: 'action_not_allowed', status: 403 });
      const cleanContext = {};
      for (const key of ['projectId', 'runId', 'taskId']) if (context[key] != null) cleanContext[key] = text(context[key], key, 120);
      return op.run('proxyRequest', async () => {
        signal?.throwIfAborted();
        const client = await alterFactory({ apiKey: env.ALTER_API_KEY, timeoutMs });
        try {
          const result = await client.proxyRequest({ method: action.method, url: url.href,
            grantId: env.ALTER_GRANT_ID, reason: action.reason, context: cleanContext });
          if (result.status === 'pending') return { pending: true, actionId: id, approvalId: result.approvalId,
            approvalUrl: result.approvalUrl ?? result.gates?.[0]?.approvalUrl, executed: false };
          if (!Number.isInteger(result.statusCode)) throw new SponsorError('Alter returned an invalid proxy receipt.');
          if (result.statusCode >= 400) throw new SponsorError(`Scoped provider returned HTTP ${result.statusCode}.`, { code: 'provider_rejected', status: result.statusCode });
          let data = result.bodyJson();
          if (id === 'github-profile') data = { login: data.login, name: data.name, url: data.html_url };
          return { actionId: id, statusCode: result.statusCode, data, executed: true,
            scope: 'Managed agent key and configured grant; provider policy enforced by Alter' };
        } finally { await Promise.resolve(client.close?.()).catch(() => {}); }
      });
    }
  };
}
