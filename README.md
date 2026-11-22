# Iris — a crew of cursors that designs

Describe any product and Claude designs it. Then describe changes in plain words and Claude makes them. Every time, hundreds of cursors do the work on the canvas, in the browser or live in your Figma file. They drag out frames, draw and fill shapes, round corners, snap cards into place and type every word. On a change they only touch what changes: moving, recolouring, retyping, deleting and adding.

## What the cursors do

| Task | What the cursor does |
| --- | --- |
| **Frame** / **Paint** | Drags out each screen and floods its background (or resizes and repaints it) |
| **Draw** | Drags out shapes with a live W × H readout |
| **Fill** | Clicks a shape and a colour ripple fills it (on a change, the new colour ripples over the old one) |
| **Round** | Pulls the corner handle to the new radius |
| **Align** | Drags containers onto the grid while smart guides snap; on a change, moves things to their new place, and their contents ride along |
| **Type** | Types each string with a caret; on a change, selects the old text and types the new |
| **Icon** / **Trace** | Places icons and draws chart lines |
| **Delete** | Selects a removed layer and it fades out |

Containers finish before anything that sits on them, and a small change gets a small crew.

## How it works

1. **Claude designs a document, not pixels.** Claude Opus 5.5 returns a flat list of nodes (frames, text, icons, images, shapes, lines). Each node names its parent and describes layout like flexbox: rows, columns, grids, gaps, padding, alignment and fill/hug sizing. `layout.js` computes exact geometry, so spacing and alignment come out clean however long the copy is. There are 90+ built-in stroke icons.
2. **Every node has a stable id.** For a change, Claude gets the current document and returns a patch: `set`, `add`, `remove`, `move` or `addScreen`. It never regenerates the whole design, so everything you didn't ask about stays exactly as it was.
3. **The crew plays the difference.** `crew.js` compares the old and new boards and schedules only the work needed. The browser and Figma replay the same timeline.
4. **Your own edits count.** In Figma, before each change, the plugin reads the frames back. Text you retyped, colours you changed, layers you deleted or resized, and positions inside absolute (stack) containers all become part of the design Claude edits.
5. **Versions.** Every build and change is a version. Undo/redo (⌘Z / ⇧⌘Z) or pick one in the Versions panel, and the crew animates the canvas back or forward to it.

## Set up Claude

Install Node.js 22 or later, then in this folder:

```sh
npm install
ANTHROPIC_API_KEY=sk-ant-... node server.mjs
```

You can also put the key in a `.env` file and run `node --env-file=.env server.mjs`. Open the printed browser URL, or paste the printed session key into ⚙ in the browser or the Figma plugin. Set `ELEVENLABS_API_KEY` too if you want to speak briefs instead of typing.

The server uses `claude-opus-5-5` with adaptive thinking, structured JSON output and server-side refusal fallback. A new design usually takes a minute or two; a change takes seconds to a minute.

**Without Claude**, Iris still works: the built-in kit turns any brief into a themed seven-screen product (five phone screens, a dashboard and a landing page), and the crew builds it. Changes need Claude.

## Use it

**Browser:** open **ui.html**. A demo build starts right away.
- Pick a crew size (50–1,000), type a brief and press **Build**.
- Once Claude is connected, the prompt switches to **Edit**: describe a change and press **Apply**. Click the pill to go back to **New**.
- Drag to pan. Pinch or Ctrl/⌘ + scroll to zoom. Double-click a screen to focus it, and press **F** to fit.
- Space plays and pauses, the arrow keys step through time and **R** replays. Drag the timeline to scrub.
- **Export SVG** downloads the board.

**Figma Desktop:** choose **Plugins → Development → Import plugin from manifest** and pick **manifest.json**, then run **Iris**. The crew builds native, editable frames. Each node is tagged with its design id, and the design is saved on the page, so you can close the plugin, edit by hand, reopen it and keep changing the design with words. Cancelling a first build removes it. Cancelling a change finishes it instantly, so nothing is left half-edited. Crews of up to 250 cursors are available in Figma.

## Talk to Iris (ElevenLabs)

Iris is also a voice design partner. Press the gradient mic in **Talk to Iris** and just talk: "design a loyalty app for a coffee shop called Bean", "what do you think of this screen?", "make the order button bigger", "undo that". An ElevenLabs agent listens and answers out loud, and its tools drive the studio: it searches the reference vault, builds new designs, critiques what you have selected (Claude looks at the exported frame), makes changes, steps through versions and pauses or cancels the crew.

Figma plugins can't open the microphone, so in Figma press **Open voice in browser**. The voice session runs in that browser tab, and the plugin listens on the local server's `/bridge`, so every build and change lands in your Figma file.

Setup, once: put `ELEVENLABS_API_KEY` in `.env.local`, then

```sh
npm install
npm run agent   # creates the Iris voice agent and saves its id to .iris-agent.json
npm start       # builds, then starts the server with .env / .env.local
```

The agent runs on `gemini-3.5-flash` with the Sarah voice; edit `scripts/agent.mjs` and run `npm run agent` again to change its prompt, voice or tools. Reference search reads `./vault` or the folder in `IRIS_VAULT`.

## Source

| File | Role |
| --- | --- |
| `layout.js` | Design document: validation, flexbox-style layout, patches, import from the kit, merging Figma edits |
| `icons.js` | Built-in stroke icon set |
| `designer.mjs` | Claude prompts, output schemas and validation |
| `server.mjs` | Local service: Claude Opus 5.5 (Anthropic SDK), ElevenLabs transcription, voice sessions, the plugin bridge and critique |
| `voice.js` + `voice-entry.js` | Talk to Iris: the ElevenLabs voice agent client and its tools |
| `scripts/agent.mjs` | Creates or updates the ElevenLabs agent |
| `crew.js` | Task graph for builds and diffs, cursor scheduling, sampling any moment of a run |
| `kit.js` | Local designer used without Claude |
| `screen-spec.cjs` | Board format and screen arrangement |
| `studio.js` + `template.html` | Browser studio and plugin panel |
| `figma.js` | Figma plugin: plays runs with native layers, stores and reads back the design |

After editing sources, run `npm run build` to regenerate **plugin.js** and **ui.html**.

## Verify

```sh
npm test
```

The tests cover the layout engine, patches, kit import and Figma read-back merging. They check that every task in a build or an edit runs exactly once and in order, and that runs end exactly on the new design. They also run the Claude designer flow and the Figma plugin against stand-ins for the API and for Figma: a build, then a change that edits nodes in place and keeps a manual edit, then a restore.
