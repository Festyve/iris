import { createOperation, publicUrl, safeError, text } from './common.mjs';

export function createTracing({ env, tracerootLoader = () => import('@traceroot-ai/traceroot') }) {
  const op = createOperation('traceroot', ['TRACEROOT_API_KEY'], env);
  if (env.TRACEROOT_ENABLED === 'false') op.update({ configured: false, state: 'unavailable', note: 'TRACEROOT_ENABLED=false' });
  const local = !env.TRACEROOT_API_KEY && env.TRACEROOT_LOCAL_CAPTURE === '1';
  let loading, collector;
  async function sdk() {
    if (!loading) loading = tracerootLoader().then(async module => {
      if (local) collector = await (await import('./local-otlp.mjs')).startLocalCollector();
      module.TraceRoot.initialize({ apiKey: env.TRACEROOT_API_KEY,
        baseUrl: publicUrl(env.TRACEROOT_HOST_URL || 'https://app.traceroot.ai', 'TRACEROOT_HOST_URL').origin,
        ...collector?.config, disableBatch: false, redact: () => ({}) });
      return module;
    }).catch(error => { collector?.close(); collector = null; loading = null; throw error; });
    return loading;
  }
  return {
    status: () => ({...op.status(), ...(local ? {mode:'local OTLP'} : {})}),
    async withTrace({ runId, taskId, receipt } = {}, fn) {
      const run = text(runId, 'runId', 120), task = text(taskId, 'taskId', 100);
      if (typeof fn !== 'function') throw new TypeError('withTrace requires an operation function.');
      if ((!local && !op.status().configured) || env.TRACEROOT_ENABLED === 'false') return fn();
      let module;
      try { module = await sdk(); }
      catch (error) { op.update({ state: 'error', error: safeError(error, 'TraceRoot').message }); return fn(); }
      let invoked = false, failed = false, value, failure;
      try {
        await module.observe({ name: `second-cursor.${task}`, type: 'tool', sessionId: run,
          captureInput: false, captureOutput: false }, async () => {
          invoked = true;
          try { value = await fn(); }
          catch (error) { failed = true; failure = error; throw new Error('Second Cursor task failed.'); }
          if (receipt) Object.assign(receipt, {
            id: module.getCurrentTraceId(), destination: local ? 'local OTLP' : 'TraceRoot Cloud',
            exported: false, ...(collector && {directory: collector.directory})
          });
          const attributes = {'second_cursor.operation':task};
          if (Array.isArray(value?.reviews)) attributes['second_cursor.persona_count']=value.reviews.length;
          if (Array.isArray(value?.data?.companies)) attributes['second_cursor.company_count']=value.data.companies.length;
          if (Array.isArray(value?.data?.citations)) attributes['second_cursor.citation_count']=value.data.citations.length;
          if (typeof value?.status === 'number') attributes['second_cursor.http_status']=value.status;
          if (value?.error) attributes['second_cursor.provider_failed']=true;
          module.updateCurrentSpan?.({attributes});
          return { outcome: value?.error ? 'provider_error' : 'success' };
        });
        op.update({ state: local ? 'local' : 'configured', lastOperation: task,
          note: 'SDK batch export enabled. Delivery is unconfirmed.' });
      } catch (error) { op.update({ state: 'error', error: safeError(error, 'TraceRoot').message }); }
      if (failed) throw failure;
      if (!invoked) return fn();
      return value;
    },
    async close() {
      if (!loading) return;
      let timer;
      try {
        await Promise.race([
          loading.then(module => module.TraceRoot.shutdown()),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Trace drain timed out')), 5000); })
        ]);
      } finally {
        clearTimeout(timer);
        collector?.close();
      }
    }
  };
}
