# IV41-010 — Canonical research-object schema reconciliation

**Scope:** IV41-010A → 010E. Canonical contract: `configs/ivory-v41-canonical-model.json`.
**Prior authority:** `configs/ivory-v41-authority-heads.json`, `configs/ivory-v41-owner-map.json`, `configs/ivory-v41-carrier-matrix.json`, `configs/ivory-v41-adr-lineage.json`; implementation branch `feat/v41-p02-fragment-context`, PR #5.
**Evidence class:** structural architecture contract with adversarial fixtures, reconciled against the merged N1–N7 closeout line and retained by exact-head readback at `refs/heads/dev` = `5c2b6d464cbbd727f24587bd44834199e19777a1` (tree `39c9e5541b4f439b7a43bd5563a026a4d800f48b`) under the `sha256` / `utf-8` / `normalize-lf` / POSIX-separator convention shared with the rest of the V4.1 contract set. This is **not** a claim of production persistence, migration/restart qualification, or Q1 closure; no gate moves off `not-run`.

## A. Ownership, identity, and mutation

| V4.1 concept | Owner | Canonical record / boundary | Semantics |
| --- | --- | --- | --- |
| Source | `@ivory-tower/research-kernel` | Core `SourcePayload` in immutable `RevisionRecord` | Exact retained bytes, `sourceVersionId`, content digest. Scholarly aliases/status assertions are **not implemented** and remain tracked. |
| Artifact | `@ivory-tower/research-kernel` | Core `ArtifactPayload` revision | Derived immutable output/digest and exact Source refs. |
| Fragment | `@ivory-tower/research-kernel` | Core `FragmentPayload` revision | Owns selector/profile/digest and exact cited/context representation refs; `EvidenceLink` may reference but never overwrite selector identity. |
| Statement / Claim | `@ivory-tower/research-kernel` | Core `ClaimPayload` revision | One `claim` object. Naming and projection authority is the ADR lineage (`claim-card-authority`, carried by ADR-007 and amended by ADR-008), not a second writer or ID namespace. |
| EvidenceLink | `@ivory-tower/research-kernel` | Core `EvidenceLinkPayload` revision | Role, exact Claim/Fragment/Annotation refs and cited/context role; carry-forward creates a new link. |
| ResearchProtocol | `@ivory-tower/contracts` | `research-protocol-contract.ts#researchProtocolVersionSchema` | Typed version shape already exists, but this contract does not prove one durable Core-owned implementation. |
| Activity | `@ivory-tower/research-kernel` | Core `ActivityRecord` | Append-only provenance; activity back-links are not semantic dependencies. |
| Proposal | `@ivory-tower/research-kernel` | Core's governed `AcceptAgentProposalInput` boundary | Before adoption it is a proposal, **not** a second canonical research object. See IV41-041. |
| Adjudication | `@ivory-tower/research-kernel` | Typed Core Activity/decision-receipt obligation | Exact assessment/snapshot basis is still an owned gap, IV41-023. No automatic adjudication from a passed machine test. |
| Receipt | `@ivory-tower/research-kernel` | Core `AgentProposalReceipt` / Activity; execution `ExecutionRecord` is separate | Research decisions belong to Core. Execution records belong to domain/execution and cannot accept research meaning. |
| Snapshot | `@ivory-tower/research-kernel` | Core `SnapshotRecord` | Frozen selected/context/dependency refs and exact per-member revision digests. |
| Assessment | `@ivory-tower/research-kernel` | Core Activity contract | Typed citation and semantic-support assessments remain separate pending IV41-021/IV41-022 (lineage decision `semantic-assessment-carrier`). |
| CAS | `@ivory-tower/contracts` | `durable-store-port.ts#DurableStorePort` (ADR-005 durable-store contract; `admitBlob` fsyncs before `commit`) | Immutable bytes/storage mechanics, not research interpretation authority. `@ivory-tower/infrastructure#FilesystemObjectStore` and `@ivory-tower/adapters#ObjectStorePort` are non-canonical secondaries. Durability/restore gap IV41-016 / V41-I07.4. |

The **only** semantic revision writer and acceptance owner is `@ivory-tower/research-kernel`, and every row of the contract now names its owner explicitly; the validator rejects a row whose owner is not a package in the exact-head inventory of `configs/ivory-v41-authority-heads.json`, whose owner contradicts the owner map for the same surface, whose carrier sits outside its owner's package, or whose carrier the owner map does not name as primary and the carrier matrix does not carry. `@ivory-tower/infrastructure` implements durable storage. The execution harness, workers and clients do not adjudicate.

## B. Persistence and forward migration

The existing durable migration runner is `packages/ivory-tower-infrastructure/src/node/migrate.ts#runIvoryMigrations`; the existing N1 Core is an in-memory reference kernel. Reconciliation here specifies the *required forward migration shape*, not an unexecuted SQL migration as proof of production durability.

1. Inspect the exact pinned schema and bytes, retain a checkpoint and establish writer exclusion before migration.
2. Migrate forward only: versioned/additive fields or append-only records. Never rewrite historical accepted payloads, selectors, receipts, or source bytes. Do not invent aliases, source status, missing Fragment context, assessment decisions, or old snapshot basis.
3. Restore into a fresh path and compare object refs, heads, snapshot members, row counts **and digests**. Retain explicit loss/mismatch reporting. No in-place downgrade or active-store restore.
4. Qualify CAS-first commit/recovery and checkpoint/restore separately in V41-I07 and IV41-016. The present architecture record cannot close that prerequisite.

## C. Cross-object references and dependency digests

`ExactRef = { projectId, objectId, revisionId }`. Resolve within the declared project at the named historical revision, reject `latest` in semantic data, and reject unknown/wrong-type/cross-project refs. A revision update requires `expectedHead`; conflicting edits fail before canonical state changes. Carry-forward of an EvidenceLink is an explicit *new* link to the selected Claim revision.

`RevisionRecord.digest` currently binds canonical JSON of `schemaVersion`, `objectId`, `predecessor`, `payload`, `exactRefs`, and `activityId`. The immutable snapshot digest binds the entire manifest, whose members each carry `{ ref, role, revisionDigest }`. This is an exact-revision digest contract, **not an invented independently persisted transitive dependency hash**. The latter stays owned by later dependency-impact implementation.

## D. Inherited compatibility / supersession

- Keep V3/V4 exact refs and original revision bytes readable; do not rewrite history to match new conceptual names.
- `Statement` is a naming alias for the existing Claim carrier. `Paper Store`, `Claim Card`, and `ResearchCase` are projections over Source/Artifact/Claim/EvidenceLink/Snapshot — never mutable stores.
- Schema/ADR supersession, the `Statement` naming and the Claim Card projection are **not restated here**: the contract points at the real ADR files (`docs/adr-007-v41-authority-harness-boundary.md`, `docs/adr-008-v41-adr-lineage-supersession.md`) and at `configs/ivory-v41-adr-lineage.json` decisions `one-core-authority`, `claim-card-authority` and `semantic-assessment-carrier`. The validator fails closed if a pointer names an ADR no longer registered with the same path, a decision that does not exist, an ADR that does not carry the decision, or a declared decision no row references. The V41 owner map and IV41-004 ADR lineage remain the existing reconciliation authorities; this issue introduces no replacement status registry.
- Absent legacy Fragment context is **unavailable** (not automatically `not-applicable`). A converter/profile change creates a new Fragment revision for `EXACT`; `AMBIGUOUS` and `UNRESOLVED` do not guess a successor.

## E. Reproducible contract proof

```text
node scripts/ivory/iv41-010-model.mjs
node --test scripts/ivory/iv41-010-model.spec.mjs
node scripts/ivory/v41-authority.mjs
node --test scripts/ivory/v41-authority.spec.mjs
node scripts/ivory/n-gates.mjs
npx lerna run compile --scope @ivory-tower/research-kernel --include-dependencies
npx lerna run test --scope @ivory-tower/research-kernel --stream
```

The validator binds the contract to exact repository/PR/pinned-head/toolchain context, the current owner and package maps, the N1–N7 carrier matrix, the ADR lineage, existing structural carrier symbols, revision and dependency digest fields, migration rules, compatibility aliases, all owner-map gaps, and the retained exact-head readback. The test suite deliberately corrupts each contract and expects a nonempty failure finding; the reconciliation run recorded in `changes/iv41-010-canonical-model.md` shows `tests 20, pass 20, fail 0` for the canonical-model suite, `tests 56, pass 56, fail 0` for the authority suite, `7/7 N-gates closed`, and a clean `compile`/`test` for `@ivory-tower/research-kernel` (20 passing kernel cases).

**Limits and follow-ups:** durable production CAS-first commit/recovery with checkpoint/restore semantic readback stays owned by IV41-016 and V41-I07.4; typed citation-integrity and semantic-support assessments by IV41-021 and IV41-022; human research-decision receipts/adjudication by IV41-023; governed proposal envelopes by IV41-041; Source scholarly assertion/status implementation by IV41-010 itself. The retained readback in `configs/ivory-v41-canonical-model.json` (audited head `5c2b6d464cbbd727f24587bd44834199e19777a1`, twelve pinned file digests and byte counts, all 12/12 confirmed against both the working tree and `git cat-file -p HEAD:<path>`) is a structural identity, not runtime, restart, or restore evidence. These runtime leaves need their own positive, negative and restart/readback evidence before a parent Done or Q1 Done decision. Proof on one GitHub Actions runner is not independent restore proof.

**Operator/observation:** GitHub integration authoring against pinned `dev` with a recorded exact PR head before IV41-010; package requirement Node >=24 / npm 11.13.0. The reconciliation commands above were executed on Windows 11 (win32 `10.0.26200`), x64, Node v24.16.0, npm 11.13.0, lerna 9.0.7 in a clean worktree. Exact post-commit SHA, matrix results and any formatter/toolchain limitations should be taken from PR #5's final Actions run, not copied from an earlier run.
