# Second Cursor design studio

Build a working landing page or small application from a brief and your own reference notes. The browser stores the vault snapshots, selected references and versioned HTML locally. The companion shows the source of each design decision and the result of each tool.

## Run locally

Use Node 24.22.1 or later and Wasp 0.26.1 for the studio with its SQLite project archive. On this machine the dependencies and archive database are installed. From this directory run:

```sh
npm start
```

For a fresh checkout, run `npm ci` and follow the initial database setup in [the Wasp archive runbook](wasp-studio/README.md). The launcher builds the studio and starts or reuses the local services. The archive API runs on port 3002 and its browser on 3003.

Open **http://localhost:4739/studio/**. For server-backed features, use the private studio link printed by the server. The fragment contains a temporary session key. The Iris browser adapter remains at **http://localhost:4739/** and the Figma development plugin still loads from `manifest.json`.

## Try the reference-to-build flow

1. Drop Markdown notes and their screenshots together, select a folder, or click **Load design-vault demo**. Open a reference to inspect its original note, linked images and attribution.
2. Select **Founder audience · YC** from the demo. Open **Write a brief**, attach the selected note, and enter `Build a landing page named "Founder Workshop" for a startup accelerator`.
3. Review the reference decisions and choose **Build plan**. Try **Apply** inside the preview to prepare a local application draft.
4. Ask `Set title to Founder Field Notes` and apply the plan. Download the self-contained HTML, reload the page or restore an earlier version.
5. For an app, use **New design** and try `Build a searchable app named "Field Index" for design references`. Add an entry and shortlist it. The studio saves the generated artifact. Entries typed inside its demo preview last for that preview session.

Local planning uses bounded rules, two compositions and a set of subject profiles. Gemini can choose a structured design plan when the server has `GEMINI_API_KEY`. The compiler produces the HTML, checks it, and renders it in isolated frames at 390 and 1024 pixels before saving a version. A failed or cancelled run keeps the previous deliverable.

**Talk to your repository** uses a private ElevenAgents WebSocket session. Its six client tools can inspect this project, propose and build a design, cancel a run, dispatch a Codevisor worktree task and read its result. The server signs sessions with `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID`. Successful dispatch returns a task ID; the completed task report identifies any code changes or commit.

Set secrets in the ignored `.env`. Scribe transcription requires `ELEVENLABS_API_KEY`. Spoken feedback also requires `ELEVENLABS_VOICE_ID`. The studio lets you edit a transcript in the companion before submitting it. Integration availability and evidence are recorded in [the integration map](docs/INTEGRATIONS.md).

The checked-in browser evidence shows the working companion, the revised mobile app, and the landing page informed by the founder reference. [Desktop build](docs/evidence/studio-desktop.png) · [Mobile revision](docs/evidence/studio-mobile.png) · [Founder landing](docs/evidence/founder-landing.png)

## Verify the studio

```sh
npm test
npx playwright install chromium
node tests/browser/journey.mjs
STUDIO_URL=http://localhost:4739/studio/ npx playwright test tests/vault.browser.spec.js
```

Start the built studio server first for browser checks. The journey script prints its temporary screenshot directory. To use an installed Chrome browser, set `CHROME_CHANNEL=chrome` for that script.

## Iris — Figma cursor swarm

Iris gives you a team of up to 100 visible cursors in Figma. Describe a new screen and watch them build editable layers, or select an existing frame to refine it and explore responsive layouts.

## Build a new UI

Open **Iris** on a blank Figma canvas, or choose **New UI from brief** in the swarm menu. Describe a screen and click **Build new UI**. Cursors assemble a separate editable Figma frame from named text and shape layers. Runs can be paused, resumed or canceled. New screens are placed beside existing work.

Local mode provides three distinct starters: a mobile transit screen, a task board, and a spending overview. Include a quoted name to name the product. For example, try `A mobile transit screen called "Northline"`. With the Gemini design service connected, a brief can specify an entirely different product, layout, viewport, palette and copy. Creating a screen sends just its brief to the planner. The output is an editable single-screen design.

The shared-canvas and responsive-grid cursor paths now run 2.5 times faster. A full shared-canvas run takes about six seconds of animation, excluding planning and editor overhead.

## Launch the swarm

Open **ui.html**, choose **Shared canvas** and **100 cursors**, then click **Launch swarm**. Numbered, color-tagged cursors enter in waves, visit layer positions, pause, and move to their next assignments. The panel shows the live active count. In Figma the pass runs on one editable working copy of the selected frame. The local pass snaps eligible layer positions to whole pixels. Voice and model planning are optional.

Choose **Responsive grid** to build breakpoint variants. The sample has five layers. Twenty workers each own the same role at different viewport sizes, forming 100 assignments across 20 layouts from 320 to 1440 pixels. Click a layout to zoom in. Pause and resume the run, or cancel to return to the desktop canvas. The 5- and 25-cursor options build smaller sets.

In Figma, select a product frame before running the plugin, or use the sample desktop it creates. Click **Launch swarm**. Colored pointer layers travel to their assignments as the plugin positions, sizes, and reveals editable design layers. The completed frames remain together on the page. Cancel removes only the current unfinished board. The agent arrows are temporary plugin-created layers. They do not require inviting other Figma accounts.

The sample uses an art-directed responsive layout. For custom frames the starting point uses native auto-layout or proportional geometry; each lane handles a group of top-level layers. The displayed assignment count reflects the actual number of occupied lanes. Extremely large selections need a smaller run.

With Gemini connected, each launch sends one source preview, indexed layer list and design direction to the model. Its plan assigns bounded edits by layer and viewport size. One art director coordinates the cursor workers. Disconnected runs use the local layout engine. To give a brief, type a direction before launch, or transcribe a voice note with ElevenLabs.

## Try it immediately

Open **ui.html** in a browser. Drag the title or flower, resize the flower, and compare Follow desktop, Stack, and Overlap. Keep this mobile version saves a snapshot below the browser canvas. These controls use local layout rules. Typed shortcuts such as “Keep the overlap and put the date at the top” work offline. Freeform art direction requires the AI service below.

## Run inside Figma

In Figma Desktop, open a design file. Choose **Plugins → Development → Import plugin from manifest** and select **manifest.json** from this folder. Run **Iris** from the Development menu. With no frame selected, the plugin opens in New UI from brief mode. The existing-frame modes can still launch the After Hours sample. With a frame selected, it opens the swarm controls for that frame.

Move or resize the desktop Title or Hero layer or edit the headline. A purple pointer marks the area under review in the mobile proposal. Keep this mobile version creates an independent editable Figma frame below the live proposal. The live proposal is regenerated on source changes. Edit the saved frame to refine it by hand. The prototype expects its five named layers.

## Enable AI and voice

Install Node.js 22 or later. Set **GEMINI_API_KEY** for freeform design direction and **ELEVENLABS_API_KEY** for spoken direction in your local environment, then run the command below from this folder. You can supply these variables in a local .env file using Node's --env-file flag. GEMINI_MODEL overrides the default gemini-2.5-flash. Choose a Gemini model supporting image input and structured responses.

```sh
node server.mjs
```

Open the browser URL printed in the terminal, or paste the printed session key into **Connect local AI service** in the Figma plugin. The server binds to 127.0.0.1. Keep the terminal open while using the service.

Try **“Keep the overlap. Put the date at the top and make the flower bigger.”** Enable AI review after desktop edits for automatic proposals, or use Ask coworker for individual requests. Each AI request sends a desktop PNG, its layer geometry, the current mobile controls and the direction to Gemini. The model can choose stacking or overlap, hero scale, text alignment and date position. Voice notes go to ElevenLabs Scribe on recording completion. If the host denies microphone access, use an audio file or type the direction.

## Source

Edit engine.js for the shared layout rules, figma.js for the native plugin, template.html and app.js for the UI, and server.mjs for the optional model service. After editing plugin or UI sources, run `node build.mjs` to regenerate plugin.js and ui.html. No npm dependencies are required.

## Verify

Run `node --test tests/*.test.cjs` to check screen generation, layer placement, cursor timing, role assignment and responsive layouts.
