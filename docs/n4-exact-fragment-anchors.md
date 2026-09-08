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

## Qualification still required

## Qualification

`npm run qualify:n4` verifies the checked-in 20-fixture corpus, creates five anchors per fixture,
persists them with immutable baseline and changed-converter representations, and writes
`artifacts/n4/qualification-ledger.json`. The contract requires 100 anchors, two scanned PDFs,
explicit `docling-serve:v1.21.0` and `docling-serve:v1.22.0` representation identities, and zero
false exact matches. N4 project namespaces exercise both permitted and denied transfer without
claiming the later V1 user-authorization boundary.
