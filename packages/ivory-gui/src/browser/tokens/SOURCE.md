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

## Accessibility exceptions

Upstream ships only 100/500/600 steps per hue and no darker step. A role is aliased only where that step clears WCAG AA as the small text the prototype actually paints it in; everywhere else the bridge uses the accessible Poteto value and keeps the upstream alias vendored as the record of what was pinned.

| Role | Theme | Upstream | Measured | Decision |
| --- | --- | --- | --- | --- |
| `success` | light | `#248A3D` | 3.53:1 on canvas | Poteto `#2d6b48` |
| `warning` | light | `#C93400` | 4.09:1 on canvas | Poteto `#80560f` |
| `accent` | dark | `#007AFF` | 4.24 canvas, 4.41 surface, 3.10 card | Poteto `#e38b6c` |
| `success` | dark | `#34C759` | 4.38 on its 14% pill tint | Poteto `#8fd0a8` |
| `warning` | dark | `#FF9500` | 4.42 on its 14% pill tint | Poteto `#e0b878` |
| `danger` | dark | `#FF2D92` | 3.19 on its 14% pill tint | Poteto `#f2b8b5` |

Two of these were initially documented as passing on the strength of the token values rather than the painted result, and an independent review measured them in a real browser and found them below AA. `SOURCE.md` previously claimed the dark 500 steps "clear 8:1"; the measured worst case is 3.19:1. The corrections are in both theme blocks, and `ivory-gui.spec.ts` now measures the dark block against the same composited backdrops the browser uses, so the claim cannot drift again.

Upstream's dark green and orange do clear AA as ordinary body text on the dark canvas; they fail specifically as 10px/700 pill labels on the raised card, which is the only place those roles are painted.

## Text on the accent fill

`--ivory-on-accent` is the label colour for the accent-filled button. It cannot reuse `--ivory-surface`: in the dark theme that alias is 60%-alpha glass, so a surface-coloured label composites over the accent and drops to 3.27:1. The role holds the flat colours the two surfaces resolve to (`#f5f5f7` light, `#1c1c1e` dark), which clear AA on the accent (4.83:1 and 6.62:1) and on the ink hover background (14.71:1 and 17.01:1). Under high contrast it defers to `--theia-button-foreground`.

The status bar paints `--ivory-surface` on `--ivory-ink` and was measured the same way; it clears at 14.71:1 light and 4.74:1 dark, so it keeps using the surface role.

## High contrast

`body.theia-hc` and `body.theia-hcLight` map every colour role to a native Theia variable, including the status roles and `danger`, and drop the soft elevation (`--ivory-shadow: none`, `--ivory-radius: 0px`). Leaving the status roles unmapped let them inherit the ordinary light Poteto literals, which measure 3.06:1 and 3.02:1 on a black canvas; a test now fails if any colour role is missing from that block. A browser probe confirms each of those variables resolves under all three themes, and that they follow the active theme rather than being hard-coded.

One caveat the review raised and the probe confirmed: Theia publishes the high-contrast palette through its theme plugin, so `--theia-editor-background` resolves to `rgb(30, 30, 30)` rather than pure black in the default dark HC theme. The mappings are correct either way because they defer to whatever Theia publishes.
