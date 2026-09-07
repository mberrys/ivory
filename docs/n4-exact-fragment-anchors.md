# N4 — Exact fragment anchors and ingestion fidelity

This slice implements the fail-closed contracts needed by the N4 prototype. It does not claim
the real-fixture qualification until the repository has a working dependency install and the
20-fixture corpus is supplied.

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

The acceptance experiment still needs 20 supplied real fixtures: plain text, multilingual text,
column/table/footnote PDFs, CSVs with missing values and non-ASCII labels, and two scanned PDFs.
The experiment must create at least 100 anchors, rerun with a changed converter version, reopen
from retained raw representations, and exercise project transfer. Those results must be recorded
as exact, ambiguous, or unresolved with zero false exact matches. This repository currently has no
such corpus or importer persistence path, and `npm ci` is blocked by an existing package-lock
drift (`js-yaml` 4.3.1 in the lock versus 4.3.2 required by the package graph), so those claims
remain open.
