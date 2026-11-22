// A single writer per tab. The store compares revisions inside an IndexedDB transaction.
export function emptyProject() {
  return {
    id: 'local-studio', serial: 0, selectedIds: [], versions: [], currentVersion: null,
    pending: null, run: null, clarification: '', startFresh: false
  };
}

export function currentArtifact(project) {
  return project.versions.find(version => version.version === project.currentVersion) || null;
}

const jobs = [
  ['references', 'Reference research', 'Reference shortlist'],
  ['design', 'Design direction', 'Design plan'],
  ['implementation', 'Implementation', 'index.html'],
  ['verification', 'Verification', 'Preview and check report']
];

function createRun(brief) {
  return {
    id: crypto.randomUUID(), brief, status: 'running', started: Date.now(),
    tasks: jobs.map(([id, label, artifact], i) => ({
      id, label, artifact, status: 'queued', dependsOn: i ? [jobs[i - 1][0]] : []
    }))
  };
}

function stopped(run, reason) {
  if (!run || !['running', 'queued'].includes(run.status)) return run;
  return { ...run, status: 'cancelled', reason, tasks: run.tasks.map(task =>
    ['running', 'queued'].includes(task.status) ? { ...task, status: 'cancelled' } : task) };
}

export function projectController(initial, { save, notify, retrieve, planBuild, compile, verify }) {
  let state = initial;
  let queue = Promise.resolve();
  let active = null;
  let planning = null;
  function write(transform) {
    const operation = queue.then(async () => {
      const next = transform(state);
      if (!next) return;
      next.serial = state.serial + 1;
      await save(next, state.serial);
      state = next;
      notify(next);
    });
    queue = operation.catch(() => {});
    return operation;
  }

  function check(runId) {
    if (active !== runId) throw new DOMException('Run superseded', 'AbortError');
  }

  function task(runId, id, status, detail = {}) {
    return write(project => {
      check(runId);
      const tasks = project.run.tasks.map(t => t.id === id ? { ...t, status, ...detail } : t);
      return { ...project, run: { ...project.run, status: 'running', tasks } };
    });
  }

  async function fail(runId, error) {
    if (active !== runId) return;
    await write(project => {
      if (active !== runId) return;
      return { ...project, run: { ...project.run, status: 'failed', error: error.message,
        tasks: project.run.tasks.map(t => t.status === 'running'
          ? { ...t, status: 'failed', error: error.message }
          : t.status === 'queued' ? { ...t, status: 'cancelled' } : t) } };
    });
  }

  async function brief(text, attachedIds, refs) {
    await queue; // Include any selection or restore submitted immediately before this message.
    text = String(text).trim().slice(0, 3000);
    if (!text) return { message: 'What would you like to build?', plan: null };
    const previous = state.startFresh ? null : currentArtifact(state)?.plan;
    planning?.abort();
    const request = state.clarification ? state.clarification + ' — ' + text : text;
    if (!previous && !state.clarification && !/landing|website|page|app|tracker|dashboard|catalog|directory|portfolio|board|list|gallery|calendar|planner/i.test(text)) {
      active = null;
      await write(p => ({ ...p, clarification: text, pending: null, run: stopped(p.run, 'New brief') }));
      return { message: 'Should this be a landing page with one primary action, or an app where people work with a list?', plan: null };
    }
    const run = createRun(request);
    active = run.id;
    planning = new AbortController();
    try {
      const pinned = [...new Set([...state.selectedIds, ...attachedIds])];
      await write(p => ({ ...p, clarification: '', pending: null, run }));
      await task(run.id, 'references', 'running');
      const matches = retrieve(refs, request, [...new Set([...pinned, ...(previous?.referenceIds || [])])]);
      await task(run.id, 'references', 'succeeded', { detail: matches.map(m => m.title).join(', ') || 'No matching references' });
      await task(run.id, 'design', 'running');
      const sources = matches.map(m => refs.find(ref => ref.id === m.id));
      const plan = await planBuild({ brief: request, refs: sources, previous, signal: planning.signal });
      check(run.id);
      Object.assign(plan, { id: run.id, matches, request, pinned, baseVersion: previous ? state.currentVersion : null });
      await task(run.id, 'design', 'succeeded', { detail: plan.mechanism });
      await write(p => {
        check(run.id);
        return { ...p, pending: plan, run: { ...p.run, status: 'queued' } };
      });
      return { message: plan.mechanism, plan };
    } catch (error) {
      await fail(run.id, error);
      if (error.name === 'AbortError') return { message: 'This proposal was cancelled.', plan: null };
      throw error;
    }
  }

  async function build(direction, refs) {
    const proposal = state.pending;
    if (!proposal || state.run.status !== 'queued') return null;
    const runId = proposal.id;
    if (active === 'building:' + runId) return null;
    // Claim immediately so double-clicks cannot execute the writer twice.
    if (active && active !== runId) return null;
    active = 'building:' + runId;
    const token = active;
    try {
      await task(token, 'implementation', 'running');
      let plan = proposal;
      if (direction && direction !== proposal.direction) {
        const previous = state.versions.find(v => v.version === proposal.baseVersion)?.plan;
        const sources = proposal.matches.map(m => refs.find(r => r.id === m.id)).filter(Boolean);
        plan = { ...proposal, ...await planBuild({ brief: proposal.request, refs: sources, previous, direction, signal: planning?.signal }), id: runId, request: proposal.request, matches: proposal.matches, pinned: proposal.pinned, baseVersion: proposal.baseVersion };
      }
      const html = await compile(plan);
      await task(token, 'implementation', 'succeeded', { detail: html.length + ' characters generated' });
      await task(token, 'verification', 'running');
      const checks = await verify(html, plan);
      check(token);
      const version = (state.versions.at(-1)?.version || 0) + 1;
      const artifact = { version, id: crypto.randomUUID(), path: 'versions/' + version + '/index.html',
        runId, html, plan, checks, saved: Date.now() };
      await write(p => {
        check(token);
        const completedRun = { ...p.run, status: 'succeeded',
          tasks: p.run.tasks.map(t => t.id === 'verification' ? { ...t, status: 'succeeded', detail: checks.join(' · ') } : t) };
        artifact.run = completedRun;
        return { ...p, versions: [...p.versions, artifact], currentVersion: version,
          startFresh: false, pending: null, run: completedRun };
      });
      return artifact;
    } catch (error) {
      await fail(token, error);
      if (error.name !== 'AbortError') throw error;
      return null;
    } finally {
      if (active === token) active = null;
    }
  }
  function cancel(reason = 'Cancelled by designer') {
    active = null;
    planning?.abort();
    return write(p => ({ ...p, run: stopped(p.run, reason), pending: null }));
  }
  return {
    brief, build, cancel, read: () => state,
    select: ids => write(p => ({ ...p, selectedIds: ids })),
    resume() {
      if (state.run?.status === 'running') return cancel('Interrupted by reload');
      return Promise.resolve();
    },
    async restore(version) {
      if (!state.versions.some(v => v.version === version)) throw Error('Unknown version.');
      await cancel('Version restored');
      return write(p => ({ ...p, currentVersion: version, run: p.versions.find(v => v.version === version).run || null, startFresh: false, clarification: '' }));
    },
    async fresh() {
      await cancel('Starting another design');
      return write(p => ({ ...p, startFresh: true, clarification: '' }));
    }
  };
}
