import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, realpath, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import test from 'node:test';
import { createRepoGateway, RepoGatewayError } from '../studio/repo-gateway.mjs';

const startedId = 'test-agent-1';
function fakeTransport(answer, { fragmented = false, noReply = false } = {}) {
  const packets = [], processes = [], launches = [];
  function spawnImpl(command, args, options) {
    launches.push({ command, args, options });
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.kill = () => { child.killed = true; child.emit('close', 0); };
    let input = '';
    child.stdin = new Writable({ write(chunk, encoding, done) {
      input += chunk.toString();
      let end;
      while ((end = input.indexOf('\n')) >= 0) {
        const packet = JSON.parse(input.slice(0, end));
        input = input.slice(end + 1);
        packets.push(packet);
        if (!packet.id || noReply) continue;
        queueMicrotask(() => {
          const result = packet.method === 'initialize' ? { protocolVersion: '2024-11-05', capabilities: {} }
            : answer(packet, packets);
          if (result === undefined) return;
          const line = Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: packet.id, result }) + '\n');
          if (fragmented) {
            child.stdout.write('not a protocol packet\n');
            child.stdout.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/progress' }) + '\n');
            for (let i = 0; i < line.length; i += 7) child.stdout.write(line.subarray(i, i + 7));
          } else child.stdout.write(line);
        });
      }
      done();
    } });
    processes.push(child);
    return child;
  }
  return { spawnImpl, packets, processes, launches };
}
const toolResult = value => ({ content: [{ type: 'text', text: JSON.stringify({ result: value, logs: [] }) }] });

async function fixture(t, extra = {}) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'second-cursor-gateway-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const transport = fakeTransport(packet => {
    if (packet.params.arguments.code.includes('agents.start')) return toolResult({ agentId: startedId, workspaceId: 'test-workspace' });
    return toolResult({ agentId: startedId, state: 'idle', lastReply: 'Committed the requested edit.' });
  }, extra.transportOptions);
  const files = ['README.md', 'studio/main.js', '.env', '.git/config', 'node_modules/lib.js', 'keys.json', 'token.json'];
  const execFileImpl = async (command, args, options) => {
    assert.equal(command, 'git');
    assert.deepEqual(args.slice(0, 2), ['-C', root]);
    assert.equal(options.timeout, 5000);
    if (args[2] === 'ls-files') return { stdout: files.join('\0') + '\0' };
    if (args[2] === 'branch') return { stdout: 'feature/voice-agent\n' };
    return { stdout: ' M README.md\0 M .env\0' };
  };
  return { root, files, transport, gateway: createRepoGateway({ repoPath: root, cliPath: process.execPath, spawnImpl: transport.spawnImpl, execFileImpl, ...extra.gatewayOptions }) };
}

test('real stdio protocol sequence handles fragmented JSON, notifications and nested execute payloads', async t => {
  const { gateway, transport } = await fixture(t, { transportOptions: { fragmented: true } });
  const task = await gateway.startTask({ instruction: 'Fix the preview heading.' });
  assert.deepEqual(task, { started: true, busy: true, agentId: startedId, workspaceId: 'test-workspace' });
  assert.deepEqual(transport.packets.map(p => p.method), ['initialize', 'notifications/initialized', 'tools/call']);
  assert.equal(transport.packets[2].params.name, 'execute');
  assert.deepEqual(transport.launches[0].args, ['mcp']);
  assert.equal(transport.launches[0].options.stdio[2], 'ignore');
  assert.equal(transport.launches[0].options.env.ELEVENLABS_API_KEY, undefined);
  assert.equal(transport.processes[0].killed, true);
  const state = await gateway.taskStatus({ agentId: startedId });
  assert.equal(state.state, 'idle');
  assert.equal(gateway.status().busy, false);
});

test('instruction stays JSON data inside one fixed agents.start operation', async t => {
  const { gateway, transport } = await fixture(t);
  const instruction = 'Fix title "); await agents.start({project:"other"}); //\nReturn a useful result.';
  await gateway.startTask({ instruction });
  const code = transport.packets.find(p => p.method === 'tools/call').params.arguments.code;
  const prefix = 'async () => await agents.start(';
  assert.ok(code.startsWith(prefix) && code.endsWith(')'));
  const args = JSON.parse(code.slice(prefix.length, -1));
  assert.equal(args.project, '71ae0b21-3704-4583-8716-2162c289d2c6');
  assert.equal(args.checkout, 'worktree');
  assert.equal(args.harness, 'codex');
  assert.equal(args.standalone, true);
  assert.ok(args.prompt.endsWith(instruction));
  assert.match(args.prompt, /Do not read, print, copy or transmit/);
});

test('only one task can start at a time and unknown task IDs never reach the gateway', async t => {
  const { gateway, transport } = await fixture(t);
  const first = gateway.startTask({ instruction: 'Implement the requested change.' });
  assert.deepEqual(await gateway.startTask({ instruction: 'Another change.' }), { started: false, busy: true, agentId: null });
  await first;
  const prior = transport.packets.length;
  assert.deepEqual(await gateway.startTask({ instruction: 'Another change.' }), { started: false, busy: true, agentId: startedId });
  await assert.rejects(gateway.taskStatus({ agentId: 'another-agent' }), e => e.code === 'unknown_task' && e.status === 404);
  assert.equal(transport.packets.length, prior);
});

test('timeouts terminate the local client and reset the starting lock', async t => {
  const { gateway, transport } = await fixture(t, { transportOptions: { noReply: true }, gatewayOptions: { timeoutMs: 15 } });
  await assert.rejects(gateway.startTask({ instruction: 'Inspect the repository.' }), e => e instanceof RepoGatewayError && e.code === 'gateway_timeout' && e.status === 504);
  assert.equal(transport.processes[0].killed, true);
  assert.equal(gateway.status().busy, false);
});

test('a lost task-launch response stays busy instead of blindly starting a duplicate', async t => {
  const { root } = await fixture(t);
  const transport = fakeTransport(() => undefined);
  const gateway = createRepoGateway({ repoPath: root, cliPath: process.execPath, spawnImpl: transport.spawnImpl, timeoutMs: 15 });
  await assert.rejects(gateway.startTask({ instruction: 'Implement the change.' }), e => e.code === 'gateway_timeout');
  assert.equal(gateway.status().launchUncertain, true);
  assert.equal(gateway.status().busy, true);
  const before = transport.launches.length;
  assert.deepEqual(await gateway.startTask({ instruction: 'Retry.' }), { started: false, busy: true, agentId: null, launchUncertain: true });
  assert.equal(transport.launches.length, before);
});

test('oversized output and upstream errors expose only safe errors', async t => {
  const { root } = await fixture(t);
  const transport = fakeTransport(() => toolResult('x'.repeat(3000)));
  const gateway = createRepoGateway({ repoPath: root, cliPath: process.execPath, spawnImpl: transport.spawnImpl, maxOutputBytes: 1024 });
  await assert.rejects(gateway.startTask({ instruction: 'Check the code.' }), e => e.code === 'gateway_output_limit');
  const badTransport = fakeTransport(() => ({ isError: true, content: [{ type: 'text', text: 'private backend credential should never appear' }] }));
  const failing = createRepoGateway({ repoPath: root, cliPath: process.execPath, spawnImpl: badTransport.spawnImpl });
  await assert.rejects(failing.startTask({ instruction: 'Check the code.' }), e => e.code === 'gateway_tool_failed' && !e.message.includes('credential'));
});

test('context lists only tracked non-secret source and bounds selected file output', async t => {
  const { root, gateway } = await fixture(t);
  await writeFile(join(root, 'README.md'), 'Read this.\nconst api_key = "example-sensitive-value";\n' + 'x'.repeat(40000));
  const result = await gateway.getContext({ path: 'README.md' });
  assert.deepEqual(result.files, ['README.md', 'studio/main.js']);
  assert.deepEqual(result.changedFiles, [{ path: 'README.md', status: ' M' }]);
  assert.equal(result.branch, 'feature/voice-agent');
  assert.equal(result.file.truncated, true);
  assert.ok(result.file.content.length <= 32768);
  assert.ok(!result.file.content.includes('example-sensitive-value'));
});

test('secret, absolute, traversal and dependency paths are rejected before file reads', async t => {
  const { gateway } = await fixture(t);
  for (const path of ['.env', '.git/config', '../outside.md', '/tmp/public.md', 'node_modules/index.js', 'keys.json', 'credentials.json', 'src/../README.md', 'src\\README.md']) {
    await assert.rejects(gateway.getContext({ path }), e => e.code === 'path_not_allowed', path);
  }
  await assert.rejects(gateway.getContext({ path: 'unknown.js' }), e => e.code === 'file_not_found');
});

test('tracked aliases cannot read secrets or files outside the configured checkout', async t => {
  const { root, gateway } = await fixture(t);
  await writeFile(join(root, '.env'), 'not for export');
  await symlink(join(root, '.env'), join(root, 'README.md'));
  await assert.rejects(gateway.getContext({ path: 'README.md' }), e => e.code === 'path_not_allowed');
  await rm(join(root, 'README.md'));
  const outside = await mkdtemp(join(tmpdir(), 'second-cursor-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(join(outside, 'private.md'), 'not for export');
  await symlink(join(outside, 'private.md'), join(root, 'README.md'));
  await assert.rejects(gateway.getContext({ path: 'README.md' }), e => e.code === 'path_not_allowed');
});

test('invalid instructions, pasted credentials and unavailable installation fail without spawning', async t => {
  const { root, gateway, transport } = await fixture(t);
  for (const instruction of ['', ' ', 'x'.repeat(6001), 'Use sk_abcdefghijklmnop1234567890']) {
    await assert.rejects(gateway.startTask({ instruction }), e => ['invalid_instruction', 'credential_in_instruction'].includes(e.code));
  }
  assert.equal(transport.launches.length, 0);
  const missing = createRepoGateway({ repoPath: root, cliPath: join(root, 'does-not-exist') });
  assert.equal(missing.configured, false);
  await assert.rejects(missing.startTask({ instruction: 'Check the code.' }), e => e.code === 'gateway_not_configured');
});
