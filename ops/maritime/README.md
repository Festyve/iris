# Thirty isolated Maritime jobs

This prepares 30 real assignments: four optional provider-adapter implementers and 26 independent reviews. It has not launched any cloud agents. Codevisor remains the integration owner. Never point several workers at one local checkout.

## Requirements established from official docs

Individual Codex agent boxes can use `maritime create second-cursor --template codex --count 30 --idle 600`. This command **provisions billable persistent resources**; it is shown for review and has not been executed. The `create --count` contract was checked with CLI help and a one-item CLI dry-run.

Boxes still count toward concurrent-awake capacity. The current published trial allows 2, Starter 5, Growth 25 and Scale 60. A hackathon grant may differ; check the actual account. Thirty tasks can instead be queued on fewer boxes, but that is not 30 agents running concurrently.

The separate Swarms service requires Scale/Dedicated or a grant and rents a server at $1/minute. It is not the default here. Model credits are separate from compute credit. Each box must have its own model setup or funded Maritime proxy. This tooling never copies local ChatGPT/Codex login files.

Sources checked 22 November 2026:
- https://maritime.sh/docs/cli
- https://maritime.sh/docs/billing
- https://maritime.sh/docs/persistent-sandboxes
- https://maritime.sh/docs/frameworks/codex
- https://maritime.sh/docs/swarms

## Safe commands

Node 22+. Install the official `maritime-cli`, or set `MARITIME_BIN` to the cached installed executable.

```sh
node ops/maritime/dispatch.mjs
node ops/maritime/dispatch.mjs preflight --config /path/to/maritime-config.json
node --test ops/maritime/dispatch.test.mjs
```

The default prints all assignments and starts nothing. Preflight calls only `whoami`, `billing status` and `usage get`, removes credential-shaped fields from output and does not purchase, upgrade or provision. Authentication was unavailable during development, so actual account limits/balances and authenticated response shapes remain unverified.

## Dispatch after access and budgets are verified

Publish the source commit first. Cloud workers cannot fetch unpushed laptop changes. Prepare two private files outside tracked source:

`agents.json`: exactly 30 distinct, already-provisioned boxes:

```json
[
  { "id": "actual-agent-id", "modelReady": true, "disposableWorkspace": true }
]
```

`approval.json`: account evidence reviewed within 15 minutes. Values must come from actual account/budget verification. This example intentionally cannot pass:

```json
{
  "approved": false,
  "verifiedAt": "",
  "maxAgents": 30,
  "availableAwakeSlots": 0,
  "modelAuthentication": "already-configured-per-box",
  "maxComputeUsd": 0,
  "maxModelUsd": 0,
  "availableComputeCreditUsd": 0,
  "availableModelCreditUsd": 0,
  "computeBudgetEnforced": false,
  "modelBudgetEnforced": false,
  "autoTopupDisabled": false
}
```

This script does **not** create provider-side hard spending caps. If the account cannot enforce them, execution stays blocked. Do not turn the evidence flags on merely to bypass this check. Repository permissions, funding, capacity and box model authentication are separate requirements.

```sh
node ops/maritime/dispatch.mjs dispatch --execute \
  --repo https://github.com/Festyve/iris.git \
  --commit FULL_PUBLISHED_COMMIT_SHA \
  --agents /private/path/agents.json \
  --approval /private/path/approval.json \
  --config /private/path/maritime-config.json

node ops/maritime/dispatch.mjs collect \
  --run ops/maritime/runs/ACTUAL_RUN_DIRECTORY \
  --config /private/path/maritime-config.json
```

Execution uses the verified `agents chat --stdin` command. It writes each submission receipt before moving on. A retained delivery ID proves acceptance, not completion or concurrency. `collect` reads exact retained receipts using `agents chat-result`; it never resends uncertain work. Unknown billing eligibility fields fail closed pending inspection of the actual API response.

Worker patches remain in their separate branches/clones. The integration owner reviews and applies them. No worker receives repository push credentials. Persistent boxes keep their disks and can continue incurring storage/box charges after sleep, so review ownership and retention before stopping/deleting resources; this dispatcher does not delete cloud data.
