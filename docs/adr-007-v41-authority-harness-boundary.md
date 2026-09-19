# ADR-007 — V4.1 authority carriers and harness boundary

**Status:** proposed for review by V41-P01.  
**Scope:** V41-I01.1 through V41-I01.4.  
**Machine contract:** `configs/ivory-v4-1-authority.json`.

## Context

V4.1 starts from three deliberately separate repository observations: the detached planning baseline, PR #1's pinned foundation head, and the selected `dev` head. These heads are evidence inputs, not interchangeable aliases. Package and schema facts must be tied to exact commit/tree identities; a current or inferred "latest" checkout is not allowed to substitute for one of them.

The same boundary applies to Ivory's agent harness. The harness can become richer over time—tool routing, run scheduling, provider selection, replay, evaluation, retained traces, and recursive improvement of exploration/orchestration policy—without becoming a second research kernel. The canonical Core remains the semantic authority for research records and human research decisions.

## Decision

1. **Exactly three source heads are named.** The manifest records the detached baseline, PR #1 foundation, and selected `dev` SHA/tree. PR #1 is the implementation base for this work. Every package fact classifies each named head explicitly.
2. **Core owns research meaning.** Source, Fragment, EvidenceLink, Statement/claim, Artifact, Activity, ResearchProtocol, receipts, snapshots, and later assessment carriers resolve through the existing canonical revision/receipt boundaries. Missing semantics are recorded as owned gaps; they do not justify a parallel store.
3. **Harness owns execution, not interpretation.** The harness may schedule work, route tools/providers, fence attempts, cancel/retry, retain immutable execution traces, replay runs, and evaluate orchestration behavior. It may not accept an interpretation, write canonical research state directly, or bypass Core adoption/review.
4. **Clients are replaceable projections.** Theia, CLI, MCP, and R/Python helpers request operations and render snapshot-scoped reads. They do not select a newer head implicitly and do not contain a shadow acceptance path.
5. **Recursive improvement stays outside evidence truth.** Retained research/discovery traces may be replayed as evaluation worlds and may improve harness exploration/orchestration policy. Recursive improvement cannot rewrite canonical evidence, mutate historical snapshots, or bypass semantic evaluation and human authority.
6. **N1–N7 are carried structurally.** Every retained lesson names a carrier, predicate, fixture, evidence record, gate, and scope/limitation. A prose-only lesson or out-of-scope experiment cannot close a V4.1 gate.
7. **Gates remain disaggregated.** Durability, replay, and Q1–Q4 each retain separate machine evidence, human receipts, negative cases, and stop conditions. Their initial state is `not-run`; this parent contract does not manufacture execution proof.

## Rejected alternatives

- A Paper Store, Claim Card store, ResearchCase, or universal acceptance aggregate as a second authority.
- A harness-owned semantic judge or mutable workflow `complete` state.
- Client-side acceptance or implicit reconnect-to-latest behavior.
- A single aggregate pass flag that collapses machine evidence and human research decisions.
- Treating prior N1–N7 experiment success as unbounded production qualification.

## Consequences

The V41-P01 deliverable is intentionally small: a typed manifest plus a fail-closed verifier and adversarial tests. Later V4.1 leaves can add fields only where the exact-head audit proves them absent, through the existing canonical revision/receipt path. If future work requires writable projection state or repeated exceptions to the Core/harness boundary, the architecture must be re-grounded rather than patched with another coordinator.
