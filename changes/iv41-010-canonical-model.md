# IV41-010 — Reconcile canonical research object schemas

## Plan and issue coverage

- 010A: bind the eleven requested concepts plus existing Assessment/CAS to exactly one canonical model surface, one owner, and one carrier.
- 010B: define the additive, forward-only migration and independent restore/readback obligations on the existing infrastructure runner.
- 010C: pin cross-project, exact revision, expected-head, semantic dependency, and digest invariants.
- 010D: retain inherited names and revisions as aliases/projections rather than second stores or retroactive edits.
- 010E: execute the canonical-model verifier and adversarial fixtures in the required Ivory Tower quality gate.

## Files

- `configs/ivory-v41-canonical-model.json`: exact issue/branch/pr/basis, carrier inventory, receipt variants, reference policy, migration shape, aliases and qualification limits, plus the new ADR-lineage pointers and the retained exact-head readback.
- `scripts/ivory/iv41-010-model.mjs`: fail-closed validator bound to the existing V4.1 owner/package/head authorities, the carrier matrix, the ADR lineage and carrier symbols.
- `scripts/ivory/iv41-010-model.spec.mjs`: adversarial tests for duplicate ownership, absent carriers, guessed backfills, untracked gaps, shadow stores, owner/carrier contradictions, unresolved ADR-lineage authority, drifted readbacks and unsafe closure.
- `docs/plans/ivory-v4-1-working/iv41-010-canonical-model.md`: human readback and explicit remaining runtime qualification.
- `package.json`: `verify:ivory-canonical-model` and `test:ivory-canonical-model` are required by `verify:ivory-tower`.

## Reconciliation at the merged head

Readback taken at `refs/heads/dev` = `5c2b6d464cbbd727f24587bd44834199e19777a1`, tree `39c9e5541b4f439b7a43bd5563a026a4d800f48b`, from a clean worktree (`git status --short` empty for the audited files). The model was authored before the N1-N7 closeout was merged as `f8d0af66a` and before the owner map was reconciled (`419c44ce2`) and the carrier matrix re-resolved (`cadc8ed51`), so every carrier, owner, revision-identity and persistence statement was re-resolved against that merged tree.

**The CAS row was the one contradiction, and the model's row was the wrong one.** The model named `packages/ivory-tower-adapters/src/execution-ports.ts#ObjectStorePort` as the canonical CAS carrier while `configs/ivory-v41-owner-map.json` names the ADR-005 durable-store contract `packages/ivory-tower-contracts/src/durable-store-port.ts#DurableStorePort` for the `CAS` surface, owned by `@ivory-tower/contracts`, with `@ivory-tower/infrastructure#FilesystemObjectStore` and `@ivory-tower/adapters#ObjectStorePort` kept as non-canonical secondaries. The owner map is right on the file evidence:

- `packages/ivory-tower-contracts/src/durable-store-port.ts` — header comment "Durable-store port accepted by ADR-005"; `export interface DurableStorePort` (line 40) with `admitBlob`/`commit`/`getVisible`/`freezeUnchanged`/`exportSemantic`/`importSemantic`, `AdmittedBlob { digest, byteLength, objectKey }`, `CommitReceipt { revisionIds, projectSequence, idempotencyKey, acknowledgedAt }`, `CommitRequest { projectId, idempotencyKey, expectedHeads, revisions, blobDigests }`, and the ordering contract "`admitBlob` must have durably installed and fsynced the bytes before `commit` may reference them".
- `configs/ivory-v41-carrier-matrix.json` — the N2 lesson "durability requires CAS/semantic ordering, idempotency, writer exclusion, and semantic restore readback" is carried by `durable-store-port.ts#DurableStorePort`, `#AdmissionReceipt`, `#CommitReceipt`, `#SemanticExport`, `filesystem-object-store.ts#FilesystemObjectStore` and `migrate.ts#runIvoryMigrations`; the generic object port is not a carrier of that lesson.
- `packages/ivory-tower-adapters/src/execution-ports.ts` still declares `ObjectStorePort` (line 41), i.e. it exists but is a secondary immutable-bytes port, not the durable CAS contract.

**Per-row changes.**

| row | before | after | file evidence |
| --- | --- | --- | --- |
| CAS | carrier `packages/ivory-tower-adapters/src/execution-ports.ts#ObjectStorePort`, no owner field, persistence `immutable-bytes-port` | carrier `packages/ivory-tower-contracts/src/durable-store-port.ts#DurableStorePort`, owner `@ivory-tower/contracts`, identity `blobDigest/objectKey + idempotencyKey/expectedHeads`, persistence `durable-store-port-admit-before-commit`, compatibility naming the two non-canonical secondaries and the residual `IV41-016` / `V41-I07.4` gap | owner map `CAS` row; carrier matrix N2 units; `durable-store-port.ts`; `docs/plans/ivory-v4-1-working/authority-reconciliation.md` "What the audit changed" |
| all 13 rows | implicit ownership (only `canonicalWriter`) | explicit `owner` per row: `@ivory-tower/research-kernel` for Source, Artifact, Fragment, Statement/Claim, EvidenceLink, Activity, Proposal, Adjudication, Receipt, Snapshot, Assessment; `@ivory-tower/contracts` for ResearchProtocol and CAS | owner map `surfaces[].owner`; exact-head inventory in `configs/ivory-v41-authority-heads.json` |
| Statement/Claim | `compatibility` restated the naming rule in prose | `adrDecision: claim-card-authority` plus a compatibility limit that points at the lineage instead of restating it | `configs/ivory-v41-adr-lineage.json` decision `claim-card-authority` (amended, carried by ADR-007, amended by ADR-008) |
| Claim Card alias | canonical `Claim + EvidenceLink + Activity` restated the projection | canonical `regenerated projection, see the cited ADR lineage decision`, `adrDecision: claim-card-authority` | same lineage decision; `docs/adr-008-v41-adr-lineage-supersession.md` |
| Assessment | no authority pointer | `adrDecision: semantic-assessment-carrier` | lineage decision `semantic-assessment-carrier` → tracked issue IV41-021 with its URL |
| `authority` block | four packages stated without inventory binding | unchanged values plus `adrDecision: one-core-authority`; every authority package is now checked against the exact-head package inventory | lineage decision `one-core-authority` (inherited, carried by ADR-007); `docs/adr-007-v41-authority-harness-boundary.md` |
| model header | four basis pointers | adds `carrierMatrix` and `adrLineage` pointers, and an `authorityRecords` block citing `docs/adr-007-v41-authority-harness-boundary.md`, `docs/adr-008-v41-adr-lineage-supersession.md` and the three lineage decisions, so schema/ADR supersession, Statement naming and the Claim Card projection are read from their real authority rather than duplicated | ADR-007 (machine contract paragraph), ADR-008, `configs/ivory-v41-adr-lineage.json` |

The remaining eleven row carriers were re-resolved and are still identical to their owner-map primary carrier: `types.ts#SourcePayload`, `#ArtifactPayload`, `#FragmentPayload`, `#ClaimPayload`, `#EvidenceLinkPayload`, `#ActivityRecord` (Activity), `#ActivityRecord` (Adjudication), `#AgentProposalReceipt` (Receipt, also a carrier-matrix N7 unit), `#SnapshotRecord`, `#ActivityRecord` (Assessment), `research-protocol-contract.ts#researchProtocolVersionSchema`. `Proposal` keeps `types.ts#AcceptAgentProposalInput`, which is the carrier-matrix N7 unit for the governed-proposal boundary. No row now claims a carrier the owner map or the carrier matrix does not carry, and no row has a second writer: `canonicalWriter` stays `@ivory-tower/research-kernel` on all thirteen.

## Retained exact-head readback

`configs/ivory-v41-canonical-model.json` → `readback`, convention `algorithm: sha256`, `encoding: utf-8`, `pathSeparator: "/"`, `lineEndingPolicy: normalize-lf` — the same convention as `carrierReadback` (V41-I01.2), `fixtureReadback` (V41-I01.3), `machineReadback` (V41-I01.4) and the IV41-005 `digestConvention`. Digests are computed through the shared `readbackIdentity` helper exported from `scripts/ivory/v41-authority.mjs`: text digests are taken over LF-normalized content and `bytes` is the length of that normalized content, so a CRLF checkout (this Windows worktree) and an LF checkout record the same identity, and a fixture containing a NUL byte keeps raw bytes (none of the files below is binary).

Audited head: `refs/heads/dev` = `5c2b6d464cbbd727f24587bd44834199e19777a1`, mode `exact-working-tree` (the pre-commit dev tip this issue reconciled; the canonical-model file itself is not listed, because a file cannot retain its own digest).

```
ownerMap                   configs/ivory-v41-owner-map.json                                      861ac8af90da03cd3009a0da1227c17dcd0bc927b8d6608c6315ef1f5906861d    7307
packageOwnership           configs/ivory-v41-package-ownership.json                             671e846ff741eb61b2a66f14cffc3587c94ceedc4851a0ed5d8cf3c84f0b68c5   11075
exactAuthority             configs/ivory-v41-authority-heads.json                               277e549d4d94e52fe3d8f38b0aa654b53bfb8dc1a2377d5b34dfe186093f09b4    5392
carrierMatrix              configs/ivory-v41-carrier-matrix.json                                ee19961a23c630504341cbf575f37fb41d76c2d92a0ed224565d916a6c13e669   13190
adrLineage                 configs/ivory-v41-adr-lineage.json                                    6c91f1337dbb2d0b0bf96e9b08f08f8cbee449116c70752bb8566d5322ca9852    5925
researchKernelTypes        packages/ivory-tower-research-kernel/src/node/types.ts                f0f211eaa78376cfe04a95e0e1ba0afefc3681008fcb7103c69438c29c4efdbb   12097
researchProtocolContract   packages/ivory-tower-contracts/src/research-protocol-contract.ts      44190d90eb5c9d79248118e762a8ad39debb6620f91c59793b0a0ec351bae57d    6766
durableStorePort           packages/ivory-tower-contracts/src/durable-store-port.ts              5f07b7fce6ece6c2e1696b57784df165f600e599121decea46907a9c69fda580    2466
domainExecution            packages/ivory-tower-domain/src/execution.ts                         7f27555fef7d207c08dd8629d970485dc28d949fef6b2bb494ef304030edf9de    2196
migrationRunner            packages/ivory-tower-infrastructure/src/node/migrate.ts               2b60512028030ada9b490f8b84ee7df8429d468579d229547c73f4702aeafd39    3240
adr-007                    docs/adr-007-v41-authority-harness-boundary.md                        e3d0e623e7f57c171cc06b89446e5dbac4431a42a60254beca466e9b350cbea5    5173
adr-008                    docs/adr-008-v41-adr-lineage-supersession.md                          2d3e945a473dbec90e0d3996099f12371160e5440fb123f31e9baea6d959d2bb    5372
```

Every one of the twelve `sha256`/`bytes` pairs was confirmed identical when recomputed from the working tree **and** from `git cat-file -p HEAD:<path>` at that head (12/12, 0 mismatches). The set is not hand-picked: the validator derives the required set from the model itself — the five basis pointers, every concept carrier file, every receipt-variant carrier file, the migration runner, and every cited ADR path — and fails closed when the readback omits one, adds one, or repeats one.

## Validator hardening

`scripts/ivory/iv41-010-model.mjs` now fails closed on: a missing carrier file or an undeclared symbol (declaration-checked, not a passing mention); a carrier outside the package that owns it; an owner that is not a package in the exact-head inventory; an owner that contradicts the owner map for the same surface; a carrier the owner map does not name as primary and the carrier matrix does not carry; a carrier whose owner contradicts the carrier matrix for the same unit; an authority package outside the inventory; an ADR-lineage pointer that does not resolve to a registered ADR path or an existing lineage decision, a cited ADR path that contradicts the lineage registry, a lineage decision the model relies on without citing its carrying ADR, a declared decision nothing references, and an ADR file that is absent on disk; a readback that is missing, unbound (no exact non-latest head, wrong head mode), incomplete or duplicated, unhashed, or drifted in digest/byte count/convention; and every rule the contract already enforced — the pinned `npm@11.13.0` / `nodeEngine >=24` toolchain, the exact pre-issue PR head, the exact repository/PR/branch context, the five ordered leaves, Core-only acceptance, additivity/forward-only migration with digest readback, exact-reference and expectedHead fencing, alias modes, all fifteen owner-map gaps tracked by an `IV41-*` issue, and all six gates `not-run`.

**Adversarial cases added** (`scripts/ivory/iv41-010-model.spec.mjs`, 20 cases total): a CAS row that names the adapters' generic object port as canonical owner/carrier is rejected in three directions (owner-map contradiction, carrier-outside-owning-package, carrier neither primary nor matrix-carried); the carrier matrix disagreeing with the model about a shared unit is rejected; an owner outside the package inventory is rejected; an authority package outside the inventory is rejected; a missing/unbound/incomplete/wrong-convention/digest-drifted/byte-drifted/unhashed readback is rejected; and an unresolved ADR-lineage pointer is rejected (undeclared reference, missing decision, uncited carrying ADR, contradicted ADR path).

## Commands actually run at that head

```
npx lerna run compile --scope @ivory-tower/research-kernel --include-dependencies
  exit 0; Successfully ran target compile for 2 projects (@theia/ivory-identity, @ivory-tower/research-kernel)

npx lerna run test --scope @ivory-tower/research-kernel --stream
  exit 0; 20 passing (51 ms) = 8 V41-P02 leaf cases + 12 N1 research-identity cases

node scripts/ivory/iv41-010-model.mjs
  exit 0; IV41-010 canonical-model contract valid; SHA-256
  b6d255890305e2a7ec0e7d866cba1743e490dbd0625f094952a3b933fdd3c9e8 configs/ivory-v41-canonical-model.json

node --test scripts/ivory/iv41-010-model.spec.mjs
  exit 0; tests 20, pass 20, fail 0

node scripts/ivory/v41-authority.mjs
  exit 0; V4.1 authority reconciliation: valid (V41-P01 4/4 leaves + IV41-003 package ownership
  + IV41-004 ADR lineage + IV41-005 qualification manifest)

node --test scripts/ivory/v41-authority.spec.mjs
  exit 0; tests 56, pass 56, fail 0

node scripts/ivory/n-gates.mjs
  exit 0; 7/7 N-gates closed (N4 -> status="qualified", falseExact=0, anchors=120, converted=22)
```

**Environment.** Windows 11 (win32 `10.0.26200`), x64; Node v24.16.0; npm 11.13.0; lerna 9.0.7; `npm ci` had already been run in this worktree with the pinned toolchain. No suite is reported as passed anywhere it was not executed, and no CI or second-platform run is claimed.

## Evidence boundary

This is the architecture/schema reconciliation and its executable **contract proof**, not an applied migration, authenticated production writer, independent second-machine replay, or Q1 closure. Composite/explicitly owned gaps that stay open: durable production CAS/restore readback (`IV41-016`, `V41-I07.4`), typed citation-integrity and semantic-support assessments (`IV41-021`/`IV41-022`), human research-decision receipts/adjudication (`IV41-023`), governed proposal envelopes (`IV41-041`), Source scholarly alias/status assertions, migration execution itself, and the legacy Fragment-context compatibility rule. The retained readback is a structural identity of the contract and its carriers at one exact head; it is not runtime, restart, or restore evidence. Do not mark the parent Done until each leaf and its integration evidence is accepted.
