import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentArtifact, emptyProject, projectController } from '../studio/project.mjs';
import { compileArtifact, planBuild, verifyArtifact } from '../studio/compiler.mjs';

function setup(overrides = {}) {
  const writes = [];
  const api = projectController(emptyProject(), {
    save: async p => writes.push(structuredClone(p)), notify() {},
    retrieve: () => [], planBuild, compile: compileArtifact, verify: verifyArtifact, ...overrides
  });
  return { api, writes };
}

test('persisted approval can finish after reload; selected source and versions survive revision and restore', async () => {
  const { api, writes } = setup();
  await api.select(['reference']);
  await api.brief('Build a project tracker app named Ledger', [], []);
  const queued = writes.at(-1);
  const resumed = projectController(queued, {
    async save() {}, notify() {}, retrieve: () => [], planBuild, compile: compileArtifact, verify: verifyArtifact
  });
  const first = await resumed.build(undefined, []);
  assert.equal(first.plan.title, 'Ledger');
  await resumed.brief('Set title to Atlas', [], []);
  const second = await resumed.build(undefined, []);
  assert.notEqual(second.html, first.html);
  await resumed.restore(1);
  assert.deepEqual(currentArtifact(resumed.read()), first);
  assert.deepEqual(resumed.read().selectedIds, ['reference']);
  assert.deepEqual(resumed.read().run.tasks.map(t => t.status), Array(4).fill('succeeded'));
});

test('cancel during verification prevents stale commit even after a newer proposal', async () => {
  let deliver, started;
  const verifying = new Promise(resolve => { started = resolve; });
  const { api } = setup({ verify() {
    started();
    return new Promise(resolve => { deliver = resolve; });
  } });
  await api.brief('Build a landing page', [], []);
  const result = api.build(undefined, []);
  await verifying;
  await api.cancel();
  assert.equal(api.read().run.tasks.at(-1).status, 'cancelled');
  await api.brief('Build an app for founders', [], []);
  deliver(['Verified']);
  assert.equal(await result, null);
  assert.equal(api.read().pending.kind, 'app');
  assert.equal(api.read().versions.length, 0);
});

test('check failure preserves previous good artifact and marks exact task failed', async () => {
  let broken = false;
  const { api } = setup({verify(html,plan) {
    if (broken) throw Error('Preview width exceeded');
    return verifyArtifact(html,plan);
  }});
  await api.brief('Build a landing page', [], []);
  const good = await api.build(undefined, []);
  broken = true;
  await api.brief('Set title to Replacement', [], []);
  await assert.rejects(api.build(undefined, []), /width exceeded/);
  assert.equal(api.read().run.status,'failed');
  assert.equal(api.read().run.tasks.at(-1).status,'failed');
  assert.deepEqual(currentArtifact(api.read()), good);
});
