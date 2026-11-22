import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { createExpectedParrotReviewer, ExpectedParrotError } from '../providers/expected-parrot/index.mjs';

const request = { brief: 'Build a clear task app', htmlSummary: '<h1>Tasks</h1>', plan: { title: 'Tasks' }, references: [] };
const response = {
  provider: 'expected-parrot', simulated: true,
  reviews: ['first-time founder', 'keyboard-first user', 'busy product designer'].map(persona => ({
    persona, critique: 'Observation: The primary action needs a descriptive label. Change: Name the action Add task.'
  }))
};

function childFactory({ result = response, code = 0, hang = false, raw, stderr = '' } = {}) {
  const calls = [];
  const spawnImpl = (command, args, options) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.killed = false;
    child.kill = () => { child.killed = true; return true; };
    let input = '';
    child.stdin = new Writable({ write(chunk, _encoding, callback) { input += chunk.toString(); callback(); } });
    child.stdin.on('finish', () => {
      calls.push({ command, args, options, input: JSON.parse(input), child });
      if (!hang) queueMicrotask(() => {
        if (stderr) child.stderr.write(stderr);
        child.stdout.write(raw ?? JSON.stringify(result));
        child.emit('close', code);
      });
    });
    return child;
  };
  return { spawnImpl, calls };
}

const configured = mock => createExpectedParrotReviewer({
  apiKey: 'test-server-key', pythonPath: '/test/python', runtimeExists: () => true, ...mock
});

test('runs the fixed EDSL script with bounded input and server-only credentials', async () => {
  const mock = childFactory();
  const reviewer = configured(mock);
  const result = await reviewer.review({ ...request, htmlSummary: '<script>steal()</script><h1>Tasks</h1>' });
  assert.equal(result.simulated, true);
  assert.equal(result.provider, 'expected-parrot');
  assert.equal(result.reviews.length, 3);
  assert.match(result.basis, /not a live human/);
  const [call] = mock.calls;
  assert.equal(call.command, '/test/python');
  assert.equal(call.options.shell, false);
  assert.match(call.args[0], /providers\/expected-parrot\/review\.py$/);
  assert.equal(call.args.length, 1);
  assert.equal(call.options.env.EXPECTED_PARROT_API_KEY, 'test-server-key');
  assert.equal(call.input.htmlSummary, '<h1>Tasks</h1>');
  assert.equal(JSON.stringify(call.input).includes('test-server-key'), false);
});

test('reports configuration and runtime independently without exposing secrets', () => {
  assert.deepEqual(createExpectedParrotReviewer({ apiKey: '', runtimeExists: () => false }).status(), {
    provider: 'expected-parrot', configured: false, runtimeReady: false, model: 'gpt-4o-mini'
  });
  assert.equal(JSON.stringify(configured(childFactory()).status()).includes('test-server-key'), false);
});

test('missing credentials and runtime stop before a provider process is started', async () => {
  const mock = childFactory();
  await assert.rejects(createExpectedParrotReviewer({ ...mock, apiKey: '', runtimeExists: () => true }).review(request), error => error.status === 503 && error.code === 'not_configured');
  await assert.rejects(createExpectedParrotReviewer({ ...mock, apiKey: 'key', runtimeExists: () => false }).review(request), error => error.status === 503 && error.code === 'runtime_missing');
  assert.equal(mock.calls.length, 0);
});

test('rejects malformed and oversized inputs locally', async () => {
  const mock = childFactory();
  const reviewer = configured(mock);
  for (const input of [
    { ...request, brief: '' }, { ...request, brief: 'x'.repeat(6001) },
    { ...request, htmlSummary: 'x'.repeat(120001) }, { ...request, plan: [] },
    { ...request, references: Array(13).fill({}) }
  ]) await assert.rejects(reviewer.review(input), error => error.status === 400);
  assert.equal(mock.calls.length, 0);
});

test('maps authentication and quota failures without returning raw provider diagnostics', async () => {
  for (const [id, status] of [['authentication_failed', 502], ['quota_exceeded', 429], ['dependency_missing', 503]]) {
    const reviewer = configured(childFactory({ result: { error: id, detail: 'test-server-key secret diagnostic' }, code: 1, stderr: 'test-server-key' }));
    await assert.rejects(reviewer.review(request), error => error instanceof ExpectedParrotError && error.status === status && !error.message.includes('test-server-key'));
  }
});

test('rejects malformed, incomplete and duplicate provider reviews', async () => {
  for (const mock of [
    childFactory({ raw: 'not JSON' }),
    childFactory({ result: { ...response, reviews: response.reviews.slice(0, 1) } }),
    childFactory({ result: { ...response, reviews: [response.reviews[0], response.reviews[0], response.reviews[2]] } })
  ]) await assert.rejects(configured(mock).review(request), error => error.status === 502);
});

test('cancellation stops the local review process and never returns a critique', async () => {
  const mock = childFactory({ hang: true });
  const controller = new AbortController();
  const pending = configured(mock).review({ ...request, signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, error => error.status === 499);
  assert.equal(mock.calls[0].child.killed, true);
  const alreadyAborted = new AbortController(); alreadyAborted.abort();
  await assert.rejects(configured(childFactory()).review({ ...request, signal: alreadyAborted.signal }), error => error.status === 499);
});

test('timeout terminates the local client and reports an explicit failure', async () => {
  const mock = childFactory({ hang: true });
  await assert.rejects(configured({ ...mock, timeoutMs: 5 }).review(request), error => error.status === 504);
  assert.equal(mock.calls[0].child.killed, true);
});

test('invalid configured executables, model names and timeouts fail safely', () => {
  assert.throws(() => configured({ pythonPath: 'python\ncommand' }), TypeError);
  assert.throws(() => configured({ model: 'model;echo key' }), TypeError);
  assert.throws(() => configured({ timeoutMs: Infinity }), TypeError);
});
