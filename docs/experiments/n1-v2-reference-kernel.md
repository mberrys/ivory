# N1 V2 reference-kernel experiment

**Status:** provisional architecture pass; human validation remains open.

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

It deliberately does not implement persistence, a Core service, PDF/OCR remapping, a production
schema, or human researcher validation. Those are N2, N4, and later release gates.

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

## Decision and open gate

The automated trace is a **provisional architecture pass** when all recorded criteria pass. It
unlocks the exact-reference schema, immutable revision semantics, semantic snapshot closure, and
explicit EvidenceLink carry-forward contract for the bounded production-kernel design.

The three-researcher gate is intentionally **open**. The supplied reader protocol requires three
qualitative researchers to inspect both claims and the revision trace; at least two must complete
it without confusing provenance with endorsement. No researcher result is fabricated by the
automated evidence writer.

This record does not authorize an IV-16 schema freeze or claim that the in-memory kernel is the
production persistence implementation.
