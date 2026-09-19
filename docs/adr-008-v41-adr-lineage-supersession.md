# ADR-008 — V4.1 ADR lineage and supersession

**Status:** proposed for review by IV41-004.  
**Scope:** V4.1 architecture lineage and decision supersession.  
**Machine contract:** `configs/ivory-v4-1-authority.json#adrLineage`.

## Context

Ivory V4.1 inherits architecture from the historical V3 ORX proposal while PR #2 also introduces ADR-007 for the authority-carrier and harness boundary. The historical sources must remain reviewable as written. V4.1 therefore needs an explicit lineage record instead of silently rewriting older decisions or treating planning notes as current authority.

The lineage is evidence-bound to the exact repository heads already retained by the V4.1 authority manifest. This ADR does not broaden qualification: durability, replay, and Q1-Q4 remain independent gates and retain their existing evidence limits.

## Decision

1. **Historical architecture records are immutable evidence.** V3 ORX and ADR-007 remain intact; later decisions reference, amend, defer, or supersede them explicitly.
2. **ADR numbering is monotonic and unambiguous.** ADR-008 follows ADR-007. Registry entries use zero-padded `ADR-###` identifiers and unique repository paths.
3. **Decision lineage uses four explicit dispositions.** Every reconciled decision is classified as `inherited`, `amended`, `deferred`, or `superseded` in the machine manifest.
4. **Inheritance preserves the one-Core model.** V3's single canonical Core authority remains inherited through ADR-007.
5. **Amendment narrows Claim Card authority.** Claim Card is a projection over canonical research state, not a second canonical aggregate or store.
6. **Deferred work remains owned and fail-closed.** Research Capsule independent-reproduction qualification stays behind Q3. The missing semantic-support Assessment carrier stays owned by V41-I03.2; this ADR does not fill it with prose.
7. **Supersession is explicit and narrow.** V3 ORX is superseded only as the current architecture qualification target by the V4.1 authority/harness contract. Its historical record and inherited one-Core decisions remain intact.
8. **Architectural gaps cannot live only in session notes.** A deferred architectural gap must name its tracked gate or issue, and issue-owned gaps must retain the tracking URL in the manifest.

## Evidence context

The machine lineage is stored in `configs/ivory-v4-1-authority.json` and validated by `scripts/ivory/v4-1-authority.mjs`. It reuses the exact retained repository observations rather than selecting a newer branch implicitly:

- closed PR #1 head: `d538fd44c25aa2403230b075c5e18613cea9b855` / tree `5d4aa6ec3e4c568e7babf26db8487f7abc6ec641`;
- later `pre-dev-foundation` observation remains separate evidence context and does not replace that PR snapshot;
- selected `dev` head remains a divergent compared authority.

The environment and execution evidence for N1-N7 remains bound to the retained evidence records already checked by the authority verifier. IV41-004 does not manufacture new execution proof.

## Consequences

Reviewers can determine which historical decision still applies without inferring intent from chronology. Supersession becomes machine-checkable, historical ADR text remains intact, and deferred architectural gaps cannot disappear into prose. Downstream work can add a new ADR when a decision actually changes rather than editing the historical record in place.

## Rejected alternatives

- Editing ADR-007 or the V3 ORX source to make them read as if V4.1 had always existed.
- Treating a newer branch head as implicit evidence for a lineage decision.
- Using a free-form "current" status with no explicit predecessor/successor relationship.
- Closing deferred gates or schema gaps from ADR prose alone.
