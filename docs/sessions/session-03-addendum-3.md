# Session 03 Addendum 3

## Objective completed

Not a new roadmap session. This records a **third** independent execution of Session 03 (IV-19)
that collided with the same already-merged work described in `docs/sessions/session-03-addendum.md`
(§13 of `docs/iv-19-dependency-governance.md`) and `docs/sessions/session-03-addendum-2.md` (§14).
This execution fetched `origin/claude/session-3-q9tc4o` only at push time — after already building a
full independent duplicate of the IV-19 mechanism from a stale local checkout — and discovered the
branch had moved to `941a331` (PR #20's merged work plus both prior addenda) while this execution's
own unpushed commit sat on top of the older `40d48b0`.

Unlike the two prior collisions, a line-by-line comparison found **zero** genuinely new findings:
every fix this execution made independently (the `@theia/ivory-identity` boundary layer, widening
`typecheck`/`lint`/`test`/`format` scope to include it, the floating-Docling-tag rejection, the
reviewed third-party inventory, SBOM generation, secret scanning, notices generation) already
existed at origin — in the ivory-identity prettier-formatting case, byte-for-byte identical. Two
narrow items survived as genuinely additive rather than duplicate, and are fixed directly rather
than merely recorded (matching addendum-2's approach, not addendum's):

- `scripts/ivory-boundary-fixtures.json` gained one fixture origin did not have: `{ "layer":
  "@theia/ivory-identity", "import": "pg" }`. Origin's two existing fixtures for this layer
  (`@theia/core`, `@ivory-tower/domain`) already prove the layer rejects a platform import and a
  sibling-package import; `pg` additionally proves it rejects the specific infrastructure-adapter
  dependency the layer's `forbidden` list names alongside `@aws-sdk/`, `graphile-worker`, and
  `docling` — none of which had a fixture at all before this addendum.
- `packages/ivory-tower-infrastructure/src/package.spec.ts` gained one test asserting
  `validateIvoryTowerEnvironment` rejects a floating Docling image tag directly. This is
  complementary to, not a duplicate of, origin's `floating-image-tag` fixture under
  `scripts/fixtures/dependency-policy/`: that fixture proves the `dependency:policy` CI gate
  catches a mutable tag in a synthetic `docker-compose.yml`, while this test proves the runtime
  environment-validation function itself — which fires at actual process startup, independently of
  whether the CI gate ever ran — rejects the same case.

## Canonical commit / branch

- Discovered the collision after committing `4ec65f7` on top of a stale `40d48b0`. Reconciled via
  `git merge origin/claude/session-3-q9tc4o -X theirs` (commit `70e8b97`) followed by an explicit
  cleanup commit removing the discarded duplicate's leftover files and the two byte-for-byte
  duplicate additions the merge could not itself detect (commit `f664df4`, the parent of this file).
- `git reset --hard` was likewise not used here — same reasoning as addendum-2: a real merge keeps
  the reconciliation itself in the visible history rather than silently discarding an already-made
  commit.

## Files changed

- `docs/sessions/session-03-addendum-3.md` — this file.
- (Already committed in `f664df4`.) Six files deleted: `THIRD-PARTY-NOTICES-ivory-tower.md`,
  `configs/ivory-dependency-policy-fixtures.json`, `configs/ivory-third-party-inventory.json`,
  `scripts/check-ivory-notices.mjs`, `scripts/check-ivory-secret-scan.mjs`,
  `scripts/check-ivory-third-party-inventory.mjs`. Two files trimmed to remove duplicate content:
  `scripts/check-ivory-boundaries.mjs` (duplicate `@theia/ivory-identity` layer entry),
  `.gitignore` (duplicate `/artifacts/` block). One file trimmed to remove two duplicate fixtures
  while keeping the one new one: `scripts/ivory-boundary-fixtures.json`.

## Tests and commands run

```
node scripts/check-ivory-boundaries.mjs
node scripts/check-ivory-dependency-policy.mjs --fixtures
node scripts/check-ivory-secrets.mjs
node scripts/generate-ivory-notices.mjs && node scripts/generate-ivory-notices.mjs --check
```

All green after the cleanup commit. `verify:ivory-tower` end-to-end was not run in this sandbox
(Node 22.22.2/npm 10.9.7 present, not the pinned 24.16.0/11.13.0; no `node_modules` installed) —
same toolchain gap the merged work's own handoff already notes is outstanding for the next session
or CI run to close.

## Evidence produced

- The diff of this execution's final tree against `origin/claude/session-3-q9tc4o` after cleanup,
  confirmed to contain exactly the two items listed above and nothing else.

## Acceptance criteria passed / still open

Unchanged from the merged work's own `docs/sessions/session-03-handoff.md` and
`docs/iv-19-dependency-governance.md` §12–§14. This addendum closes no new acceptance criterion; it
adds two small, verified gate improvements and removes duplicate content.

## Known regressions / risks

None. The two survived additions were each re-verified against the real (origin's) checker scripts,
not this execution's discarded ones.

## Decisions made

- Followed §13/§14's precedent exactly: discard the duplicate mechanism, keep only genuinely
  non-duplicated content, fix it directly rather than merely describing it, and record the
  collision so a fourth execution (should one happen) does not have to re-derive this account from
  the commit graph alone.
- Did not create a fourth dependency-policy engine or SBOM generator variant to compare approaches
  "for safety." Two independently-maintained implementations of the same gate is a liability per
  addendum's own reasoning; a third would compound it for no benefit.

## Do not assume

- Do **not** assume anything under `configs/`, `scripts/check-ivory-dependency-policy.mjs`,
  `scripts/check-ivory-secrets.mjs`, `scripts/generate-ivory-sbom.mjs`, or
  `scripts/generate-ivory-notices.mjs` changed as part of this addendum — none of it did.
- Before starting Session 04 (or any further Session 03 work), run `git merge-base --is-ancestor
  <local-HEAD> origin/claude/session-3-q9tc4o` (or equivalent) **before** writing new IV-19 code,
  not at push time. This is the third time that check would have prevented a full duplicate
  implementation on this specific branch.

## Exact prerequisite for next session

Unchanged: a clean checkout with the pinned toolchain (Node 24.16.0 / npm 11.13.0) to run
`npm run verify:ivory-tower` end-to-end once, per the merged work's own handoff.

## Recommended next session

Session 04 — Reproducible local environment and migrations (IV-21), as already recommended.
