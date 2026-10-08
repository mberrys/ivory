# ADR-007 — V4.1 authority carriers and harness boundary

Status: accepted (2026-09-19). Carries the authority decisions already landed as the `configs/ivory-v41-*.json` contract set.
Machine contract: `configs/ivory-v41-adr-lineage.json` (lineage registry and decisions) read together with
`configs/ivory-v41-authority-heads.json`, `configs/ivory-v41-owner-map.json`, `configs/ivory-v41-package-ownership.json`,
`configs/ivory-v41-carrier-matrix.json`, `configs/ivory-v41-gates.json`, and `configs/ivory-v41-qualification.json`;
validated by `scripts/ivory/v41-authority.mjs`.

## Context

`configs/ivory-v41-authority-heads.json` pins three deliberately separate repository observations by role:
`detachedBaseline` (the detached planning checkout), `foundationPr` (the pinned PR #1 head, retained as foundation
evidence), and `selectedDev` (`refs/heads/dev`, the only selectable authority and the implementation and
package/schema audit basis for this reconciliation). These roles are evidence inputs, not interchangeable aliases.
Package and schema facts are tied to exact commit/tree identities and exact `package.json` git blob ids; a current or
inferred "latest" checkout is not allowed to substitute for one of them.

The same boundary applies to Ivory's agent harness. The harness can become richer over time — tool routing, run
scheduling, provider selection, replay, evaluation, retained execution traces, and recursive improvement of
exploration/orchestration policy — without becoming a second research kernel. The canonical Core remains the
semantic authority for research records and human research decisions.

## Decision

1. **Exactly three source head roles are named.** The manifest records `detachedBaseline`, `foundationPr`, and
   `selectedDev` as distinct exact SHAs, and exactly one of them is selectable. Every package fact classifies each
   named role explicitly.
2. **Core owns research meaning.** Source, Fragment, EvidenceLink, Statement/claim, Artifact, Activity, Snapshot,
   ResearchProtocol, research-decision receipts, execution receipts, and CAS resolve through the existing canonical
   revision/receipt boundaries recorded in `configs/ivory-v41-owner-map.json`. Missing semantics are recorded as
   owned gaps tracked by an `IV41-*` issue; they do not justify a parallel store.
3. **Harness owns execution, not interpretation.** The harness may schedule work, route tools and providers, fence
   attempts, cancel and retry, retain immutable execution traces, replay runs, and evaluate orchestration behavior.
   It may not accept an interpretation, write canonical research state, or bypass Core adoption and human review.
4. **Clients are replaceable projections.** Theia, CLI, API, and the R/Python helpers request operations and render
   snapshot-scoped reads. They do not select a newer head implicitly and do not contain a shadow acceptance path.
5. **Recursive improvement stays outside evidence truth.** Retained research and discovery traces may be replayed as
   evaluation worlds and may improve harness exploration/orchestration policy. Recursive improvement cannot rewrite
   canonical evidence, mutate historical snapshots, or bypass semantic evaluation and human authority.
6. **N1–N7 are carried structurally.** `configs/ivory-v41-carrier-matrix.json` gives every retained lesson exactly
   one structural carrier or one owned gap, plus a predicate, fixture pointer, gate, and scope limitation. A
   prose-only lesson cannot close a V4.1 gate.
7. **Gates remain disaggregated.** `configs/ivory-v41-gates.json` registers DURABILITY, REPLAY, and Q1–Q4, each with
   separate machine evidence, human receipts, adversarial cases, and stop conditions. Every gate stays `not-run`
   until its own retained proof exists; runs belong to `configs/ivory-v41-qualification.json` records, and there is no
   aggregate pass flag.
8. **Authority stays single-sourced.** Research acceptance and canonical research-state writes belong to
   `configs/ivory-v41-owner-map.json` and `configs/ivory-v41-package-ownership.json`. `configs/ivory-v41-adr-lineage.json`
   is a lineage record; it may not declare acceptance authority, and ADR text cannot close a gate.

## Rejected alternatives

- A Paper Store, Claim Card store, ResearchCase, or universal acceptance aggregate as a second authority.
- A harness-owned semantic judge or a mutable workflow `complete` state.
- Client-side acceptance or implicit reconnect-to-latest behavior.
- A single aggregate pass flag that collapses machine evidence and human research decisions.
- Treating prior N1–N7 experiment success as unbounded V4.1 qualification.

## Consequences

The contract is intentionally small: typed manifests plus a fail-closed verifier (`scripts/ivory/v41-authority.mjs`)
and an adversarial suite (`scripts/ivory/v41-authority.spec.mjs`). Later V4.1 leaves add fields only where the
exact-head audit proves them absent, through the existing canonical revision/receipt path. If future work requires
writable projection state or repeated exceptions to the Core/harness boundary, the architecture must be re-grounded
rather than patched with another coordinator.
