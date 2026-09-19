# N1 reader protocol — interpretation and revision trace

Purpose: establish that a qualitative researcher can read two competing claims over one revision
trace and explain why provenance is not endorsement.

This file retains the protocol the three participants actually followed. The normative
walk-through and rubric live in the in-repo fixture protocol
`packages/ivory-tower-research-kernel/src/node/fixtures/advising-agency-protocol.md` at the
exercised commit; its steps and rubric are reproduced below verbatim so the exercised protocol is
retained here rather than duplicated in a second, divergent copy.

## Materials

- the advising-agency golden trace, built by `packages/ivory-tower-research-kernel/src/node/fixtures/advising-agency-protocol.md`
- both snapshots (S1, S2), the source correction, the carry-forward link, and the two competing claims

## Retained walk-through (verbatim from the fixture protocol)

1. Open `S1 before revision sequence` and run `explainClaim` for Claim A and Claim B. Name the
   claim author, each link role, each link author, and the exact quote.
2. Replace T1. Re-open the old fragment and confirm that its quote is still “Maya said advising
   made the next step visible.” The replacement is a new source revision; it is not a silent
   re-anchor.
3. Open CB2 and compare its narrowed `agency` definition and new `negotiation` code with S1.
   S1 must still name CB1's exact codebook revision.
4. Revise Maya's claim. Confirm that the old evidence links remain attached to the old claim
   revision. Preview carry-forward, then execute it explicitly and inspect the new links.
5. Answer: does Jordan's `challenges` link endorse Maya's claim? **No.** It is Jordan's
   attribution and polarity, not Maya's endorsement.

## Retained rubric (verbatim from the fixture protocol)

| Dimension | Pass evidence | Fail evidence |
| --- | --- | --- |
| Provenance | Exact source, fragment, codebook, and claim revisions are named. | A reader says “latest” or cannot identify the revision. |
| Citation survival | The original quote resolves after T1 replacement. | The old fragment moves to the corrected sentence. |
| Revision semantics | Old claim links stay put until carry-forward. | Revising the claim rewires old links automatically. |
| Attribution vs endorsement | Jordan's challenge is described as Jordan's authored interpretation. | The link author is treated as the claim author or as endorsement. |

## Exercise (20–30 minutes per participant)

1. Read the two competing claims.
2. Name the exact revisions each claim cites, then name what the originally cited material said before
   the source correction. A participant who moves the citation to the corrected bytes has failed.
3. State which EvidenceLink carries the original author's position forward and which actor initiated
   the carry-forward. A participant who treats the link author as endorsing the new claim has failed.
4. Report whether the S1 snapshot changed after the source correction.

## Pass criteria

A participant passes only with: provenance ≠ endorsement, no silent re-anchor,
citation survival, and carry-forward recorded as a separate action.

## Retained record

Anonymous seats, decisions and date go in `n1-human-record.json`. Names are withheld by agreement;
the participant kind and the attestation are recorded, and the gate is closed only when the record
meets the bar (≥ 2 passes of ≥ 3 participants).
