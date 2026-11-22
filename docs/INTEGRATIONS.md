# Sponsor integration map

Runtime evidence for the Second Cursor studio, 22 November 2026. A configured service has the inputs to attempt a call. A verified result records a successful operation. Codevisor tools and the application's server have separate credentials.

| Provider | Job | Evidence and runtime status |
| --- | --- | --- |
| Codevisor | Develop and verify the project, dispatch scoped repository work | **Verified for development.** The branch includes separate vault, compiler, companion and integration commits. Git push to the team origin returned 403. |
| ElevenLabs | Transcribe briefs and read design feedback | **Transport implemented, live calls unavailable.** Authenticated `/voice` and `/speech` use the Scribe and streaming TTS adapters. Upload, record, editable transcript, playback, mute and cancellation are wired. Both routes returned safe 503 errors without keys. |
| assistant-ui | Floating conversation, attachments, plan approval, task and delivery cards | **Verified in Chromium.** Attached a selected note to a real runtime message and built and revised an artifact from its tool cards. Read-only Codevisor documentation queries also succeeded. |
| Fiber AI | Supply company context that changes a design | **Verified authoring-time lookup.** Company enrichment for `slug=y-combinator` returned HTTP 200, organization 167872, cost 2 credits. The optional founder-audience note stores the sourced observation. A tested founder landing page uses that note to put eligibility and Apply before program details. |
| Wasp | Persistent project records | Installed Wasp 0.26.1 and evaluated its current React, Node and database shell. The core studio runs with IndexedDB and the existing Node server. Backend synchronization is tracked below. |
| Alter | Per-user, per-project grants for external actions | **Docs verified.** The connected MCP returned the multi-user broker guide. Runtime requires an app identity, grants and credentials. |
| TraceRoot | Trace retrieval, planning, implementation and verification | Requires a project and API key. Local task records are available in the studio. |
| Expected Parrot | Structured simulated-persona critique | Requires inference access and an EDSL runner. No live critique has been verified. |
| Rowboat | Linked design decisions and revision memory | Requires the team's organization endpoint and authentication. Local project versions retain decision history. |
| Maritime | Isolated remote builds and browser checks | Local dispatch tooling is being prepared separately. No cloud computers or remote agent runs verified. Account, capacity and budget are prerequisites. |
| Ploid | Audience research scoped to a brief | Requires workspace access. No outreach performed. |

Gemini planning is an optional server-side runtime through authenticated `POST /studio-plan`. Its bounded plan feeds the same HTML compiler as local rules. Model output never becomes executable source. Missing `GEMINI_API_KEY` returned 503 in the route check. The completed browser journeys used local planning.

Official integration documentation: [ElevenLabs](https://elevenlabs.io/docs/), [assistant-ui](https://www.assistant-ui.com/docs/llm), [Fiber](https://docs.fiber.ai/build/mcp), [Wasp](https://wasp.sh/docs/getting-started/agent-integration), [Alter](https://docs.alterauth.com/mcp/), [TraceRoot](https://github.com/traceroot-ai/traceroot), [Expected Parrot](https://docs.expectedparrot.com/), [Rowboat](https://github.com/rowboatlabs/rowboat), [Maritime](https://maritime.sh/docs), [Ploid](https://ploid.com/documentation/mcp).

## Existing non-sponsor tools

GitHub, Exa, TinyFish and Vercel are connected in Codevisor. They can support source access, reference discovery, browser research and delivery. Figma's MCP needs sign-in, but the repository's local development plugin is a separate workflow. Neither a connected Vercel transport nor a public git clone proves deployment or push access for this team repository.

## Evidence to keep

For each runtime integration, retain a successful request identifier or trace, an input/output example, a screenshot/tool result in the demo, and the relevant failure state. Mark missing credentials as unavailable in the product. Keep model/provider secrets on the server.

Do not count logos, empty adapters, mocked responses or documentation queries as completed application integrations. Add a provider to the live journey once its result changes a useful decision or delivers an artifact.

## Runtime configuration

Keep server secrets in the ignored `.env`. Gemini uses `GEMINI_API_KEY`. ElevenLabs transcription uses `ELEVENLABS_API_KEY`, speech playback additionally uses `ELEVENLABS_VOICE_ID`, and conversational sessions require `ELEVENLABS_AGENT_ID`. Restart the server after changing credentials. Use the session link printed by the server for authenticated calls.
