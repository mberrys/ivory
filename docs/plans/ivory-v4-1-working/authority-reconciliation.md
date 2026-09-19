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

## N1-N7 carrier reconciliation

`configs/ivory-v41-carrier-matrix.json` gives every N1-N7 lesson exactly one current structural carrier or one owned downstream gap, plus a predicate, fixture pointer, gate, and scope limitation. Important open boundaries remain explicit:

- N5 retained parity evidence is not present on the selected dev head, so closure cannot be inferred from PR #1.
- N6 remains open for independent second-machine installation/replay evidence.
- N3 remains bounded to its recorded Windows 11 x64/Docker Desktop pilot scope.
- N7 remains a bounded local-provider result; later live-provider qualification is separate.

## Gate registration

`configs/ivory-v41-gates.json` registers DURABILITY, REPLAY, and Q1-Q4. Every gate starts `not-run` and separately names machine evidence, human receipts, adversarial cases, and stop conditions. There is no aggregate pass flag and no machine predicate may infer a human research outcome.

## Source register

The machine manifest retains direct links for Ivory Master Plan v4.1 and source plans A-F. These pages are architecture/design sources, not execution proof. The implementation follows the parent/leaf order `V41-I01.1 -> V41-I01.2 -> V41-I01.3 -> V41-I01.4`.

## Verification

Run:

```text
npm run verify:ivory-v41-authority
npm run test:ivory-v41-authority
```

The first command emits SHA-256 digests for all four contract artifacts and fails closed on authority drift. The second covers stale/latest-head selection, inferred package inventories, package-manifest drift, duplicate semantic authority, harness/RSI authority leakage, prose-only carrier claims, and aggregate/pre-closed gates.
