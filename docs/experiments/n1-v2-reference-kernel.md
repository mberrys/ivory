# N1 V2 reference-kernel experiment

**Status:** closed — automated trace pass and the three-participant interpretation gate closed by
`docs/experiments/n1-human-record.json`.

This experiment is the V2 refinement of N1 — research identity, snapshot closure, and
interpretation semantics. It implements the smallest headless reference kernel required to test
the architecture claim before persistence, Theia UI, or governed computation are built.

## Question and boundary

Can one linear immutable-revision model preserve exact evidence through source correction,
codebook revision, claim revision, competing interpretations, and deterministic snapshot closure
without introducing a larger ontology?

The experiment covers the advising-agency golden trace: two transcripts, an imported table, two
codebook editions, overlapping annotations, two competing claims, one derived artifact, two
snapshots, a source replacement, an EvidenceLink whose author differs from the claim author, and
the same command trace through thin CLI and Studio clients.

It deliberately does not implement persistence, a Core service, PDF/OCR remapping, or a production
schema. Those are N2, N4, and later release gates. Human researcher validation is not part of the
kernel either: it is the separate reader-protocol exercise retained in
[`n1-human-record.json`](n1-human-record.json).

## V2 contract under test

- Semantic records use exact `{ projectId, objectId, revisionId }` references; `latest` is
  navigation-only.
- Accepted revisions are immutable, have one linear object history, and require an expected head
  for revision updates.
- Snapshot closure follows semantic references and explicit selected/context members, not
  activity back-links or predecessor chains.
- Source correction and claim revision create new revisions; old citations and links do not move.
- Carry-forward is an explicit action that preserves the original link author and records the
  initiating actor separately.
- The verifier rejects dangling references, type-crossing revisions, and selectors that do not
  match retained material.

## Qualification

Compile the two packages, run the focused test suite, then emit the retained evidence record:

```powershell
node node_modules/typescript/bin/tsc --project packages/ivory-identity/tsconfig.json
node node_modules/typescript/bin/tsc --project packages/ivory-tower-research-kernel/tsconfig.json
node scripts/verify-ivory-n1.mjs
```

The root alias `npm run verify:ivory-n1` runs the verifier after compiled output exists. The
verifier writes [`n1-v2-evidence.json`](n1-v2-evidence.json), including the tested commit,
platform/runtime, fixture digest, exact command/configuration, timings, criteria, decision, and
limitations. It exits non-zero on any automated criterion failure.

## Decision and gate outcome

The automated trace is a **provisional architecture pass** when all recorded criteria pass. It
unlocks the exact-reference schema, immutable revision semantics, semantic snapshot closure, and
explicit EvidenceLink carry-forward contract for the bounded production-kernel design.

The three-researcher interpretation gate is **closed** by the retained human record
[`n1-human-record.json`](n1-human-record.json). Three anonymized seats — A, B and C, no names — each
completed the [reader protocol](n1-reader-protocol.md) against the kernel at
`0c6e7de41e787ccf7e46da9f18cacaad520b3868` and each cleared the pass criteria: provenance ≠
endorsement, no silent re-anchor, citation survival, and carry-forward recorded as a separate
action. The bar is at least two qualifying passes among at least three participants, and the record
states the participant kind (`human-qualitative-researcher`) plus the owner's dated attestation of
human participation.

The automated evidence writer derives that status from the record and cannot fabricate a
participant: with the record absent or unqualified it reports the gate open, and the status can no
longer be hand-edited here without `npm run verify:ivory-n-gates` failing on the drift.

This record does not authorize an IV-16 schema freeze or claim that the in-memory kernel is the
production persistence implementation.
