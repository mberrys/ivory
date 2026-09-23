# V5 reset: project frame and grounded boundaries

**Status:** evidence-grounded frame, not an accepted V5 architecture or passed runtime gate. Pinned source is `mberrys/ivory-archive@bfcb283c4fe32b64b67a325f8f55aca08314296f`, destination `mberrys/ivory@b0f9e63a6d331135265869a341dce7c7f1eef158`. See `archive-source-manifest.json` and `branch-reconciliation.md`.

## Operator outcome and caller walk

One researcher imports a source and an exact representation, cites a historical fragment, runs a permitted analysis, retains competing interpretations and challenge evidence, reviews an agent proposal, and freezes a reproducible capsule. A CLI or Theia view asks the **same Core** for `readSnapshot(projectId, exactSnapshotRef)` and `readAssessment(exactReceiptRef)`; neither client substitutes current heads or adjudicates support.

## /how: observed archive topology (do not auto-promote)

- `packages/ivory-tower-research-kernel`: N1 reference model, snapshots and exact references; in-memory experiment, not production persistence.
- `packages/ivory-identity`: identity/selector utilities and negative tests. `packages/ivory-tower-contracts` and `packages/ivory-tower-domain`: boundary contracts and domain types.
- `packages/ivory-tower-api` and `packages/ivory-tower-application`: service and HTTP presentation; `packages/ivory-tower-infrastructure` contains in-memory and Postgres paths, object storage, migrations and workers. This is **not** evidence of a selected V5 local store.
- `packages/ivory-tower-worker` and `packages/ivory-tower-agent-experiment`: execution/proposal machinery with separate qualification and effects; archived agent experiment must not become canonical writer.
- `packages/ivory-n5-client`, `packages/ivory-n5-shell`, browser examples, `spikes/`: client and experiment harnesses, not shipped V5 infrastructure by default.
- `docs/experiments/**`, `docs/adr-001* … adr-008*`, `configs/ivory-n-gates.json`: historical records, not mutable current architecture.

## /why: invariants carried as questions for new evidence

Exact `{projectId,objectId,revisionId}` refs, expected-head CAS in Core, frozen semantic closure excluding activity back-links, unchanged past citations, explicit carry-forward authorship (N1); byte admission before one durable SQL commit and replayable receipt (N2); governed RunSpec and no worker Core credentials (N3); representation digest and honest remap (N4); interchangeable clients over one service (N5); capsule replay distinguished from independent reproduction (N6); scoped proposal, revocation and human acceptance (N7). Sources and limitations are exact-blob pinned in the manifest.

## Non-goals and trust boundaries

No shadow provenance database; no agent or typed scorer acceptance authority; no automatic full-corpus egress; no unqualified hosted or cross-machine claims; no unreviewed archive deployment/lockfiles. Theia owns UX not semantic revision history. Core owns canonical writes and decision receipts; CAS owns bytes, not research truth; readers and decision adapters receive minimized immutable context and return proposals/observations only.

## Gates

R0: pin and reconcile heads, record baseline environment/build (currently **not run**); R1: license and source-package-by-package disposition (currently **open**); J1/J2 first; four independently concurrent architectural outputs and four interrogations (currently **not run**); then conditional V5 scaffold. This document must not be read as a completed pstack fan-out.
