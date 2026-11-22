#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TASKS, validateTasks, promptFor } from './tasks.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));

function options(args) {
  const out = { mode: 'plan' };
  if (args[0] && !args[0].startsWith('--')) out.mode = args.shift();
  for (let i = 0; i < args.length; i++) {
    const key = args[i].replace(/^--/, '');
    if (key === 'execute') out.execute = true;
    else if (!args[i].startsWith('--') || !args[i + 1] || args[i + 1].startsWith('--')) throw Error(`Invalid option: ${args[i]}`);
    else out[key] = args[++i];
  }
  return out;
}

export function checkApproval(approval, agents, now = Date.now()) {
  if (approval.approved !== true) throw Error('Explicit approval is missing.');
  const age = now - Date.parse(approval.verifiedAt);
  if (!Number.isFinite(age) || age < 0 || age > 15 * 60_000) throw Error('Account/budget evidence must be verified within 15 minutes.');
  if (approval.maxAgents !== 30 || approval.availableAwakeSlots < 30) throw Error('Verified capacity for 30 distinct awake agents is required.');
  if (approval.modelAuthentication !== 'already-configured-per-box') throw Error('Every box needs its own configured model authentication; do not copy local session tokens.');
  if (!(approval.maxComputeUsd > 0 && approval.maxModelUsd > 0)) throw Error('Explicit compute and model budgets are required.');
  if (!(approval.availableComputeCreditUsd >= approval.maxComputeUsd && approval.availableModelCreditUsd >= approval.maxModelUsd)) throw Error('Verified prepaid credit must cover the approved budgets.');
  if (approval.modelBudgetEnforced !== true || approval.computeBudgetEnforced !== true || approval.autoTopupDisabled !== true) throw Error('Provider-enforced budgets and no automatic top-up must be verified. This script does not enforce a billing cap.');
  if (!Array.isArray(agents) || agents.length !== 30 || new Set(agents.map(a => a.id)).size !== 30 || agents.some(a => typeof a.id !== 'string' || !a.id.trim())) throw Error('Exactly 30 distinct pre-provisioned agent IDs are required.');
  if (agents.some(a => a.modelReady !== true || a.disposableWorkspace !== true)) throw Error('Each box must have verified model access and an isolated disposable workspace.');
  return true;
}

function safe(value) {
  if (Array.isArray(value)) return value.map(safe);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([k]) => !/token|secret|password|apikey|api_key|authorization|cookie/i.test(k))
    .map(([k, v]) => [k, safe(v)]));
  if (typeof value === 'string') return value.replace(/\b(?:sk|mk|mlk)_[A-Za-z0-9_-]{12,}\b/g, '[redacted]');
  return value;
}

async function maritime(opt, args, input) {
  const global = ['--json', '--no-input', ...(opt.config ? ['--config', opt.config] : [])];
  return new Promise((yes, no) => {
    const child = execFile(opt.bin || process.env.MARITIME_BIN || 'maritime', [...args, ...global], { timeout: 65_000, maxBuffer: 2_000_000 }, (error, stdout, stderr) => {
      if (error) no(Error(`${args.slice(0, 2).join(' ')} failed: ${safe(stderr || error.message).slice(0, 1500)}`));
      else {
        try { yes(JSON.parse(stdout)); }
        catch { no(Error(`CLI returned non-JSON output for ${args.slice(0, 2).join(' ')}`)); }
      }
    });
    child.stdin.on('error', no);
    child.stdin.end(input ? JSON.stringify(input) : '');
  });
}

async function save(path, data) { await writeFile(path, JSON.stringify(safe(data), null, 2) + '\n', { mode: 0o600 }); }
const unwrap = value => value?.data ?? value?.result ?? value;

export async function main(args = process.argv.slice(2)) {
  const opt = options([...args]);
  validateTasks();
  if (opt.mode === 'preflight') {
    const auth = unwrap(await maritime(opt, ['whoami']));
    if (auth.authenticated !== true) throw Error('Maritime is not authenticated. Complete the official CLI login first.');
    const billing = await maritime(opt, ['billing', 'status']);
    const usage = await maritime(opt, ['usage', 'get']);
    console.log(JSON.stringify(safe({ auth, billing, usage, launched: 0, note: 'Read-only evidence. Review actual awake slots, compute credit and separate model credit. No upgrade, purchase or provisioning performed.' }), null, 2));
    return;
  }
  if (opt.mode === 'collect') {
    if (!opt.run) throw Error('--run <run-directory> is required.');
    const dir = resolve(opt.run);
    const state = JSON.parse(await readFile(resolve(dir, 'dispatch.json'), 'utf8'));
    for (const item of state.jobs) {
      if (!item.deliveryId) continue;
      item.receipt = await maritime(opt, ['agents', 'chat-result', item.agentId, item.deliveryId]);
    }
    await save(resolve(dir, 'receipts.json'), state);
    console.log(JSON.stringify(safe(state), null, 2));
    return;
  }
  if (!['plan', 'dispatch'].includes(opt.mode)) throw Error('Modes: plan (default), preflight, dispatch, collect.');
  const repo = opt.repo || 'https://github.com/Festyve/iris.git';
  const commit = opt.commit || '<published-40-character-commit-sha>';
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(repo)) throw Error('Use a public credential-free GitHub HTTPS repository URL.');
  const plan = { dryRun: true, launched: 0, taskCount: 30, repository: repo, commit,
    jobs: TASKS.map(task => ({ ...task, prompt: promptFor(task, repo, commit) })) };
  if (opt.mode === 'plan' || !opt.execute) { console.log(JSON.stringify(plan, null, 2)); return; }
  if (!/^[a-f0-9]{40}$/i.test(commit)) throw Error('--commit must name the published immutable commit all workers will inspect.');
  if (!opt.approval || !opt.agents) throw Error('--approval <budget-evidence.json> and --agents <30-agent-ids.json> are required.');
  const approval = JSON.parse(await readFile(resolve(opt.approval), 'utf8'));
  const agents = JSON.parse(await readFile(resolve(opt.agents), 'utf8'));
  checkApproval(approval, agents);
  const auth = unwrap(await maritime(opt, ['whoami']));
  if (auth.authenticated !== true) throw Error('Maritime is not authenticated.');
  // Re-read account eligibility immediately before sending any task. Unknown shapes fail closed.
  const billing = unwrap(await maritime(opt, ['billing', 'status']));
  if (billing.canStartMachines !== true && billing.can_start_machines !== true) throw Error('CLI billing status did not explicitly confirm machine-start eligibility. Inspect current API schema before proceeding.');
  const dir = resolve(opt.out || resolve(root, 'runs', new Date().toISOString().replace(/[:.]/g, '-')));
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const state = { dryRun: false, taskCount: 30, launched: 0, accepted: 0, repository: repo, commit, jobs: [] };
  await save(resolve(dir, 'dispatch.json'), state);
  for (let i = 0; i < TASKS.length; i++) {
    const task = TASKS[i], agent = agents[i];
    const item = { taskId: task.id, agentId: agent.id, state: 'submitting', branch: task.branch };
    state.jobs.push(item);
    await save(resolve(dir, 'dispatch.json'), state); // crash-safe; uncertain sends are never replayed
    try {
      const response = await maritime(opt, ['agents', 'chat', agent.id, '--stdin'], { message: promptFor(task, repo, commit), conversation_id: `second-cursor-${commit.slice(0, 12)}-${task.id}` });
      const receipt = unwrap(response);
      item.receipt = response;
      item.deliveryId = receipt.deliveryId ?? receipt.delivery_id ?? null;
      item.state = receipt.state ?? 'accepted-response';
      state.accepted++;
      // A retained receipt is acceptance, not proof the agent is currently running.
    } catch (error) {
      item.state = 'uncertain-or-rejected'; item.error = error.message;
      await save(resolve(dir, 'dispatch.json'), state);
      throw Error(`Stopped after task ${task.id}: ${error.message}. Inspect this receipt before resuming; do not resend uncertain tasks.`);
    }
    await save(resolve(dir, 'dispatch.json'), state);
  }
  console.log(JSON.stringify({ runDirectory: dir, accepted: state.accepted, running: 'Inspect retained receipts; acceptance does not prove 30 running.' }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {
  console.error(error.message); process.exitCode = 1;
});
