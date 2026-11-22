import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TASKS, validateTasks, promptFor } from './tasks.mjs';
import { checkApproval } from './dispatch.mjs';

const now = Date.now();
const agents = Array.from({ length: 30 }, (_, i) => ({ id: `isolated-box-${i}`, modelReady: true, disposableWorkspace: true }));
const approval = () => ({ approved: true, verifiedAt: new Date(now).toISOString(), maxAgents: 30,
  availableAwakeSlots: 30, modelAuthentication: 'already-configured-per-box',
  maxComputeUsd: 1, maxModelUsd: 1, availableComputeCreditUsd: 1, availableModelCreditUsd: 1,
  modelBudgetEnforced: true, computeBudgetEnforced: true, autoTopupDisabled: true });

test('30 isolated tasks have distinct IDs, branches and application write ownership', () => {
  assert.equal(validateTasks().length, 30);
  assert.equal(TASKS.filter(t => t.mode === 'implement').length, 4);
  assert.equal(new Set(TASKS.map(t => t.branch)).size, 30);
  assert.throws(() => validateTasks(TASKS.slice(1)), /Exactly 30/);
  assert.throws(() => validateTasks(TASKS.map((t, i) => i === 1 ? { ...t, writePaths: TASKS[0].writePaths } : t)), /Overlapping writer/);
});

test('approval rejects stale evidence, insufficient capacity/credit and unenforced budgets', () => {
  assert.equal(checkApproval(approval(), agents, now), true);
  assert.throws(() => checkApproval({ ...approval(), verifiedAt: new Date(now - 16 * 60_000).toISOString() }, agents, now), /15 minutes/);
  assert.throws(() => checkApproval({ ...approval(), availableAwakeSlots: 29 }, agents, now), /capacity/);
  assert.throws(() => checkApproval({ ...approval(), availableModelCreditUsd: 0 }, agents, now), /prepaid credit/);
  assert.throws(() => checkApproval({ ...approval(), modelBudgetEnforced: false }, agents, now), /Provider-enforced/);
  assert.throws(() => checkApproval({ ...approval(), autoTopupDisabled: false }, agents, now), /Provider-enforced/);
  assert.throws(() => checkApproval(approval(), agents.map(a => ({ ...a, id: 'same-agent' })), now), /distinct/);
});

test('every prompt binds an immutable source, private workspace and bounded ownership', () => {
  const sha = 'a'.repeat(40);
  const prompt = promptFor(TASKS[0], 'https://github.com/Festyve/iris.git', sha);
  assert.ok(prompt.includes(sha));
  assert.ok(prompt.includes('/data/workspace/second-cursor-1'));
  assert.ok(prompt.includes(TASKS[0].branch));
  assert.ok(prompt.includes('Never change another worker'));
  assert.ok(prompt.includes('Do not copy local ChatGPT/Codex authentication'));
});

test('default plan and unconfirmed dispatch are dry-run with no CLI/cloud dependency', () => {
  for (const args of [[], ['dispatch']]) {
    const stdout = execFileSync(process.execPath, [new URL('./dispatch.mjs', import.meta.url).pathname, ...args], {
      encoding: 'utf8', env: { ...process.env, MARITIME_BIN: '/does-not-exist' }
    });
    const plan = JSON.parse(stdout);
    assert.equal(plan.dryRun, true);
    assert.equal(plan.launched, 0);
    assert.equal(plan.jobs.length, 30);
  }
});

test('confirmed dispatch submits each task once and collects exact retained receipts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'maritime-dispatch-'));
  try {
    const mock = join(dir, 'maritime');
    const log = join(dir, 'calls.jsonl');
    writeFileSync(mock, `#!/usr/bin/env node
const fs=require('node:fs'); const a=process.argv.slice(2); let input='';
process.stdin.on('data',c=>input+=c); process.stdin.on('end',()=>{
 fs.appendFileSync(process.env.MOCK_CALLS,JSON.stringify({args:a,input:input?JSON.parse(input):null})+'\\n');
 let v;
 if(a[0]==='whoami')v={authenticated:true};
 else if(a[0]==='billing')v={canStartMachines:true};
 else if(a[1]==='chat')v={deliveryId:'delivery-'+a[2],state:'accepted'};
 else if(a[1]==='chat-result')v={deliveryId:a[3],state:'completed',reply:'verified receipt'};
 else {process.stderr.write('unexpected call');process.exit(1)}
 process.stdout.write(JSON.stringify(v));
});\n`, { mode: 0o755 });
    writeFileSync(join(dir, 'agents.json'), JSON.stringify(agents));
    writeFileSync(join(dir, 'approval.json'), JSON.stringify(approval()));
    const runner = new URL('./dispatch.mjs', import.meta.url).pathname;
    const env = { ...process.env, MARITIME_BIN: mock, MOCK_CALLS: log };
    const out = JSON.parse(execFileSync(process.execPath, [runner, 'dispatch', '--execute',
      '--commit', 'a'.repeat(40), '--agents', join(dir, 'agents.json'), '--approval', join(dir, 'approval.json'), '--out', join(dir, 'run')], { encoding: 'utf8', env }));
    assert.equal(out.accepted, 30);
    const calls = readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
    const messages = calls.filter(c => c.args[1] === 'chat');
    assert.equal(messages.length, 30);
    assert.equal(new Set(messages.map(c => c.args[2])).size, 30);
    assert.equal(new Set(messages.map(c => c.input.conversation_id)).size, 30);
    execFileSync(process.execPath, [runner, 'collect', '--run', join(dir, 'run')], { encoding: 'utf8', env });
    const state = JSON.parse(readFileSync(join(dir, 'run', 'receipts.json'), 'utf8'));
    assert.equal(state.jobs.filter(j => j.receipt.state === 'completed').length, 30);
    const all = readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(all.filter(c => c.args[1] === 'chat').length, 30);
    assert.equal(all.filter(c => c.args[1] === 'chat-result').length, 30);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
