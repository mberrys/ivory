# V41-P02 — Fragment context and exact evidence

## Plan

1. Extend the canonical `@ivory-tower/research-kernel` Fragment carrier rather than creating a second evidence store.
2. Bind every new Fragment revision to an exact retained representation digest, converter revision, selector-profile revision, selector kind, and ordered-span identity.
3. Represent material structural context as bounded exact references with typed roles; preserve explicit `unavailable` and justified `not-applicable` states.
4. Keep cited/context roles on `EvidenceLink` while leaving selector identity owned by Fragment.
5. Produce deterministic mechanical citation receipts that separate byte/selector/context exactness from semantic support.
6. Remap converter changes through explicit `EXACT`, `AMBIGUOUS`, or `UNRESOLVED` outcomes; even `EXACT` creates a new Fragment revision and never rewrites history.
7. Keep Q1 fail-closed until the prerequisite `V41-I07.4` checkpoint/restore semantic readback and downstream human assessment evidence exist.

## Implementation

- Added `FragmentAnchorIdentity`, `FragmentProfile`, bounded `FragmentContext`, and exact context-reference carriers.
- Added explicit per-Fragment `cited` / `context` roles to `EvidenceLinkPayload`.
- Added `ResearchKernel.verifyCitation` mechanical receipts with `EXACT`, `BLOCKED`, and `MISMATCH` states and `semanticSupport: not-assessed`.
- Added `ResearchKernel.remapFragment` with fail-closed exact/ambiguous/unresolved remap semantics.
- Legacy Fragment callers remain readable, but missing structural context is retained as `unavailable` and blocks an exact mechanical receipt instead of being silently treated as not-applicable.
- Updated the V4.1 owner/gap map and the N4 carrier row to point to the implemented structural carriers: `configs/ivory-v41-owner-map.json` keeps `Fragment` → `types.ts#FragmentPayload` and `EvidenceLink` → `types.ts#EvidenceLinkPayload`, and the N4 row of `configs/ivory-v41-carrier-matrix.json` binds `FragmentPayload`, `FragmentAnchorIdentity`, `MechanicalCitationReceipt`, `FragmentRemapReceipt`, `kernel.ts#remapFragment` and `kernel.ts#verifyCitation`. That row's retained fixture is `docs/experiments/n4-v2-evidence.json` (the replaced 22-fixture corpus: 22 converted, 120 exact anchors, `falseExact: 0`, Docling v1.21.0/v1.22.0 image digests); see the integration readback below for the exact counts and for the platform-bound digest defect still open in that row.

## Adversarial coverage

The focused research-kernel fixture covers:

- empty applicable context;
- unjustified not-applicable context;
- context collapsed onto the cited span;
- missing EvidenceLink cited/context roles;
- converter/profile drift through the create path;
- changed representation with one exact candidate;
- duplicate exact candidates that must remain ambiguous;
- missing exact candidates that must remain unresolved;
- immutable historical Fragment readback after remap;
- deterministic mechanical receipts from identical exact reconstruction.

## Qualification boundary

This PR does **not** close Q1 or claim durable restart proof. `V41-I07.4` is still a prerequisite and remains independently evidence-gated. The deterministic reconstruction fixture proves the exact contract is stable for identical retained inputs; it is not a substitute for checkpoint/restore semantic readback.

## Integration readback (contract/design evidence)

**Head and tree.** Readback taken at `refs/heads/dev` = `655e8f89816e9cdc7b8a099219576b5448ee8466`, tree `e4786624c64ccf768572ad7844b241291eb824de`, from a clean worktree. This record is retained on top of that head; every digest below is of a head blob.

**Digest convention.** `algorithm: sha256`, `encoding: utf-8`, `pathSeparator: "/"`, `lineEndingPolicy: normalize-lf`. Text digests are computed over the LF-normalized content (`readFileSync(p, 'utf8').replace(/\r\n/g, '\n')`) and `bytes` is the length of that normalized string, so a CRLF checkout and an LF checkout record the same identity. Binary fixtures (a NUL byte present) are hashed over raw bytes and are named individually; none of the pinned files below is binary. Every recorded `sha256`/`bytes` pair was confirmed identical when recomputed from `git cat-file -p HEAD:<path>`.

**Child leaves.** V41-P02 contains `V41-I02.1`, `V41-I02.2`, `V41-I02.3` and `V41-I02.4` (containment is separate from execution dependency). Each leaf's named contract and bounded fixture as they exist on the merged head:

- `V41-I02.1` — selector and converter profile type: `types.ts#FragmentProfile` (`converter`, `converterRevision`, `selectorProfileRevision`), `types.ts#FragmentAnchorIdentity` (`brand: ivory.fragment-anchor/1`, `representation`, `representationRef`, `representationDigest`, `selectorKind`, `orderedSpanIdentity`), `kernel.ts#selectFragmentRepresentation`, `kernel.ts#normalizeFragmentProfile`. Bounded fixture: `fragment-context.spec.ts` cases 1 and 5.
- `V41-I02.2` — cited/context/non-applicable validation: `types.ts#FragmentContext` (`applicable` | `not-applicable` | `unavailable`), `types.ts#EvidenceFragmentRole`, `types.ts#EvidenceFragmentTarget`, `types.ts#EvidenceLinkPayload#fragmentTargets`, `kernel.ts#normalizeFragmentContext`, `kernel.ts#hasNoMaterialStructure`, `kernel.ts#normalizeEvidenceFragmentTargets`. Bounded fixture: `fragment-context.spec.ts` cases 2, 3, 6, 7 and 8.
- `V41-I02.3` — quote equality and representation fixture: `kernel.ts#selectorMatches` (exact quote and offset equality against the retained representation), the `representationDigest` binding and recomputed `orderedSpanIdentity` inside `kernel.ts#verifyCitation`, `types.ts#MechanicalCitationReceipt`. Bounded fixture: `fragment-context.spec.ts` cases 1 and 5.
- `V41-I02.4` — exact/ambiguous/unresolved remap fixture: `types.ts#FragmentRemapStatus`, `types.ts#FragmentRemapReceipt`, `kernel.ts#remapFragment`, `kernel.ts#findSelectorCandidates`, `kernel.ts#remapFragmentContext`. Bounded fixture: `fragment-context.spec.ts` case 4.

**Pinned artifacts** (LF-normalized sha256, then bytes):

```
types.ts                                                             f0f211eaa78376cfe04a95e0e1ba0afefc3681008fcb7103c69438c29c4efdbb   12097
kernel.ts                                                            168ec9031e810ced0c6af3eb2cb78a5023de9df765411412f85361fd724e2246   58747
clients.ts                                                           4492cf9f58a7e4820e60a7b5afcc717c4bc51482425875b265591648502fc6a9    3491
fragment-context.spec.ts                                             b281b60ef515ef2fdb6fbff6ec2d5a40194d8ede29dbc1e1352d0dcb4d0cb101   23204
research-kernel.spec.ts                                              c1b5e824ae34c870c7aacfd4363df9ca1855b0591483ca7e1361b6e5717de734   13011
configs/ivory-v41-owner-map.json                                     891b462955c4202e379a4b0a3cd698382d726114ec56278a7646c80a94660942    7271
configs/ivory-v41-carrier-matrix.json                                1291a7335472bc8beeea095a65740e4a69929af24f23ee85c40a34786c045a14   13154
configs/ivory-v41-gates.json                                         b059370c09eb7d58841a94b64e217c46e7b92888079de5db13f5c7b7abfcb18e   10444
docs/experiments/n4-v2-evidence.json                                 f9da58d4903c14fd7591d64408c38dc3a46151135df338a7d25497486e75f855   36082
fixtures/n4/manifest.json                                            83f7b541339545bf0e8df9c2579c8e489485228f7c4b15a67ddda6a35f2c364c    3912
```

(The first five paths are `packages/ivory-tower-research-kernel/src/node/<name>`.)

**Commands actually run at that head.**

```
npx lerna run compile --scope @ivory-tower/research-kernel --include-dependencies
  exit 0; Successfully ran target compile for 2 projects (@theia/ivory-identity, @ivory-tower/research-kernel)

npx lerna run test --scope @ivory-tower/research-kernel --stream
  exit 0; nyc mocha --config ../../configs/mocharc.yml "./lib/**/*.*spec.js"
  20 passing (122 ms), 0 failing = 8 V41-P02 leaf cases + 12 N1 research-identity cases

node scripts/ivory/v41-authority.mjs
  exit 0; V4.1 authority reconciliation: valid (V41-P01 4/4 leaves + IV41-003 package ownership
  + IV41-004 ADR lineage + IV41-005 qualification manifest)

node --test scripts/ivory/v41-authority.spec.mjs
  exit 0; tests 55, pass 55, fail 0

node scripts/ivory/iv41-010-model.mjs
  exit 0; IV41-010 canonical-model contract valid; SHA-256 743289cc9bd368e6c6b285fbb07914b40e2c4d3c290ca0ac9b8400dfc22d6876
  configs/ivory-v41-canonical-model.json; "durable Q1 and migration qualification not-run"

node --test scripts/ivory/iv41-010-model.spec.mjs
  exit 0; tests 16, pass 16, fail 0

node scripts/ivory/n-gates.mjs
  exit 0; 7/7 N-gates closed (N4 -> status="qualified", falseExact=0, anchors=120, converted=22)
```

**Environment.** Windows 11 (win32 `10.0.26200`), x64, 24 logical CPUs; Node v24.16.0; npm 11.13.0; lerna 9.0.7; `npm ci` had already been run in this worktree with the pinned toolchain. No suite above is reported as passed anywhere it was not executed, and no additional platform or CI run is claimed.

**Observations.**

- An independent scratch probe over the compiled `lib/node/kernel.js` (one process, run from the repo root; the probe source is not retained in this repository and is not a qualification runner) reproduced the predicates below. Its observed outcomes: the fragment anchor retained `converter docling`, `converterRevision v1.21.0`, `selectorProfileRevision text-offset-v1`; re-creating that same fragment identity with `v1.22.0` / `text-offset-v2` failed closed with `ExpectedHeadConflictError` and did not fork a revision at that identity; the mechanical receipt was `EXACT` with `checks {representationDigest: true, selectorBytes: true, context: 'not-applicable'}` and `semanticSupport: 'not-assessed'`.
- Remap observed: `EXACT` moved the head to a new revision of the same object carrying the new converter profile (`converterRevision v1.22.0`), while the historical revision payload stayed byte-identical and readable.
- Boundary observed: `fragmentTargets` returned `[{role: 'cited'}, {role: 'context'}]` on distinct object ids; `EvidenceLinkPayload` keys were `claimRef, fragmentTargets, linkAuthor, linkAuthorType, rationale, role, targets` and `FragmentPayload` keys were `anchor, artifactRef, context, selector, sourceRef` — selector identity stays on Fragment and no `role` key exists there.
- Authority observed: `configs/ivory-v41-owner-map.json` yields exactly one distinct owner for `Fragment` and `EvidenceLink`, `@ivory-tower/research-kernel`.
- N4 dependency readback (replaced corpus and evidence). `fixtures/n4/manifest.json` declares 22 fixtures (csv 2, columns 2, scanned 2, plain 4, multilingual 6, footnote 2, table 2, text 2) under `fixtures/n4/{csv,pdf,txt}`; all 22 declared digests match both the working tree and `git cat-file -p HEAD:` at that head. The 12 `fixtures/n4/sources/*.typ` files are the retained Typst 0.15.1 generators and are not part of the 22-entry digest manifest. `docs/experiments/n4-v2-evidence.json` is `status: "qualified"`, `experiment: n4-v2`, `repositoryCommit 707bd3f3…`, `command: npm run verify:ivory-n4-v2`, converters A = Docling v1.21.0 and B = v1.22.0 pinned by image digest, runtime win32 x64 / Node v24.16.0, `observations {attemptedFixtures: 22, convertedFixtures: 22, anchorsFromA: 120, falseExact: 0, reviewQueueSize: 0}`, all-exact classification matrix, 2 declared `ocr_required` scanned failures, `anchorSelectionFailures: []`, 11/11 `criteria` true, store `InMemoryN4QualificationStore`. That agrees with the N4 row's limit text ("retained 22-fixture corpus … 120 anchors resolved against Docling v1.21.0/v1.22.0 … no user/role authorization boundary"). The record asserted no N4 fixture identity, digest or count that the replaced corpus invalidates; the only stale statement was the imprecise manifest sentence in `## Implementation`, corrected above to the exact owner-map/carrier rows and the current fixture.
- Explicit blocker, not smoothed over. The seven `fixtureDigest`/`fixtureBytes` pairs in `configs/ivory-v41-carrier-matrix.json` and the sixteen `machineReadback.files[]` pairs in `configs/ivory-v41-gates.json` (23 in total) were derived from the Windows working-tree bytes: 23/23 match the raw working tree, 0/23 match the repository identity. The N4 fixture is recorded there as `bc559df7…` / 37086 bytes (the CRLF materialisation) while its blob is `f9da58d4…` / 36082 bytes. An LF checkout therefore fails the same readback check in `scripts/ivory/v41-authority.mjs` ("fixture byte count does not match the retained readback"), which is the failure the ubuntu CI gate reported for all seven records after the carrier-matrix commit. This record does not fix it: that validator pins `encoding: "raw-bytes"` / `lineEndingPolicy: "preserve-bytes"` for those readbacks and `configs/ivory-v41-qualification.json` (owned by IV41-005) asserts the same convention, so the correct fix is one cross-platform digest-convention change with every pinned digest re-derived, owned by V41-I01.2 / V41-I01.3 / V41-I01.4 and IV41-005. Until then those two recorded fields are platform-bound and should not be read as the corpus identity; the LF-normalized values above are.

**Negative cases (adversarial acceptance).** Each item is an enforced refusal with a retained case, not a prose claim:

- Selector identity vs converter profile drift — retained case "rejects converter/profile drift through createFragment and yields deterministic mechanical receipts from exact reconstruction"; the drift attempt fails closed (`ExpectedHeadConflictError`) and a remap carries the new profile into a new revision instead of rewriting the old one. Q1's own `negativeCases` list `wrong selector profile`, and its `stopConditions` include `machine exactness treated as semantic support`, which the receipt answers by pinning `semanticSupport: 'not-assessed'`.
- Cited vs context boundary confusion — retained case "stores cited and context Fragment roles on EvidenceLink without moving selector identity out of Fragment" (a missing per-target role throws `ResearchKernelError: … every Fragment target`) and case 2 (a context reference on the cited span throws `cited and context boundaries must be separate exact references`).
- Ambiguous remap that must not be guessed — retained case "emits EXACT, AMBIGUOUS, and UNRESOLVED remap results without guessing or rewriting history": two exact candidates return `AMBIGUOUS` with 2 `candidateSelectors` and an unchanged head; no candidate returns `UNRESOLVED`; a stale `expectedHead` raises `ExpectedHeadConflictError`. Q1's `stopConditions` entry `ambiguous remap guessed` is therefore a refusal enforced by code.
- Stale or unavailable context stays explicit — retained cases "keeps context states explicit and rejects hidden or synthetic context" (a legacy Fragment with no context is retained as `state: 'unavailable'` and its receipt is `BLOCKED` with `checks.context: 'unavailable'`; it never becomes `not-applicable`), "rejects not-applicable when structural context could be concealed, without writing a Fragment", "accepts only a bounded standalone no-structure witness and rejects inconsistent source/artifact lineage", and "does not infer absent structure from an excerpt or a material qualifier inside one line".
- No second acceptance owner for Fragment/EvidenceLink — `configs/ivory-v41-owner-map.json` rows: `Fragment` owner `@ivory-tower/research-kernel`, carrier `types.ts#FragmentPayload`, secondary `@theia/ivory-identity#FragmentAnchor` (anchor projection only), `missingFields: []`; `EvidenceLink` owner `@ivory-tower/research-kernel`, carrier `types.ts#EvidenceLinkPayload`, secondary `[]`, `missingFields: ["explicit transformation mode", "typed qualification payload"]`. `forbiddenDuplicateAuthorities` still names `PaperStore`, `ClaimCardStore`, `ResearchCase`, `WorkflowStateStore`, `ClientAcceptance`, `HarnessSemanticAuthority`, and the authority validator's own adversarial cases ("audits every owner-map carrier against the merged tree", "keeps the carrier inside the package that owns it", "rejects a planning synonym that re-adds a forbidden duplicate authority") pass in the 55/55 run above. `configs/ivory-v41-qualification.json` declares `mayDecideResearchAcceptance: false`, so this readback is not an acceptance owner either.
- Unbounded context payloads and latest-head substitution — bounded by `kernel.ts#assertSelectorBounded` plus the empty/collapsed-reference rejections of retained case 2, and by the N1 cases "rejects latest pointers and confidence scores", "rejects stale expected heads and keeps overlapping annotations independent" and "requires explicit carry-forward and leaves old links on the old claim revision", all passing in the same run. Not re-proved by any new fixture here.

**Limitations.** The `ResearchKernel` reference implementation keeps objects in an in-memory `Map`, so this readback is process-local: no durable restart, restore or cross-machine reopen of a Fragment revision is claimed, and `V41-I07.4` remains the prerequisite that blocks it. `MechanicalCitationReceipt.semanticSupport` is the literal `'not-assessed'`, so nothing here assesses semantic support or current applicability. `EvidenceLink`'s `missingFields` (`explicit transformation mode`, `typed qualification payload`) stay open in the owner map. The adversarial probe above is a scratch probe and is not retained. The platform-bound digest defect recorded in the observations stays open and blocks a clean cross-platform readback of the N4 row. Q1 is untouched: `configs/ivory-v41-gates.json` keeps `Q1.state === "not-run"` and the Q1 record in `configs/ivory-v41-qualification.json` keeps machine `not-run`, human `not-run`, decision `not-run` with a `blocks-closure` limitation. No file outside this change record was modified by the readback.

**Reviewer disposition.** Reviewer: pending human review. This is contract/design integration evidence retained at dev head `655e8f89816e9cdc7b8a099219576b5448ee8466`. It makes no Q1 closure claim, no human qualification or semantic-support claim, no durable restart claim, no hosted/release claim, and no second acceptance owner.
