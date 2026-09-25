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

Upstream ships only 100/500/600 steps per hue and no darker step. A role is aliased only where that step clears WCAG AA as the text the prototype actually paints it in; everywhere else the bridge uses an accessible Poteto value and keeps the upstream alias vendored as the record of what was pinned.

The status roles are painted by `.ivory-status-pill`, which sets the label to the status colour itself over a 14% tint of that same colour, on the card. Every figure below is that painted pair, not the status value against the bare canvas. Measuring the wrong pair is how this table was wrong twice: an earlier draft credited upstream light orange with failing "on canvas" when it in fact clears there, and the dark steps were claimed to "clear 8:1" when the worst case is 3.19:1.

| Role | Theme | Upstream | Painted ratio | Poteto value | Result |
| --- | --- | --- | --- | --- | --- |
| `success` | light | `#248A3D` | 3.53:1 | `#2d6b48` | 4.98:1 |
| `warning` | light | `#C93400` | 4.09:1 | `#80560f` | 5.05:1 |
| `danger` | light | `#D70015` | 4.00:1 | `#a83e3e` | 4.79:1 |
| `success` | dark | `#34C759` | 4.38:1 | `#8fd0a8` | 5.13:1 |
| `warning` | dark | `#FF9500` | 4.42:1 | `#e0b878` | 5.01:1 |
| `danger` | dark | `#FF2D92` | 3.19:1 | `#f2b8b5` | 5.35:1 |

The dark accent is declined for a different reason. Upstream's `#007AFF` scores 4.24:1 on the canvas, 4.41:1 on the surface and 3.10:1 on the raised card, then 1.63:1 against the `#0056CC` accent-soft that Theia paints behind a selected row, missing the 3:1 non-text minimum. `#f0a583` clears all of them at 8.44, 8.79, 6.17 and 3.25.

`ivory-gui.spec.ts` measures each of these painted pairs, including the flattened alpha stack for the translucent dark surface and raised roles, and the pill assertions fail if any of the six status values is reverted to its upstream alias.

## Text on the accent fill

`--ivory-on-accent` is the label colour for the accent-filled button. It cannot reuse `--ivory-surface`: in the dark theme that alias is 60%-alpha glass, so a surface-coloured label composites over the accent and drops to 3.27:1. The role holds one flat colour per theme, `#f5f5f7` light and `#1c1c1e` dark, clearing AA on the accent (4.83:1 and 8.44:1) and on the ink hover background (16.92:1 and 17.01:1). Under high contrast it defers to `--theia-button-foreground`.

The status bar paints `--ivory-surface` on `--ivory-ink` and was measured the same way; it clears at 16.92:1 light and 4.74:1 dark, so it keeps using the surface role.

## High contrast

`body.theia-hc` and `body.theia-hcLight` map every colour role to a native Theia variable, including the status roles and `danger`, and drop the soft elevation (`--ivory-shadow: none`, `--ivory-radius: 0px`). Leaving the status roles unmapped let them inherit the ordinary light Poteto literals, which measure 3.31:1 and 3.26:1 on black and only 2.63:1 and 2.58:1 against Theia's own high-contrast canvas; a test now fails if any colour role is missing from that block. A browser probe confirms each of those variables resolves under all three themes, and that they follow the active theme rather than being hard-coded.

One caveat the review raised and the probe confirmed: Theia publishes the high-contrast palette through its theme plugin, so `--theia-editor-background` resolves to `rgb(30, 30, 30)` rather than pure black in the default dark HC theme. The mappings are correct either way because they defer to whatever Theia publishes.
