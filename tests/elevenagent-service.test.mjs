import test from 'node:test';
import assert from 'node:assert/strict';
import { createElevenAgentService, ElevenAgentError } from '../studio/elevenagent-service.mjs';
import { createAgentClientTools } from '../ops/elevenlabs/client-tools.mjs';
import { clientToolDefinitions, makePrivateAgentConfig } from '../ops/elevenlabs/agent-config.mjs';

const signedUrl = 'wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent_test&conversation_signature=temporary-test-signature';
const configured = options => createElevenAgentService({ apiKey: 'test-server-secret', agentId: 'agent_test', ...options });
const errorIs = (status, code) => error => error instanceof ElevenAgentError && error.status === status && error.code === code;

test('private sessions use server-only API-key auth and explicit WebSocket transport', async () => {
  const service = configured({ fetchImpl: async (url, options) => {
    const target = new URL(url);
    assert.equal(target.origin, 'https://api.elevenlabs.io');
    assert.equal(target.pathname, '/v1/convai/conversation/get-signed-url');
    assert.equal(target.searchParams.get('agent_id'), 'agent_test');
    assert.equal(target.searchParams.get('include_conversation_id'), 'true');
    assert(!url.includes('test-server-secret'));
    assert.equal(options.method, 'GET');
    assert.equal(options.headers['xi-api-key'], 'test-server-secret');
    return Response.json({ signed_url: signedUrl, ignored: 'not forwarded' });
  } });
  assert.deepEqual(service.status(), { configured: true, provider: 'elevenlabs', transport: 'websocket' });
  assert.deepEqual(await service.createSession(), { signedUrl, connectionType: 'websocket' });
});

test('every call issues a new session without a shared signed-URL cache', async () => {
  let calls = 0;
  const service = configured({ fetchImpl: async () => Response.json({ signed_url: signedUrl + ++calls }) });
  const first = await service.createSession(), second = await service.createSession();
  assert.notEqual(first.signedUrl, second.signedUrl);
  assert.equal(calls, 2);
});

test('missing key and agent remain distinct configuration errors with no network calls', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; };
  const missingKey = createElevenAgentService({ agentId: 'agent_test', fetchImpl });
  assert.equal(missingKey.status().configured, false);
  await assert.rejects(missingKey.createSession(), errorIs(503, 'eleven_agent_not_configured'));
  const missingAgent = createElevenAgentService({ apiKey: 'test-server-secret', fetchImpl });
  assert.equal(missingAgent.status().configured, false);
  await assert.rejects(missingAgent.createSession(), errorIs(503, 'eleven_agent_missing'));
  await assert.rejects(configured({ apiKey: 'bad\nkey', fetchImpl }).createSession(), errorIs(503, 'eleven_agent_not_configured'));
  await assert.rejects(configured({ agentId: '../other-agent', fetchImpl }).createSession(), errorIs(503, 'eleven_agent_missing'));
  assert.equal(calls, 0);
});

test('configuration status exposes no API key or temporary conversation credential', () => {
  const status = JSON.stringify(configured({}).status());
  assert(!status.includes('test-server-secret'));
  assert(!status.includes('temporary-test-signature'));
});

test('provider auth, missing-agent, quota and service failures have safe error messages', async () => {
  for (const [upstream, status, code] of [[401, 502, 'eleven_agent_auth'], [403, 502, 'eleven_agent_auth'], [404, 503, 'eleven_agent_missing'], [429, 429, 'eleven_agent_quota'], [500, 502, 'eleven_agent_rejected']]) {
    await assert.rejects(configured({ fetchImpl: async () => new Response('private account test-server-secret', { status: upstream }) }).createSession(), error => {
      assert(errorIs(status, code)(error));
      assert(!error.message.includes('test-server-secret'));
      assert(!error.message.includes('private account'));
      return true;
    });
  }
});

test('only expected secure ElevenLabs conversation URLs reach the browser', async () => {
  for (const invalid of ['', 'not a url', 'ws://api.elevenlabs.io/v1/convai/conversation',
    'wss://evil.test/v1/convai/conversation', 'wss://api.elevenlabs.io.evil.test/v1/convai/conversation',
    'wss://api.elevenlabs.io/v1/other', 'wss://user:password@api.elevenlabs.io/v1/convai/conversation',
    'wss://api.elevenlabs.io:1234/v1/convai/conversation', 'x'.repeat(8193)]) {
    await assert.rejects(configured({ fetchImpl: async () => Response.json({ signed_url: invalid }) }).createSession(), errorIs(502, 'eleven_agent_invalid_session'));
  }
  await assert.rejects(configured({ fetchImpl: async () => new Response('not json') }).createSession(), errorIs(502, 'eleven_agent_invalid_session'));
  await assert.rejects(configured({ fetchImpl: async () => Response.json({ wrong: true }) }).createSession(), errorIs(502, 'eleven_agent_invalid_session'));
});

test('pre-cancelled connections do not contact the provider', async () => {
  const controller = new AbortController(); controller.abort('private reason');
  let calls = 0;
  await assert.rejects(configured({ fetchImpl: async () => { calls++; } }).createSession({ signal: controller.signal }), errorIs(499, 'eleven_agent_cancelled'));
  assert.equal(calls, 0);
});

test('in-flight cancellation reaches the provider without forwarding the abort reason', async () => {
  const controller = new AbortController();
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const service = configured({ fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true }); started();
  }) });
  const pending = service.createSession({ signal: controller.signal });
  await ready; controller.abort('private reason');
  await assert.rejects(pending, error => errorIs(499, 'eleven_agent_cancelled')(error) && !error.message.includes('private reason'));
});

test('timeouts and network failures are distinguished and redact private details', async () => {
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const service = configured({ timeoutMs: 5, fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }) });
    await assert.rejects(service.createSession(), errorIs(504, 'eleven_agent_timeout'));
    await assert.rejects(configured({ fetchImpl: async () => { throw Error('test-server-secret'); } }).createSession(), error => errorIs(502, 'eleven_agent_unavailable')(error) && !error.message.includes('test-server-secret'));
  } finally { clearTimeout(keepAlive); }
});

test('the live agent manifest has six blocking tools and private authentication', () => {
  assert.deepEqual(clientToolDefinitions.map(tool => tool.name), ['get_project_context', 'submit_design_brief', 'build_current_plan', 'cancel_build', 'send_repo_task', 'get_repo_task_status']);
  assert(clientToolDefinitions.every(tool => tool.expects_response && tool.parameters.type === 'object'));
  const config = makePrivateAgentConfig(clientToolDefinitions.map((_, i) => 'tool_' + i));
  assert.equal(config.platform_settings.auth.enable_auth, true);
  assert.equal(config.conversation_config.agent.prompt.tool_ids.length, 6);
  assert.equal(config.conversation_config.agent.prompt.tools, undefined);
});

test('build tool awaits the real artifact instead of immediately claiming success', async () => {
  let complete;
  const actualBuild = new Promise(resolve => { complete = resolve; });
  const states = [];
  const tools = createAgentClientTools({ onBuild: () => actualBuild, onToolState: state => states.push(state) });
  let finished = false;
  const pending = tools.build_current_plan({ direction: 'index' }).then(result => { finished = true; return JSON.parse(result); });
  await Promise.resolve();
  assert.equal(finished, false);
  assert.equal(states[0].status, 'running');
  complete({ id: 'artifact_1', version: 2, path: 'versions/2/index.html', plan: { title: 'Live artifact' }, checks: ['Rendered at 390px'] });
  const result = await pending;
  assert.equal(result.state, 'completed');
  assert.equal(result.artifact.path, 'versions/2/index.html');
  assert.deepEqual(result.artifact.checks, ['Rendered at 390px']);
});

test('a proposal needing clarification and an empty build are not reported as delivered artifacts', async () => {
  const tools = createAgentClientTools({ onBrief: async () => ({ plan: null, message: 'App or landing page?' }), onBuild: async () => null });
  const brief = JSON.parse(await tools.submit_design_brief({ brief: 'Design something' }));
  assert.equal(brief.state, 'needs_clarification');
  const build = JSON.parse(await tools.build_current_plan({}));
  assert.equal(build.ok, false);
  assert.equal(build.state, 'not_started');
});

test('repository tasks return real IDs and status without fabricating commit or push success', async () => {
  let sent;
  const tools = createAgentClientTools({
    onRepoTask: async instruction => { sent = instruction; return { agentId: 'agent-code-task', state: 'working' }; },
    onRepoTaskStatus: async taskId => ({ state: 'idle', lastReply: 'Changed the header; tests passed. Push blocked403.' }),
  });
  const receipt = JSON.parse(await tools.send_repo_task({ instruction: 'Make the header compact.' }));
  assert.equal(sent, 'Make the header compact.');
  assert.equal(receipt.taskId, 'agent-code-task');
  assert.equal(receipt.state, 'working');
  const status = JSON.parse(await tools.get_repo_task_status({ taskId: receipt.taskId }));
  assert.equal(status.state, 'idle');
  assert(status.result.includes('Push blocked403'));
  assert.equal(status.committed, undefined);
});

test('invalid tool arguments and missing callbacks cannot trigger actions', async () => {
  let calls = 0;
  const tools = createAgentClientTools({ onBrief: async () => { calls++; }, onBuild: async () => { calls++; } });
  assert.equal(JSON.parse(await tools.submit_design_brief({ brief: 'x'.repeat(2401) })).ok, false);
  assert.equal(JSON.parse(await tools.submit_design_brief({ brief: 'A landing page', referenceIds: ['ok', null] })).ok, false);
  assert.equal(JSON.parse(await tools.build_current_plan({ direction: 'execute-code' })).ok, false);
  assert.equal(JSON.parse(await tools.send_repo_task({ instruction: 'Change it' })).ok, false);
  assert.equal(calls, 0);
});

test('tool results redact credential fields and secret-shaped errors before returning to the agent', async () => {
  const tools = createAgentClientTools({ getContext: async () => ({ title: 'My repo', apiKey: 'do-not-share', authorization: 'do-not-share', nested: { token: 'do-not-share' } }),
    onRepoTask: async () => { throw Error('bad sk-0123456789abcdefgh'); } });
  const context = await tools.get_project_context();
  assert(!context.includes('do-not-share'));
  assert(context.includes('My repo'));
  const failure = await tools.send_repo_task({ instruction: 'Change the heading' });
  assert(!failure.includes('sk-0123456789abcdefgh'));
  assert.equal(JSON.parse(failure).ok, false);
});
