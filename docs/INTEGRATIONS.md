# Sponsor integration map

Setup snapshot, 22 November 2026. Roles below are implementation targets unless the status explicitly says verified. Connecting an MCP documentation server gives the coding assistant documentation; it does not put that provider into the application.

| Provider | Concrete job | Verified setup / remaining work | Official source |
| --- | --- | --- | --- |
| Codevisor | Build and revise the project with visible coding work and checks | Repo registered locally and project chat opened. Codex harness authenticated. Existing four tests pass and generated build succeeds. Git push was attempted and returned HTTP 403, permission denied to `rehanjafar`. Check repository collaborator access and Git credential permissions. | https://codevisor.dev/ |
| ElevenLabs | Spoken briefs, spoken feedback and transcription | Existing `server.mjs` implements Scribe transcription. Application needs `ELEVENLABS_API_KEY`. Codevisor's hosted ElevenLabs connector currently needs attention; a raw API key used as its OAuth bearer token failed a live request. | https://elevenlabs.io/docs/ |
| assistant-ui | Floating conversation, attachments and real tool progress cards | Codevisor documentation MCP connected at `https://www.assistant-ui.com/mcp`, seven tools. Live `search_docs` succeeded. React runtime/components still need application integration. | https://www.assistant-ui.com/docs/llm |
| Fiber AI | Retrieve target-company and audience context that informs the design brief | Codevisor MCP connected at `https://mcp.fiber.ai/mcp/v2`. Authenticated credit request succeeded with 2,500 credits available and zero used at setup. Application adapter not implemented. | https://docs.fiber.ai/build/mcp |
| Alter | Scope external actions to the active user/project and show approvals where appropriate | Read-only Alter Docs MCP connected at `https://mcp.alterauth.com/mcp`, 14 tools. Runtime app/agent identity, credentials and grants still required. | https://docs.alterauth.com/mcp/ |
| Wasp | Companion web app with saved projects, reference records, auth and backend actions | Installed CLI verified at version 0.26.1. No Wasp app has been scaffolded in this vanilla-JS repo. Use the current agent-integration docs. | https://wasp.sh/docs/getting-started/agent-integration |
| TraceRoot AI | Trace brief → reference retrieval → build → critique, including failures and latency | Need project/API key and SDK wiring. Official JS SDK is `@traceroot-ai/traceroot`. No application tracing verified. | https://github.com/traceroot-ai/traceroot |
| Expected Parrot | Run structured simulated-persona reviews of a proposed UI and return actionable critique | Need Expected Parrot/model access and an EDSL review job. No live review verified. | https://docs.expectedparrot.com/ |
| Rowboat Labs | Preserve linked design decisions, brand constraints and revision history across builds | Suitable Markdown-memory architecture. Hosted team integration requires an actual organization address and OAuth. No team endpoint or runtime integration configured. | https://github.com/rowboatlabs/rowboat |
| Maritime | Execute generated-app builds and browser checks in isolated remote computers | Need account/API key and an explicitly chosen compute budget. No remote computer created. | https://maritime.sh/docs |
| Ploid | Identify relevant public professional audiences or potential research participants when the brief needs it | Hosted MCP is `https://api.ploid.com/mcp`, with workspace-scoped OAuth. Needs user sign-in/approval and an actual use case. No search or outreach performed. | https://ploid.com/documentation/mcp |

## Existing non-sponsor tools

GitHub, Exa, TinyFish and Vercel are connected in Codevisor. They can support source access, reference discovery, browser research and delivery. Figma's MCP needs sign-in, but the repository's local development plugin is a separate workflow. Neither a connected Vercel transport nor a public git clone proves deployment or push access for this team repository.

## Evidence to keep

For each runtime integration, retain a successful request identifier or trace, an input/output example, a screenshot/tool result in the demo, and the relevant failure state. Mark missing credentials as unavailable in the product. Keep model/provider secrets on the server.

Do not count logos, empty adapters, mocked responses or documentation queries as completed application integrations. Add a provider to the live journey once its result changes a useful decision or delivers an artifact.

## Next credentials and setup

1. Configure the existing app's `GEMINI_API_KEY` and `ELEVENLABS_API_KEY` through an ignored local `.env` or deployment secret settings.
2. For trace/critique coverage, obtain TraceRoot project access and Expected Parrot inference access.
3. For broader sponsor coverage, provide the team's Rowboat organization address and configure Alter, Maritime and Ploid through their official account flows.
4. Wire Fiber through a server-side provider adapter or an approved agent tool gateway. A key stored in Codevisor is not implicitly an application environment variable.

Use a separate configured/unavailable/verified status for each provider. Never silently substitute fabricated external results.
