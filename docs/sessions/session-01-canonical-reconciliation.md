# Session 01 — Canonical repository reconciliation

**Primary owner:** IV-14 (Decide V1 runtime topology and repository architecture)
**Gate:** 0 — Canonical executable baseline
**Canonical commit:** `4e6c1c39a6292a60b1869a52aa32378f373022b8` (branch `stable`)
**Report anchored at:** the same commit; this branch adds only this session's docs on top.

## Goal

Make the declared canonical branch match the accepted V1 runtime architecture, and eliminate any
local-only implementation claim, so that later sessions build on a repository whose state is
exactly what the tracker believes it to be. This session produces a reconciliation report; it
introduces no product code (Session 01's exit contract is evidence, not tests).

## Method

Findings below are read directly off the repository at the canonical commit. Each is
independently checkable with the command noted; nothing here is asserted from a plan or a Notion
page.

## 1. Canonical anchor

| Fact | Value | Check |
| --- | --- | --- |
| Canonical branch | `stable` (tracks `origin/stable`) | `git rev-parse --abbrev-ref HEAD` |
| Canonical SHA | `4e6c1c39a6292a60b1869a52aa32378f373022b8` | `git rev-parse HEAD` |
| Upstream base | Eclipse Theia **v1.74.0** (tag `v1.74.0`) | `git merge-base --is-ancestor v1.74.0 HEAD` |
| Monorepo package name | `@theia/monorepo` (unchanged from upstream) | `grep name package.json` |
| Node engine | `>= 22` | root `package.json` `engines` |
| Package manager | **npm**, not yarn | `CLAUDE.md`; root scripts use `lerna`/`npm` |

The `stable` branch, the working branch `claude/ivory-tower-next-steps-my1bt8`, and `origin/stable`
all pointed at `4e6c1c3` at the start of this session; `git diff origin/stable..<branch>` was
empty. The branch is a clean cut from the canonical commit with no prior session work on it.

## 2. Ivory Tower footprint on top of upstream

The `git diff --stat` against the `v1.74.0` tag is large but **misleading**: nearly all of it
arrived via `Merge branch 'eclipse-theia:master' into stable` and is upstream Theia, not Ivory
Tower work. The genuinely Ivory-Tower-authored changes are small and deliberate (the fork's
"minimize divergence" discipline, ADR-001 §3.7).

### Delivered code (canonical)

- **`packages/ivory-identity/`** — npm name `@theia/ivory-identity`. The **only** non-`@theia/*`
  product package in `packages/` (all 81 others are upstream). It is the IV-17 reference
  implementation of stable source/passage/derived-artifact identifiers: `src/common/` (frontend-
  safe identifier types, aliases, scheme, canonical preimage, passage anchor), `src/node/`
  (digest + identity using `node:crypto`), fixtures, and a determinism verification spec
  (`identity-boundaries.spec.ts`). Introduced by commit `12d291c`.
  Check: `ls packages/ivory-identity`, `grep name packages/ivory-identity/package.json`.

### Delivered docs (canonical, planning-only)

- `docs/adr-001-application-platform.md` — the binding platform decision (IV-14), **Accepted**.
- `docs/iv-8-product-model.md` — canonical object vocabulary, lifecycle, gates G1–G24, and the
  125-issue traceability matrix.
- `docs/v1-build-vs-open-source.md` — planning baseline, repository map, and the non-negotiable
  release-gate list.
- `docs/iv-17-identifiers.md` — the identifier contract implemented by `ivory-identity`.
- `docs/iv-102-chapter-plan.md`, `docs/iv-102-landscape-review.md`,
  `docs/iv-102-phase1-literature-search-report.md` — the IV-102 landscape review deliverables.
- `CLAUDE.md` — Ivory Tower guidance (upstream's own guidance preserved separately at
  `doc/THEIA-CLAUDE.md`).

Introduced by commits `efec71e` (planning baseline + ADR) and `5db97d1` (README rewrite).

### Other local edits to upstream files

- `c29f7b9 ai-ide: refine coder agent system prompt` — a small edit inside an upstream `ai-ide`
  package. Noted for completeness; it is not part of the Ivory Tower domain model and carries no
  roadmap delivery claim.

## 3. Tracker ↔ repository reconciliation

Delivery-evidence states: `unimplemented` → `implemented-local` → `canonical` → `verified-release`.

| Issue | Claim | Evidence at `4e6c1c3` | State |
| --- | --- | --- | --- |
| IV-8 | Product model defined | `docs/iv-8-product-model.md` | canonical (doc) |
| IV-14 | Platform/surface decided | `docs/adr-001-application-platform.md` (Accepted) | canonical (decision); topology sub-questions **open** (§4) |
| IV-17 | Stable identifiers | `packages/ivory-identity/` + spec + `docs/iv-17-identifiers.md` | **canonical (code)** |
| IV-102 | Landscape review | `docs/iv-102-*` (3 files) | canonical (doc) |
| IV-15 | Application scaffold + quality gates | **none in code** — no Ivory app, root is upstream `@theia/monorepo` | unimplemented |
| IV-19 | Licensing/dependency policy/SBOM/pinning | only upstream Theia tooling (`.github/workflows/generate-sbom.yml`, `license-check.yml`); no Ivory-specific policy | unimplemented |
| IV-21 | Reproducible local env + migrations | **absent** — no docker-compose, no Postgres/pgvector, no migrations dir | unimplemented |
| IV-22 | Deployment/config/readiness/secrets | **absent** — no config schema, no profiles, no secret sentinel | unimplemented |
| IV-128 | V1 cutline + gate manifest | prose only in `docs/v1-build-vs-open-source.md`; no machine-readable manifest | unimplemented |

**Reconciliation result:** no issue in the repository claims a runtime package or ADR that cannot
be located at `4e6c1c3`. The only shipped product code is `ivory-identity`. Everything the
audit critical path calls Gate 0 beyond IV-14/IV-17 is **decided-in-docs at most, not implemented
in code**, and is labeled as such above.

## 4. No unpublished / local runtime work to recover

Session 01's stop condition — "unpublished code cannot be recovered" / "canonical branch cannot
safely absorb the implementation" — **does not apply**. There is no local-only runtime branch,
no stranded implementation, and no divergence between the working branch and `origin/stable`.
Nothing needs to be rescued into the canonical commit.

## 5. Open IV-14 topology questions (carried forward, not resolved tonight)

From ADR-001 §6, these remain open and are inputs/blockers for later sessions — **not** to be
resolved in this session:

- Upstream sync cadence and ownership of version-bump conflict resolution (IV-14, IV-19).
- Extension host: fully disabled vs. first-party allow-list via a self-hosted registry
  (IV-14, IV-83).
- Desktop wrapper: Theia's Electron target vs. a lighter shell over the browser build
  (IV-14, IV-22; Electron footprint counts against gate G23).
- Local Docling bundling strategy and the degraded remote-conversion path (IV-30).
- Remaining IV-14 topology: queue technology, object storage, migration ownership, and
  per-boundary failure models (IV-14).

These must be settled deliberately (with the user) before the code that depends on each one is
written; they should not be resolved implicitly inside a scaffold session.

## 6. Verification of this report

- `git status` clean after commit; `git diff --stat stable..HEAD` shows only the new
  `docs/sessions/` files.
- `git rev-parse HEAD` == `4e6c1c39a6292a60b1869a52aa32378f373022b8`.
- `ls packages/` → `ivory-identity` is the sole non-`@theia` package.
- No `docker-compose*.yml`, no `migrations/` directory, no Ivory-branded app under `examples/`.
- The Ivory-authored commits named here (`12d291c`, `efec71e`, `5db97d1`) are present in
  `git log --oneline`.

## 7. Exact prerequisite for the next session

Session 02 (IV-15) may proceed against canonical commit `4e6c1c3` on branch
`claude/ivory-tower-next-steps-my1bt8` (or a fresh branch cut from `stable`). Its objective is the
**deterministic browser-first Theia product scaffold and quality gates**: an Ivory-owned
application entry point, a single clean-checkout verification sequence (locked install → compile →
lint → test → architecture/boundary checks → browser build → health smoke), and enforcement that
browser code cannot import DB/queue/parser/provider/storage internals. Session 02 should treat the
open topology questions in §5 as decisions to surface, not to assume.

**Recommended next session:** Session 02 — Deterministic scaffold and quality gates (IV-15).
