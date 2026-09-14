#set page(paper: "a4", margin: 2cm, columns: 2)
#set text(font: ("Times New Roman",), size: 10pt)
#set par(leading: 0.7em, justify: true)
#set heading(numbering: none)

= Snapshot-based evidence in a small research team

This paper records how a small research team keeps evidence attached to exact revisions while documents change underneath the trace. It is an internal methods note rather than a study report, and every statement is meant to be checked against retained records.

Every claim in the trace names the revisions it cites. A frozen snapshot names the exact revision identifiers it contains, so a later reader can reopen precisely the bytes that were present at freeze time.

A source correction creates a new revision and never edits an accepted one. Existing citations keep pointing at the bytes they were recorded against, even when a co-ordinator's name or title is corrected elsewhere in the corpus.

Supporting and challenging evidence links are stored as separate attributed records. The author who recorded a link is not an author who endorses the claim, and the two roles are reported separately in every export.

Repeated quotations are retained as ambiguous anchors and are never silently re-anchored. No ranking, scoring, or automatic selection is applied to the retained quotations, and zero matches are reported as unresolved instead of being searched loosely.

Frozen snapshots are never rewritten. Re-freezing after an edit produces a new snapshot whose manifest lists its own members, and both snapshots remain readable side by side for comparison.

Coding instruments evolve in editions. When an edition replaces one broad code with two narrower codes, previously coded passages keep the earlier code and the earlier revision identifier.

Analytical reports read only the structured survey rows that were frozen into the snapshot. Presentation formats are recorded separately so that a change of format can never change an analytical value.

Where the evidence conflicts, both links are kept and the conflict is reported as it stands. The team deliberately avoids averaging disagreements away, because a disagreement that disappears is a finding that disappears.

This note is read aloud to every new researcher before their first independent pass through the trace. Its statements are checked against the retained records during onboarding, and any mismatch is treated as a documentation defect.
