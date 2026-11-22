# Alter delegated GitHub metadata read

The application check on 2026-11-22 returned `state: "unavailable"` with `missing: ["ALTER_API_KEY", "ALTER_GRANT_ID"]` after loading the workspace’s ignored `.env`. The adapter stopped before SDK construction. There was no Alter runtime call, GitHub response, approval ID, or provider audit receipt for this run. The connected Alter Docs MCP successfully returned the proxy API and local MCP guides.

## Caller contract

Use the server-side sponsor hub. The required context is the exact repository name. The optional method must be uppercase GET. Optional audit labels are nonempty strings of at most 120 characters each. The adapter rejects extra input or context fields for this action and fixes the destination to `https://api.github.com/repos/Festyve/iris`.

```js
await hub.scopedAction({
  actionId: 'github-iris-metadata',
  context: {
    repo: 'Festyve/iris',
    method: 'GET',
    projectId: 'studio',
    runId: 'run-1',
    taskId: 'repo-metadata'
  }
});
```

Scope violations throw a synchronous `SponsorError` with HTTP 403 and code `action_not_allowed`. The adapter passes locally allowed requests to `Agent.proxyRequest` with the server-configured grant ID. This single-grant adapter assumes the caller has access to that grant through the enclosing server. Audit labels do not authenticate callers or select another user's grant.

| Result | Meaning |
| --- | --- |
| `verified` | The SDK returned HTTP 200 with complete metadata for the exact repository. Read `result.data.data` for `full_name`, `default_branch` and `private`. The evidence timestamp comes from the application clock. |
| `pending` | Alter returned an approval request. `result.data.executed` is false and `result.evidence.verifiedAt` is null. The adapter exposes the approval ID and includes the link only when it passes its Alter HTTPS host check. |
| `error` | The SDK failed, the upstream rejected the call, or the metadata failed validation. The adapter omits upstream response bodies and headers from errors. |
| `unavailable` | The result lists missing server configuration. |

## Reproduction

Run the actual adapter from the project root with a managed-agent key carrying proxy execution scope and its delegated GitHub grant. Configure the grant for GET on the exact repository metadata endpoint. The installed SDK is `@alter-ai/alter-sdk` 0.34.1. [Alter SDK proxy API](https://docs.alterauth.com/reference/typescript-sdk/calling-apis/)

```sh
node --env-file=.env --input-type=module <<'JS'
import { createSponsorHub } from './providers/sponsors/index.mjs';
const result = await createSponsorHub().scopedAction({
  actionId: 'github-iris-metadata',
  context: { repo: 'Festyve/iris' }
});
console.log(result);
JS
```

Local checks passed with `node --test tests/alter-repo.test.mjs tests/sponsors.test.mjs` (14 tests). The repository tests inject a recording client and construct SDK result objects from fixtures. They cover the exact outgoing GET and grant, wrong repository, wrong method, destination and grant overrides, missing grant, filtered fields, pending approval links, and invalid provider results. They establish application policy and response handling. Live grant enforcement remains unverified.

## Supported local and connector options

- The connected hosted Alter Docs MCP exposes documentation and setup tools. Alter’s runtime MCP guide describes running a separate local Python server with a managed-agent key and a delegated grant. A GitHub connector read would exercise the GitHub connector’s own identity. [Alter runtime MCP guide](https://docs.alterauth.com/guides/integrate-with-claude-code-mcp/)
- The Alter CLI was absent from PATH. Its runtime commands require a runtime key. An operator can dry-run policy decisions with an authenticated CLI session and a grant ID using `alter policy simulate`. A simulation returns a policy verdict without contacting GitHub. [CLI runtime authentication](https://docs.alterauth.com/reference/cli/commands/sdk-passthrough/) · [Policy simulation](https://docs.alterauth.com/reference/cli/commands/policy/)
