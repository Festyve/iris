import test from 'node:test';
import assert from 'node:assert/strict';
import { createSponsorHub } from '../providers/sponsors/index.mjs';

const mcpResult = data => ({ structuredContent: data });
const rowEnv = { ROWBOAT_MCP_URL: 'https://team.rowboatlabs.com/mcp', ROWBOAT_MCP_TOKEN: 'rowboat-test-value', ROWBOAT_SPACE_ID: 'space-1' };

test('unconfigured hub performs no network calls or SDK loading and reports exact missing fields', async () => {
  let callbacks = 0;
  const forbidden = () => { throw Error('Unexpected provider call'); };
  const hub = createSponsorHub({ env: {}, fetchImpl: forbidden, mcpFactory: forbidden, alterFactory: forbidden, tracerootLoader: forbidden });
  assert.equal(hub.status().length, 5);
  assert.ok(hub.status().every(item => item.state === 'unavailable' && !item.configured));
  assert.equal((await hub.companyContext({ query: 'Stripe' })).state, 'unavailable');
  assert.equal((await hub.audienceSearch({ query: 'product designers' })).state, 'unavailable');
  assert.equal((await hub.readMemory({ projectId: 'project-1' })).state, 'unavailable');
  assert.equal((await hub.scopedAction({ actionId: 'github-profile' })).state, 'unavailable');
  assert.equal(await hub.withTrace({ runId: 'run-1', taskId: 'build' }, () => ++callbacks), 1);
  assert.equal(callbacks, 1);
});

test('Fiber performs the documented bounded company search over MCP and redacts credentials', async () => {
  const calls = []; let closed = 0;
  const hub = createSponsorHub({ env: { FIBER_API_KEY: 'test-fiber-key' }, mcpFactory: async config => {
    assert.equal(config.url, 'https://mcp.fiber.ai/mcp/v2');
    assert.equal(config.headers['x-api-key'], 'test-fiber-key');
    return { callTool: async request => { calls.push(request); return mcpResult({ output: { data: [{ preferred_name: 'Stripe', domains: ['stripe.com'], li_description:'Payments', emails:['private@example.com'] }] }, apiKey: 'test-fiber-key', note: 'echo test-fiber-key' }); }, close: async () => { closed++; } };
  } });
  const result = await hub.companyContext({ domain: 'stripe.com', limit: 200 });
  assert.equal(result.state, 'verified');
  assert.deepEqual(calls[0], { name: 'companySearch_tool', arguments: { searchParams: { domains: ['stripe.com'] }, pageSize: 10, includeCount: false } });
  assert.equal(result.data.companies[0].name, 'Stripe');
  assert.equal(result.data.companies[0].description, 'Payments');
  assert.ok(!JSON.stringify(result).includes('private@example.com'));
  await hub.companyContext({query:'Stripe',limit:1});
  assert.deepEqual(calls[1].arguments.searchParams, {nameLike:{anyOf:['Stripe']}});
  assert.equal(closed, 2);
  assert.ok(!JSON.stringify(result).includes('test-fiber-key'));
  assert.equal(hub.status().find(p => p.id === 'fiber').state, 'verified');
});

test('Ploid requests professional fields only and never treats provider authorization failure as verified', async () => {
  let request;
  const hub = createSponsorHub({ env: { PLOID_API_KEY: 'test-ploid-key' }, fetchImpl: async (url, init) => {
    request = { url, init };
    return Response.json({ results: [{ name: 'Alex', title: 'Designer', company: 'Acme', linkedin: 'https://linkedin.com/in/example', email: 'private@example.com', phone: '555' }] });
  } });
  const result = await hub.audienceSearch({ query: 'product designers in Toronto', limit: 2 });
  assert.equal(request.url, 'https://api.ploid.com/v1/search');
  assert.equal(request.init.headers.Authorization, 'Bearer test-ploid-key');
  assert.deepEqual(JSON.parse(request.init.body).contents.fields, ['linkedin', 'title', 'company', 'location']);
  assert.equal(result.state, 'verified');
  assert.equal(result.data.contacted, false);
  assert.ok(!JSON.stringify(result).includes('private@example.com'));
  const bad = createSponsorHub({ env: { PLOID_API_KEY: 'test-ploid-key' }, fetchImpl: async () => new Response('test-ploid-key', { status: 403 }) });
  const failure = await bad.audienceSearch({ query: 'designers' });
  assert.equal(failure.state, 'error');
  assert.equal(failure.status, 403);
  assert.ok(!JSON.stringify(failure).includes('test-ploid-key'));
  assert.equal(bad.status().find(p => p.id === 'ploid').verifiedAt, null);
});

test('Rowboat creates project-scoped decision memory without sending a message to people', async () => {
  const calls = [];
  const hub = createSponsorHub({ env: rowEnv, mcpFactory: async () => ({ close: async () => {}, callTool: async request => {
    calls.push(request);
    if (request.name === 'list_spaces') return mcpResult({ spaces: [{ id: 'space-1', assets: [] }] });
    assert.equal(request.name, 'create_asset');
    return mcpResult({ asset: { id: 'asset-1', version: 1 } });
  } }) });
  const result = await hub.saveDecision({ projectId: 'demo', title: 'Editorial hierarchy', decision: 'Use a strong title and a quiet action row.', referenceIds: ['ref-1'], revision: 1 });
  assert.equal(result.state, 'verified');
  assert.equal(result.data.saved, true);
  assert.equal(calls[1].arguments.path, 'second-cursor/demo/decisions.md');
  assert.ok(calls[1].arguments.newContent.includes('ref-1'));
  assert.ok(calls.every(call => call.name !== 'post_message'));
});

test('Rowboat reads current version before proposing changes and never retries a conflict', async () => {
  const calls = [];
  const hub = createSponsorHub({ env: rowEnv, mcpFactory: async () => ({ close: async () => {}, callTool: async request => {
    calls.push(request);
    if (request.name === 'list_spaces') return mcpResult({ spaces: [{ id: 'space-1', assets: [{ id: 'asset-1', path: 'second-cursor/demo/decisions.md' }] }] });
    if (request.name === 'read_asset') return mcpResult({ content: '# Existing\n', version: 2 });
    return mcpResult({ outcome: 'conflict', currentVersion: 3 });
  } }) });
  const result = await hub.saveDecision({ projectId: 'demo', title: 'Revision', decision: 'Keep the same primary action.', revision: 2 });
  assert.equal(result.state, 'error');
  assert.equal(result.status, 409);
  assert.deepEqual(calls.map(call => call.name), ['list_spaces', 'read_asset', 'propose_change']);
  assert.equal(calls[2].arguments.baseVersion, 2);
});

test('Alter restricts caller input to a registered read and preserves actual approval state', async () => {
  let proxyRequest, closed = 0;
  const hub = createSponsorHub({ env: { ALTER_API_KEY: 'test-alter-key', ALTER_GRANT_ID: 'grant-1' }, alterFactory: async () => ({
    proxyRequest: async request => { proxyRequest = request; return { status: 'pending', approvalId: 'approval-1', gates: [{ approvalUrl: 'https://portal.alterauth.com/approval-1' }] }; },
    close: async () => { closed++; }
  }) });
  const result = await hub.scopedAction({ actionId: 'github-profile', context: { projectId: 'demo', authorization: 'ignored' } });
  assert.equal(proxyRequest.url, 'https://api.github.com/user');
  assert.equal(proxyRequest.grantId, 'grant-1');
  assert.deepEqual(proxyRequest.context, { projectId: 'demo' });
  assert.equal(result.state, 'pending');
  assert.equal(result.data.executed, false);
  assert.equal(result.evidence.verifiedAt, null);
  assert.equal(closed, 1);
  assert.throws(() => hub.scopedAction({ actionId: 'arbitrary-shell' }), /not registered/);
});

test('TraceRoot preserves a task result and executes it once even when flush fails', async () => {
  let count = 0, observed;
  const hub = createSponsorHub({ env: { TRACEROOT_API_KEY: 'test-trace-key' }, tracerootLoader: async () => ({
    TraceRoot: { initialize: config => { assert.equal(config.apiKey, 'test-trace-key'); }, flush: async () => { throw Error('transport failed'); }, shutdown: async () => {} },
    observe: async (options, fn) => { observed = options; return fn(); }
  }) });
  const result = await hub.withTrace({ runId: 'run-1', taskId: 'build' }, async () => { count++; return { artifact: 'index.html' }; });
  assert.equal(count, 1);
  assert.equal(result.artifact, 'index.html');
  assert.equal(observed.captureInput, false);
  assert.equal(observed.captureOutput, false);
  assert.equal(hub.status().find(p => p.id === 'traceroot').state, 'error');
});

test('TraceRoot exports safe failure text and preserves the original application error', async () => {
  const original = new Error('private application detail'); let recorded;
  const hub = createSponsorHub({ env: { TRACEROOT_API_KEY: 'test-trace-key' }, tracerootLoader: async () => ({
    TraceRoot: { initialize() {}, flush: async () => {} },
    observe: async (_, fn) => { try { return await fn(); } catch (error) { recorded = error.message; throw error; } }
  }) });
  await assert.rejects(hub.withTrace({ runId: 'run', taskId: 'task' }, async () => { throw original; }), error => error === original);
  assert.equal(recorded, 'Second Cursor task failed.');
});

test('cancelled MCP operations close without sending a request', async () => {
  let connected = false;
  const controller = new AbortController(); controller.abort();
  const hub = createSponsorHub({ env: { FIBER_API_KEY: 'test-fiber-key' }, mcpFactory: async () => { connected = true; } });
  const result = await hub.companyContext({ query: 'Stripe', signal: controller.signal });
  assert.equal(result.state, 'error');
  assert.equal(result.code, 'cancelled');
  assert.equal(connected, false);
});
