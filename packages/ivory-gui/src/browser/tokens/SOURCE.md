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

The status roles are painted by `.ivory-status-pill`, which sets the label to the status colour itself over a 14% tint of that same colour, on the card (`--ivory-surface-raised` over the dashboard's canvas). Every figure below is that painted pair, measured over the card, not the status value against the bare canvas. Getting this wrong is how this table was wrong twice before: an earlier draft credited upstream light orange with failing "on canvas" when it in fact clears there, and the dark steps were claimed to "clear 8:1" when the worst case is 2.38:1.

| Role | Theme | Upstream alias | Upstream, painted | Poteto value | Poteto, painted | Poteto on canvas |
| --- | --- | --- | --- | --- | --- | --- |
| `success` | light | `#248A3D` | 3.69:1 | `#2d6b48` | 5.18:1 | 6.08:1 |
| `warning` | light | `#C93400` | 4.27:1 | `#80560f` | 5.24:1 | 6.18:1 |
| `danger` | light | `#D70015` | 4.16:1 | `#a83e3e` | 4.97:1 | 5.88:1 |
| `success` | dark | `#34C759` | 4.23:1 | `#8fd0a8` | 4.96:1 | 9.52:1 |
| `warning` | dark | `#FF9500` | 4.27:1 | `#e0b878` | 4.78:1 | 9.15:1 |
| `danger` | dark | `#FF2D92` | 3.05:1 | `#f2b8b5` | 5.12:1 | 9.96:1 |

The "painted" columns are the status colour on its own 14% tint over that theme's card - `#ffffff` in light, `#373739` in dark. The last column is the same colour on the bare canvas, and it is there to make one thing visible: the two backdrops rank the upstream steps very differently. Upstream light orange and light green both clear 4.5:1 on the canvas and fail only on the tint, while upstream dark magenta fails on both. So the exception is a per-backdrop judgement, not a per-hue one, and reading the canvas column alone would pick the wrong three roles to keep.

The three light upstream steps miss the 4.5:1 text minimum on the card, and all three dark steps miss it by a wide margin, so every status role declines its alias in both themes. Upstream light orange is the near miss at 4.27:1: it clears comfortably on the bare canvas (5.28:1) and only fails on the tint it is actually painted over, which is why the exception is a per-backdrop judgement rather than a per-hue one.

The dark accent is declined for a different reason, as non-text rather than text. Upstream's `#007AFF` scores 4.24:1 on the canvas, 4.41:1 on the surface and 2.96:1 on the raised card, missing the 3:1 non-text minimum by 0.04. `#f0a583` clears all three at 8.44, 8.79 and 5.89.

`ivory-gui.spec.ts` measures each of these painted pairs, including the flattened alpha stack for the translucent dark surface and raised roles, and the pill assertions fail if any status value is reverted to its upstream alias. The tint percentage is read from the stylesheet per role rather than assumed, so changing the queued pill's 14% to 40% fails the suite even though the ready pill's is untouched.

## Non-text contrast

WCAG 1.4.11 requires 3:1 for anything that identifies a control or conveys state. Six roles in this package are painted as non-text, and five of them decline their upstream aliases because it cannot be met there. Every translucent figure is composited over the surface that role is actually painted on, not flattened once against the canvas and compared with a different surface.

| Role | Theme | Upstream | Measured against | Shipped | Result |
| --- | --- | --- | --- | --- | --- |
| `border` | light | `#E5E5EA` | 1.20 canvas, 1.15 surface, 1.26 card | `#84848c` | 3.55 / 3.41 / 3.71 |
| `border` | dark | 8% white | 1.26 / 1.24 / 1.28 | 42% white | 4.02 / 4.08 / 3.49 |
| `focus` | dark | `#007AFF` | 2.96 card, 1.63 selection | `#8fc0ff` | 6.31 card, 9.04 canvas |
| `accent-soft` | light | `#D1E9FF` | 1.15 panel, 1.25 card, 1.20 canvas | `#0090ca` | 3.30 / 3.59 / 3.44 |
| `accent-soft` | dark | `#0056CC` | 2.70 panel, 1.81 card, 2.60 canvas | `#0090ca` | 4.93 / 3.30 / 4.73 |
| `border-on-ink` | dark | `--ivory-accent` | 2.02 on the white bar fill | `#5a5a60` | 6.85 |
| `surface-raised` | light | `#FAFAFA` | 1.00 against its own canvas | `#ffffff` | 1.04 fill, 3.71 via the border |

Three of these need explaining, because the shipped value is not simply "darker" or "lighter".

**The light raised fill** still measures 1.04:1 against the canvas, and that is deliberate. Upstream's light canvas and light raised surface are both `#FAFAFA`, so a light card had no fill separation at all and was bounded only by a 1.20:1 border: an invisible rectangle. The border now carries the separation at 3.71:1, and `ivory-gui.spec.ts` asserts that a card is separated by its fill *or* its border, never by a 1px line nobody can see.

**The 42% dark border** clears 3:1 on all three backdrops. The binding case is the card at 3.49:1, since it is the darkest of the three. 34% fails there at 2.81:1; 37% passes at 3.05:1 and was rejected because a value that close to the minimum leaves no room for an upstream nudge.

**The selection fill** is the hardest constraint in the package, because Theia paints a selection on more than one surface. List and menu-bar selections sit on the panel, quick-input and menu selections on the raised card, and in the dark theme those two surfaces are `#18181a` and `#373739` - only 1.49:1 apart. A fill has to be 3:1 from both while the label on it stays at 4.5:1, which leaves a narrow band; `#0090ca` is the value that clears both themes at their worst surface, and it is used in both so the selection does not change hue between them. A white label reaches only 3.59:1 on it, so the label is near-black, which is why `--ivory-on-accent-soft` exists: body ink is 5.13:1 on the fill in the light theme but only 3.59:1 in the dark one, so neither the body ink nor white works for both.

The selection fill previously came straight from Theia's own palette, which is the same value in both themes and fails the same way, so this is an inherited defect that the activation has to override rather than one the package introduced.

## The selected row, which Theia paints three ways

`packages/core/src/browser/style/tree.css` paints a selected tree row from two rules that target the same node. Under `:focus-within` it sets the fill, the label **and** `outline: var(--theia-focusBorder) solid 1px` together; without focus it sets a different fill and label. So the fill is never the only thing marking the row, and the general focus colour is not usable as the ring on top of the selection fill - it is 1.82:1 in the light theme and 1.91:1 in the dark one. The selected state therefore gets its own ring colour:

| Pair | Backdrop | Ratio |
| --- | --- | --- |
| ring `#002e6e` on the fill, both ordinary themes | `#0090ca` | 3.62:1 |
| label on the fill | `#0090ca` | 5.51:1 |
| unfocused fill on the panel, light / dark | `#f5f5f7` / `#18181a` | 3.30:1 / 4.93:1 |

A Chromium run measured 3.44:1 for the light panel rather than 3.30:1, because the live sidebar composites `--ivory-surface` over the canvas instead of using the flat `#f5f5f7` token. The table gives the flat token so it can be recomputed; the proof script reports what the browser paints.

The unfocused row takes the same fill as the focused one. A quieter step is not available: the label on it falls below 4.5:1 and so does the ring. The two states are told apart by the presence of the ring, not by a different colour.

Both roles are declared on the themed `body`, never on `html`. Theia sets its own values for them on the element carrying the theme class, so a declaration on `html` is inherited and loses regardless of source order. A live probe showed the rule sitting in `bundle.css` while the value still resolved to Theia's native `#37373D`.

### High contrast cannot carry this on a fill

The HC themes cannot reach 3:1 with a selection fill at all, and that is a property of high contrast rather than a gap in the palette. Their selection fill is Theia's own `#094771` on the `#252526` sidebar, which is 1.57:1, and no darker fill does better without abandoning the dark background those themes exist to provide. HC signals state with a boundary instead, so the unfocused HC selected row gets a 1px `outline` in the native focus colour, which measures 3.64:1 on the sidebar against it. The focused HC row keeps the Ivory ring in `--theia-foreground` (`#cccccc`, 6.08:1 on the fill), because HC's `--theia-focusBorder` is `#007fd4` and only reaches 2.32:1 there.

That boundary is scoped to `.theia-Tree:not(:focus-within)`. Without the guard it outranks the focused ring and drags it back to 2.32:1, which a live probe caught.

The 22% focus halo cannot reach 3:1 by itself. It supplements the 2px outline rather than replacing it, and is asserted only to remain visible rather than decorative, with its percentage read from the stylesheet.

## Text on the accent fill

`--ivory-on-accent` is the label colour for the accent-filled button. It cannot reuse `--ivory-surface`: in the dark theme that alias is 60%-alpha glass, so a surface-coloured label composites over the `#f0a583` accent to `#6d4f43` and drops to 3.65:1. The role holds one flat colour per theme, `#f5f5f7` light and `#1c1c1e` dark, clearing AA on the accent (6.02:1 light against the `#0056CC` the alias resolves to, 8.44:1 dark) and on the ink hover background (16.92:1 and 17.01:1). Under high contrast it defers to `--theia-button-foreground`.

The status bar paints `--ivory-surface` on `--ivory-ink` and was measured the same way; it clears at 16.92:1 light and 4.74:1 dark, so it keeps using the surface role.

## High contrast

`body.theia-hc` and `body.theia-hcLight` map every colour role to a native Theia variable, including the status roles and `danger`, and drop the soft elevation (`--ivory-shadow: none`, `--ivory-radius: 0px`). Leaving the status roles unmapped let them inherit the ordinary light Poteto literals, which measure 3.31:1 and 3.26:1 on black and get worse, not better, against Theia's own high-contrast canvas of `rgb(30, 30, 30)`: 2.63:1 and 2.58:1; a test now fails if any colour role is missing from that block. A browser probe confirms each of those variables resolves under all three themes, and that they follow the active theme rather than being hard-coded.

One caveat the review raised and the probe confirmed: Theia publishes the high-contrast palette through its theme plugin, so `--theia-editor-background` resolves to `rgb(30, 30, 30)` rather than pure black in the default dark HC theme. The mappings are correct either way because they defer to whatever Theia publishes.
