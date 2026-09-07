# N1 — Research identity and snapshot closure

Status: reference-kernel decision record. This spike proves a small immutable primitive; it does
not freeze IV-16 or implement persistence.

## Decision

The N1 kernel uses one linear accepted revision history per object. A project-owned record is
addressed by an exact reference:

```text
{ projectId, objectId, revisionId }
```

Semantic payloads, links, and frozen snapshots accept only this shape. `latest` is a navigation
operation and is rejected at the semantic boundary. Each revision records an immutable sequence,
predecessor, payload, exact references, and an activity ID. The activity ID is allocated before
the revision is hashed.

Activity provenance edges are stored outside the revision hash. Snapshot closure follows only
semantic exact references, so incoming `used-by` edges cannot recurse into unrelated live notes or
make the snapshot hash unstable.

## IV-17 attachment

Source revisions carry an IV-17 `SourceVersion` derived from the exact source bytes. Text
fragments carry an IV-17 `Passage` derived from the source version, extraction artifact, and
selector span. Derived artifacts use the IV-17 execution fingerprint and artifact identity. The
source bytes are hashed exactly as received; a correction creates a new source revision and
leaves the old fragment resolvable.

## Kept and deferred boundaries

The spike keeps sources, source fragments, codebook editions, annotations, claims, evidence
links, derived artifacts, and snapshots. It deliberately does not introduce `Interpretation`,
`Warrant`, a universal `Citation` aggregate, Entity/Event, PDF/OCR anchors, or persistence.
Competing readings are parallel claims and/or differently attributed evidence links.

## EvidenceLink contract

An EvidenceLink names an exact claim revision, exact targets, one of `supports`, `challenges`,
`qualifies`, or `contextualizes`, a rationale, and an independent link author. It stores no
confidence score. Revising a claim does not move old links. Carry-forward is a separate command
with a preview and creates new links while preserving the old ones.

## Snapshot contract

At freeze, the kernel resolves selected corpus members at project sequence Q and records explicit
context separately from auxiliary semantic dependencies. It closes over the revision's exact
semantic references, detects cycles, and does not follow predecessor chains or activity edges.
The immutable manifest is canonicalized before hashing. Label, researcher, and creation time are
receipt metadata outside the digest.

## Conflict semantics

Existing objects require `expectedHead` on every write. A stale head is rejected; no accepted
revision is modified. The in-memory reference implementation uses deterministic hash-derived
IDs so the same command trace through the `cli` and `studio` thin clients produces identical
revision IDs and snapshot digests.

## IV-16 proposal mapping

| N1 kernel record         | Proposed IV-8 mapping              | Decision status                            |
| ------------------------ | ---------------------------------- | ------------------------------------------ |
| source + source revision | `Source` / `SourceVersion`         | proposal; IV-17 identity remains canonical |
| fragment                 | `Passage`-backed evidence fragment | proposal                                   |
| codebook edition         | `Codebook` / edition               | proposal                                   |
| annotation               | `Annotation`                       | proposal                                   |
| claim                    | `Claim`                            | proposal                                   |
| EvidenceLink             | `EvidenceLink`                     | proposal; no score field                   |
| artifact                 | `Artifact` / producing run         | proposal                                   |
| snapshot                 | `Snapshot` / closure manifest      | proposal                                   |

This table is additive guidance for the eventual IV-16 freeze. It does not rewrite
[`docs/iv-8-product-model.md`](iv-8-product-model.md).

## Human validation

The package ships `advising-agency-protocol.md`, a reader mock, and a provenance-versus-
endorsement rubric. The three-researcher gate remains open until real researchers walk the
protocol and their results are recorded by the study owner.
