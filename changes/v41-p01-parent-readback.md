# V41-P01 — parent integration readback

## Plan

1. Name every child of the parent at the current dev tip: the four leaves (`V41-I01.1`–`V41-I01.4`) with the exact artifact each one owns, its `sha256` and byte count under the bundle's `normalize-lf` readback convention, and the verification command that actually ran for it.
2. Record the exact dependency basis the parent rests on: the pinned authority head and tree, the green quality-gate run that observed that head, the reconciliation merge, the retained superseded selection, and the environment the observation was taken in.
3. Map the A–F lineage letters and the N1–N7 obligations to what the parent actually carries, and say plainly where a letter or lesson has no distinct carrier instead of inventing one.
4. Exercise every adversarial acceptance case with evidence that it is a live blocker rather than prose.
5. Make this readback machine-visible so it cannot rot silently: `scripts/ivory/v41-authority.mjs` fails closed when the note is missing, when a leaf id is absent, or when the recorded `selectedDev` anchor no longer matches the heads manifest.
6. Retain the whole-bundle verification at this tip and state the evidence boundary.

This is the parent's *integration readback*. It is contract/design evidence: it claims no execution, production, hosted, or release completion, no gate moves off `not-run`, and no human receipt.

## Implementation

- `changes/v41-p01-parent-readback.md` (this note) is the parent's own retained readback, in the same Plan / Implementation / Evidence convention as the sibling notes under `changes/`.
- `scripts/ivory/v41-authority.mjs` gains one parent-level predicate (`validateParentReadback`, wired into the existing `validateBundle`): the note must exist at `changes/v41-p01-parent-readback.md`, must name each leaf id `V41-I01.1`, `V41-I01.2`, `V41-I01.3`, `V41-I01.4` as a literal anchored id (not as prose, and not as a longer id such as `V41-I01.14`), and must record the pinned selection as a literal `selectedDev: <40-character SHA>` line whose value equals the manifest's current `selectedDev` head.
- `scripts/ivory/v41-authority.spec.mjs` gains the adversarial cases for that predicate. The note text is injected through `options.parentReadbackText` (with `null` modelling an absent note) so the spec never depends on the live file for its negative cases.
- `docs/plans/ivory-v4-1-working/authority-reconciliation.md` gains a short parent section pointing here.
- No gate state changes, nothing is qualified, no `packages/**` file is touched, and no second registry, evaluator, or acceptance owner is introduced — the check is one more predicate inside the one existing whole-bundle verifier.

## Leaves and their artifacts

Every digest below was recomputed at this tip through the exported `readbackIdentity` from `scripts/ivory/v41-authority.mjs` (`sha256` over LF-normalized content, `encoding: utf-8`, `lineEndingPolicy: normalize-lf`, POSIX paths; `bytes` is the length of the normalized content). Each leaf's artifact is a committed file, and the verification column names the command that was really executed.

| leaf | artifact | sha256 | bytes | verification actually run |
|---|---|---|---|---|
| `V41-I01.1` three-head and package manifest | `configs/ivory-v41-authority-heads.json` | `ccad89546e1d224540456dd010f9eb42e796666fe3c6a3f5316acd5c8040e44d` | 6859 | `node scripts/ivory/v41-authority.mjs` → valid (reachability, distinct heads, one selectable, 12 pinned package blobs) |
| `V41-I01.2` canonical-owner map | `configs/ivory-v41-owner-map.json` | `eb0e8aeb1a0540d23c8150a767de7d3be43c380aced11ef2c1c32eb7be8655d9` | 7307 | `node scripts/ivory/v41-authority.mjs` → valid (12 surfaces, one owner and one declared carrier each, carrier readback re-hashed) |
| `V41-I01.3` N1–N7 lesson-to-carrier matrix | `configs/ivory-v41-carrier-matrix.json` | `7f6854cc0e461e399eab3a226de02b08e49083fe0b91c340f66496ec6b88f061` | 13190 | `node scripts/ivory/v41-authority.mjs` → valid; `node scripts/ivory/n-gates.mjs` → `7/7 N-gates closed.`; `node --test scripts/ivory/n-gates.spec.mjs` → 18/18 pass |
| `V41-I01.4` machine gate registry | `configs/ivory-v41-gates.json` | `09f8ef00dd48922db58056bd4da38b4affc5c01d39b043fc52dc72448650c11f` | 10480 | `node scripts/ivory/v41-authority.mjs` → valid (six gates `not-run`, runner bindings and machine readback re-hashed); `npm run -s test:ivory-n7` → 27/27 pass |

Sibling artifacts that landed on the same surfaces are not leaves of this parent and are not claimed as such: `configs/ivory-v41-package-ownership.json` (IV41-003), `configs/ivory-v41-adr-lineage.json` with `docs/adr-007-*.md` / `docs/adr-008-*.md` (IV41-004), `configs/ivory-v41-qualification.json` (IV41-005) and `configs/ivory-v41-canonical-model.json` (IV41-010, verified by `node scripts/ivory/iv41-010-model.mjs` → valid and `node --test scripts/ivory/iv41-010-model.spec.mjs` → 20/20 pass). They are carried by the same whole-bundle verifier, so a leaf cannot rot without the parent failing.

The four leaves are also exactly the ordered dependency chain `V41-I01.1 → V41-I01.2 → V41-I01.3 → V41-I01.4`, and the verifier asserts that chain (`dependsOn` per artifact) as part of the same run.

## Dependency basis

The parent's integration predicate is the whole-bundle verifier at one exact head, so the head is named, not implied.

| fact | value | how it was observed at this tip |
|---|---|---|
| selected authority (`selectedDev`, the only selectable head) | `41fa0e19889fad7fdedef45a8c21944e7d923e68` | `configs/ivory-v41-authority-heads.json#heads[role=selectedDev]`; `git merge-base --is-ancestor 41fa0e198… refs/heads/dev` → exit 0 |
| pinned tree | `14e6e62079396a33409752b17a6a380db31571c1` | `git rev-parse 41fa0e198…^{tree}` → `14e6e62079396a33409752b17a6a380db31571c1` |
| quality-gate run for that head | `35481120037`, workflow `Ivory Tower quality gate`, event `push`, `refs/heads/dev`, `headSha 41fa0e198…`, conclusion `success`, created `2026-09-20T01:20:02Z`, completed `2026-09-20T01:34:06Z` | `gh run view 35481120037 --repo mberrys/ivory --json …` re-queried at this tip |
| the run's four jobs | `Verify (windows-2022)` `01:20:04Z → 01:29:23Z`; `Verify (ubuntu-22.04)` `01:20:05Z → 01:24:57Z`; `Dependency governance evidence (IV-19)` `01:20:05Z → 01:21:29Z`; `Runtime and migration recovery (Session 04)` `01:29:25Z → 01:34:05Z` — all `success` | same `gh run view` payload (`jobs[].conclusion`) |
| reconciliation merge | `f8d0af66aa10d419cd18fb5f649f0eabfc63cd5d` | `git merge-base --is-ancestor f8d0af66… refs/heads/dev` → exit 0 |
| superseded selection (retained, never authority) | `bc3cd03b5b2d870d219797925d92edc48c33c6ca`, tree `8edc9eab81e3733b60eb626c10ca91de63bd041c`, `selectable: false`, `supersededBy` the pinned head, merge `f8d0af66…` | `configs/ivory-v41-authority-heads.json#supersededSelections[0]`; `git merge-base --is-ancestor bc3cd03b… 41fa0e198…` → exit 0 |
| dev tip this readback was taken at | `898a72b57589adaf18b9cb478106b4f5c37929a4` (`= origin/dev` at the time of the run) | `git rev-parse HEAD origin/dev` |
| environment observed | win32 `10.0.26200`, x64 (MINGW64/MSYS bash); Node `v24.16.0`; npm `11.13.0` | `uname -a`, `node --version`, `npm --version`; the same OS/runtime triple is what `configs/ivory-v41-qualification.json#runContext.environment` records |

The pinned selection is also recorded as a literal anchor line, which is what the machine check reads (one line, one head):

```text
selectedDev: 41fa0e19889fad7fdedef45a8c21944e7d923e68
```

The run is the *observation context* for the pinned head. It is not a qualification of the V4.1 gates: the required gate suite does not close Q1–Q4, DURABILITY, or REPLAY, and every gate stays `not-run` in `configs/ivory-v41-gates.json`.

The pinned head is an ancestor of this tip, so the leaf artifacts verified here are the ones the authority names. The parent makes no claim about heads it did not verify: the detached baseline `efec71ed83a1d0d9d513a4ead86369201cb5b401` and the PR #1 foundation head `ecc406d34a9bf49d8e2f165b994a919ca90ff718` are retained as non-selectable comparison heads only.

## A–F lineage mapping

`configs/ivory-v41-authority-heads.json#sourceRegister` is the machine register: the Ivory Master Plan v4.1 plus the six source plans `A`–`F`, each as a direct link. It carries **links only** — no plan text, no per-plan artifact, no per-plan execution evidence. What the parent actually carries per letter, stated plainly:

| lineage | source (register) | what the parent carries it as |
|---|---|---|
| master plan v4.1 | `sourceRegister.masterPlan` | the parent contract set itself: the exact-head authority manifest, the owner map, the carrier matrix, and the gate registry, verified as one bundle by `scripts/ivory/v41-authority.mjs` |
| A | `sourceRegister.plans.A` | the register entry only. **No distinct carrier exists on this line** beyond the shared authority / owner / carrier contracts; the parent does not invent one. |
| B | `sourceRegister.plans.B` | the register entry only. **No distinct carrier exists on this line** beyond the shared authority / owner / carrier contracts. |
| C | `sourceRegister.plans.C` | the register entry, plus the one artifact the manifest derives from it: the detached baseline head `efec71ed83a1d0d9d513a4ead86369201cb5b401`, whose recorded identity is `detached checkout recorded by V4 plan C`. It stays `selectable: false` and is a comparison head, not authority. |
| D | `sourceRegister.plans.D` | the register entry only. **No distinct carrier exists on this line** beyond the shared authority / owner / carrier contracts. |
| E | `sourceRegister.plans.E` | the register entry only. **No distinct carrier exists on this line** beyond the shared authority / owner / carrier contracts. |
| F | `sourceRegister.plans.F` | the register entry only. **No distinct carrier exists on this line** beyond the shared authority / owner / carrier contracts. |

So: only lineage **C** has any artifact beyond the register (a non-selectable head identity), and it is not a carrier of the plan's content either. The register's own limit applies to all seven rows — these pages are architecture/design sources, not execution proof — and the verifier keeps them that way by validating the register as links rather than as evidence. Nothing in this readback claims that plans A, B, D, E, or F are implemented, mapped, or verified by this line.

## N1–N7 obligation mapping

As `configs/ivory-v41-carrier-matrix.json` now records it: every lesson carries exactly one structural carrier (owner plus units that resolve on this tree as `<repository-relative path>#<symbol>`) or an owned gap, plus a predicate, a fixture with a retained readback, a gate, and a scope limit. On this tree all seven lessons have a carrier; **no lesson is left on an `ownedGap`**, and the two lessons whose production qualification is still unproven keep that in an explicit `residualGap` rather than a pass.

| lesson | obligation (predicate, abbreviated) | carrier (owner → units) | gate | limit / owned gap |
|---|---|---|---|---|
| N1 | exact refs resolve at their recorded revisions and semantic carry-forward is explicit | `@ivory-tower/research-kernel` → `types.ts#ExactRef`, `#RevisionRecord`, `#SnapshotRecord`, `#EvidenceLinkPayload`, `#ActivityRecord` | Q1 | reference-kernel-only: in-memory reference model on win32 x64, closed by 3 human reader-protocol seats; representation remapping, PDF/OCR anchors, and production schema persistence were not qualified |
| N2 | acknowledged semantic effects survive tested interruption and restore without duplication | `@ivory-tower/contracts` → `durable-store-port.ts#DurableStorePort`, `#AdmissionReceipt`, `#CommitReceipt`, `#SemanticExport`; `@ivory-tower/infrastructure` → `filesystem-object-store.ts#FilesystemObjectStore`, `node/migrate.ts#runIvoryMigrations` | DURABILITY | one Windows NTFS reference-machine observation (1000 interruption cycles, 0 failures); hardware power loss, removable media, cross-platform behaviour, and the production durable-store implementation were not tested. `residualGap`: `V41-I07` (leaves `V41-I07.1`–`V41-I07.4`), `status: open` |
| N3 | stale or revoked attempts cannot publish and execution remains replayable | `@ivory-tower/domain` → `execution.ts#ExecutionRecord`, `#ExecutionEvent`; `@ivory-tower/adapters` → `execution-ports.ts#ExecutionJob`, `#EgressPolicyPort`, `#ProviderPort` | Q4 | pilot platform Windows 11 x64 with Docker Desktop (Linux containers) only; macOS/Apple Silicon not qualified; evidence tooling rather than a production Compute adapter |
| N4 | an exact anchor reopens to the same retained bytes or remains explicitly ambiguous | `@ivory-tower/research-kernel` → `types.ts#FragmentPayload`, `#FragmentAnchorIdentity`, `#MechanicalCitationReceipt`, `#FragmentRemapReceipt`; `node/kernel.ts#remapFragment`, `#verifyCitation` | Q1 | retained 22-fixture corpus and pinned converter scope only; no wider corpus, no user/role authorization boundary |
| N5 | Theia/CLI/API reads use the requested snapshot and return semantically identical results | `@ivory-tower/research-kernel` → `types.ts#SnapshotRecord`, `node/clients.ts#ResearchClient`, `#createResearchClients` | Q3 | observed live on win32/x64 against the one canonical Core service on loopback with the isolated `@ivory-tower/n5-browser` workbench and Theia 1.75.0; no notebook surface, and no desktop, cross-platform, hosted-service, or independent second-machine reproduction |
| N6 | capsule closure verifies retained dependencies and an independent operator can reproduce | `spikes/n6-portable-reproduction` → `portable.mjs#exportStudy`, `#validateExport`, `#restoreStudy`, `reproduce.mjs#reproduce` | REPLAY | technical-pass on Windows with a trusted synthetic study; the second-machine clean install records `blocked`; the retained clean reproduction is an isolated same-machine restore; no public format freeze. `residualGap`: `V41-I09` (leaves `V41-I09.1`–`V41-I09.4`), `status: open` |
| N7 | stale/revoked/cross-project proposals fail closed and researcher adoption remains governed | `@ivory-tower/research-kernel` → `types.ts#AcceptAgentProposalInput`, `#AgentProposalReceipt`, `node/kernel.ts#acceptAgentProposal` | Q4 | bounded local-provider run: one retained run against a loopback llama.cpp model, in-memory acceptance and receipts only; no restart or crash-durability claim, no Theia integration or production authentication, no hosted-provider qualification |

The matrix cites the closed N1–N7 records; it does not re-evaluate them. `scripts/ivory/n-gates.mjs` stays the only N1–N7 gate evaluator and reports `7/7 N-gates closed.` on this tree. A closed spike gate is not a V4.1 gate closure: the six registered V4.1 gates remain `not-run`.

## Adversarial acceptance

Each case below is a live blocker enforced by the bundle at this tip, not a prose promise. The rejection text is real output from `scripts/ivory/v41-authority.mjs` driven over mutated candidates (the probe is reproduced in the Evidence section).

| adversarial case | how it stays a live blocker | observed evidence |
|---|---|---|
| stale or fabricated authority head | the verifier proves reachability against the real object graph (`git merge-base --is-ancestor <pinned sha> refs/heads/dev`); a fabricated 40-character SHA, a real commit off the dev line, and a clone that does not carry the head all fail closed. A superseded selection is additionally required to be a real commit in the pinned head's history and is rejected if marked `selectable: true`. | `BLOCKED: I01.1: selectedDev dddddddd… must be a real commit reachable from refs/heads/dev`; `BLOCKED: I01.1: selectedDev ecc406d34a9bf49d8e2f165b994a919ca90ff718 must be a real commit reachable from refs/heads/dev` |
| duplicate authority | the owner map declares six forbidden duplicate authorities (`PaperStore`, `ClaimCardStore`, `ResearchCase`, `WorkflowStateStore`, `ClientAcceptance`, `HarnessSemanticAuthority`) and the verifier rejects any canonical key or planning synonym that re-adds one; package ownership asserts exactly one acceptance owner, one canonical-write owner, and one durable-storage implementation owner across the 12 selected-dev packages. | `BLOCKED: I01.2: forbidden duplicate authority surfaced as canonical: ClaimCardStore`; `BLOCKED: IV41-003: research acceptance must have exactly one owner: @ivory-tower/research-kernel` |
| latest-head substitution | every recorded ref must be exact and non-latest (`/latest|current/i` is rejected) in the manifest, the owner map readback, the package-ownership contexts, the ADR lineage, and the qualification run context; the manifest must select through an exact ref that resolves. | `BLOCKED: I01.1: selectedDev ref must be an exact non-latest ref`; `BLOCKED: IV41-005: runContext.repository.ref must be an exact non-latest ref` |
| unbounded payloads | every carrier lesson must record a non-empty platform/operator/evidence limit and a fixture digest plus byte count; every qualification record must retain at least one limitation with `id`/`kind`/`effect`/`statement`, a `not-run` record may claim no fixtures and no evidence, and the registry's machine readback pins the SHA-256 and byte count of every bound runner and record. | `BLOCKED: I01.3: N4 is missing a platform/operator/evidence limit`; `BLOCKED: IV41-005 Q1: at least one limitation is required` |
| hidden qualifications | all six registry gates must read `not-run` (`gate.state === 'not-run'` is asserted), the registry and the qualification manifest forbid `aggregatePass` / `overallPass` / `overallStatus` and every other outcome field, and a `qualified` decision requires human or joint authority, a clean worktree, and a zero verifier exit code. Observed state on this tree: registry `DURABILITY, Q1, Q2, REPLAY, Q3, Q4` all `not-run`; qualification decisions `not-run`, `inconclusive`, `not-run`, `inconclusive`, `inconclusive`, `inconclusive` — **none is `qualified`**. | `BLOCKED: I01.4: Q1 must remain not-run until executable retained proof exists`; `BLOCKED: IV41-005 Q1: qualified decisions require human or joint authority` |
| a second acceptance owner | the owner map names exactly one canonical owner per surface (12 surfaces: `@ivory-tower/research-kernel` 9, `@ivory-tower/contracts` 2, `@ivory-tower/domain` 1 — no surface has two owners, and the authority boundaries keep Core the only semantic authority), and package ownership must have exactly one package with `researchAcceptance: true`. | `BLOCKED: IV41-003: research acceptance must have exactly one owner: @ivory-tower/research-kernel` |
| this readback itself | the parent's own acceptance artifact cannot silently rot: a missing note, a missing leaf id, a leaf id only mentioned in prose or as a longer id, and a recorded `selectedDev` anchor that no longer matches the manifest all fail closed. | `BLOCKED: V41-P01: the parent integration readback is missing: changes/v41-p01-parent-readback.md must exist and be readable`; `BLOCKED: V41-P01: the parent integration readback must name leaf V41-I01.3 as a literal id`; `BLOCKED: V41-P01: the parent integration readback records selectedDev aaaa…, which does not match the pinned selectedDev 41fa0e19889fad7fdedef45a8c21944e7d923e68` |

## Commands actually run at this tip

All commands below were executed in this worktree at `898a72b57589adaf18b9cb478106b4f5c37929a4` (`= origin/dev`), on the pinned toolchain. The worktree carried only this issue's own uncommitted changes (`scripts/ivory/v41-authority.mjs`, `scripts/ivory/v41-authority.spec.mjs`, and this note); the four leaf artifacts and every fixture hashed above were unmodified, so the digests are the committed bytes at that tip.

```text
$ node scripts/ivory/v41-authority.mjs
heads ccad89546e1d224540456dd010f9eb42e796666fe3c6a3f5316acd5c8040e44d configs/ivory-v41-authority-heads.json
owners eb0e8aeb1a0540d23c8150a767de7d3be43c380aced11ef2c1c32eb7be8655d9 configs/ivory-v41-owner-map.json
packageOwnership aed8d3365b417a517feca55242da3ca98087d38874cc0b8ce6ced0aeec58e7d3 configs/ivory-v41-package-ownership.json
carriers 7f6854cc0e461e399eab3a226de02b08e49083fe0b91c340f66496ec6b88f061 configs/ivory-v41-carrier-matrix.json
gates 09f8ef00dd48922db58056bd4da38b4affc5c01d39b043fc52dc72448650c11f configs/ivory-v41-gates.json
qualification f13f80947d5215dbc62f15831c8020e24207e65ddf97b60e37d265e79a5fb6ff configs/ivory-v41-qualification.json
adrLineage 9fed8e3bfbf0513b18baf67c2e9a97c6b7ea621b002c7f14071acd295dd9d4f7 configs/ivory-v41-adr-lineage.json
V4.1 authority reconciliation: valid (V41-P01 4/4 leaves + IV41-003 package ownership + IV41-004 ADR lineage + IV41-005 qualification manifest)
exit 0

$ node --test scripts/ivory/v41-authority.spec.mjs
ℹ tests 72
ℹ pass 72
ℹ fail 0
exit 0

$ node scripts/ivory/iv41-010-model.mjs
IV41-010 canonical-model contract valid; SHA-256 317d91fae7b66fcdb18f2973dc8a8c84270287dbe3fce9810543c643231d39e9 configs/ivory-v41-canonical-model.json
IV41-010 evidence classification: structural contract only; durable Q1 and migration qualification not-run
exit 0

$ node --test scripts/ivory/iv41-010-model.spec.mjs
ℹ tests 20
ℹ pass 20
ℹ fail 0
exit 0

$ node scripts/ivory/n-gates.mjs
| gate | state | evidence | observations |
|---|---|---|---|
| N1 | closed | docs/experiments/n1-v2-evidence.json | automated=true, human="closed", decision="provisional-architecture-pass" |
| N2 | closed | docs/experiments/n2-v2-evidence.json | automated=true, engine="pglite", architectureStatus="engine-decided" |
| N3 | closed | docs/experiments/n3-evidence.json | runtime="runtime-qualified", supportMatrix="pilot-decided", onboardingObserved=undefined |
| N4 | closed | docs/experiments/n4-v2-evidence.json | status="qualified", falseExact=0, anchors=120, converted=22 |
| N5 | closed | docs/experiments/n5-v2-evidence.json | decision="passed", liveService=true |
| N6 | closed | docs/experiments/n6-evidence.json | status="technical-pass", humanQualification="pending", cleanReproduction="passed" |
| N7 | closed | docs/experiments/n7-v1-evidence.json | decision="bounded-experiment-pass", liveProvider="run", deterministic="passed" |
7/7 N-gates closed.
exit 0

$ node --test scripts/ivory/n-gates.spec.mjs
ℹ tests 18
ℹ pass 18
ℹ fail 0
exit 0

$ npm run -s test:ivory-n7
ℹ tests 27
ℹ pass 27
ℹ fail 0
exit 0

$ git diff --check
exit 0
```

The parent readback predicate was also proved in isolation before the note existed, so the fail-closed path is real and not a description:

```text
$ node scripts/ivory/v41-authority.mjs        # with the note absent
BLOCKED: V41-P01: the parent integration readback is missing: changes/v41-p01-parent-readback.md must exist and be readable
exit 1
```

and the new spec cases exercise the remaining negative paths directly:

```text
BLOCKED: V41-P01: the parent integration readback must name leaf V41-I01.3 as a literal id
BLOCKED: V41-P01: the parent integration readback records selectedDev aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, which does not match the pinned selectedDev 41fa0e19889fad7fdedef45a8c21944e7d923e68
BLOCKED: V41-P01: the parent integration readback must record the pinned selection as a literal `selectedDev: <40-character SHA>` line, not as prose
BLOCKED: V41-P01: the parent integration readback must name leaf V41-I01.1 as a literal id
```

The CI run named in the dependency basis was re-queried (read-only) rather than quoted from the retained records:

```text
$ gh run view 35481120037 --repo mberrys/ivory --json displayTitle,headSha,conclusion,status,event,createdAt,updatedAt,jobs
{"conclusion":"success","createdAt":"2026-09-20T01:20:02Z","event":"push","headSha":"41fa0e19889fad7fdedef45a8c21944e7d923e68","status":"completed","updatedAt":"2026-09-20T01:34:06Z",
 "jobs":["Dependency governance evidence (IV-19)" success 01:20:05Z→01:21:29Z,
         "Verify (windows-2022)" success 01:20:04Z→01:29:23Z,
         "Verify (ubuntu-22.04)" success 01:20:05Z→01:24:57Z,
         "Runtime and migration recovery (Session 04)" success 01:29:25Z→01:34:05Z]}
```

## Limitations and reviewer disposition

- **Evidence class.** This is contract/design evidence: a structural identity of the V4.1 contract set and its carriers at one exact head, plus the parent's own integration predicate. It is **not** execution, production, hosted, or release-completion evidence, and it is not runtime, restart, or restore evidence.
- **No gate moved.** Every gate in `configs/ivory-v41-gates.json` remains `not-run` and the parent's Notion Gate evidence remains **Not run**. No qualification record is `qualified`; the six records read `not-run` / `inconclusive` only. Closing a gate needs executable retained proof, and for `qualified` also human or joint authority on a clean worktree.
- **No execution claim.** No runner is reported as passed here that was not executed in this worktree, and the CI run is reported only as the observation context of the pinned head, not as a V4.1 gate result. `DURABILITY` is not run here (the pinned 1000-cycle storm exceeds the bounded session window, as IV41-005 records); `Q2` has no runner on this tree at all.
- **Open gaps stay open.** The 15 owner-map missing fields remain tracked by `IV41-*` issues, and the carrier matrix's two `residualGap`s (`V41-I07` production durable-store commit/recovery and restore readback, `V41-I09` independent capsule replay) remain `status: open`. The parent does not smooth any of them over with a status.
- **Lineage limit.** Five of the seven source-register lineages (A, B, D, E, F) have no distinct carrier on this line; that is recorded as a limit above rather than filled with an invented mapping.
- **Scope.** The parent makes no implementation, test, production, hosted, or release-completion claim, and no claim about any head other than the pinned one.

**Reviewer disposition.** The four leaves, their digests, the dependency basis, the lineage and obligation mappings, the adversarial evidence, and this readback are retained as the parent's integration evidence, and the readback is now machine-checked by the whole-bundle verifier so it cannot drift silently. The parent's own completion/stop condition still governs: it closes only after every child and integration predicate has independently verifiable evidence. **Disposition: retained as contract/design evidence at the pinned head; Gate evidence remains Not run.**
