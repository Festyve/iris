import { createFiber } from './fiber.mjs';
import { createPloid } from './ploid.mjs';
import { createRowboat } from './rowboat.mjs';
import { createAlter } from './alter.mjs';
import { createTracing } from './traceroot.mjs';
export { SponsorError } from './common.mjs';

// Server-only. Importing or constructing this module performs no network calls.
export function createSponsorHub({ env = process.env, fetchImpl = fetch, mcpFactory, alterFactory,
  tracerootLoader, alterActions, timeoutMs = 20_000 } = {}) {
  const options = { env, fetchImpl, mcpFactory, alterFactory, tracerootLoader, alterActions, timeoutMs };
  const fiber = createFiber(options), ploid = createPloid(options), rowboat = createRowboat(options),
    alter = createAlter(options), tracing = createTracing(options);
  return {
    status: () => [fiber, ploid, rowboat, alter, tracing].map(provider => provider.status()),
    companyContext: fiber.companyContext,
    audienceSearch: ploid.audienceSearch,
    saveDecision: rowboat.saveDecision,
    readMemory: rowboat.readMemory,
    scopedAction: alter.scopedAction,
    withTrace: tracing.withTrace,
    close: tracing.close
  };
}
