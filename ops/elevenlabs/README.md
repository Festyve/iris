# Live ElevenAgents conversation

This is a real conversational agent connection, separate from voice-note transcription and reply playback.

The server needs `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` in its ignored environment. The key needs access to the configured ElevenLabs agent and conversation-session issuance. Keep the key out of browser code, prompts, logs and Git. An agent created through another account cannot be accessed by an unrelated key.

`studio/elevenagent-service.mjs` issues a new private-agent signed URL per conversation. The authenticated `POST /eleven-agent/session` route should return `createSession()` with `Cache-Control: no-store`. It must never return the API key.

`studio/ElevenAgent.jsx` owns a `ConversationProvider` and explicitly starts a WebSocket voice session. Its props are:

```jsx
<ElevenAgent
  token={localSessionToken}
  api=""
  onBrief={(brief, referenceIds) => controller.brief(brief, referenceIds, refs)}
  onBuild={direction => controller.build(direction, refs)}
  onCancel={() => controller.cancel()}
  getContext={() => ({ pending: project.pending, run: project.run })}
  onRepoTask={instruction => submitRealCodevisorTask(instruction)}
  onRepoTaskStatus={taskId => readRealCodevisorTask(taskId)}
/>
```

The component fetches repository context through authenticated `GET /repo-context`. Optional repository callbacks can override its defaults, `POST /repo-task` with `{instruction}` and `GET /repo-task-status?taskId=...`. An `api` function, if supplied instead of a URL prefix, receives `(path, fetchOptions)` and returns a standard Response or parsed result.

The six tool names and camelCase parameter schemas are defined in `agent-config.mjs`. Create client tools separately and attach their IDs under `conversation_config.agent.prompt.tool_ids`. Every tool must have `expects_response: true` so the agent awaits actual results. Do not mix deprecated inline `prompt.tools` with `tool_ids`.

The connected account has already created an agent for this project; do not create duplicates just to run the app. The component uses the agent ID configured on the server. Private authentication uses `platform_settings.auth.enable_auth: true`; do not also configure a hostname allowlist.

The user must choose Start and grant microphone access. End releases the SDK session. Microphone and reply muting are separate. Client actions validate inputs and return actual awaited receipts. A repository task receipt means submitted work; completion, tests, commit and push must be read from the real task-status result.

## Verify

```sh
node --test tests/elevenagent-service.test.mjs
```

Tests mock the remote API and exercise real local client-tool handlers. A successful signed-URL test or configured environment alone does not prove a live conversation. Final verification requires a microphone conversation in the browser and a client tool that demonstrably changes or reads the project.

Official references:

- https://elevenlabs.io/docs/eleven-agents/libraries/react
- https://elevenlabs.io/docs/api-reference/conversations/get-signed-url
- https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools
- https://elevenlabs.io/docs/eleven-agents/customization/authentication
