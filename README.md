# Second Cursor — Figma cursor swarm

Edit a print-fair hero on desktop while an editable mobile composition updates beside it. Both the Figma plugin and the local browser prototype use the same layout engine.

## Launch the swarm

Open **ui.html** on a laptop, leave **100 cursors** selected, and click **Launch swarm**. The sample has five layers. Twenty workers each own the same role at different viewport sizes, forming 100 assignments across 20 layouts from 320 to 1440 pixels. Click a layout to zoom in. Pause and resume the run, or cancel to return to the desktop canvas. The 5- and 25-cursor options build smaller sets.

In Figma, select a product frame before running the plugin, or use the sample desktop it creates. Click **Launch swarm**. Colored pointer layers travel to their assignments as the plugin positions, sizes, and reveals editable design layers. The completed frames remain together on the page. Cancel removes only the current unfinished board. The agent arrows are temporary plugin-created layers. They do not require inviting other Figma accounts.

The sample uses an art-directed responsive layout. For custom frames the starting point uses native auto-layout or proportional geometry; each lane handles a group of top-level layers. The displayed assignment count reflects the actual number of occupied lanes. Extremely large selections need a smaller run.

With Gemini connected, each launch sends one source preview, indexed layer list and design direction to the model. Its plan assigns bounded edits by layer and viewport size. One art director coordinates the cursor workers. Disconnected runs use the local layout engine. To give a brief, type a direction before launch, or transcribe a voice note with ElevenLabs.

## Try it immediately

Open **ui.html** in a browser. Drag the title or flower, resize the flower, and compare Follow desktop, Stack, and Overlap. Keep this mobile version saves a snapshot below the browser canvas. These controls use local layout rules. Typed shortcuts such as “Keep the overlap and put the date at the top” work offline. Freeform art direction requires the AI service below.

## Run inside Figma

In Figma Desktop, open a design file. Choose **Plugins → Development → Import plugin from manifest** and select **manifest.json** from this folder. Run **Second Cursor** from the Development menu. With no frame selected, the plugin creates a fresh After Hours desktop frame and mobile proposal. With a frame selected, it opens the swarm controls for that frame.

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

Run `node --test tests/swarm.test.cjs` for timeline, role assignment, and responsive layout checks.
