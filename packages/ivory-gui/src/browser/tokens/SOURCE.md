# LiqUIdify token provenance

The package vendors a minimal token subset from `tuliopc23/LiqUIdify` at revision `bc462c6e0bcc502938013b02c6434ac06c8350a0`, retrieved 2026-09-24. The upstream license is MIT. The full notice is in `packages/ivory-gui/THIRD_PARTY_NOTICE.md`.

## Upstream inventory

The machine-readable inventory is in `liquidify.source.json`. Each file is pinned by SHA-256 and line range.

| Upstream file | Verified range or declaration | Use here |
| --- | --- | --- |
| `styled-system/styles.css` | lines 90-91, 327-331, 349, 780-782, 790-792, 801, 804, 807-809, 811, 813-814, 825, 852-853, 892, 903, 907, 938-943 | selection, glass colors, blur, gray surface ramp, system accents, semantic text, radius, spacing, duration, easing, elevation-8 shadow |
| `panda.config.ts` | line 1651 | independent elevation-8 shadow confirmation |
| `libs/components/src/styles/panda.css` | lines 6-14, 40-61 | dark and light glass surface, border, text, and shadow overrides; no component recipe copied |
| `libs/components/src/styles/new-design-system.css` | lines 1-18, 151-158 | source context and typography boundary; no font layer copied |
| `LICENSE` | lines 1-21 | full MIT notice reproduced in the package notice |

## Transformation

`liquidify.generated.css` is a minimal derived subset. It does not contain the upstream reset, component recipes, font imports, or full generated stylesheet. No upstream URL is imported at runtime.

Each copied declaration is exposed as a `--verified-upstream-*` alias, scoped to the reversible `html[data-ivory-gui='prototype']` boundary. `ivory-semantic-tokens.css` resolves every ordinary semantic role through `var(--verified-upstream-<role>, <accessible fallback>)`, so the alias is the resolved value and the fallback is only used if the upstream sheet is absent.

## Accessibility exception

Upstream ships only 100/500/600 steps per hue and no darker step. On the light canvas its green (`#248A3D`, 3.53:1) and orange (`#C93400`, 4.09:1) cannot clear WCAG AA as small text. Those two aliases stay vendored as the record of the pinned values, but the light theme in `ivory-semantic-tokens.css` declines to consume them and uses the accessible Poteto values instead. The dark theme, where the 500-weight steps clear 8:1, consumes them normally.
