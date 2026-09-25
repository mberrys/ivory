# LiqUIdify token provenance

The package vendors a minimal token subset from `tuliopc23/LiqUIdify` at revision `bc462c6e0bcc502938013b02c6434ac06c8350a0`, retrieved 2026-09-24. The upstream license is MIT. The full notice is in `packages/ivory-gui/THIRD_PARTY_NOTICE.md`.

## Upstream inventory

The machine-readable inventory is in `liquidify.source.json`. Each file is pinned by SHA-256 and line range.

| Upstream file | Verified range or declaration | Use here |
| --- | --- | --- |
| `styled-system/styles.css` | lines 90-91, 327-331, 349, 749, 753, 755, 767, 771, 776, 778, 780-782, 789-792, 800-801, 803-804, 806-809, 811, 813-814, 825-826, 852-853, 892, 903, 907, 938-943 | selection, glass colors, blur, gray surface ramp, system accents, semantic text, radius, spacing, duration, easing, elevation-8 shadow |
| `panda.config.ts` | line 1651 | independent elevation-8 shadow confirmation |
| `libs/components/src/styles/panda.css` | lines 6-14, 40-61 | dark and light glass surface, border, text, and shadow overrides; no component recipe copied |
| `libs/components/src/styles/new-design-system.css` | lines 1-18, 151-158 | source context and typography boundary; no font layer copied |
| `LICENSE` | lines 1-21 | full MIT notice reproduced in the package notice |

## Transformation

`liquidify.generated.css` is a minimal derived subset. It does not contain the upstream reset, component recipes, font imports, or full generated stylesheet. No upstream URL is imported at runtime.

Each copied declaration is exposed as a `--verified-upstream-*` alias, scoped to the reversible `html[data-ivory-gui='prototype']` boundary. `ivory-semantic-tokens.css` resolves every ordinary semantic role through `var(--verified-upstream-<role>, <accessible fallback>)`, so the alias is the resolved value and the fallback is only used if the upstream sheet is absent.

### Deviations

Two vendored scale tokens are recorded for provenance but deliberately not consumed, and the deviation is intentional:

- `--verified-upstream-duration` is `0.15s` upstream; the prototype's shell timing is the tighter `160ms` from the Poteto scale, and the shell does not read the alias.
- `--verified-upstream-easing` is the upstream `cubic-bezier(0.25, 0.1, 0.25, 1)`-family curve; the prototype uses `cubic-bezier(0.2, 0, 0, 1)`, which is the Poteto curve. Adopting the upstream curve would change motion, not just its source, so the shell keeps its own value and the alias stays as the record of what was pinned.

Every other vendored alias is consumed by the semantic bridge, and `ivory-semantic-tokens.spec.ts` fails if any vendored alias lacks a recorded `<path>:<line> <variable>` source.

## Accessibility exception

Upstream ships only 100/500/600 steps per hue and no darker step. On the light canvas its green (`#248A3D`, 3.53:1) and orange (`#C93400`, 4.09:1) cannot clear WCAG AA as small text. Those two aliases stay vendored as the record of the pinned values, but the light theme in `ivory-semantic-tokens.css` declines to consume them and uses the accessible Poteto values instead. The dark theme, where the 500-weight steps clear 8:1, consumes them normally.
