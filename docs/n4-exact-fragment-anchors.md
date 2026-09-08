# N4 — Exact fragment anchors and ingestion fidelity

This slice implements the fail-closed contracts and reproducible qualification needed by the N4
prototype. The committed corpus is checked before qualification, and the generated ledger is
ignored alongside other runtime evidence.

## Implemented boundary

| Requirement | Implementation | Proof added |
|---|---|---|
| Reopen the same representation | `createFragmentAnchor` plus same-artifact position and quote validation | exact reopen test |
| Re-extract or correct the source | quote/context digest search with source offsets; old source version remains immutable | unique remap and source-correction tests |
| Repeated quotations | all matching candidates are retained | ambiguous remap test |
| Changed or missing evidence | no ranking or fallback | unresolved remap test |
| Page geometry and quotes | `PageCoordinate` and `InspectableFragment` are returned together | inspectable coordinate assertion |
| Raw and typed table data | raw representation identity, typed cell values, missingness, and source row numbers | contracts package test |
| Extraction failure visibility | code, message, attempt, retryability, and next action are required | failure contract test |

The remapper returns `exact` only for a unique validated location. A unique match in a different
representation is explicitly marked `confidence: approximate`, because its old position is not
being rewritten. Repeated matches are `ambiguous`; zero matches are `unresolved`. Multi-span
recovery remains unresolved until a structured selector is defined.

## Code anchors

- [`fragment-anchor.ts`](../packages/ivory-identity/src/node/fragment-anchor.ts) — inspectable
  anchors and fail-closed remapping.
- [`fragment-anchor.spec.ts`](../packages/ivory-identity/src/node/fragment-anchor.spec.ts) —
  reopen, unique, ambiguous, unresolved, and multi-span cases.
- [`ingestion-fidelity-contract.ts`](../packages/ivory-tower-contracts/src/ingestion-fidelity-contract.ts)
  — raw/table/failure schemas.

## Qualification

`npm run verify:ivory-n4-v2` first compiles the N4 dependency slice, then runs both immutable
Docling converter images against every checked-in fixture. It selects six anchors from each real
A-side extraction (at least five are required), persists the A/B representations and selectors,
reopens them from the qualification store, and checks their visibility after permitted project
transfer. The full ledger is written to `artifacts/n4/qualification-ledger.json`; the small
retained evidence record is written to `docs/experiments/n4-v2-evidence.json`.

The ledger contains input/output and raw-response hashes, converter image digests, runtime and
pull diagnostics, per-anchor observed and independent-oracle classifications, the 3x3 confusion
matrix, false-exact count, page-coordinate coverage, typed/raw CSV fidelity, and schema-valid
extraction failures with retry/next-action fields. A run is `qualified` only with 20 attempted
fixtures, two ready digest-pinned converters, at least 100 real anchors, exact reopen before and
after transfer, inspectable PDF coordinates and quotes, valid CSV fidelity, actionable failures,
and zero false-exact cells. Otherwise it is explicitly `NO-GO`. N4 project namespaces exercise
both permitted and denied transfer without claiming the later V1 user-authorization boundary.
