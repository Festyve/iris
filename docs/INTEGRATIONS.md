# Sponsor integration map

Runtime evidence for the Second Cursor studio, 22 November 2026. A configured service has the inputs to attempt a call. A verified result records a successful operation. Codevisor tools and the application's server have separate credentials.

| Provider | Job | Evidence and runtime status |
| --- | --- | --- |
| Codevisor | Develop and verify the project, dispatch scoped repository work | **Verified dispatch and completion.** The actual ElevenAgent client tool submitted task `4fabbf20-3ba1-4dfd-824b-5a71219b9f7e` through the authenticated repo gateway. Its isolated worker committed Wasp regression tests in `b99b5fa`. The task-status tool returned that commit. We ran the tools programmatically without a microphone session. Git push to the team origin returned 403. |
| ElevenLabs | Speak the test question and transcribe it for Maritime | **TTS and Scribe verified.** Flash returned 32,644 bytes of audio. Scribe transcribed the question and Wasp returned the cited answer. Both authenticated session routes issued signed WebSockets and received conversation initialization metadata. The root Iris agent currently exposes six canvas tools. The dedicated private studio agent exposes the six repository/design tools in ops/elevenlabs/agent-config.mjs. |
| assistant-ui | Floating conversation, attachments, plan approval, task and delivery cards | **Verified in Chromium.** Attached a selected note to a real runtime message and built and revised an artifact from its tool cards. Read-only Codevisor documentation queries also succeeded. |
| Fiber AI | Research the deployment partner and inform verification UI | Codevisor company lookup returned Maritime, YC ID `ycombinator_38061`. This informed the run ID, state and preview/log design. Studio runtime search also returned HTTP 200 for both name and domain filters. Chromium saved the maritime.sh result as a selected reference and confirmed it survived reload. [Lookup](evidence/partner-context.md) |
| Wasp | Persistent project records | **Verified Wasp 0.26.1 and SQLite.** Health, save, get and list returned 200. The browser journey saved Founder Workshop at archive revision 4. Wasp rejects stale writes with 409. The full HTML and reference images remain in IndexedDB. |
| Alter | Gate access to GitHub repository metadata | Fixed GET for Festyve/iris. The live local server denied other repositories and DELETE with HTTP 403. The scoped read returned 503 for missing ALTER_API_KEY and ALTER_GRANT_ID. Provider approval remains unverified. [Permission evidence](evidence/alter-repo.md) |
| TraceRoot | Trace typed questions from the studio bridge to Maritime | **Hosted ingestion verified.** The authenticated studio question returned trace ID `9afdee55e5187e9ae72b95311f8f603b`. TraceRoot Cloud returned HTTP 200 for GET `/api/v1/public/traces/9afdee55e5187e9ae72b95311f8f603b` with that ID and the operation `second-cursor.repo-question`. Earlier local export also passed. The decoded OTLP span for the browser request has trace ID `276cc6ab5eea066653801a543c681662`. [Span evidence](evidence/repo-question-trace.json) |
| Expected Parrot | Grade answerable, ambiguous and outside-scope repo questions | **3/3 against deployed Wasp.** Local EDSL Survey and deterministic QuestionFunctional graded three real HTTP responses. The authenticated persona-review route also completed hosted EDSL inference with HTTP 200 and three simulated critiques covering purpose clarity, keyboard navigation and visual hierarchy. [Evaluation](evidence/repo-evaluation.json) |
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

Keep server secrets in the ignored `.env`. Gemini uses `GEMINI_API_KEY`. ElevenLabs transcription uses `ELEVENLABS_API_KEY`, speech playback additionally uses `ELEVENLABS_VOICE_ID`, and conversational sessions use `ELEVENLABS_AGENT_ID` for root Iris and `ELEVENLABS_STUDIO_AGENT_ID` for the repository assistant. Restart the server after changing credentials. Use the session link printed by the server for authenticated calls.

## Studio server usage limits

Authenticated `GET /provider-usage` reports reservations and limits for the current UTC day. All local studio server instances under the same OS account share `~/.second-cursor/usage.sqlite`. A full bucket returns HTTP 429 with Retry-After before provider dispatch. Reservations count attempted requests, including failures and cancellations. Midnight UTC starts a new allowance.

| Operation | Upper bound |
| --- | --- |
| Model generation | 16,384 requested output tokens per UTC day across Gemini, Iris Claude calls and hosted design critique. Each Claude design attempt reserves 8,192 and a Claude visual critique reserves 1,536. One studio plan or poster edit reserves 1,536, a new editable screen reserves 4,096, and a three-persona review reserves 3 × 384. |
| Model context | 16 KiB of serialized user context for studio planning and review. Legacy Figma requests allow 32 KiB of text alongside the existing bounded screenshot input. Provider instructions, schemas and image accounting are additional. |
| ElevenLabs | 12 transcriptions, 24 speech requests and 4 signed session requests per day. |
| Codevisor | 4 repository task dispatch requests per day. |
| External project tools | 24 combined company, audience, memory and permission requests per day. |

Provider-managed conversation duration, downstream worker tokens, provider retries and account-wide billing require limits in the corresponding provider account. Local artifact generation and the Maritime read-only repo lookup consume no model reservation. Design reviews include compiler checks, button labels and reference feature tags. TraceRoot spans record operation counts and response status without sending note contents or critique text.
