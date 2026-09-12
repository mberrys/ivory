# ADR-003 — Consolidate the spike work onto dev

Status: accepted (2026-09-12).

## Context

Measured on 2026-09-12 with `git merge-tree --write-tree --name-only` (nothing modified):

| ref | sha | date | content |
|---|---|---|---|
| `origin/dev` (= `origin/pre-dev` = `origin/unstable`) | `7c303b183` | 2026-09-07 | upstream Theia 1.75, **0 ivory packages** |
| ivory product line (`c0556b580`, branch `NExperimentation-FullSuite-v4`) | `c0556b580` | 2026-08-29 | 10 ivory packages, `scripts/ivory` gate machinery, `docs/sessions` 01–05; **no `spikes/`, no `docs/experiments/`** |
| common ancestor | `c4452ce29` | 2026-08-06 | — |

`origin/stable` was deleted from the remote on 2026-09-12 (found during the consolidation fetch). The ivory
product line is therefore referenced by commit `c0556b580`, which is still reachable through the local branch
`NExperimentation-FullSuite-v4`.

Merge cost into a `dev`-based branch:

| merged branch | conflicted paths | of which ivory files |
|---|---|---|
| `c0556b580` (the ivory line) | 211 | **0** (207 Theia paths + `package.json`, `package-lock.json`, `CLAUDE.md`, `CHANGELOG.md`) |
| `n7-scoped-agent-proposals` (N1 + N7) | 0 | 0 |
| `n3-compute` | 0 | 0 |
| `v2-n1-experiment` | 0 | 0 |
| `pre-dev-n1-port` | 0 | 0 |
| `v2-n2-experiment`, `n6-portable-reproduction`, `cdx/n4-exact-fragment-anchors`, `n1-v4` | 211 before M1 → 0 after | 0 |
| `N5-architecture-proof` | 15 after M1 | 3 |

Merging the same spikes into the ivory line instead would cost 256 (`n7`) and 213 (`n3-compute`).

## Decision

1. Work off `dev`. Merge the ivory line into the dev-based consolidation branch once (M1), taking `dev`'s side for
   every upstream Theia conflict and re-applying the ivory deltas that live inside files `dev` also owns
   (`package.json`, `dev-packages/*`).
2. Merge the spike branches next (M2–M5). They are 0-conflict merges once M1 has moved the merge-base up, because
   every ivory file is a pure addition relative to `dev`.
3. Fast-forward `dev` to the result and push. `pre-dev` is the same commit as `dev` today and is fast-forwarded
   with it so the two cannot diverge. No pull request.
4. **`stable` is read-only**: feature, spike and gate work never merges into it, and this work does not push it.
   When `stable` needs content from this line it arrives through `stable`'s own flow.
5. Spike code stays under `spikes/` until promoted; ADR-004 records each promotion.
6. An experiment is complete only when its evidence record is committed and evaluated by
   `npm run verify:ivory-n-gates`.

## Constraint: snapshot closure cost

`freezeUnchanged` over 101 000 members measured 908 143 ms on the v1 layout and 399.07 ms after
`spikes/n2-durable-store/sql/003_snapshot_manifest_text.sql`. Closure cost is a design constraint, not a
benchmark: any change to snapshot or closure semantics must re-run
`npm run verify:ivory-n2-v2 -- --cycles 1000 --skip-tests` and record the new `snapshotMs`.

## Consequences

- One line holds Theia 1.75, every ivory package and every spike; the next measurement does not have to re-derive
  the topology.
- The ivory line's `dev-packages/*` patches are re-checked against Theia 1.75 by `npm run check:ivory-toolchain`
  and `npm run check:ivory-install`, which are part of M1's exit criteria.
- Spike branches are frozen after their merges (see `docs/experiments/README.md` and the N-gate manifest).

## Open question

V1 is specified as local single-writer PGlite; the ivory line ships Postgres + Graphile + S3/MinIO + Docling +
Sentry with a `vendorHosted|selfHostedAtResearchOrganization` topology, and N2's own grounding note says the
SQLite comparison is blocked *because that stack exists*. Adopting the existing stack retires the PGlite default;
narrowing the stack makes the deployment/rights work post-V1. Owner decision required.
