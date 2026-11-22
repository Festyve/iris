---
tags: [home]
---
# Iris reference vault

A design-reference library for the Iris agent and for humans. Open this folder as an Obsidian vault, or browse it on GitHub.

How it plugs into Iris:
1. **Profiles** in `Profiles/` are selectable house styles. Each has a brief, colour tokens, type and layout rules, and 3 reference images, written so a designer model can follow them.
2. **Aesthetic notes** collect references by style, each image linked to its source.
3. The wiring that sends a chosen profile and its images to the designer, plus a `set_profile` voice tool, was built on the pre-rebuild code and lives on the `feat/elevenlabs-voice-agent` branch. Porting it into `designer.mjs` is a follow-up.

## Profiles
| Profile | Style |
|---|---|
| [[general]] Iris House | Balanced, product-appropriate defaults |
| [[glasswright]] The Glasswright | Liquid glass |
| [[terminal-monk]] Terminal Monk | ASCII, dither, mono |
| [[quiet-engineer]] The Quiet Engineer | Developer-tool minimalism |
| [[grid-purist]] Grid Purist | Swiss grid |
| [[concrete]] Concrete Club | Neo-brutalism |
| [[knob-and-switch]] Knob & Switch | Tactile hardware |
| [[calm-ledger]] Calm Ledger | Calm fintech dashboards |
| [[mixtape]] Mixtape 98 | Retro OS and Y2K |
| [[candy-lab]] Candy Lab | Playful, clay, mascots |
| [[atelier]] Atelier Noir | Editorial luxury |
| [[night-bloom]] Night Bloom | Dark aurora glow |
| [[tile-smith]] Tile Smith | Bento and colour-blocked tiles |

## Aesthetics
[[Liquid Glass]] · [[ASCII and Dither]] · [[Minimal Tech]] · [[Swiss Grid]] · [[Brutalism and Neo-Brutalism]] · [[Tactile and Skeuomorphic]] · [[Fintech and Dashboards]] · [[Retro OS and Y2K]] · [[Bento Grids]] · [[Aurora, Gradients and Glow]] · [[Playful and Clay]] · [[Mobile App Patterns]] · [[Editorial and Luxury]] · [[Motion and Interaction]]

## Sources
- [[X posts]]: 13 posts the team curated, with 3 video frames each
- [[Tools and libraries]]: galleries, component libraries and taste skills
- [[Designers]]: the people and studios behind the profiles
- `assets/pinterest/<aesthetic>/`: 336 Pinterest references (each note links the pin and original source)
- `assets/sites/`: 22 full-page screenshots of reference sites
- `assets/user/`: images the team added by hand

## Adding to the vault
- New profile: copy a file in `Profiles/`, change `id`, `name`, `tagline` and `refs` (paths relative to the vault), then update whatever reads profiles (see point 3 above).
- New references: drop images in `assets/` and embed them in a note.

Images are collected for internal reference only and keep links to their original creators. Don't ship them inside a product.
