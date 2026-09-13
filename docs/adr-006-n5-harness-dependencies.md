# ADR-006 — Keep the N5 plugin-host surface out of the V1 application

Status: accepted (2026-09-13). Applies to the N5 experiment harness (Phase 6 of the N1–N7 closeout);
ADR-002 §"Decision"'s plugin-host prohibition stands for the V1 application unchanged.
Evidence: N5 graft on `ivory/n5-qualification`; `scripts/n5/check-boundaries.mjs`;
`docs/experiments/n5-theia-client-equivalence.md`.

## Context

The N5 spike (Theia shell and external-client equivalence) needs an extension host: the N5 shell scans
and validates the locked candidate VSIX set through `@theia/plugin-ext` /
`@theia/plugin-ext-vscode`, and `packages/ivory-n5-shell/src/node/module.ts` composes a candidate
scanner (`packages/ivory-n5-shell/src/node/scanner.ts`) over the stock plugin model. That makes two
plugin-host packages visible in the dependency inventory.

ADR-002 is explicit: *"V1 application manifests do not include plugin-host packages, plugin startup
flags, or runtime installation paths."* The N5 browser assembly (`examples/ivory-n5-browser`,
`@ivory-tower/n5-browser`) exists to observe client equivalence against the canonical Core API; it is
an experiment harness, not a V1 deployable.

## Decision

1. `@theia/plugin-ext` and `@theia/plugin-ext-vscode` remain **experiment-harness dependencies only**.
   They are inventoried in `configs/ivory-dependency-policy.json` with purposes that name the N5
   experiment harness, and `deployables` in that file is unchanged (`ivory-api`, `ivory-worker`,
   `ivory-browser`). `examples/ivory-n5-browser` is **not** a V1 deployable, and the V1 application
   manifest gains no plugin-host package, startup flag, or installation path. ADR-002's prohibition
   is not weakened.
2. The harness deliberately omits the extension registry and shared plugin directories. The N5
   application manifest carries no `@theia/vsx-registry`, no legacy `@ivory-tower/health` widget, and
   no shared `theiaPluginsDir`.
3. Enforcement is a gate, not a convention. `scripts/n5/check-boundaries.mjs` (run by
   `npm run test:n5`) asserts the harness shape:
   - it cross-checks the hardcoded candidate versions in
     `packages/ivory-n5-shell/src/node/scanner.ts` against
     `examples/ivory-n5-browser/extensions.lock.json`, so a scanner/artifact drift fails the gate;
   - it rejects an N5 application that carries `@theia/vsx-registry`, `@ivory-tower/health`, or a
     shared `theiaPluginsDir`;
   - it allowlists the client/shell imports, so the portable client cannot reach framework, storage,
     or process APIs.
4. The extension version/license/compatibility matrix is an **N5 evidence deliverable** (recorded in
   `docs/experiments/n5-theia-client-equivalence.md` and `extensions.lock.json`), not a V1 shipping
   decision. Notebook/kernel execution stays conditional: no notebook extension is part of the
   mandatory candidate set and its absence cannot qualify or fail the language lane.

## Consequences

- The N5 harness may revise its candidate extension set (versions, licences, compatibility
  observations) without re-opening a V1 decision, because nothing in the V1 application or the
  deployable closure depends on it.
- Promoting any plugin-host capability into a V1 deployable — including adding
  `@theia/plugin-ext` to a `deployables` entry or to the V1 application manifest — requires a new ADR
  that supersedes this one and re-opens ADR-002 §"Decision".
- The dependency-policy entries for both packages reference this ADR; if the harness is archived, the
  entries and this record go together.
