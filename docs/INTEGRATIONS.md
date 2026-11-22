# Sponsor integration map

Runtime evidence for the Second Cursor studio, 22 November 2026. A configured service has the inputs to attempt a call. A verified result records a successful operation. Codevisor tools and the application's server have separate credentials.

| Provider | Job | Evidence and runtime status |
| --- | --- | --- |
| Codevisor | Develop and verify the project, dispatch scoped repository work | **Verified dispatch and completion.** The actual ElevenAgent client tool submitted task `4fabbf20-3ba1-4dfd-824b-5a71219b9f7e` through the authenticated repo gateway. Its isolated worker committed Wasp regression tests in `b99b5fa`. The task-status tool returned that commit. We ran the tools programmatically without a microphone session. Git push to the team origin returned 403. |
| ElevenLabs | Speak the test question and transcribe it for Maritime | **TTS and Scribe verified.** Flash returned 32,644 bytes of audio. Scribe transcribed the question and Wasp returned the cited answer. Signed WebSocket issuance succeeded for Iris, the five-tool agent accessible to the supplied account. The six-tool agent in the project manifest returned 404 under this account. |
| assistant-ui | Floating conversation, attachments, plan approval, task and delivery cards | **Verified in Chromium.** Attached a selected note to a real runtime message and built and revised an artifact from its tool cards. Read-only Codevisor documentation queries also succeeded. |
| Fiber AI | Research the deployment partner and inform verification UI | Codevisor company lookup returned Maritime, YC ID `ycombinator_38061`. This informed the run ID, state and preview/log design. Studio runtime search still requires FIBER_API_KEY. [Lookup](evidence/partner-context.md) |
| Wasp | Persistent project records | **Verified Wasp 0.26.1 and SQLite.** Health, save, get and list returned 200. The browser journey saved Founder Workshop at archive revision 4. Wasp rejects stale writes with 409. The full HTML and reference images remain in IndexedDB. |
| Alter | Gate access to GitHub repository metadata | Fixed GET for Festyve/iris. The live local server denied other repositories and DELETE with HTTP 403. The scoped read returned 503 for missing ALTER_API_KEY and ALTER_GRANT_ID. Provider approval remains unverified. [Permission evidence](evidence/alter-repo.md) |
| TraceRoot | Trace typed questions from the studio bridge to Maritime | **SDK export verified locally.** The decoded OTLP span for the browser request has trace ID `276cc6ab5eea066653801a543c681662`. Cloud ingestion needs TRACEROOT_API_KEY. [Span evidence](evidence/repo-question-trace.json) |
| Expected Parrot | Grade answerable, ambiguous and outside-scope repo questions | **3/3 against deployed Wasp.** Local EDSL Survey and deterministic QuestionFunctional graded three real HTTP responses. Hosted persona critique still requires EXPECTED_PARROT_API_KEY. [Evaluation](evidence/repo-evaluation.json) |
| Rowboat | Linked design decisions and revision memory | Save/read operations scoped to the project decision file. Missing `ROWBOAT_MCP_URL`, `ROWBOAT_MCP_TOKEN` and `ROWBOAT_SPACE_ID`. |
| Maritime | Host the Wasp repository reader | **HTTPS verified.** Deployment `05353b5d-c310-40f5-a83f-ff721455a1bb` served health and an authenticated repo question with 200. Missing bearer returned 401 and the private archive returned 403. One server deployed. [Live health](https://1e4878ee-23cb-40bb-8140-c0ccfc27889f.mtm.sh/studio-api/repo/health) |
| Ploid | Audience research scoped to a brief | Audience search saves returned professional roles as a brief reference. Missing `PLOID_API_KEY`; no live search or outreach. |
| Keike | Partner listed in the organizer hacker package | Product and access could not be verified from organizer material. [Organizer check](evidence/partner-context.md) |

Gemini planning is an optional server-side runtime through authenticated `POST /studio-plan`. Its bounded plan feeds the same HTML compiler as local rules. Model output never becomes executable source. Missing `GEMINI_API_KEY` returned 503 in the route check. The completed browser journeys used local planning.

Official integration documentation: [ElevenLabs](https://elevenlabs.io/docs/), [assistant-ui](https://www.assistant-ui.com/docs/llm), [Fiber](https://docs.fiber.ai/build/mcp), [Wasp](https://wasp.sh/docs/getting-started/agent-integration), [Alter](https://docs.alterauth.com/mcp/), [TraceRoot](https://github.com/traceroot-ai/traceroot), [Expected Parrot](https://docs.expectedparrot.com/), [Rowboat](https://github.com/rowboatlabs/rowboat), [Maritime](https://maritime.sh/docs), [Ploid](https://ploid.com/documentation/mcp).

## Existing non-sponsor tools

GitHub, Exa, TinyFish and Vercel are connected in Codevisor. They can support source access, reference discovery, browser research and delivery. Figma's MCP needs sign-in, but the repository's local development plugin is a separate workflow. Neither a connected Vercel transport nor a public git clone proves deployment or push access for this team repository.

## Evidence to keep

For each runtime integration, retain a successful request identifier or trace, an input/output example, a screenshot/tool result in the demo, and the relevant failure state. Mark missing credentials as unavailable in the product. Keep model/provider secrets on the server.

Do not count logos, empty adapters, mocked responses or documentation queries as completed application integrations. Add a provider to the live journey once its result changes a useful decision or delivers an artifact.

## Runtime configuration

Keep server secrets in the ignored `.env`. Gemini uses `GEMINI_API_KEY`. ElevenLabs transcription uses `ELEVENLABS_API_KEY`, speech playback additionally uses `ELEVENLABS_VOICE_ID`, and conversational sessions require `ELEVENLABS_AGENT_ID`. Restart the server after changing credentials. Use the session link printed by the server for authenticated calls.
