import { createOperation, publicUrl, SponsorError, text } from './common.mjs';

export const IRIS_ACTION_ID = 'github-iris-metadata';
const repo = 'Festyve/iris';
const irisAction = Object.freeze({
  method: 'GET',
  url: 'https://api.github.com/repos/Festyve/iris',
  reason: 'Read repository metadata for the Iris workspace.'
});

function denyScope() {
  throw new SponsorError('Request exceeds the registered Iris metadata scope.', { code: 'action_not_allowed', status: 403 });
}

function irisContext(input, context) {
  if (Object.keys(input).some(key => !['actionId', 'context', 'signal'].includes(key))) denyScope();
  if (!context || context.repo !== repo || (Object.hasOwn(context, 'method') && context.method !== 'GET')) denyScope();
  if (Object.keys(context).some(key => !['repo', 'method', 'projectId', 'runId', 'taskId'].includes(key))) denyScope();
  return { repo, method: 'GET' };
}

function repositoryMetadata(body) {
  if (body?.full_name !== repo || typeof body.private !== 'boolean' ||
      typeof body.default_branch !== 'string' || !body.default_branch.length ||
      body.default_branch.length > 255 || /[\x00-\x1f\x7f]/.test(body.default_branch)) {
    throw new SponsorError('GitHub returned unexpected Iris repository metadata.');
  }
  return { full_name: repo, default_branch: body.default_branch, private: body.private };
}

function pendingResult(id, result) {
  const approvalId = result.approvalId;
  if (typeof approvalId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(approvalId)) {
    throw new SponsorError('Alter returned an invalid approval identifier.');
  }
  const pending = { pending: true, actionId: id, approvalId, executed: false };
  const link = result.approvalUrl ?? result.gates?.[0]?.approvalUrl;
  if (typeof link === 'string' && link.length <= 2048 && URL.canParse(link)) {
    const url = new URL(link);
    if (url.protocol === 'https:' && url.hostname.endsWith('.alterauth.com') &&
        !url.username && !url.password && !url.port) pending.approvalUrl = url.href;
  }
  return pending;
}

const defaults = Object.freeze({
  'github-profile': { method: 'GET', url: 'https://api.github.com/user', reason: 'Verify delegated repository-account identity before delivering a design build.' }
});

export async function defaultAlterFactory({ apiKey, timeoutMs }) {
  const { Agent } = await import('@alter-ai/alter-sdk');
  return new Agent({ apiKey, timeout: timeoutMs, caller: 'second-cursor', logger: { warn() {}, error() {}, info() {}, debug() {} } });
}

export function createAlter({ env, alterFactory = defaultAlterFactory, alterActions = defaults, timeoutMs }) {
  const credentials = { ALTER_API_KEY: env.ALTER_API_KEY?.trim(), ALTER_GRANT_ID: env.ALTER_GRANT_ID?.trim() };
  const op = createOperation('alter', ['ALTER_API_KEY', 'ALTER_GRANT_ID'], credentials);
  const actions = { ...alterActions, [IRIS_ACTION_ID]: irisAction };
  return {
    status: () => ({ ...op.status(), actions: Object.keys(actions) }),
    scopedAction(input = {}) {
      const { actionId, context = {}, signal } = input;
      const id = text(actionId, 'actionId', 100);
      const action = Object.hasOwn(actions, id) ? actions[id] : null;
      if (!action) throw new SponsorError('This external action is not registered by the server.', { code: 'action_not_allowed', status: 403 });
      const url = publicUrl(action.url, 'Alter action URL');
      if (!['GET', 'HEAD'].includes(action.method)) throw new SponsorError('This hub permits only registered read operations.', { code: 'action_not_allowed', status: 403 });
      const cleanContext = id === IRIS_ACTION_ID ? irisContext(input, context) : {};
      for (const key of ['projectId', 'runId', 'taskId']) if (context[key] != null) cleanContext[key] = text(context[key], key, 120);
      return op.run('proxyRequest', async () => {
        signal?.throwIfAborted();
        const client = await alterFactory({ apiKey: credentials.ALTER_API_KEY, timeoutMs });
        try {
          const result = await client.proxyRequest({ method: action.method, url: url.href,
            grantId: credentials.ALTER_GRANT_ID, reason: action.reason, context: cleanContext });
          if (result.status === 'pending') return pendingResult(id, result);
          if (!Number.isInteger(result.statusCode) || result.statusCode < 100 || result.statusCode > 599) {
            throw new SponsorError('Alter returned an invalid proxy receipt.');
          }
          if (result.statusCode >= 400) throw new SponsorError(`Scoped provider returned HTTP ${result.statusCode}.`, { code: 'provider_rejected', status: result.statusCode });
          if (result.providerFault || result.bodyTruncated || result.bodyOmitted ||
              (id === IRIS_ACTION_ID && result.statusCode !== 200)) {
            throw new SponsorError('Alter did not return a complete provider result.');
          }
          let data = result.bodyJson();
          if (id === IRIS_ACTION_ID) data = repositoryMetadata(data);
          if (id === 'github-profile') data = { login: data.login, name: data.name, url: data.html_url };
          return { actionId: id, statusCode: result.statusCode, data, executed: true,
            scope: 'Managed agent key and configured grant; provider policy enforced by Alter' };
        } finally { await Promise.resolve(client.close?.()).catch(() => {}); }
      });
    }
  };
}
