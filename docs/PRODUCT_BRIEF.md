# Second Cursor — product direction

Confirmed by Rehan on 22 November 2026.

## Product

A design UI AI assistant we would hire to take an idea from zero to a working product. Users give it a brief and their design library. It proposes useful features, selects references, builds a coherent interface, checks the result, and delivers an editable artifact and working preview.

The assistant is a small, characterful companion that stays nearby, inspired by Clippy. It can suggest a focused improvement or take ownership of the whole build. The library and the work should remain the center of the screen.

## Core journey

1. Drop screenshots, images, Markdown reference notes, or an exported Obsidian vault into the library. A local folder picker can provide ongoing vault access later. Record which files were imported.
2. Enter or speak a brief. Ask only for information that materially changes the build. Extract the intended audience, main task, deliverable, constraints and visual direction.
3. Retrieve relevant references from a feature-oriented index. Show which reference influenced hierarchy, navigation, forms, motion, onboarding or another specific decision.
4. Offer a small set of meaningfully different directions. Recommend one with a concrete reason. Support “build it” and smaller feature suggestions.
5. Execute research, layout, implementation and review tasks. Multiple cursors can make concurrent activity legible, with names, task ownership and true status.
6. Show a usable preview, editable code or Figma output, verification results, and an explanation of the reference decisions. Let the user request changes conversationally.

## Library contract

Use an Obsidian-compatible folder of Markdown and assets. The initial scaffold is `design-vault/`. References should carry a source URL, feature tags, date, relevant screenshot, a short observation and adaptation guidance. User-uploaded images stay associated with the note that explains them.

An Obsidian vault is the editable source of knowledge. A search index can be rebuilt from it. Start with metadata and text search. Add embeddings only if retrieval quality requires them. A large collection without useful classification will not reliably improve design.

For browser imports, drag-and-drop grants access to selected files. Reading an arbitrary local vault continuously requires a folder permission or a local service. Do not imply that attaching files grants access to the user's entire computer or ChatGPT Library.

Useful feature categories include navigation, onboarding, tables, search, filtering, forms, pricing, empty states, loading, errors, typography, responsive behavior, motion, accessibility and conversational tools.

## Design direction

Make the workspace feel like a working design studio. Let actual reference thumbnails, annotations and the live canvas provide visual character. Keep task controls compact and readable. The companion needs a useful presence without obscuring content. Respect reduced motion, keyboard navigation and a pause/cancel control.

Apply the existing `design-distinctive-ui` guidance. Its Zirui Zhao research separates inferred principles from source code and supplies original implementation patterns. Use reference mechanisms and permitted assets rather than copying unlicensed code, fonts or artwork.

## Existing code and boundaries

The repository currently contains a working vanilla JavaScript Figma plugin and browser prototype. It supports editable responsive layouts, visible layout-worker cursors, optional Gemini direction and ElevenLabs speech transcription. Four swarm tests passed during setup.

The prototype is narrower than the product vision. It does not yet implement vault ingestion, a general-purpose UI feature library, assistant-ui chat, arbitrary app generation or verified deployment. Preserve it as the first editable canvas/output adapter.

assistant-ui is React-based. A React companion surface can host the reference library, floating conversation and tool cards while reusing the existing layout engine. Wasp is a candidate shell for that companion's persistence/auth/backend. Confirm the installed Wasp version and current docs before scaffolding; do not regenerate the Figma plugin as a Wasp app.

## Hackathon build order

1. Keep the current demo runnable and establish the assistant's real voice/model credentials.
2. Ship reference import, browsing and retrieval, plus a floating assistant that can explain its selected references.
3. Connect one real build/edit tool. Produce a preview, run checks, accept one revision and preserve the result.
4. Add TraceRoot tracing and one Expected Parrot simulated critique if credentials are ready.
5. Extend company context, durable memory, permissions and remote execution through the sponsor adapters in `INTEGRATIONS.md`.

Maintain a complete main path while increasing sponsor coverage. Each additional provider should improve an actual step and have visible evidence of use.

## Two-minute demo target

- 0:00–0:20 — Show the brief and drag three references into the library.
- 0:20–0:40 — Speak a design request. Show selected references and the proposed direction.
- 0:40–1:15 — Start the build. Show task cursors tied to real work and an editable preview appearing.
- 1:15–1:40 — Show critique/checks, request one change and demonstrate the resulting edit.
- 1:40–2:00 — Open the delivered preview/artifact and show saved design decisions plus actual integration results.

Use simulated-persona feedback as simulated feedback. Describe deterministic layout workers accurately when they are driven by one model plan.
