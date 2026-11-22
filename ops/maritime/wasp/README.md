# Wasp repository reader on Maritime

The Wasp routes serve a fixed, cited snapshot of Festyve/iris. The deployment package contains the generated Wasp server bundle, Prisma schema, pinned runtime dependency versions and Dockerfile. The archive database and studio credentials stay on the developer machine.

1. From `wasp-studio`, run `wasp compile`, then `(cd .wasp/out/server && npm run bundle)`.
2. From the repo root, run `node ops/maritime/wasp/package.mjs`. It prints the newly created temporary directory. Upload that directory with `maritime agents upload-source DIRECTORY --json`.
3. Use the returned upload key with `maritime agents create --stdin`, or `maritime deployments create --stdin` for an existing agent. Set the public port to 8080, the health path to `/studio-api/repo/health` and a secret `REPO_QUESTION_TOKEN` of at least 32 characters in the agent environment. The read-only image disables the project archive.
4. Set the same token and the HTTPS agent origin as `REPO_BACKEND_URL` in the studio's ignored root `.env`. For local SDK trace exports set `TRACEROOT_LOCAL_CAPTURE=1`. A server-side `TRACEROOT_API_KEY` selects hosted tracing instead.

`GET /studio-api/repo/health` reports ready status, provider, repo and commit. `POST /studio-api/repo/question` accepts JSON with a question (1–1000 characters) and requires `Authorization: Bearer <REPO_QUESTION_TOKEN>`. The response contains status, answer, repo, commit and citations with path, 1-based line and full commit SHA. Ambiguous and outside-scope questions have empty citations. Missing or invalid credentials return 401. Keep the read token on the ElevenAgents tool server or studio bridge.

In the private studio, open **Write a brief** and type `/repo Which command starts the studio locally?`. The answer appears in the assistant-ui thread. The reproducible browser check is `node --env-file=.env tests/browser/repo-question.mjs` after `npm run build:studio`. Set `CHROME_CHANNEL=chrome` to use installed Chrome.
