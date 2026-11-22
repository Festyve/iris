---
tags: [aesthetic, component-systems]
aesthetic: component-systems
images: 3
---
# Component Systems and States

Reference systems for designing products that remain coherent at scale. The visual value comes from tokens, state completeness, predictable density and component composition rather than a single landing-page look.

## Palette

| Swatch | Hex | Role |
|---|---|---|
| ![](https://placehold.co/28x18/FFFFFF/FFFFFF.png) | `#FFFFFF` | base surface |
| ![](https://placehold.co/28x18/F4F4F4/F4F4F4.png) | `#F4F4F4` | secondary surface |
| ![](https://placehold.co/28x18/161616/161616.png) | `#161616` | primary text |
| ![](https://placehold.co/28x18/0F62FE/0F62FE.png) | `#0F62FE` | action and focus |
| ![](https://placehold.co/28x18/DA1E28/DA1E28.png) | `#DA1E28` | destructive and error |
| ![](https://placehold.co/28x18/198038/198038.png) | `#198038` | success |

## Type

Neutral UI sans with explicit type tokens. Labels, body, helper text and data values each have stable roles; density changes spacing before it sacrifices legibility.

## Signature moves

- Every control documents default, hover, focus, active, disabled, loading and error states
- Tokens connect colour, spacing, type, radius and elevation across platforms
- Components expose anatomy, behavior, content rules and accessibility guidance
- Dense enterprise patterns use alignment and grouping instead of decorative cards
- Examples show realistic composition, not isolated components only
- Themes preserve semantic roles rather than swapping arbitrary colours

## Best references

![IBM Carbon Design System overview and component illustration](../assets/research/systems/carbon.png)
![Material 3 design system with expressive tokens and components](../assets/research/systems/material-3.png)
![Adobe Spectrum design system documentation](../assets/research/systems/adobe-spectrum.png)

## Sources

- [Carbon Design System](https://carbondesignsystem.com/)
- [Material 3](https://m3.material.io/)
- [Adobe Spectrum](https://spectrum.adobe.com/)
- Research record: [[Web research 2026]]

## Use for

Enterprise products, multi-platform suites, admin tools, public services, design-to-code workflows and any product maintained by multiple teams.

## Avoid

- Treating a component library as a complete product design
- Missing loading, empty, error or permission states
- Token names tied to literal colours instead of semantic roles
- Excessive variants without clear usage rules

