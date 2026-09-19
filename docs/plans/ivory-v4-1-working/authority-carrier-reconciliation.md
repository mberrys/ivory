# V41-P01 authority, carrier, and source reconciliation

**Status:** implemented contract; downstream V4.1 qualification gates are not run.

This record implements the four ordered leaves of V41-P01 without adding a second semantic store or acceptance authority. The executable source of truth is `configs/ivory-v4-1-authority.json`; `scripts/ivory/v4-1-authority.mjs` validates it and derives gate state from separate machine evidence and human receipts.

## Authority decision

The authority manifest pins the exact **closed PR #1 head** because that snapshot contains the complete N1-N7 retained-evidence and machine-gate surfaces. The former PR #1 branch `pre-dev-foundation` advanced after PR #1 closed; its later head is retained separately as a moving branch observation and is not substituted for the PR #1 snapshot. The selected `dev` head remains a divergent compared authority.

| authority | commit | tree | classification | Ivory packages |
|---|---|---|---|---:|
| detached planning baseline | `efec71ed83a1d0d9d513a4ead86369201cb5b401` | `b52b1aa0957e45f199f3e75bf99fdaad7ef972a1` | reference-only | 1 |
| closed PR #1 head (`pre-dev-foundation`) | `d538fd44c25aa2403230b075c5e18613cea9b855` | `5d4aa6ec3e4c568e7babf26db8487f7abc6ec641` | implementation-base | 14 |
| later `pre-dev-foundation` branch observation | `904b6fb115740eb5c59e509ff5d8cce0a5b98766` | `5765b7dcf41d92ae216235acc5344059da4108e8` | moving-branch-observation, 11 commits ahead / 0 behind PR #1 | 14 |
| selected `dev` | `bc3cd03b5b2d870d219797925d92edc48c33c6ca` | `8edc9eab81e3733b60eb626c10ca91de63bd041c` | divergent-compared-head | 12 |

The retained package inventory is exact to those tree objects. The detached baseline contains only `ivory-identity`. The closed PR #1 snapshot has the full Core/service package set plus `ivory-n5-client` and `ivory-n5-shell`. The later `pre-dev-foundation` branch observation retains the same 14 Ivory package locations and the N-gate surface at its own exact tree; that branch movement is evidence context, not authority replacement. The selected `dev` head has the Core/service set but not those N5 packages or the N-gate manifest.

## Canonical-owner map

The audit maps existing semantic concepts to one owner boundary. `Assessment` is deliberately an owned gap assigned to V41-I03.2 because the exact foundation head has no canonical semantic-support assessment carrier. P01 does not fill that gap with a planning synonym.

| concept | owner |
|---|---|
| Source | `@ivory-tower/research-kernel` `SourcePayload`; durable admission remains behind the existing source/object-store ports |
| Fragment | `@ivory-tower/research-kernel` `FragmentPayload` |
| EvidenceLink | `@ivory-tower/research-kernel` `EvidenceLinkPayload` |
| Statement | `@ivory-tower/research-kernel` `ClaimPayload`; Claim Card remains a projection |
| Artifact | `@ivory-tower/research-kernel` `ArtifactPayload` |
| Activity | `@ivory-tower/research-kernel` `ActivityRecord` |
| ResearchProtocol | `@ivory-tower/contracts` `researchProtocolVersionSchema` |
| Assessment | owned gap: `V41-I03.2` |
| Receipt | Core activity/proposal receipt boundary in `@ivory-tower/research-kernel` |
| CAS | `@ivory-tower/adapters` `ObjectStorePort`; infrastructure is an implementation, not a semantic owner |

The manifest rejects canonical-owner entries that introduce the planned-but-forbidden `Paper Store`, `Claim Card store`, `ResearchCase`, a secondary writer, or a universal acceptance aggregate.

## N1-N7 carrier reconciliation

IV41-002 makes the N1-N7 crosswalk executable rather than leaving it as prose. Each retained lesson has exactly one approved structural carrier kind (type, receipt, predicate, manifest, schema, fixture, or an explicitly owned gap), its N-gate predicate, a concrete fixture, the retained evidence record, and exact repository/environment bindings read from that record. The verifier compares every bound value against the retained JSON before any downstream gate can be evaluated.

| gate | kind | structural carrier | exact retained repository context | retained limitation |
|---|---|---|---|---|
| N1 | type | research-kernel revisions, snapshots and evidence links | record commit `3f0eade59167d273bf0154861482947565d358c5`; human exercise commit `0c6e7de41e787ccf7e46da9f18cacaad520b3868` | exact-reference experiment evidence is not V4.1 production qualification |
| N2 | schema | revision/activity durable SQL schema | `dda5c294b8493fbc49ffac94712a7dd03d05e698` | bounded to the recorded reference machine and unclean process termination |
| N3 | type | execution record/event model | `e21cd613ee49f206c3e82aef2d00499bb60f5386` | bounded to the decided Windows 11 x64 + Docker Desktop pilot runtime |
| N4 | type | fragment-anchor identity | `707bd3f327c3bbc99c480d853b694fef0466fd5e` | observed converter pair was all-exact; ambiguous/unresolved are harness coverage |
| N5 | type | N5 canonical client boundary | `2796af12dbddb444329edcee89025f007e34c4a9` | unsupported language-observation cells remain unsupported |
| N6 | manifest | portable reproduction manifest contract | `7c3f732a0d95e1fb489c67a0b46d69e09b501b55` | no retained second-machine clean-install evidence |
| N7 | receipt | `AgentProposalReceipt` | `6b4ebebe06a04e2810e87557f0dc8faf0155257c` | bounded local loopback provider run; hosted qualification remains open |

The environment bindings are also exact rather than descriptive summaries. They retain the recorded OS/release/architecture and applicable runtime/toolchain values (Node for every gate where recorded; Docker/image digests for N3; PGlite for N2; Theia/Python/R for N5; Python/R/Quarto for N6; TypeScript/MCP SDK for N7). Empty clean-worktree markers and boolean dirty-state observations are preserved as values, not normalized away.

This closes IV41-002's mapping requirement without creating a second research authority. Structural carriers remain owned by the existing Core/contract/experiment surfaces; qualification scope remains bounded to the retained evidence.

## Machine gate registry

P01 registers six downstream gates: `DURABILITY`, `REPLAY`, and `Q1` through `Q4`. Every gate has separate machine-evidence and human-receipt paths, negative cases, and stop conditions. Gate state is derived at runtime:

- both artifacts absent: `not-run`
- only one evidence class present: `blocked`
- both present but a predicate fails: `failed`
- both independent predicates pass: `passed`

The manifest retains `status: not-run` only as the declared planning baseline; `authorityPolicy.planningStatusIsAuthority` is false and the verifier rejects any attempt to turn that field into a pass. Executable state is derived only from retained machine evidence plus its independent human receipt. `--require-gate <id>` exits non-zero unless that derived state is actually `passed`.

At this implementation point all six downstream gates are intentionally `not-run`. That is the correct result for P01; this issue defines authority and carriers but does not manufacture qualification evidence for later workstreams.

## Core and harness boundary

The retained contract keeps semantic authority in Core. The harness may schedule runs, route tools/providers, fence attempts, replay/evaluate traces, and evolve exploration/orchestration policy, but it cannot accept interpretation or write canonical research state. Theia, CLI, MCP, and R/Python remain non-authoritative projections and cannot silently select a latest head. Recursive-improvement traces are replayable, while canonical evidence mutation and semantic-evaluator bypass remain forbidden.

## Reproduction

Run the contract and adversarial tests:

```text
npm run test:ivory-v4-1-authority
npm run verify:ivory-v4-1-authority
```

Recheck the three observed heads against the retained exact values:

```text
npm run verify:ivory-v4-1-authority -- \
  --observed-head detached=efec71ed83a1d0d9d513a4ead86369201cb5b401 \
  --observed-head pr1=d538fd44c25aa2403230b075c5e18613cea9b855 \
  --observed-head dev=bc3cd03b5b2d870d219797925d92edc48c33c6ca
```

A full repository checkout also verifies that every named owner, carrier, fixture, evidence record, and N-gate manifest path exists. The verifier prints the SHA-256 of the exact authority manifest bytes so a review can bind its output to the retained contract.

The head and tree values above were read from the repository objects on 18 September 2026. Package inventories were derived from the recursive tree for each exact commit, not from branch names or a latest-head assumption.

## Acceptance evidence

IV41-001 is bound to repository `mberrys/ivory`, PR #2, work branch `v41-p01-authority-reconciliation`, and the exact **closed PR #1 head** `d538fd44c25aa2403230b075c5e18613cea9b855` / tree `5d4aa6ec3e4c568e7babf26db8487f7abc6ec641`. The former PR #1 branch `pre-dev-foundation` was separately observed later at `904b6fb115740eb5c59e509ff5d8cce0a5b98766` / tree `5765b7dcf41d92ae216235acc5344059da4108e8`, 11 commits ahead and 0 behind the closed PR snapshot. GitHub repository objects were inspected directly; recursive tree responses were non-truncated, and Ivory package locations were derived from `packages/<name>/package.json` at the exact trees rather than inferred from a moving branch name.

The manifest records the leaf identity `IV41-001`, exact PR snapshot identity, separate moving-branch observations, explicit package locations, non-truncated-tree evidence, and per-observation evidence boundaries. The verifier fails closed if the retained PR #1 snapshot disagrees with the implementation-base head, if a later branch observation is substituted for that snapshot, if package locations stop matching the exact inventory, if a tree inventory is marked truncated, or if an owned architectural gap lacks a tracked issue URL. Its JSON report returns the manifest digest, repository context, exact commit/tree identities, package locations, evidence boundaries, and downstream gate states.

The currently identified architectural gap—canonical semantic-support Assessment—is linked to the existing tracked issue `V41-I03.2` rather than retained as session notes.

A fresh executable test run is **not claimed** by this update. PR #2 currently has no hosted workflow run because it is stacked on `pre-dev-foundation`; the available isolated execution service also rejected the attempted run for account/billing reasons. The focused tests and verifier therefore still need to be rerun in a normal repository checkout before review closure. Prior test claims are not used as evidence for this refreshed manifest.

The adversarial suite now covers stale/latest-head substitution, repository-base drift, package-location mismatch, truncated-tree rejection, untracked architectural gaps, duplicate canonical ownership, forbidden authority creation, missing N1 carriers, unapproved carrier kinds, missing exact repository/environment bindings, retained-evidence drift, broken retained carrier paths, one-sided gate evidence, rejected human review, an unrun required gate, planning status promoted to pass, harness canonical writes, and implicit latest selection.

## Limitations

This PR remains based on the `pre-dev-foundation` line, but the authority contract does not equate that moving branch with the immutable closed PR #1 snapshot. It does not merge or rewrite PR #1, reconcile the divergent `dev` commits into the foundation line, implement the missing semantic assessment carrier, or close any durability/replay/Q1-Q4 gate. Those remain owned by their declared downstream issues.


## ADR lineage and supersession

IV41-004 is recorded in `configs/ivory-v4-1-authority.json#adrLineage` and ADR-008. The lineage registry keeps V3 ORX and ADR-007 intact, adds ADR-008 as the current reconciliation decision, and classifies reconciled decisions only as inherited, amended, deferred, or superseded. Supersession targets must exist in the registry, ADR numbering must remain strictly increasing, and issue-owned deferred gaps must retain their tracking URL.

The machine contract currently records: one-Core authority as inherited; Claim Card authority as amended to a non-canonical projection; Research Capsule independent-reproduction qualification as deferred to Q3; any second canonical/workflow/scientific-acceptance authority interpretation as superseded by ADR-007; and the semantic Assessment carrier as deferred to tracked issue V41-I03.2. None of these lineage entries closes a downstream qualification gate.
