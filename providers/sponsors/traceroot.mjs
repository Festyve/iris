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
        ...collector?.config, redact: () => ({}) });
      return module;
    }).catch(error => { loading = null; throw error; });
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
      let invoked = false, value, failure;
      try {
        await module.observe({ name: `second-cursor.${task}`, type: 'tool', sessionId: run,
          captureInput: false, captureOutput: false }, async () => {
          invoked = true;
          if (receipt) Object.assign(receipt, {id:module.getCurrentTraceId(), destination:local ? 'local OTLP' : 'TraceRoot Cloud', exported:false});
          try { value = await fn(); return { outcome: 'success' }; }
          catch (error) { failure = error; throw new Error('Second Cursor task failed.'); }
        });
        await module.TraceRoot.flush();
        if (receipt) Object.assign(receipt,{exported:true,...(collector ? {directory:collector.directory} : {})});
        // Flushing the SDK is not an independent receipt from the cloud dashboard.
        op.update({ state: local ? 'local' : 'configured', lastOperation: task, exportAttemptedAt: new Date().toISOString(),
          note: local ? 'SDK exported to a private local OTLP archive.' : 'SDK span flushed. Confirm ingestion in the TraceRoot dashboard before claiming cloud verification.' });
      } catch (error) { op.update({ state: 'error', error: safeError(error, 'TraceRoot').message }); }
      if (failure) throw failure;
      if (!invoked) return fn();
      return value;
    },
    async close() { if (loading) await (await loading).TraceRoot.shutdown(); collector?.close(); }
  };
}
