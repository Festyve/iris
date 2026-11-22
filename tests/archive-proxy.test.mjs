import assert from 'node:assert/strict';
import test from 'node:test';

test('Wasp archive proxy', async (t) => {
  const originalEnv = process.env;
  process.env = { WASP_BACKEND_URL: 'http://127.0.0.1:3002' };
  t.after(() => { process.env = originalEnv; });

  const { archiveRoute } = await import('../studio/archive.mjs');
  const path = 'projects/example';
  const payload = { expectedRevision: 2, project: { name: 'Example' } };

  await t.test('forwards a revision-guarded save and returns the new revision', async (t) => {
    const fetch = t.mock.method(globalThis, 'fetch', async () => {
      return Response.json({ revision: 3 }, { status: 200 });
    });

    assert.deepEqual(await archiveRoute(path, payload, new AbortController().signal), {
      status: 200,
      data: { revision: 3 },
    });
    assert.equal(fetch.mock.callCount(), 1);
    const [url, options] = fetch.mock.calls[0].arguments;
    assert.equal(url.href, 'http://127.0.0.1:3002/studio-api/projects/example');
    assert.equal(options.method, 'PUT');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), payload);
  });

  await t.test('returns a local-copy message when the Wasp server is unavailable', async (t) => {
    const fetch = t.mock.method(globalThis, 'fetch', async () => {
      throw new TypeError('fetch failed');
    });

    assert.deepEqual(await archiveRoute(path, payload, new AbortController().signal), {
      status: 503,
      data: {
        error: 'Wasp archive unavailable on the configured loopback port. Your local copy stays on this device.',
      },
    });
    assert.equal(fetch.mock.callCount(), 1);
  });
});
