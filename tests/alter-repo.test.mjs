import assert from 'node:assert/strict';
import test from 'node:test';
import { ApprovalResult, PendingApproval } from '@alter-ai/alter-sdk';
import { createSponsorHub } from '../providers/sponsors/index.mjs';

const actionId = 'github-iris-metadata';
const repo = 'Festyve/iris';
const input = { actionId, context: { repo } };
const credentials = { ALTER_API_KEY: 'fixture-key', ALTER_GRANT_ID: 'fixture-grant' };
const metadata = { full_name: repo, default_branch: 'main', private: true };

function response(body, overrides = {}) {
  return new ApprovalResult({
    status_code: 200, headers: {}, body_b64: Buffer.from(JSON.stringify(body)).toString('base64'), ...overrides
  });
}

function fixture(result, options) {
  const requests = [];
  const hub = createSponsorHub({
    env: credentials,
    alterFactory: async () => ({ proxyRequest: async request => { requests.push(request); return result; } }),
    ...options
  });
  return { hub, requests };
}

test('local allow policy sends exactly the fixed GET through the server grant and filters metadata', async () => {
  const { hub, requests } = fixture(response({ ...metadata, permissions: { admin: true }, token: 'private' }), {
    alterActions: { [actionId]: { method: 'POST', url: 'https://example.org' } }
  });
  const context = { repo, projectId: 'studio', runId: 'run', taskId: 'task' };
  const result = await hub.scopedAction({ actionId, context });
  assert.deepEqual(requests, [{
    method: 'GET', url: 'https://api.github.com/repos/Festyve/iris', grantId: credentials.ALTER_GRANT_ID,
    reason: 'Read repository metadata for the Iris workspace.', context: { ...context, method: 'GET' }
  }]);
  assert.equal(result.state, 'verified');
  assert.equal(result.data.executed, true);
  assert.deepEqual(result.data.data, metadata);
});

test('local policy denies wrong repo, method, missing scope, and transport overrides before SDK setup', () => {
  let clients = 0;
  const { hub } = fixture(null, { alterFactory() { clients++; } });
  for (const context of [{}, { repo: 'Festyve/other' }, { repo, method: 'POST' }, { repo, method: 'HEAD' },
    { repo, grantId: 'other' }, { repo, url: 'https://example.org' }]) {
    assert.throws(() => hub.scopedAction({ actionId, context }), { code: 'action_not_allowed', status: 403 });
  }
  for (const override of [{ method: 'PATCH' }, { grantId: 'other' }, { url: 'https://example.org' }]) {
    assert.throws(() => hub.scopedAction({ ...input, ...override }), { code: 'action_not_allowed' });
  }
  assert.equal(clients, 0);
});

test('missing or blank delegated grant returns unavailable before SDK setup', async () => {
  const { hub, requests } = fixture(null, { env: { ...credentials, ALTER_GRANT_ID: '  ' } });
  const result = await hub.scopedAction(input);
  assert.equal(result.state, 'unavailable');
  assert.deepEqual(result.missing, ['ALTER_GRANT_ID']);
  assert.deepEqual(requests, []);
});

test('pending SDK result exposes approval state and only an Alter HTTPS link', async () => {
  for (const link of ['https://wallet.alterauth.com/approve/fixture', 'https://wallet.alterauth.com.example.org/fixture']) {
    const gate = { approval_id: 'fixture-id', approval_url: link, expires_in: 60, expires_at: new Date() };
    const { hub } = fixture(new PendingApproval({ ...gate, approval_group_id: 'fixture-group', status: 'pending', gates: [gate] }));
    const result = await hub.scopedAction(input);
    assert.equal(result.state, 'pending');
    assert.equal(result.data.executed, false);
    assert.equal(result.data.approvalId, 'fixture-id');
    assert.equal(result.data.approvalUrl, link.includes('example.org') ? undefined : link);
    assert.equal(result.evidence.verifiedAt, null);
  }
});

test('rejects incomplete, redirected, denied and out-of-scope provider results', async () => {
  for (const receipt of [
    response({ ...metadata, full_name: 'Festyve/other' }), response({ ...metadata, private: 'false' }),
    response(metadata, { status_code: 301 }), response(metadata, { status_code: 403 }),
    response(metadata, { body_truncated: true }), response(metadata, { provider_fault: true })
  ]) {
    const { hub } = fixture(receipt);
    const result = await hub.scopedAction(input);
    assert.equal(result.state, 'error');
    assert.equal(result.data, undefined);
    assert.equal(hub.status().find(p => p.id === 'alter').verifiedAt, null);
  }
});
