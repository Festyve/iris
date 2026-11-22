# Sponsor integration map

Runtime evidence for the Second Cursor studio, 22 November 2026. A configured service has the inputs to attempt a call. A verified result records a successful operation. Codevisor tools and the application's server have separate credentials.

| Provider | Job | Evidence and runtime status |
| --- | --- | --- |
| Codevisor | Develop and verify the project, dispatch scoped repository work | **Verified dispatch and completion.** The actual ElevenAgent client tool submitted task `4fabbf20-3ba1-4dfd-824b-5a71219b9f7e` through the authenticated repo gateway. Its isolated worker committed Wasp regression tests in `b99b5fa`. The task-status tool returned that commit. We ran the tools programmatically without a microphone session. Git push to the team origin returned 403. |
| ElevenLabs | Transcribe briefs and read design feedback | **Transport implemented, live calls unavailable.** Authenticated `/voice` and `/speech` use the Scribe and streaming TTS adapters. Upload, record, editable transcript, playback, mute and cancellation are wired. The registered private ElevenAgent has six client tools in `ops/elevenlabs/configured-agent.json`. Scribe, TTS and signed-session issuance returned 503 without the application key. No live speech session was verified. |
| assistant-ui | Floating conversation, attachments, plan approval, task and delivery cards | **Verified in Chromium.** Attached a selected note to a real runtime message and built and revised an artifact from its tool cards. Read-only Codevisor documentation queries also succeeded. |
| Fiber AI | Supply company context that changes a design | **Verified authoring-time lookup.** Company enrichment for `slug=y-combinator` returned HTTP 200, organization 167872, cost 2 credits. The optional founder-audience note stores the sourced observation. A tested founder landing page uses that note to put eligibility and Apply before program details. Runtime company search is wired to the library and requires `FIBER_API_KEY`. |
| Wasp | Persistent project records | **Verified Wasp 0.26.1 and SQLite.** Health, save, get and list returned 200. The browser journey saved Founder Workshop at archive revision 4. Wasp rejects stale writes with 409. The full HTML and reference images remain in IndexedDB. |
| Alter | Per-user, per-project grants for external actions | **Docs verified.** The connected MCP returned the multi-user broker guide. The runtime can verify the delegated GitHub account with a fixed scoped GET. Missing `ALTER_API_KEY` and `ALTER_GRANT_ID`; no live grant verified. |
| TraceRoot | Trace retrieval, planning, implementation and verification | SDK wired to bounded server operations with run/task IDs. Missing `TRACEROOT_API_KEY`. No cloud span ingestion verified. |
| Expected Parrot | Structured simulated-persona critique | EDSL environment installed. Per-version review UI, authenticated runner and structured critique storage implemented. Missing `EXPECTED_PARROT_API_KEY`; no hosted inference verified. |
| Rowboat | Linked design decisions and revision memory | Save/read operations scoped to the project decision file. Missing `ROWBOAT_MCP_URL`, `ROWBOAT_MCP_TOKEN` and `ROWBOAT_SPACE_ID`. |
| Maritime | Isolated remote builds and browser checks | Dispatcher defines 30 independent jobs and has five passing checks. The studio exposes a read-only CLI account check. Account unavailable; zero cloud jobs launched. Actual capacity and budget remain unverified. |
| Ploid | Audience research scoped to a brief | Audience search saves returned professional roles as a brief reference. Missing `PLOID_API_KEY`; no live search or outreach. |

Gemini planning is an optional server-side runtime through authenticated `POST /studio-plan`. Its bounded plan feeds the same HTML compiler as local rules. Model output never becomes executable source. Missing `GEMINI_API_KEY` returned 503 in the route check. The completed browser journeys used local planning.

Official integration documentation: [ElevenLabs](https://elevenlabs.io/docs/), [assistant-ui](https://www.assistant-ui.com/docs/llm), [Fiber](https://docs.fiber.ai/build/mcp), [Wasp](https://wasp.sh/docs/getting-started/agent-integration), [Alter](https://docs.alterauth.com/mcp/), [TraceRoot](https://github.com/traceroot-ai/traceroot), [Expected Parrot](https://docs.expectedparrot.com/), [Rowboat](https://github.com/rowboatlabs/rowboat), [Maritime](https://maritime.sh/docs), [Ploid](https://ploid.com/documentation/mcp).

## Existing non-sponsor tools

GitHub, Exa, TinyFish and Vercel are connected in Codevisor. They can support source access, reference discovery, browser research and delivery. Figma's MCP needs sign-in, but the repository's local development plugin is a separate workflow. Neither a connected Vercel transport nor a public git clone proves deployment or push access for this team repository.

## Evidence to keep

For each runtime integration, retain a successful request identifier or trace, an input/output example, a screenshot/tool result in the demo, and the relevant failure state. Mark missing credentials as unavailable in the product. Keep model/provider secrets on the server.

Do not count logos, empty adapters, mocked responses or documentation queries as completed application integrations. Add a provider to the live journey once its result changes a useful decision or delivers an artifact.

## Runtime configuration

Keep server secrets in the ignored `.env`. Gemini uses `GEMINI_API_KEY`. ElevenLabs transcription uses `ELEVENLABS_API_KEY`, speech playback additionally uses `ELEVENLABS_VOICE_ID`, and conversational sessions require `ELEVENLABS_AGENT_ID`. Restart the server after changing credentials. Use the session link printed by the server for authenticated calls.
