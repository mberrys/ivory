# Archive integration disposition (provisional R1)

Archived source `mberrys/ivory-archive@bfcb283c4fe32b64b67a325f8f55aca08314296f`; destination baseline `mberrys/ivory@b0f9e63a6d331135265869a341dce7c7f1eef158`. This record assigns a **provisional path-level decision** to every listed source entry in `archive-source-manifest.json`. Each path has its historical blob SHA, license-review status, reason, and `destinationBlob: null` until actual porting. A **rewrite** means an intended contract/candidate, not a code acceptance. No old runtime package was imported by this checkpoint.

| Archived area | Provisional decision | Rationale |
|---|---|---|
| `docs/adr-` | **reference** | Preserve historical decision as written; V5 ADR may amend but never rewrite it. |
| `docs/experiments/` | **reference** | Pinned original qualification and raw proof, not V5 certification. |
| `packages/ivory-tower-research-kernel/` | **rewrite** | Extract exact-reference/N1 fixtures and semantic rules; do not ship in-memory kernel as Core. |
| `packages/ivory-identity/` | **rewrite** | Review and selectively lift pure identity/fragment helpers after exact API and license check. |
| `packages/ivory-tower-contracts/` | **rewrite** | Extract typed domain/API contracts to one V5 owner after architecture approval. |
| `packages/ivory-tower-domain/` | **rewrite** | Reconcile single V5 domain authority; strip redundant wrapper concepts. |
| `packages/ivory-tower-content-policy/` | **rewrite** | Carry rights/egress invariant through one reviewed Core boundary. |
| `packages/ivory-tower-infrastructure/` | **rewrite** | Only selected CAS/writer/recovery code after local-vs-hosted engine decision; no dual production topology by default. |
| `packages/ivory-tower-api/` | **rewrite** | Port only minimal read/command surface after one canonical Core is selected. |
| `packages/ivory-tower-application/` | **rewrite** | Retain relevant protocol/compute obligations without recreating workflow authority. |
| `packages/ivory-tower-adapters/` | **rewrite** | Candidate boundary ports, subject to removal of shallow pass-through interfaces. |
| `packages/ivory-tower-health/` | **reject** | Archived UI example and temporary health widget are not required by V5 minimum core. |
| `packages/ivory-tower-worker/` | **reference** | Only N3 execution contract and negative fixtures until governed execution is selected. |
| `packages/ivory-tower-agent-experiment/` | **reference** | N7 proposal evidence only; prototype has no durable canonical acceptance authority. |
| `packages/ivory-n5-client/` | **reference** | Client parity scripts/fixtures only; no imported client package before Core read model is stable. |
| `packages/ivory-n5-shell/` | **reference** | Old Theia shell experiment, not a current product plugin. |
| `examples/ivory-n5-browser/` | **reference** | N5 browser fixtures, not V5 deployment. |
| `examples/ivory-tower-browser/` | **reference** | Historical shell/read model example, not shipping V5 workspace. |
| `spikes/n2-durable-store/` | **reference** | PGlite N2 local proof only; no production dependency on spike. |
| `spikes/n6-portable-reproduction/` | **reference** | Reproduction fixture/code is a test reference pending V5 capsule owner. |
| `scripts/n5/` | **reference** | Branch-only N5 harness reference; client qualification remains bounded. |
| `scripts/n7/` | **reference** | N7 original harness reference; no transient proposal acceptance path. |
| `scripts/ivory/` | **reference** | Historical verification and V4.1 gate rules; V5 gates must be independently generated. |
| `.github/workflows/ivory-tower.yml` | **reject** | Archive dev/stable workflow assumes old dev line and old deployment/toolchain. |
| `other` | **reference** | Not selected for runtime; assess by exact path and license before any promotion. |

## Retained immutable historical records

- [`docs/adr-001-application-platform.md`](https://github.com/mberrys/ivory-archive/blob/bfcb283c4fe32b64b67a325f8f55aca08314296f/docs/adr-001-application-platform.md), blob `aca8a952ed8a68cb3ac2bbf4cba90df0efb4525a`; verbatim at `docs/archive-evidence/adr-001-application-platform.md`.
- [`docs/adr-002-runtime-topology.md`](https://github.com/mberrys/ivory-archive/blob/bfcb283c4fe32b64b67a325f8f55aca08314296f/docs/adr-002-runtime-topology.md), blob `e65ec950c0794b8685df069495dcef3ad1dfee4c`; verbatim at `docs/archive-evidence/adr-002-runtime-topology.md`.
- [`docs/adr-003-spike-informed-architecture.md`](https://github.com/mberrys/ivory-archive/blob/bfcb283c4fe32b64b67a325f8f55aca08314296f/docs/adr-003-spike-informed-architecture.md), blob `3d31c701b3646b996d1152b978dcebf7b11b484b`; verbatim at `docs/archive-evidence/adr-003-spike-informed-architecture.md`.
- [`docs/adr-004-n1-exact-reference-contract.md`](https://github.com/mberrys/ivory-archive/blob/bfcb283c4fe32b64b67a325f8f55aca08314296f/docs/adr-004-n1-exact-reference-contract.md), blob `426e2b1f0ba2fb4cdc04f96b32f5797b7086cecc`; verbatim at `docs/archive-evidence/adr-004-n1-exact-reference-contract.md`.
- [`docs/adr-005-storage-engine.md`](https://github.com/mberrys/ivory-archive/blob/bfcb283c4fe32b64b67a325f8f55aca08314296f/docs/adr-005-storage-engine.md), blob `1e6c5d07f39cef112347f68a3984cbff1fcb4f4b`; verbatim at `docs/archive-evidence/adr-005-storage-engine.md`.
- [`docs/adr-006-n5-harness-dependencies.md`](https://github.com/mberrys/ivory-archive/blob/bfcb283c4fe32b64b67a325f8f55aca08314296f/docs/adr-006-n5-harness-dependencies.md), blob `211cc9a94c196c54046b2e57b78ef02c63bf2ff0`; verbatim at `docs/archive-evidence/adr-006-n5-harness-dependencies.md`.
- [`docs/adr-007-v41-authority-harness-boundary.md`](https://github.com/mberrys/ivory-archive/blob/bfcb283c4fe32b64b67a325f8f55aca08314296f/docs/adr-007-v41-authority-harness-boundary.md), blob `7f4539dedcd096d1e67777ee40d2ded63729c05b`; verbatim at `docs/archive-evidence/adr-007-v41-authority-harness-boundary.md`.
- [`docs/adr-008-v41-adr-lineage-supersession.md`](https://github.com/mberrys/ivory-archive/blob/bfcb283c4fe32b64b67a325f8f55aca08314296f/docs/adr-008-v41-adr-lineage-supersession.md), blob `201caea146f6c8f791d72937440b60aad8c0c353`; verbatim at `docs/archive-evidence/adr-008-v41-adr-lineage-supersession.md`.
- [`docs/experiments/n1-v2-evidence.json`](https://github.com/mberrys/ivory-archive/blob/bfcb283c4fe32b64b67a325f8f55aca08314296f/docs/experiments/n1-v2-evidence.json), blob `3c5c2d2a77da4e2922d900200c71e5f9826cd976`; verbatim at `docs/archive-evidence/experiments/n1-v2-evidence.json`.
- [`docs/experiments/n1-v2-reference-kernel.md`](https://github.com/mberrys/ivory-archive/blob/bfcb283c4fe32b64b67a325f8f55aca08314296f/docs/experiments/n1-v2-reference-kernel.md), blob `edb587f276d3b83b0cf8908eed1a634e8daf56ad`; verbatim at `docs/archive-evidence/experiments/n1-v2-reference-kernel.md`.

All other `docs/experiments/**` records, including N2 storm raw cycles, N5 browser evidence, N7 live-provider transmission files, remain **external, exact SHA-pinned references** in `archive-source-manifest.json` rather than duplicated into the fresh fork. Do not rewrite their claims or ingest sensitive raw provider bodies without review.

## Branch-only implementation decisions

- `N5-architecture-proof`: 11 commits ahead of archive dev, 48 relevant blob differences; **reference** its alternate browser/plugin-host harness until a V5 client contract is chosen. No automatic plugin-host inclusion.
- `cursor-n7-proposal-integrity-aeda`: 2 commits ahead, 4 relevant blobs differ from dev (original N7 evidence and catalog); **reference** both heads; compare retained records before selecting a proposal shape.
- `v2-n1-experiment`: 1 commit ahead, 20 relevant blobs differ, mainly an older in-memory reference kernel and evidence; **reference** historical source, **rewrite** production Core from N1 invariants rather than merging the spike.
- `closeout/n1-n7`, `feat/v41-p02-fragment-context`, `pre-dev-foundation`, `unstable`, and `cursor-fix-authority-reachability-80e7`: ancestry reachable from dev. Do not infer that earlier versions equal the dev tree: the manifest pins both historical and selected tree identities.

## Work remaining before R1 closure

Explicit source/header license assessment, code/API comparison to V5 design, positive and negative fixtures per port, destination blob SHA after admission, and hosted/local store choice. Import only the accepted implementation paths after J1/J2 and the required four independent /architect + four independent /interrogate runs. The historical ADR-001…008 records are preserved verbatim, not changed to pronounce V5 decided.
