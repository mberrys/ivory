# V4.1 authority reconciliation

This record implements the contract/design portion of V41-P01 through its four executable leaves. It does not claim Q1-Q4, durability, replay, hosted support, or release qualification.

## Exact authority basis

| role | exact SHA | disposition |
|---|---|---|
| detached baseline | `efec71ed83a1d0d9d513a4ead86369201cb5b401` | historical comparison only |
| PR #1 foundation head | `ecc406d34a9bf49d8e2f165b994a919ca90ff718` | retained foundation evidence only |
| selected dev | `bc3cd03b5b2d870d219797925d92edc48c33c6ca` | implementation and package/schema audit basis |

`selectedDev` is the only selectable authority for this reconciliation. Package ownership is pinned by the exact `package.json` git blob IDs in `configs/ivory-v41-authority-heads.json`; branch names, inferred inventories, and latest-head substitution are not accepted as evidence.

## Canonical ownership and harness boundary

`configs/ivory-v41-owner-map.json` maps Source, Fragment, EvidenceLink, Statement/Claim, Artifact, Activity, Snapshot, ResearchProtocol, assessments, research-decision receipts, execution receipts, and CAS to one canonical structural owner. Missing V4.1 fields remain explicit gaps for later leaves rather than being implemented as new stores.

The execution harness is intentionally not a semantic authority. It may own runs, tool/provider routing, permissions, immutable execution traces, replay, evaluation orchestration, and Dream-RSI-style exploration/orchestration improvement. Core retains research semantics, provenance, acceptance, researcher authority, protected evaluation standards, rollback, and regression fixtures. Research state and improvement state remain separate. Theia, CLI, API, and other clients are replaceable projections and command surfaces; they cannot adjudicate locally or reconnect to a newer head silently.

### Owner-map reconciliation at the merged head

The N1-N7 closeout merge `f8d0af66a` was carried into the owner map as an exact-head audit rather than as narrative. `configs/ivory-v41-owner-map.json` now retains a `carrierReadback` record under the same `sha256` / `utf-8` / `normalize-lf` / POSIX-separator convention the carrier matrix uses: it is bound to `configs/ivory-v41-authority-heads.json` (SHA-256 `277e549d4d94e52fe3d8f38b0aa654b53bfb8dc1a2377d5b34dfe186093f09b4`, 5392 bytes), it records the exact working tree it was audited against (`refs/heads/dev` at `cadc8ed512a1f6322c55d00b1c5fdff2fdbcdb5b`, the pre-commit tip this issue reconciled), and it records the SHA-256 and byte count of every carrier file the twelve surfaces name. The validator now resolves each surface's `<path>#<symbol>` carrier to a declaration inside the package that owns it, resolves every secondary `owner#symbol` against the exact-head package inventory, and fails closed when a carrier file or symbol is absent from the tree, when the carrier is not inside the owning package or the owner is not a package in that inventory, when the readback is missing, unbound to the manifest it hashes, incomplete, or does not match the bytes on disk, when a surface has no owner, no carrier, no explicit missing-field list, or no explicit secondary list, when a `missingFields` entry is not a non-empty string, and when a canonical key or a planning synonym re-declares a forbidden duplicate authority.

**What the audit changed.** Three rows moved to the truth on the merged tree. `CAS` no longer names the adapters' generic immutable-object port as its canonical carrier: the closeout line promoted the durable-store port accepted by ADR-005 (`packages/ivory-tower-contracts/src/durable-store-port.ts#DurableStorePort`, whose blob identity is the SHA-256 of the raw bytes and whose ordering admits bytes before commit), so the canonical CAS surface is now owned by `@ivory-tower/contracts` with the durable implementation (`@ivory-tower/infrastructure#FilesystemObjectStore`) and the immutable-bytes port (`@ivory-tower/adapters#ObjectStorePort`) retained as non-canonical secondaries. `Snapshot` gained its real projection carrier as a non-authoritative secondary, `@ivory-tower/research-kernel#ResearchClient`, which is the snapshot-scoped read path the retained N5 record exercised. `Fragment`'s bare `@theia/ivory-identity` secondary was sharpened to the declared `FragmentAnchor`. The remaining nine surfaces were re-resolved unchanged. The client and shell layers the merge added (`packages/ivory-n5-client`, `packages/ivory-n5-shell`) are spike-package transport code: they own no canonical surface, and the clients boundary above is unchanged.

**What the audit did not change.** All fifteen missing-field entries stay open, because none of them is implemented anywhere under `packages/**`: there is still no typed assessment carrier (semantic support is the literal `'not-assessed'` in `types.ts`), no decision-class research receipt, no CAS-first commit/recovery or restore readback implementation, no governed proposal envelope, no artifact disclosure/replay level, no protocol query/stopping receipt, and no execution provider/tool/query pins. Closing one here would be a false claim, so typed Assessment carriers stay owned by IV41-021, durable CAS and restore readback by IV41-016 and V41-I07.4, adjudication receipts by IV41-023, and governed proposal envelopes by IV41-041.

Reviewer disposition: the owner table, the exact-head carrier readback, and the unchanged additive-field list are retained as this issue's evidence. The audit is design/structural, it makes no gate closure claim, no gate moves off `not-run`, and no human qualification is asserted.

## N1-N7 carrier reconciliation

`configs/ivory-v41-carrier-matrix.json` gives every N1-N7 lesson exactly one current structural carrier or one owned downstream gap, plus a predicate, fixture pointer, retained fixture readback, gate, and scope limitation. A carrier is one owner plus the units that resolve on this tree as `<repository-relative path>#<symbol>`; `scripts/ivory/n-gates.mjs` stays the only N1-N7 gate evaluator, and this matrix cites the closed gates rather than re-evaluating them.

### N1–N7 carrier reconciliation after the closeout merge

The closeout merge `f8d0af66a` landed the seven retained spike records, so the matrix was reconciled against the closed gates instead of the earlier head, and every value in it is now read back from those records and from the merged tree. N5's recorded limit no longer says the evidence is absent on the selected dev head: the retained record shows `decision: passed` for four-client equivalence, twelve ordered competing edits, restart around an accepted-but-undelivered receipt, and exact citation navigation against the one canonical Core service on win32/x64 at `http://127.0.0.1:4100` with Theia 1.75.0, and its limit is now the scope that record actually observed — no notebook surface, and no desktop, cross-platform, hosted-service, or independent second-machine reproduction. N2 and N6 are carriers rather than owned gaps: N2 is carried by the accepted durable-store port in `@ivory-tower/contracts` together with the infrastructure adapters that exist on this tree (`FilesystemObjectStore`, `runIvoryMigrations`), and N6 by the capsule export/validate/restore and replay tooling under `spikes/n6-portable-reproduction`. Both keep their unproven production qualification in an explicit `residualGap` — V41-I07 for production durable-store commit/recovery and restore readback, V41-I09 for independent capsule replay — so nothing is rounded up to a pass.

N1, N3, N4, and N7 were re-resolved on the merged tree, and N3's carrier is now split honestly: the attempt-fenced execution record and events live in `@ivory-tower/domain`, while `ExecutionJob`, `EgressPolicyPort`, and `ProviderPort` are the typed ports of `@ivory-tower/adapters`. The remaining limits stay bounded to what was recorded: N3 to the Windows 11 x64 pilot platform with Docker Desktop and to macOS/Apple Silicon remaining unqualified, N4 to the retained 22-fixture corpus and pinned converter digests, N6 to the clean-install runbook, which records `blocked` with an isolated same-machine restore rather than a second installation, and N7 to its one bounded local-provider run. Each lesson also records the SHA-256 and byte count of its fixture under the matrix's `fixtureReadback` convention, so the validator resolves every carrier unit to a file and a declared symbol, hashes every fixture against the recorded digest, and fails closed on a missing fixture, a wrong digest or byte count, or a lesson that offers only prose. The `carrier` XOR `ownedGap` rule is unchanged and still fail-closed; `ownedGap` remains available for a lesson with no carrier on this tree.

## Gate registration

`configs/ivory-v41-gates.json` registers DURABILITY, REPLAY, and Q1-Q4. Every gate starts `not-run` and separately names machine evidence, human receipts, adversarial cases, and stop conditions. There is no aggregate pass flag and no machine predicate may infer a human research outcome.

### Gate registry reconciliation

The registry was authored on a head that predates the N1-N7 closeout, so it named its machine predicates in prose only. It now carries a `machineRunners` binding per gate — one entry per real runner, each naming the repository-relative `module`, the root `package.json` `command` that runs it, and the retained `evidence` record the run is bound to — plus a `machineReadback` block under the same `sha256` / `raw-bytes` / POSIX-separator convention the carrier matrix uses, which retains the SHA-256 and byte count of every one of those runner modules and records. `DURABILITY` is bound to the N2 durability runner (`scripts/verify-ivory-n2-v2.mjs` via `verify:ivory-n2-v2`, record `docs/experiments/n2-v2-evidence.json`); `Q1` to the two exact-anchor runners (`scripts/verify-ivory-n1.mjs` via `verify:ivory-n1` and `scripts/verify-ivory-n4-v2.mjs` via `verify:ivory-n4-v2`, with the `n1-v2` and `n4-v2` records); `REPLAY` to the portable-reproduction runner (`spikes/n6-portable-reproduction/verify.mjs` via `verify:ivory-n6`, record `docs/experiments/n6-evidence.json`); `Q3` to the N5 client-equivalence comparator and record writer (`scripts/n5/compare.mjs` via `test:n5` and `scripts/n5/evidence.mjs` via `evidence:n5`, record `docs/experiments/n5-v2-evidence.json`); and `Q4` to the governed-compute runner, its retention step, and the proposal retention runner (`scripts/ivory/n3-compute.mjs` via `verify:ivory-n3` and `scripts/ivory/n3-retain.mjs` via `retain:ivory-n3` with record `docs/experiments/n3-evidence.json`, plus `scripts/ivory/n7-retain.mjs` via `verify:ivory-n7` with record `docs/experiments/n7-v1-evidence.json`).

`Q2` is explicitly unbound. No module on this tree emits the bounded coverage/stopping observable the gate scores — there is no bounded alternate-query record, contrary/null result artifact, or coverage computation — and `ResearchProtocol` still carries `coverage/stopping receipt refs` as an open missing field in `configs/ivory-v41-owner-map.json`. The gate therefore records `machineRunners: []` with an `unboundReason` naming IV41-036 (bounded completeness, abstention, coverage, and stopping receipts) and IV41-031 (bounded query/provider receipt refs), so the gap is machine-visible instead of prose.

Every gate stays `not-run`, including the five that now name a real runner: a runner existing is not a qualification, and no record here claims one. The registry makes no closure claim — there is no aggregate flag, no `passed`/`qualified` state, no closure field, and no way to infer a human research outcome from a machine result. The validator now fails closed on a runner module or record that is absent from the tree, a `command` the root `package.json` does not declare, a missing or non-file `evidence` path, a readback digest or byte count that no longer matches the bytes on disk, a readback set that does not cover exactly the bound runners and records, a gate that offers neither a runner nor a reason (or both), an `unboundReason` that names no tracked issue, and any outcome field or state other than `not-run`. The N1-N7 roll-up (`test:ivory-n-gates`, `verify:ivory-n-gates`) is now part of the required `verify:ivory-tower` chain, so the closed N1-N7 records this registry cites cannot rot silently again.

## Source register

The machine manifest retains direct links for Ivory Master Plan v4.1 and source plans A-F. These pages are architecture/design sources, not execution proof. The implementation follows the parent/leaf order `V41-I01.1 -> V41-I01.2 -> V41-I01.3 -> V41-I01.4`.

## Verification

Run:

```text
npm run verify:ivory-v41-authority
npm run test:ivory-v41-authority
```

The first command emits SHA-256 digests for all four contract artifacts and fails closed on authority drift. The second covers stale/latest-head selection, inferred package inventories, package-manifest drift, duplicate semantic authority, harness/RSI authority leakage, prose-only carrier claims, and aggregate/pre-closed gates.


## IV41-003 package ownership reconciliation

Package-level authority is retained in `configs/ivory-v41-package-ownership.json`, bound to the same exact selected-dev package inventory as V41-I01.1. The reconciliation separates package scope from authority: only `@ivory-tower/research-kernel` owns canonical research-state writes and research acceptance, while `@ivory-tower/infrastructure` owns the durable storage implementation. Adapter, client, worker, policy, and experiment packages remain non-authoritative over research meaning.

| V4.1 responsibility | canonical package owner | authority limit |
|---|---|---|
| identity | `@theia/ivory-identity` | identifiers only; no acceptance or persistence |
| domain | `@ivory-tower/domain` | platform-free execution/domain invariants |
| application | `@ivory-tower/application` | use-case orchestration only |
| adapters | `@ivory-tower/adapters` | typed ports only |
| storage | `@ivory-tower/infrastructure` | durable implementation; no semantic acceptance |
| research protocol | `@ivory-tower/contracts` | versioned structural contracts |
| evidence | `@ivory-tower/research-kernel` | sole canonical research writer and acceptance owner |
| compute | `@ivory-tower/worker` | bounded execution; proposal/result production only |
| clients | `@ivory-tower/api` | HTTP/SSE client boundary; no shadow kernel |
| health/diagnostics | `@ivory-tower/health` | diagnostics surface only |
| content policy | `@ivory-tower/content-policy` | rights/content admission, not research support |
| agent proposal harness | `@ivory-tower/agent-experiment` | bounded qualification harness, not a production authority |

The validator fails closed if the exact package inventory is not covered, a responsibility gains multiple owners, another package acquires research acceptance or canonical-write authority, or the evidence context no longer matches the selected-dev SHA. The 15 missing fields already retained in the V41-I01.2 owner map are each mapped to an existing `IV41-*` roadmap issue; dropping one, duplicating one, or replacing its issue with session notes is also a validation failure.

## ADRs and lineage (IV41-004)

`configs/ivory-v41-adr-lineage.json` is the machine contract: one registry and one decision list, loaded and validated by `scripts/ivory/v41-authority.mjs` in the same whole-bundle check as the rest of the V4.1 contracts. The registry covers the historical V3 ORX architecture source and every ADR that exists on this line — `docs/adr-001-application-platform.md` through `docs/adr-006-n5-harness-dependencies.md`, plus the two this issue adds, `docs/adr-007-v41-authority-harness-boundary.md` and `docs/adr-008-v41-adr-lineage-supersession.md`. Identifiers are zero-padded `ADR-###`, registry order is strictly increasing, paths are unique, and ADR-001 through ADR-006 are neither renumbered nor rewritten.

Every reconciled decision is classified as `inherited`, `amended`, `deferred`, or `superseded` — those four and nothing else — and must name its `source`, `carriedBy`, `statement`, `evidenceBoundary`, and `evidenceHeads`. Historical records stay `retainedIntact`; supersession is explicit-only, so the target must exist in the registry, cannot be the record itself, and cannot form a cycle; a deferred architectural gap must name a registered gate id or a tracked issue id, and an issue-tracked gap carries its tracking URL, so a gap cannot survive as session notes. A lineage entry may not declare research acceptance or canonical research-state writes: `configs/ivory-v41-owner-map.json` and `configs/ivory-v41-package-ownership.json` remain the single sources for that.

The evidence context is the exact-head manifest rather than a narrative: `configs/ivory-v41-authority-heads.json` names the three roles `detachedBaseline`, `foundationPr`, and `selectedDev`, and the lineage is bound to the same selectedDev head `bc3cd03b5b2d870d219797925d92edc48c33c6ca`, retained intact as history. The reconciliation merge `f8d0af66aa10d419cd18fb5f649f0eabfc63cd5d` is recorded as an exact observation of the line these ADRs land on, and lineage decisions may name only those three head ids.

The machine contract currently records: one-Core authority as inherited; Claim Card authority as amended to a non-canonical projection; Research Capsule independent-reproduction qualification as deferred to gate `Q3`; V3 ORX as the current architecture qualification target superseded by ADR-007 while its one-Core invariants remain inherited separately; and the semantic-support Assessment carrier as deferred to tracked issue `IV41-021`.

Verify with:

```text
node scripts/ivory/v41-authority.mjs
node --test scripts/ivory/v41-authority.spec.mjs
```

ADR text cannot close a gate. None of these lineage entries executes Q1-Q4, durability, or replay evidence, none moves a gate off `not-run`, and none implements a deferred carrier: ADR-007 and ADR-008 record decisions the existing V4.1 contracts already carry structurally, and IV41-004 introduces no second status or qualification registry.

### Retained readback convention

Every retained readback in the V4.1 bundle (`fixtureReadback`, `carrierReadback`, `machineReadback`,
and the qualification `digestConvention`) declares `sha256` / `utf-8` / `normalize-lf` with POSIX
paths, and `scripts/ivory/v41-authority.mjs` folds CRLF to LF before hashing a text fixture (a
fixture containing a NUL byte keeps its raw bytes). The earlier `raw-bytes` / `preserve-bytes`
convention recorded the Windows working-tree bytes of files that carry no `eol=lf` pin, so the
recorded identity was the CRLF materialisation while the stored blob is LF: the ubuntu-22.04 gate
failed closed on every pinned record with "fixture byte count / SHA-256 does not match the retained
readback". The values recorded here are the stored-blob identity and hold on every platform.
