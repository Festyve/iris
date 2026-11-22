const scrub = text => String(text).replace(/\b(?:sk_[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]{10,}|mk_[A-Za-z0-9_-]+|ghp_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+)\b/g, '[redacted]')
  .replace(/wss:\/\/[^\s"']+/g, '[private conversation URL]');
export const safeAgentMessage = value => scrub(typeof value === 'string' ? value : value?.message || 'The operation could not be completed.').slice(0, 600);

export function agentResult(value) {
  const text = JSON.stringify(value, (key, entry) => /authorization|api.?key|password|secret|signed.?url|session.?key|token/i.test(key)
    ? '[redacted]' : typeof entry === 'string' ? scrub(entry) : entry);
  return text.length > 18_000 ? JSON.stringify({ truncated: true, excerpt: text.slice(0, 16_000) }) : text;
}

const parameterText = (value, name, limit) => {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw Error(`Provide a valid ${name} of ${limit} characters or fewer.`);
  return value.trim();
};

/** All tools await application callbacks and return an explicit receipt to the agent. */
export function createAgentClientTools({ getContext, onBrief, onBuild, onCancel, onRepoTask, onRepoTaskStatus, onToolState } = {}) {
  const unavailable = name => { throw Error(`${name} is not connected in this application.`); };
  async function run(name, action) {
    onToolState?.({ name, status: 'running' });
    try {
      const receipt = await action();
      onToolState?.({ name, status: receipt?.ok === false ? 'failed' : 'succeeded' });
      return agentResult(receipt);
    } catch (error) {
      const message = safeAgentMessage(error);
      onToolState?.({ name, status: 'failed', error: message });
      return agentResult({ ok: false, error: message });
    }
  }
  return {
    get_project_context: () => run('get_project_context', async () => {
      if (!getContext) unavailable('Project context');
      const context = await getContext();
      return context == null ? { ok: false, error: 'No project context was returned.' } : { ok: true, context };
    }),
    submit_design_brief: parameters => run('submit_design_brief', async () => {
      if (!onBrief) unavailable('Design planning');
      const brief = parameterText(parameters?.brief, 'design brief', 2400);
      const ids = parameters?.referenceIds ?? [];
      if (!Array.isArray(ids) || ids.length > 128 || ids.some(id => typeof id !== 'string' || !id || id.length > 256)) throw Error('Provide valid referenceIds from the project context.');
      const result = await onBrief(brief, ids);
      if (!result) return { ok: false, state: 'unconfirmed', error: 'The application did not confirm a design proposal.' };
      return { ok: true, state: result.plan ? 'proposed' : 'needs_clarification', message: result.message,
        plan: result.plan ? { title: result.plan.title, kind: result.plan.kind, direction: result.plan.direction,
          referenceIds: result.plan.referenceIds, mechanism: result.plan.mechanism } : null };
    }),
    build_current_plan: parameters => run('build_current_plan', async () => {
      if (!onBuild) unavailable('Artifact building');
      const direction = parameters?.direction;
      if (direction != null && !['editorial', 'index'].includes(direction)) throw Error('Choose editorial or index, or omit direction to build the pending plan.');
      const result = await onBuild(direction);
      if (!result) return { ok: false, state: 'not_started', error: 'No completed artifact was returned. Get project context and submit a brief first, or check the current run.' };
      if (!result.path || !result.version) return { ok: false, state: 'unconfirmed', error: 'The application did not return a saved artifact receipt.' };
      return { ok: true, state: 'completed', artifact: { id: result.id, version: result.version, path: result.path,
        title: result.plan?.title, checks: result.checks ?? [] } };
    }),
    cancel_build: () => run('cancel_build', async () => {
      if (!onCancel) unavailable('Build cancellation');
      const result = await onCancel();
      return result?.status === 'cancelled' || result?.state === 'cancelled'
        ? { ok: true, state: 'cancelled' }
        : { ok: true, state: 'cancellation_requested', message: 'Cancellation was requested. Check project context before claiming a run stopped.' };
    }),
    send_repo_task: parameters => run('send_repo_task', async () => {
      if (!onRepoTask) unavailable('Repository coding');
      const instruction = parameterText(parameters?.instruction, 'repository instruction', 4000);
      const receipt = await onRepoTask(instruction);
      const taskId = receipt?.taskId || receipt?.agentId || receipt?.id;
      if (!taskId) return { ok: false, state: 'unconfirmed', error: 'No repository task ID was returned. Do not claim code was changed.' };
      return { ok: true, taskId, state: receipt.state || receipt.status || (receipt.accepted ? 'queued' : 'submitted'),
        message: 'Repository work was submitted. Use get_repo_task_status to check actual changes, tests, commits and push results.' };
    }),
    get_repo_task_status: parameters => run('get_repo_task_status', async () => {
      if (!onRepoTaskStatus) unavailable('Repository task status');
      const taskId = parameterText(parameters?.taskId, 'task ID', 128);
      if (!/^[A-Za-z0-9_-]+$/.test(taskId)) throw Error('Use a taskId returned by send_repo_task.');
      const result = await onRepoTaskStatus(taskId);
      if (!result) return { ok: false, taskId, error: 'No repository task status was returned.' };
      return { ok: true, taskId, state: result.state || result.status || 'unknown',
        result: result.lastReply ?? result.result ?? result.message ?? null, pendingQuestion: result.pendingQuestion ?? null };
    }),
  };
}
