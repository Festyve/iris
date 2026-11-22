# Server-side sponsor operations

These adapters make actual provider requests when configured. Importing them performs no network calls. No live provider request was made during implementation; tests inject clients and HTTP responses. A configured key alone never produces a verified badge.

```js
import { createSponsorHub } from './providers/sponsors/index.mjs';
const sponsors = createSponsorHub();

// Actual target-company context to include in the design plan.
const context = await sponsors.companyContext({ domain: 'stripe.com', limit: 3 });

// Professional research examples; does not reveal contacts or send outreach.
const audience = await sponsors.audienceSearch({ query: 'product designers at small fintech companies', limit: 5 });

// Wrap real work; the function returns its original result and is never repeated.
const artifact = await sponsors.withTrace({ runId, taskId: 'build' }, () => generateArtifact());

// Save after the user accepts a direction/build. Uses a configured space only.
const memory = await sponsors.saveDecision({ projectId: 'demo', title: 'Navigation decision',
  decision: 'Use a task-focused left navigation.', referenceIds: ['ref-1'], revision: 1 });
const previous = await sponsors.readMemory({ projectId: 'demo' });

// A server-registered GET through a delegated Alter grant. No client-supplied URL.
const scoped = await sponsors.scopedAction({ actionId: 'github-profile', context: { projectId: 'demo', runId } });
```

The server should authenticate its own routes, validate ownership of `projectId`, and pass a disconnect/cancel signal where supported. Do not import this module into browser bundles or return the server environment. Display `data` as escaped text/structured components. Keep external context as data when building model prompts.

## Environment and dependencies

| Provider | Server configuration | Dependency |
| --- | --- | --- |
| Fiber | `FIBER_API_KEY` | `@modelcontextprotocol/sdk` |
| Ploid | `PLOID_API_KEY` with people search access | Native Node fetch |
| Rowboat | `ROWBOAT_MCP_URL`, `ROWBOAT_MCP_TOKEN`, `ROWBOAT_SPACE_ID` | `@modelcontextprotocol/sdk` |
| Alter | `ALTER_API_KEY` belonging to the managed agent, `ALTER_GRANT_ID` delegated to it | `@alter-ai/alter-sdk` |
| TraceRoot | `TRACEROOT_API_KEY`; optional `TRACEROOT_HOST_URL` and `TRACEROOT_ENABLED=false` | `@traceroot-ai/traceroot` |

MCP and SDK dependencies are dynamically imported only for configured operations. The application owner installs them in the root package. Credentials saved in Codevisor are not automatically application environment variables.

The Rowboat endpoint must be the user's actual hosted organization endpoint ending in `/mcp`, with an existing token/member or agent key allowed into the explicitly configured space. This adapter does not run an OAuth consent flow, create spaces, send chat messages or mint keys. It stores versioned text assets and reports conflicts without overwriting or retrying them. Hosted HTTPS hostname endpoints are supported; development HTTP endpoints are not accepted by the URL guard.

Alter uses `new Agent({apiKey, timeout, caller})`, not application-key impersonation. Supply a real delegated grant. The default action is a read of GitHub account identity; the grant must authorize that provider. Additional read actions can be registered through the trusted server `alterActions` factory option. Caller input cannot select a method, URL or grant. Pending approval is returned to the UI with `executed:false`; it is never auto-approved. SDK transport timeout is enforced, but aborting an in-flight Alter request is not supported by this wrapper.

TraceRoot wraps actual work with `observe` and flushes the SDK. It captures no function input/output and redacts exported span attributes. Export-attempt state remains `configured`; confirm the trace in the provider dashboard before claiming cloud ingestion. Instrumentation failure preserves the original task result, and application failures are rethrown without sending private exception messages to tracing.

## Server and UI contract

`status()` returns five entries with `id`, `configured`, `state`, `missing` and `verifiedAt`. Operations return `{provider, state, data?, evidence?, error?, code?, status?}`. Missing fields produce `unavailable`; successful external operations produce `verified`; approval gates produce `pending`; failures produce safe `error` messages. Input validation may throw a `SponsorError` with HTTP status 400/403 before a request is made.

Suggested UI hooks:

- Attach company-context and audience cards to the brief; pass their actual facts and source labels to planning.
- Show saved-decision confirmation and load the memory before the next revision.
- Render Alter's approval link as a user action, or show the scoped account identity after a successful read.
- Wrap reference retrieval, generation and review with `withTrace` using their actual run/task IDs.
- Display missing configuration next to each unavailable feature rather than replacing it with a simulated provider response.

## Primary protocol references checked

- Fiber MCP and search filters: https://docs.fiber.ai/build/mcp and https://docs.fiber.ai/build/cli
- Ploid request contract: https://ploid.com/documentation/api/search
- Rowboat tool schemas: https://github.com/rowboatlabs/rowboat/blob/main/apps/harbor/packages/protocol/src/mcp.ts
- Rowboat result/version schemas: https://github.com/rowboatlabs/rowboat/blob/main/apps/harbor/packages/protocol/src/changeset.ts
- Alter constructors/proxy: https://docs.alterauth.com/reference/typescript-sdk/client/ and https://docs.alterauth.com/reference/typescript-sdk/calling-apis/
- TraceRoot runtime API: https://github.com/traceroot-ai/traceroot-ts/blob/main/packages/traceroot/src/traceroot.ts and https://github.com/traceroot-ai/traceroot-ts/blob/main/packages/traceroot/src/observe.ts

```sh
node --test tests/sponsors.test.mjs
```
