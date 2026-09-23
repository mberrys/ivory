# ADR-008 — V4.1 ADR lineage and supersession

Status: accepted (2026-09-19). Supersedes: V3 ORX as the *current* architecture qualification target — carried by
ADR-007, with the V3 one-Core invariants inherited separately and the historical record left intact.
Amends: the Claim Card authority decision, narrowed to a regenerated projection.
Machine contract: `configs/ivory-v41-adr-lineage.json` (lineage registry and decisions), validated by
`scripts/ivory/v41-authority.mjs`.

## Context

Ivory V4.1 inherits architecture from the historical V3 ORX proposal while the V4.1 authority, carrier,
package-ownership, gate, and qualification contracts are already landed on this line. ADR-001 through ADR-006 are the
historical ADR text that this line actually has. Those sources must remain reviewable as written; V4.1 therefore needs
an explicit lineage record instead of silently rewriting older decisions or treating planning notes as current
authority.

The lineage is evidence-bound to the exact repository heads already retained by the V4.1 authority manifest. This ADR
does not broaden qualification: durability, replay, and Q1–Q4 remain independent gates with their existing evidence
limits, and IV41-004 manufactures no execution proof.

## Decision

1. **Historical architecture records are immutable evidence.** The V3 ORX architecture source and ADR-001 through
   ADR-006 remain intact. Later decisions reference, amend, defer, or supersede them explicitly; ADR-007 and ADR-008
   are added by this issue rather than edited into the historical files.
2. **ADR numbering is monotonic and unambiguous.** Registry entries use zero-padded `ADR-###` identifiers, unique
   repository paths, and strictly increasing order. ADR-007 and ADR-008 follow ADR-006.
3. **Decision lineage uses four explicit dispositions.** Every reconciled decision is classified as exactly one of
   `inherited`, `amended`, `deferred`, or `superseded` in the machine manifest, and each names its `source`,
   `carriedBy`, `statement`, `evidenceBoundary`, and `evidenceHeads`.
4. **Inheritance preserves the one-Core model.** V3's single canonical Core authority remains inherited through
   ADR-007; clients, harnesses, and worker proposals never become parallel research authorities.
5. **Amendment narrows Claim Card authority.** Claim Card is a regenerated projection over canonical research state,
   not a second canonical aggregate or store.
6. **Deferred work remains owned and fail-closed.** Research Capsule independent-reproduction qualification stays
   behind gate Q3. The missing canonical semantic-support Assessment carrier stays owned by tracked issue IV41-021;
   this ADR does not fill either with prose.
7. **Supersession is explicit and narrow.** V3 ORX is superseded only as the current architecture qualification
   target, and the successor is named in the registry. Its historical record and inherited one-Core decisions remain
   intact. A supersession target must exist in the registry, may not be the record itself, and may not form a cycle.
8. **Architectural gaps cannot live only in session notes.** A deferred architectural gap must name a tracked gate id
   or an issue id; an issue-owned gap additionally retains its tracking URL in the manifest.
9. **Lineage declares no acceptance authority.** `configs/ivory-v41-owner-map.json` and
   `configs/ivory-v41-package-ownership.json` remain the single sources for research acceptance and canonical
   research-state writes, and no lineage record may claim either.

## Evidence context

The machine lineage is stored in `configs/ivory-v41-adr-lineage.json` and validated by
`scripts/ivory/v41-authority.mjs` as part of the whole V4.1 bundle. It reuses the exact retained repository
observations rather than selecting a newer branch implicitly:

- the three head roles of `configs/ivory-v41-authority-heads.json` — `detachedBaseline`, `foundationPr`, and
  `selectedDev` — are the only head ids a lineage decision may name;
- the prior selected-dev head `bc3cd03b5b2d870d219797925d92edc48c33c6ca` is retained intact as history and remains
  the selectedDev authority pinned by that manifest;
- the reconciliation merge `f8d0af66aa10d419cd18fb5f649f0eabfc63cd5d` ("merge: reconcile the N1-N7 closeout line with
  the V4.1 authority line on dev") is recorded as an exact observation of the line these ADRs land on.

The environment and execution evidence for N1–N7 remains bound to the retained evidence records already checked by
the authority and N-gate verifiers. The ADR text itself is not machine evidence.

## Consequences

Reviewers can determine which historical decision still applies without inferring intent from chronology.
Supersession becomes machine-checkable, historical ADR text stays intact, and deferred architectural gaps cannot
disappear into prose. Downstream work adds a new ADR when a decision actually changes rather than editing the
historical record in place.

## Rejected alternatives

- Editing ADR-001 through ADR-006 or the V3 ORX source to make them read as if V4.1 had always existed.
- Treating a newer branch head as implicit evidence for a lineage decision.
- Using a free-form "current" status with no explicit predecessor/successor relationship.
- Letting ADR prose close deferred gates or schema gaps, or declaring research acceptance from the lineage manifest.
