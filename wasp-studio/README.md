# Second Cursor Wasp archive

An actual Wasp 0.26.1 app with a SQLite-backed design project archive. Wasp generates and serves the React archive page, Express APIs and Prisma database access. No hosted database or paid service is required.

## Run

Use Node 24.22.1 or newer. On this Mac, prepend `/Users/rehanjafar/.nvm/versions/node/v24.22.3/bin` to `PATH`.

```sh
cd wasp-studio
export npm_config_cache=/tmp/second-cursor-wasp-npm
wasp install
wasp db migrate-dev --name archive
sh start-local.sh
```

The archive UI is `http://127.0.0.1:3003`. The API uses port **3002**. For the studio's server-side adapter, set `WASP_BACKEND_URL=http://127.0.0.1:3002` in the root ignored environment file. Requests must come from loopback and use a localhost/loopback Host header. This is a local hackathon archive, not a public multi-user service. Add Wasp authentication before public deployment. Wasp 0.26 requires CLI flags for development ports; do not set `PORT` or `WASP_SERVER_URL` in `.env.server`.

In this restricted agent session the global Wasp directory cannot install its own Prisma dependencies. A writable copy of the already-installed official CLI was prepared at `/tmp/second-cursor-wasp-cli-archive/bin.js`; `start-local.sh` uses it when present. For other commands in this session use `node /tmp/second-cursor-wasp-cli-archive/bin.js compile` (or `db migrate-dev`). A normal user terminal can use the installed `wasp` directly. `WASP_CLI_JS` can explicitly select another writable CLI copy.

## API contract

- `GET /studio-api/health` -> `{provider:"wasp",status:"ready",storage:"sqlite",projects:number}`. This actually queries the database.
- `GET /studio-api/projects` -> `{provider:"wasp",projects:[{id,title,revision,createdAt,updatedAt}]}`.
- `GET /studio-api/projects/:id` -> `{provider:"wasp",id,revision,updatedAt,project}`; missing records return 404.
- `PUT /studio-api/projects/:id` accepts `{project:{...},expectedRevision?:number}` and returns the saved record. Use `expectedRevision:0` to create, the last returned revision for guarded updates, or omit for local last-write-wins storage. Conflicts return 409.

Project IDs are 1–80 letters, digits, underscores or hyphens. Metadata is limited to 64 KB and depth 16. Save reference IDs/decisions and version **manifests**; keep large HTML/image artifacts in the studio's own artifact store. Unknown nested data is stored as data and never executed.

For additional local protection, set `WASP_STUDIO_TOKEN` in `.env.server`; callers must then supply `Authorization: Bearer <token>`. Never put this token into a public client bundle. The root studio backend should proxy archive requests after its existing session authorization.

## Checks

```sh
node --test tests/validation.test.mjs
wasp compile
```

Database files remain under ignored `.wasp/`. Commit `migrations/` so a fresh clone can recreate the schema.
