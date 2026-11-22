---
tags: [home]
---
# Iris reference vault

A design-reference library for the Iris agent and for humans. Open this folder as an Obsidian vault, or browse it on GitHub.

Iris reads it in three ways:
1. **Profiles** in `Profiles/` are selectable house styles (panel dropdown, or say "switch to Terminal Monk"). The chosen profile's brief and 3 reference images are sent to the screen generator, the swarm art director and the critique.
2. **find_references** (voice tool) searches every note here by keyword.
3. Humans browse the aesthetic notes for inspiration before briefing Iris.

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
- New profile: copy a file in `Profiles/`, change `id`, `name`, `tagline` and `refs` (paths relative to the vault), then rerun `npm run agent` so the voice agent knows it.
- New references: drop images in `assets/` and embed them in a note.

Images are collected for internal reference only and keep links to their original creators. Don't ship them inside a product.
