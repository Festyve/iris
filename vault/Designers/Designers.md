---
tags: [designers, research]
---
# Designers behind the profiles

The [[Profiles]] use anonymous names. Each one is a composite of the public work of designers and studios below, not an imitation of any one person. Iris should borrow principles, never copy a specific person's portfolio or brand.

## Canon (public, well documented)
| Designer / studio | Known for | Feeds profile |
|---|---|---|
| Dieter Rams (Braun) | "Less, but better"; ten principles of good design | [[knob-and-switch]], [[general]] |
| Teenage Engineering | OP-1 and TX-6 hardware, labelled glyph grids, one orange accent | [[knob-and-switch]] |
| Josef Müller-Brockmann, Massimo Vignelli | International Typographic Style, grid systems, Helvetica | [[grid-purist]] |
| Susan Kare | Original Macintosh icons and bitmap type | [[mixtape]] |
| Apple Human Interface team | iOS 26 / visionOS Liquid Glass materials | [[glasswright]] |
| Linear's design team | Dark, precise developer-tool UI | [[quiet-engineer]] |
| Rauno Freiberg (Vercel) | Interaction design and craft essays at rauno.me | [[quiet-engineer]] |
| Emil Kowalski | Design engineering and animation (Sonner, Vaul, emilkowal.ski) | [[quiet-engineer]], [[Motion and Interaction]] |
| Paco Coursey | Minimal personal sites and the cmdk command menu | [[quiet-engineer]] |
| Adel Faure | ASCII and text-mode art (adelfaure.net) | [[terminal-monk]] |
| Lucas Pope, ditherpunk community | 1-bit dithering as an art style (see Surma's "Ditherpunk") | [[terminal-monk]] |
| Gumroad's brand team | Mainstream neo-brutalist web | [[concrete]] |
| Fashion and hospitality studios on Savee / Cosmos | Serif-led editorial web | [[atelier]] |

## Live research (Fiber AI), Nov 22, 2026
Five natural-language people searches through Fiber AI returned 48 people; the full tables are in [[Fiber results]]. How each cluster feeds the anonymous profiles:

| Fiber cluster | Who came back | Feeds profile |
|---|---|---|
| product-leads | Design directors and principal designers at Stripe, Figma, Airbnb and Apple | [[general]], [[calm-ledger]] |
| design-engineers | Design engineers at Resend, Expo, Evervault and YC startups, including the author of the "Better UI" skill linked in [[X posts]] | [[quiet-engineer]], [[Motion and Interaction]] |
| studios | Founders and creative directors of European product studios | [[atelier]], [[grid-purist]] |
| type-brand | Type and identity designers who also design for screens | [[grid-purist]], [[atelier]] |
| mobile | No matches (query too narrow) | none |

Takeaways the profiles encode: the design-engineer crowd ships interaction quality (tight motion, keyboard-first, 1px detail), so [[quiet-engineer]] stresses those. Studio and type people lean on typographic scale and grids, so [[grid-purist]] and [[atelier]] lead with type.

### Re-running
Run `npm run fiber` with `FIBER_API_KEY` set. The results land in `fiber-designers.json` and the generated note [[Fiber results]]. They hold public professional fields only: name, role, company, headline and LinkedIn. No emails or phone numbers.
