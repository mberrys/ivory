# IV41-010 — Canonical research-object schema reconciliation

**Scope:** IV41-010A → 010E. Canonical contract: `configs/ivory-v41-canonical-model.json`.
**Prior authority:** `configs/ivory-v41-authority-heads.json` and `configs/ivory-v41-owner-map.json`; implementation branch `feat/v41-p02-fragment-context`, PR #5.
**Evidence class:** structural architecture contract with adversarial fixtures. This is **not** a claim of production persistence, migration/restart qualification, or Q1 closure.

## A. Ownership, identity, and mutation

| V4.1 concept | Canonical record / boundary | Semantics |
| --- | --- | --- |
| Source | Core `SourcePayload` in immutable `RevisionRecord` | Exact retained bytes, `sourceVersionId`, content digest. Scholarly aliases/status assertions are **not implemented** and remain tracked. |
| Artifact | Core `ArtifactPayload` revision | Derived immutable output/digest and exact Source refs. |
| Fragment | Core `FragmentPayload` revision | Owns selector/profile/digest and exact cited/context representation refs; `EvidenceLink` may reference but never overwrite selector identity. |
| Statement / Claim | Core `ClaimPayload` revision | One `claim` object; “Statement” is a planning name, not a second writer or ID namespace. |
| EvidenceLink | Core `EvidenceLinkPayload` revision | Role, exact Claim/Fragment/Annotation refs and cited/context role; carry-forward creates a new link. |
| ResearchProtocol | `@ivory-tower/contracts#researchProtocolVersionSchema` | Typed version shape already exists, but this contract does not prove one durable Core-owned implementation. |
| Activity | Core `ActivityRecord` | Append-only provenance; activity back-links are not semantic dependencies. |
| Proposal | Core's governed `AcceptAgentProposalInput` boundary | Before adoption it is a proposal, **not** a second canonical research object. See IV41-041. |
| Adjudication | Typed Core Activity/decision-receipt obligation | Exact assessment/snapshot basis is still an owned gap, IV41-023. No automatic adjudication from a passed machine test. |
| Receipt | Core `AgentProposalReceipt` / Activity; execution `ExecutionRecord` is separate | Research decisions belong to Core. Execution records belong to domain/execution and cannot accept research meaning. |
| Snapshot | Core `SnapshotRecord` | Frozen selected/context/dependency refs and exact per-member revision digests. |
| Assessment | Core Activity contract | Typed citation and semantic-support assessments remain separate pending IV41-021. |
| CAS | `ObjectStorePort` implemented in infrastructure | Immutable bytes/storage mechanics; not research interpretation authority. Durability gap IV41-016. |

The **only** semantic revision writer and acceptance owner is `@ivory-tower/research-kernel`. `@ivory-tower/infrastructure` implements durable storage. The execution harness, workers and clients do not adjudicate.

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
- Absent legacy Fragment context is **unavailable** (not automatically `not-applicable`). A converter/profile change creates a new Fragment revision for `EXACT`; `AMBIGUOUS` and `UNRESOLVED` do not guess a successor.
- Schema/ADR supersession is append-only and reviewable. The V41 owner map and IV41-004 ADR lineage remain the existing reconciliation authorities; this issue introduces no replacement status registry.

## E. Reproducible contract proof

```text
npm run verify:ivory-v41-authority
npm run test:ivory-v41-authority
npm run verify:ivory-canonical-model
npm run test:ivory-canonical-model
npm run verify:ivory-tower
```

The new validator binds the contract to exact repository/PR/pinned-head/toolchain context, current owner and package maps, existing structural carrier symbols, revision and dependency digest fields, migration rules, compatibility aliases and all owner-map gaps. The test suite deliberately corrupts each contract and expects a nonempty failure finding.

**Limits and follow-ups:** Source scholarly assertion/status implementation remains tracked under IV41-010, typed evidence support and qualifications under IV41-021/022, human decision receipts under IV41-023, governed proposal envelopes under IV41-041, and durable production CAS/restore under IV41-016/V41-I07.4. These runtime leaves need their own positive, negative and restart/readback evidence before a parent Done or Q1 Done decision. Proof on one GitHub Actions runner is not independent restore proof.

**Operator/observation:** GitHub integration authoring against pinned `dev` with a recorded exact PR head before IV41-010; package requirement Node >=24 / npm 11.13.0. Exact post-commit SHA, matrix results and any formatter/toolchain limitations should be taken from PR #5's final Actions run, not copied from an earlier run.
