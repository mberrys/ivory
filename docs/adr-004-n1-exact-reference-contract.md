# ADR-004 — Accept the N1 exact-reference, closure and EvidenceLink contract

Status: accepted (2026-09-13).
Supersedes: nothing. Amends: the N1 row of the Notion plan of record and §V2.11.

## Context

N1 asked whether one small revision model preserves exact evidence through source correction, codebook
revision, claim revision, competing interpretation and deterministic snapshot closure. The reference
kernel on `v2-n1-experiment` (`0c6e7de4`) answered the automated trace, and the reader-protocol
exercise is retained in `docs/experiments/n1-human-record.json`. N1 is a contract decision; production
persistence is N2's.

## Decision

1. Accepted contract (see `docs/experiments/n1-v2-reference-kernel.md`):
   - exact `{ projectId, objectId, revisionId }` references; `latest` is navigation-only;
   - accepted revisions immutable, one linear history per object, expected-head updates;
   - snapshot closure follows semantic references and explicit context members — never activity
     back-links or predecessor chains;
   - source correction and claim revision create new revisions; existing citations and links do not move;
   - EvidenceLink carry-forward is an explicit action that preserves the original link author and
     records the initiating actor separately;
   - dangling references, type-crossing revisions and unmatched selectors fail closed.
2. Explicitly **not** decided here: production schema freeze (IV-16), persistence (ADR-005), anchor
   remapping/PDF-OCR representation qualification (N4).
3. The N1 kernel stays a reference implementation. Production code re-implements the contract against
   the selected store; the spike is not promoted wholesale.

## Consequences

- The importer/importer-facing schema work may proceed against the accepted contract.
- Any later change to closure semantics is a new ADR, not a patch.
- `npm run verify:ivory-n-gates -- --require-closed N1` is the machine check for this decision.
