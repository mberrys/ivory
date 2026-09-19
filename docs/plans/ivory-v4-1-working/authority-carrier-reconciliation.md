# V41-P01 authority, carrier, and source reconciliation

**Status:** implemented contract; downstream V4.1 qualification gates are not run.

This record implements the four ordered leaves of V41-P01 without adding a second semantic store or acceptance authority. The executable source of truth is `configs/ivory-v4-1-authority.json`; `scripts/ivory/v4-1-authority.mjs` validates it and derives gate state from separate machine evidence and human receipts.

## Authority decision

The implementation is stacked on the exact PR #1 foundation head because that head contains the complete N1-N7 retained-evidence and machine-gate surfaces. The selected `dev` head is retained as a compared authority, not substituted for the foundation head: it is a divergent line and does not contain `configs/ivory-n-gates.json` or the N5 client/shell packages present on PR #1.

| authority | commit | tree | classification | Ivory packages |
|---|---|---|---|---:|
| detached planning baseline | `efec71ed83a1d0d9d513a4ead86369201cb5b401` | `b52b1aa0957e45f199f3e75bf99fdaad7ef972a1` | reference-only | 1 |
| PR #1 / `pre-dev-foundation` | `d538fd44c25aa2403230b075c5e18613cea9b855` | `5d4aa6ec3e4c568e7babf26db8487f7abc6ec641` | implementation-base | 14 |
| selected `dev` | `bc3cd03b5b2d870d219797925d92edc48c33c6ca` | `8edc9eab81e3733b60eb626c10ca91de63bd041c` | divergent-compared-head | 12 |

The retained package inventory is exact to those tree objects. The detached baseline contains only `ivory-identity`. PR #1 adds the full Core/service package set plus `ivory-n5-client` and `ivory-n5-shell`; the selected `dev` head has the Core/service set but not those N5 packages or the N-gate manifest.

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

Each retained N-gate now has an explicit structural carrier, closing predicate, fixture, evidence record, and scope limitation in the manifest. This prevents a later V4.1 issue from citing an experiment paragraph as if it were a production carrier.

| gate | structural carrier | retained limitation |
|---|---|---|
| N1 | research-kernel revisions, snapshots and evidence links | exact-reference experiment evidence is not V4.1 production qualification |
| N2 | durable-store experiment contract | bounded to the recorded reference machine and unclean process termination |
| N3 | execution record/event model | bounded to the decided Windows 11 x64 + Docker Desktop pilot runtime |
| N4 | fragment-anchor identity | observed converter pair was all-exact; ambiguous/unresolved are harness coverage |
| N5 | N5 canonical client boundary | unsupported language-observation cells remain unsupported |
| N6 | portable-reproduction contract | no retained second-machine clean-install evidence |
| N7 | proposal-integrity experiment Core | bounded local loopback provider run; hosted qualification remains open |

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

The last local contract test run on 18 September 2026 produced 17/17 passing tests against the prior exact PR #1 head. After the inherited PR #1 CI repair, this contract was refreshed to PR #1 head `d538fd44c25aa2403230b075c5e18613cea9b855` / tree `5d4aa6ec3e4c568e7babf26db8487f7abc6ec641`; the refreshed manifest SHA-256 is `0c4ad2173d7a4749ad56b6739bc58c5114a9bf1a49c398b741cd7c9e85293bbe`. The stacked PR does not currently receive the hosted workflow because its base is `pre-dev-foundation`, so this refresh is not represented as a new hosted test run.

Negative cases exercised by the test suite include latest-head substitution, duplicate canonical ownership, forbidden authority creation, a missing N1 carrier, a broken retained carrier path, machine-only gate evidence, human-only gate evidence, rejected human review, requiring an unrun gate, a planning status promoted to pass, a harness canonical write, and a client that implicitly selects latest.

## Limitations

This PR is intentionally stacked on the exact PR #1 foundation branch so its diff contains only V41-P01. It does not merge or rewrite PR #1, reconcile the divergent `dev` commits into the foundation line, implement the missing semantic assessment carrier, or close any durability/replay/Q1-Q4 gate. Those remain owned by their declared downstream issues.
