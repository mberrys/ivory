# V4.1 authority reconciliation

This record implements the contract/design portion of V41-P01 through its four executable leaves. It does not claim Q1-Q4, durability, replay, hosted support, or release qualification.

## Exact authority basis

| role | exact SHA | exact tree | disposition |
|---|---|---|---|
| detached baseline | `efec71ed83a1d0d9d513a4ead86369201cb5b401` | not recorded | historical comparison only |
| PR #1 foundation head | `ecc406d34a9bf49d8e2f165b994a919ca90ff718` | not recorded | retained foundation evidence only |
| selected dev | `41fa0e19889fad7fdedef45a8c21944e7d923e68` | `14e6e62079396a33409752b17a6a380db31571c1` | implementation and package/schema audit basis |

`selectedDev` is the only selectable authority for this reconciliation. Package ownership is pinned by the exact `package.json` git blob IDs in `configs/ivory-v41-authority-heads.json`; branch names, inferred inventories, and latest-head substitution are not accepted as evidence.

### Superseded selections (history, never authority)

`configs/ivory-v41-authority-heads.json` also retains the selection it replaced. A superseded entry is informational: it is `selectable: false`, it must not duplicate a current head, and the validator fails closed if one is marked selectable, if its SHA is not a real commit in the pinned head's history, if its merge commit is not in that history, or if it omits its reason or merge commit.

| superseded role | exact SHA | exact tree | superseded by | merge commit | reason |
|---|---|---|---|---|---|
| selected dev | `bc3cd03b5b2d870d219797925d92edc48c33c6ca` | `8edc9eab81e3733b60eb626c10ca91de63bd041c` | `41fa0e19889fad7fdedef45a8c21944e7d923e68` | `f8d0af66aa10d419cd18fb5f649f0eabfc63cd5d` | the pre-merge V4.1 line head carries no N1-N7 closeout evidence, so its N5 row read as absent and its evidence limits were stale |

## Exact-head audit readback (IV41-001)

This section is the readback IV41-001 requires: the exact heads, the package availability, the per-N evidence availability and its limitations, the tracked gaps, and the environment the observation was taken in. It records an authority and evidence boundary. It is **not** a qualification: no gate moves off `not-run`, no human acceptance is asserted, and nothing here claims Q1-Q4, durability, replay, hosted support, or release readiness.

**Heads.** Three roles, exactly one selectable. The pinned selected-dev head is `41fa0e19889fad7fdedef45a8c21944e7d923e68`, tree `14e6e62079396a33409752b17a6a380db31571c1`, reached through the exact ref `refs/heads/dev`. `ecc406d34a9bf49d8e2f165b994a919ca90ff718` (PR #1) and `efec71ed83a1d0d9d513a4ead86369201cb5b401` (detached baseline) are retained as non-selectable comparison heads. The verifier now proves reachability instead of trusting the string: `git merge-base --is-ancestor <pinned sha> refs/heads/dev` must exit 0, so a fabricated SHA, a real commit that is not on the dev line, and a clone that does not carry the pinned head all fail closed. The superseded selection above is checked the same way, against the pinned head's own history.

**Package inventory availability.** Twelve Ivory packages are pinned by the committed `package.json` git blob ID. Every pin was re-derived at the pinned head with `git rev-parse 41fa0e198:<path>` and independently with `git hash-object --path=<path> <path>` in the worktree: **12/12 matched the recorded pin and each other, 0 mismatches**, so the reconciliation merge changed no package manifest identity. The inventory source stays `selectedDev` / `exact-tree`; an inferred inventory is still rejected.

**Per-N evidence availability.** All seven retained N1-N7 records are present on the pinned head and all seven gates are closed on it (`node scripts/ivory/n-gates.mjs` → `7/7 N-gates closed`). Every limit below is drawn from the record's own scope and keeps what is *not* proven explicit.

| N | record | classification | availability on selected dev | limit (what the record does not prove) |
|---|---|---|---|---|
| N1 | `docs/experiments/n1-v2-evidence.json` | accepted | present | in-memory reference kernel with a closed three-researcher interpretation gate; not production schema persistence, representation remapping, or PDF/OCR anchors |
| N2 | `docs/experiments/n2-v2-evidence.json` | accepted | present | PGlite NodeFS on NTFS after unclean process kill, one Windows reference machine; not cross-platform, hardware-power-loss, or the selected production persistence proof |
| N3 | `docs/experiments/n3-evidence.json` | accepted | present | Windows 11 x64 pilot with Docker Desktop; macOS and Apple Silicon remain unqualified |
| N4 | `docs/experiments/n4-v2-evidence.json` | accepted | present | retained 22-fixture corpus with two genuinely pinned converters and zero false-exact anchors; no wider corpus or converter scope |
| N5 | `docs/experiments/n5-v2-evidence.json` | accepted | present | four-client equivalence, twelve ordered competing edits, restart around an accepted-but-undelivered receipt, and exact citation navigation, observed on win32/x64 against one canonical Core fixture service and the isolated `@ivory-tower/n5-browser` workbench; no notebook surface, no desktop, cross-platform, hosted-service, or independent second-machine reproduction |
| N6 | `docs/experiments/n6-evidence.json` | accepted | present | closed as a technical pass on one Windows machine; the human product-value qualification remains pending and the second-machine clean install is recorded blocked, so independent reproduction is not proven |
| N7 | `docs/experiments/n7-v1-evidence.json` | accepted | present | one bounded run against a real local llama.cpp provider; no hosted provider, multi-run, restart-durability, or Theia-integration qualification |

**What the merge falsified, and how it was corrected.** N5 read `classification: "open"` / `selectedDevAvailability: "missing"` with the limit "foundation-PR evidence is not present on selected dev and cannot be inferred". That was true of the pre-merge head and false of the pinned one: `docs/experiments/n5-v2-evidence.json` is on dev and the N-gate evaluator reports N5 closed with `decision="passed"` and `liveService=true`. It is now `accepted` / `present`, with the record's own scope as its limit. N6 read `classification: "open"`, which was correct while its record said `technical-pass-human-pending`; the merged record says `technical-pass`, so the gate is closed and the row is `accepted` — with the pending human qualification and the blocked clean install kept in the limit rather than rounded up. N4's row already read `accepted`, which was the *wrong* reading of its pre-merge record (`status: "NO-GO"` with a recorded qualification-run failure) and is now the right reading of the merged one (`status: "qualified"`, every criterion true, 22 converted fixtures, zero false-exact anchors). N1, N2, N3, and N7 keep their classifications and were re-checked against the merged records: N1's three-researcher gate is closed by `docs/experiments/n1-human-record.json`, N2's engine decision moved to `engine-decided`, N3's support matrix to `pilot-decided`, and N7's decision to `bounded-experiment-pass` — closures the pre-merge limits did not contradict, so only N5 and N6 changed.

**Tracked gaps.** The fifteen missing-field entries the owner map retains stay open, and every one is tracked by a live issue rather than by session notes: `IV41-010` (Source scholarly alias/version assertions, Source status-assertion history), `IV41-021` (EvidenceLink transformation mode, Statement method/scope binding, typed citation-integrity assessment, typed semantic-support assessment), `IV41-022` (EvidenceLink typed qualification payload, Assessment qualification/current-applicability fields), `IV41-023` (Activity typed research-decision payload, ResearchDecisionReceipt decision class and exact assessment/snapshot basis), `IV41-031` (ResearchProtocol bounded query/provider receipt refs), `IV41-036` (ResearchProtocol coverage/stopping receipt refs), `IV41-040` (ExecutionReceipt provider/tool/query pins), `IV41-063` (Artifact disclosure/replay level metadata), `IV41-016` (CAS-first semantic commit/recovery proof, owned by V41-I07). Dropping a gap, duplicating one, or replacing its issue with notes is a validation failure.

**Environment and observation context.** The head above was observed through the Ivory Tower quality gate, workflow `Ivory Tower quality gate`, run `35481120037` — event `push`, branch `dev`, `headSha` `41fa0e19889fad7fdedef45a8c21944e7d923e68`, created `2026-09-20T01:20:02Z`, completed `2026-09-20T01:34:06Z`, conclusion `success`, with all four jobs green: `Verify (windows-2022)` (01:20:04Z → 01:29:23Z), `Verify (ubuntu-22.04)` (01:20:05Z → 01:24:57Z), `Dependency governance evidence (IV-19)` (01:20:05Z → 01:21:29Z), and `Runtime and migration recovery (Session 04)` (01:29:25Z → 01:34:05Z). Those jobs are the observation context for the head, not a qualification of the V4.1 gates, which stay `not-run` in `configs/ivory-v41-gates.json` until retained per-gate proof exists.

**Downstream pointers re-grounded.** Because the manifest is a hashed dependency of the other V4.1 contracts, moving the selection re-grounds them rather than leaving them stale: `configs/ivory-v41-owner-map.json` re-records the manifest readback (SHA-256 `ccad89546e1d224540456dd010f9eb42e796666fe3c6a3f5316acd5c8040e44d`, 6859 bytes), `configs/ivory-v41-adr-lineage.json` records `selectedDevHead` alongside the retained `priorSelectedDevHead` (now validated as a recorded supersession rather than as the live selection), and `configs/ivory-v41-canonical-model.json` re-points `evidenceContext.selectedDev` and its retained readback of the manifest, owner map, ADR lineage and package ownership. The historical facts are untouched: PR #5's branch and pre-issue head, PR #3's branch and pre-issue head, and the earlier `changes/` readback tables still record the heads they were taken at.

## Canonical ownership and harness boundary

`configs/ivory-v41-owner-map.json` maps Source, Fragment, EvidenceLink, Statement/Claim, Artifact, Activity, Snapshot, ResearchProtocol, assessments, research-decision receipts, execution receipts, and CAS to one canonical structural owner. Missing V4.1 fields remain explicit gaps for later leaves rather than being implemented as new stores.

The execution harness is intentionally not a semantic authority. It may own runs, tool/provider routing, permissions, immutable execution traces, replay, evaluation orchestration, and Dream-RSI-style exploration/orchestration improvement. Core retains research semantics, provenance, acceptance, researcher authority, protected evaluation standards, rollback, and regression fixtures. Research state and improvement state remain separate. Theia, CLI, API, and other clients are replaceable projections and command surfaces; they cannot adjudicate locally or reconnect to a newer head silently.

### Owner-map reconciliation at the merged head

The N1-N7 closeout merge `f8d0af66a` was carried into the owner map as an exact-head audit rather than as narrative. `configs/ivory-v41-owner-map.json` now retains a `carrierReadback` record under the same `sha256` / `utf-8` / `normalize-lf` / POSIX-separator convention the carrier matrix uses: it is bound to `configs/ivory-v41-authority-heads.json` (SHA-256 `ccad89546e1d224540456dd010f9eb42e796666fe3c6a3f5316acd5c8040e44d`, 6859 bytes), it records the exact working tree it was audited against (`refs/heads/dev` at `cadc8ed512a1f6322c55d00b1c5fdff2fdbcdb5b`, the pre-commit tip this issue reconciled), and it records the SHA-256 and byte count of every carrier file the twelve surfaces name. The validator now resolves each surface's `<path>#<symbol>` carrier to a declaration inside the package that owns it, resolves every secondary `owner#symbol` against the exact-head package inventory, and fails closed when a carrier file or symbol is absent from the tree, when the carrier is not inside the owning package or the owner is not a package in that inventory, when the readback is missing, unbound to the manifest it hashes, incomplete, or does not match the bytes on disk, when a surface has no owner, no carrier, no explicit missing-field list, or no explicit secondary list, when a `missingFields` entry is not a non-empty string, and when a canonical key or a planning synonym re-declares a forbidden duplicate authority.

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

## IV41-005 retained qualification run

`configs/ivory-v41-qualification.json` now retains the first real run context and the first per-gate observations for the six registered gates instead of six empty `not-run` stubs. The context is the pinned authority head and its green quality gate; the per-gate records are what was actually observed on this machine. No gate closes.

**Retained run context.** `runContext.repository` names `https://github.com/mberrys/ivory.git`, `refs/heads/dev` at `41fa0e19889fad7fdedef45a8c21944e7d923e68`, tree `14e6e62079396a33409752b17a6a380db31571c1`, `dirty: false`, with `authorityBasis` bound to `configs/ivory-v41-authority-heads.json` as `selectedDev` / `equal`. `runContext.verifier` is the real quality-gate execution for that head: workflow `Ivory Tower quality gate`, run `35481120037`, event `push`, `headSha` `41fa0e19889fad7fdedef45a8c21944e7d923e68`, created `2026-09-20T01:20:02Z`, completed `2026-09-20T01:34:06Z`, conclusion `success`, exit code `0`, all four jobs green (`Verify (windows-2022)` 01:20:04Z → 01:29:23Z, `Verify (ubuntu-22.04)` 01:20:05Z → 01:24:57Z, `Dependency governance evidence (IV-19)` 01:20:05Z → 01:21:29Z, `Runtime and migration recovery (Session 04)` 01:29:25Z → 01:34:05Z). The workflow file on the tree this record is committed to differs from the file that ran only by the `fetch-depth: 0` and dev-ref steps a later commit added, so the record carries both identities: the current digest the validator re-verifies (`caab378909a22c973fe0cdfd8d6432f0beeeb8b03443b30be29735411403b5ce`) and the pinned-head blob digest the executed run used (`2abb809fb38773f05aa22eaa4b5ef7c790ce2668295be7b658be3597f108701d`). The environment is the machine the observations were taken on: `win32` / `10.0.26200` / `x64`, Node `v24.16.0`, npm `11.13.0`, Docker Desktop `29.8.0`, `secretValuesOmitted: true`, `lockfileSha256` `f877e83688e8103ea7e9508d91a5b5fce98a04a0106560eb8ac871505b8f0dd1`.

**Observation protocol.** The local runner executions were taken at the current dev tip `f99bd64d8d9b90370f2615e7728259f33d929376`, from a clean worktree except where a record states otherwise (`verify:ivory-n6` started with `docs/experiments/n1-v2-evidence.json` modified by the immediately preceding N1 run, and its record says so). The pinned head is an ancestor of that tip (`git merge-base --is-ancestor 41fa0e19889fad7fdedef45a8c21944e7d923e68 refs/heads/dev` exits 0), and `git diff 41fa0e19889fad7fdedef45a8c21944e7d923e68..f99bd64d8d9b90370f2615e7728259f33d929376 -- scripts spikes` touches only `scripts/ivory/v41-authority.mjs` and its spec, so every gate runner module executed here and every retained record cited here is byte-identical to the one pinned at the authority head. Each runner rewrote its own retained record at the local head; every such rewrite was reverted to the committed bytes so the V41-I01.4 `machineReadback` stays exact, and the regenerated digests are recorded inside the gate records rather than being kept.

**Per-gate outcome (observed, not inferred).**

| gate | bound runner(s) | what ran | exit | retained decision |
|---|---|---|---|---|
| DURABILITY | `scripts/verify-ivory-n2-v2.mjs` via `verify:ivory-n2-v2` (1000 fixed interruption-storm cycles) | not executed | - | `not-run`; no fixtures or evidence claimed |
| Q1 | `scripts/verify-ivory-n1.mjs`; `scripts/verify-ivory-n4-v2.mjs` | both passed (`ok=true`; 22/22 fixtures converted, 120 anchors, false-exact 0) | 0, 0 | `inconclusive`, machine `passed` |
| Q2 | none bound in the registry | nothing executable | - | `not-run`; gap points at IV41-036 and IV41-031 |
| REPLAY | `spikes/n6-portable-reproduction/verify.mjs` via `verify:ivory-n6` | passed (`technical-pass`; missing-blob / missing-dependency / missing-input probes `expected-failure`) | 0 | `inconclusive`, machine `passed` |
| Q3 | `scripts/n5/compare.mjs`; `scripts/n5/evidence.mjs` | equivalence passed (11/11 tests, `N5 client boundaries: OK`); evidence writer blocked (`ENOENT` on `artifacts/n5`) | 0, 1 | `inconclusive`, machine `partial` |
| Q4 | `scripts/ivory/n3-compute.mjs`, `scripts/ivory/n3-retain.mjs`; `scripts/ivory/n7-retain.mjs` | N3 `runtime-qualified` in python and R against the digest-pinned images; N7 runner red (23/24 deterministic tests) | 0, 0, 1 | `inconclusive`, machine `partial` |

**Why DURABILITY stays `not-run`.** The pinned invocation is `npm run verify:ivory-n2-v2 -- --cycles 1000` (retained as `exactQualificationCommand` in the N2 record) and the storm length is fixed at 1000 cycles. The retained raw artifact for this reference machine measures `interruptStorm.elapsedMs` `2022520` ms (33.7 minutes) for those cycles alone, before the export/import, scale, and durability-envelope sections, which exceeds the bounded window allowed for this session, and running it alongside the N4 Docker qualification would perturb a timing-sensitive fault-injection storm. It is recorded `not-run` with that reason and no observation, never as a pass.

**Why Q3 and Q4 are `partial` and not `passed`.** Q3's comparator ran and passed, but `scripts/n5/evidence.mjs` exits 1 with `ENOENT scandir artifacts/n5`: it folds raw live observations produced by the live/restart/language observation harnesses, which need a running canonical Core service, the built `@ivory-tower/n5-browser` workbench with Playwright browsers, and the python/R/quarto probes. Q4's governed-compute half ran green end to end with the digest-pinned images (`python@sha256:78387bc3881b8273120a12ebe6c1ab22b018ccc2c9adf565ae1ac9b536e184ea`, `r-base@sha256:e7032f2f6fd273ee944a717b436bc66d1a89b1b90a9bbcaafcf1318d68a7d8b2`), every required acceptance check true, and an identical language-neutral result (`{"mean":20,"rowCount":3,"sum":60}`), and its retention step reported `runtime-qualified`; but the bound proposal-retention runner exits 1 because `scripts/ivory/n7-evidence.spec.mjs` expects `deterministic.transcripts` on the committed `docs/experiments/n7-v1-evidence.json` and that record does not carry the field. The same failure reproduces with `npm run -s test:ivory-n7` on the committed record from a clean worktree, so it is a pre-existing retained-record staleness on the selected dev head rather than a Q4 semantic failure. Repairing it would rewrite another issue's retained evidence and move the V41-I01.4 readback, so it is left red and recorded instead of rounded up. Two registry commands also need their real arguments to run at all and that is recorded rather than hidden: bare `verify:ivory-n3` fails closed on `imageDigestValid` because no immutable image was supplied, and `retain:ivory-n3` requires `--python` and `--r`.

**The N4 record was regenerated and reverted.** `verify:ivory-n4-v2` exits 0 (`N4 V2 qualification passed: 120 real anchors, false-exact=0.`) but rewrites `docs/experiments/n4-v2-evidence.json`, which is pinned in three places (the N4 row of `configs/ivory-v41-carrier-matrix.json`, the `q1-n4-anchor-record` entry of `configs/ivory-v41-gates.json#machineReadback.files`, and the tables above). The regeneration drifts by one byte (`36083` bytes, SHA-256 `beba9a3d737174ed7ac9e8cfdd6f8a7b8e0d7c12088f89636bcb40934e2578e7`) against the committed record (`36082` bytes, SHA-256 `f9da58d4903c14fd7591d64408c38dc3a46151135df338a7d25497486e75f855`), so the committed record was kept as the retained fixture and the regeneration was **not** retained. The choice is deliberate: option (b) would have meant re-deriving every dependent pin in the same commit for a record whose only differences are the repository commit, the timestamps, the Docker server version, and the run timing. The run itself is retained as an observation (command, exit code, start/end, clean worktree before, one-byte drift after) and the same treatment was applied to the N1, N3, N6, N7, and N5 records.

**What is machine-evidenced, and what is not.** Machine-evidenced by this run: the N1 anchor predicate, the N4 exact-anchor predicate, the N6 capsule create/reproduce/export/restore cycle with its negative probes, the N5 four-client equivalence comparator, and the N3 governed-compute runtime qualification in python and R. Not evidenced here: the N2 durability storm, the N5 evidence writer's live observation fold, the N7 proposal-retention runner, and every human receipt the registry requires. `Q2` remains unbound in the registry itself.

**No closure.** Every record is `not-run` or `inconclusive`; nothing is `qualified`, and the manifest carries no `aggregatePass`, `overallPass`, or `overallStatus` field. `configs/ivory-v41-gates.json` still reads `not-run` for all six gates, which is where a run lives only as a record and a registry never becomes a result. The negative cases are proved in the same change: a terminal record with empty fixtures or evidence, a `qualified` decision with machine-only authority, a `not-run` record claiming fixtures and evidence, and an aggregate pass flag are each rejected by `scripts/ivory/v41-authority.mjs`.

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

The validator fails closed if the exact package inventory is not covered, a responsibility gains multiple owners, or another package acquires research acceptance or canonical-write authority. The 15 missing fields already retained in the V41-I01.2 owner map are each mapped to an existing `IV41-*` roadmap issue; dropping one, duplicating one, or replacing its issue with session notes is also a validation failure.

### Evidence context: retained history, re-grounded at the reconciled head

The audit's own context is kept as two exact, separately recorded facts instead of one pointer at the moving selection. `evidenceContext.implementationContext` retains the audit as taken at PR #3's branch `feat/v41-p01-authority-carriers`, from the pre-issue head `dce910e4a988ddfa6c1618f6b7e4a82b0adc25a8`, on the pinned `npm@11.13.0` / `>=24` toolchain. `evidenceContext.reconciliationContext` records where the package set was re-read against the merged line: `refs/heads/dev` at `41fa0e19889fad7fdedef45a8c21944e7d923e68`, merged by `f8d0af66aa10d419cd18fb5f649f0eabfc63cd5d`, bound to the exact package inventory at `configs/ivory-v41-authority-heads.json`.

The previous shape pinned `pullRequest: 3`, `branch: 'feat/v41-p01-authority-carriers'` and `authorityBasis.sha` *equal to the current selected-dev SHA* at the top level, so the record became false the moment the authority moved — exactly what the reconciliation exposed. Nothing is overwritten and nothing is re-pinned: the historical facts stay historical, and the record no longer restates the selection. **The head selection itself lives only in `configs/ivory-v41-authority-heads.json` (single source)**; this record names the heads it observed and binds to that manifest by path.

The validator's guarantees are record-driven and no weaker than the hard-coded checks they replace. An evidence context must name an exact implementation context or an exact reconciliation context; a present implementation context must carry a positive integer pull request, an exact non-latest branch, a pre-issue head, and the pinned package-manager/engine context; a present reconciliation context must carry an exact non-latest ref, an exact head, an exact merge commit, and the exact-head inventory path. Every recorded commit SHA must be a real commit reachable from `refs/heads/dev` — `git merge-base --is-ancestor` decides, so a fabricated SHA and a real commit that is not on the dev line are both rejected. The owner, acceptance, write and storage assertions above are untouched, so a second acceptance or canonical-write owner still fails closed.


## ADRs and lineage (IV41-004)

`configs/ivory-v41-adr-lineage.json` is the machine contract: one registry and one decision list, loaded and validated by `scripts/ivory/v41-authority.mjs` in the same whole-bundle check as the rest of the V4.1 contracts. The registry covers the historical V3 ORX architecture source and every ADR that exists on this line — `docs/adr-001-application-platform.md` through `docs/adr-006-n5-harness-dependencies.md`, plus the two this issue adds, `docs/adr-007-v41-authority-harness-boundary.md` and `docs/adr-008-v41-adr-lineage-supersession.md`. Identifiers are zero-padded `ADR-###`, registry order is strictly increasing, paths are unique, and ADR-001 through ADR-006 are neither renumbered nor rewritten.

Every reconciled decision is classified as `inherited`, `amended`, `deferred`, or `superseded` — those four and nothing else — and must name its `source`, `carriedBy`, `statement`, `evidenceBoundary`, and `evidenceHeads`. Historical records stay `retainedIntact`; supersession is explicit-only, so the target must exist in the registry, cannot be the record itself, and cannot form a cycle; a deferred architectural gap must name a registered gate id or a tracked issue id, and an issue-tracked gap carries its tracking URL, so a gap cannot survive as session notes. A lineage entry may not declare research acceptance or canonical research-state writes: `configs/ivory-v41-owner-map.json` and `configs/ivory-v41-package-ownership.json` remain the single sources for that.

The evidence context is the exact-head manifest rather than a narrative: `configs/ivory-v41-authority-heads.json` names the three roles `detachedBaseline`, `foundationPr`, and `selectedDev`; the lineage names the current selected-dev head `41fa0e19889fad7fdedef45a8c21944e7d923e68` in `selectedDevHead` and retains `bc3cd03b5b2d870d219797925d92edc48c33c6ca` as `priorSelectedDevHead`, which the validator now resolves against the manifest's recorded superseded selection rather than against the live selection, so a historical head cannot be silently re-promoted. The reconciliation merge `f8d0af66aa10d419cd18fb5f649f0eabfc63cd5d` is recorded as an exact observation of the line these ADRs land on, and lineage decisions may name only those three head ids.

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

### N7 retention reconciliation

The closeout merge resolved the N7 evidence record to the canonicalized closeout record, which does not carry
the `deterministic.transcripts` field the V4.1-side retention spec reads; the field was restored from the
V4.1-line record, whose four transcript names are exactly the set `docs/experiments/n7-transcripts/` holds.
Regenerating the record is not the repair here: `scripts/ivory/n7-retain.mjs` observes only the deterministic
suite, so a re-run wrote `liveProvider: not-run*` with `deterministic-pass-live-provider-open` and opened the
N7 gate, whose `closedWhen` requires `bounded-experiment-pass`. The two retention toolings now share one policy
(`scripts/ivory/n7-retain-policy.mjs`): a retained `status: "run"` observation is carried forward verbatim
instead of being overwritten, and the decision is `bounded-experiment-pass` only when the suite passed and live
evidence is retained. Every pinned readback that cites the record or the changed modules was re-derived, and
`test:ivory-n7` is now a stage of `verify:ivory-tower`. No gate moved: N7 remains closed on the same retained
live-provider run, and nothing in the V4.1 bundle is `qualified`.

## V41-P01 parent integration readback

The parent's own positive acceptance requires an integration readback, and it is retained at
`changes/v41-p01-parent-readback.md`. It names the four leaves — `V41-I01.1`
(`configs/ivory-v41-authority-heads.json`), `V41-I01.2` (`configs/ivory-v41-owner-map.json`), `V41-I01.3`
(`configs/ivory-v41-carrier-matrix.json`), `V41-I01.4` (`configs/ivory-v41-gates.json`) — each with its
`sha256`/byte-count readback and the command actually run for it, plus the exact dependency basis: the pinned
authority head `41fa0e19889fad7fdedef45a8c21944e7d923e68` (tree `14e6e62079396a33409752b17a6a380db31571c1`),
its green quality-gate run `35481120037` with four green jobs, the reconciliation merge
`f8d0af66aa10d419cd18fb5f649f0eabfc63cd5d`, the retained non-selectable superseded selection
`bc3cd03b5b2d870d219797925d92edc48c33c6ca`, the A–F lineage mapping, the N1–N7 obligation table, and each
adversarial acceptance case with its real rejection.

The parent's integration predicate is the whole-bundle verifier: `node scripts/ivory/v41-authority.mjs` prints
`V4.1 authority reconciliation: valid (V41-P01 4/4 leaves + IV41-003 package ownership + IV41-004 ADR lineage
+ IV41-005 qualification manifest)` only when every leaf, its dependency chain, and the parent readback itself
are consistent at the pinned head. That readback is machine-checked in the same verifier — it fails closed when
the note is missing, when a leaf id is absent, or when the note's recorded `selectedDev` anchor no longer
matches the heads manifest — so it cannot rot silently. No gate moves: this is contract/design evidence, every
gate stays `not-run`, and the parent claims no execution, production, hosted, or release completion.
