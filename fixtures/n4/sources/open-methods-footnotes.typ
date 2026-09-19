#set page(paper: "a4", margin: 2.4cm)
#set text(font: ("Times New Roman",), size: 11.5pt)
#set par(leading: 0.8em, justify: true)

= Methods notes with footnote attributions

The review protocol distinguishes three record kinds, and each kind carries its own attribution rules.#footnote[The three kinds are the source record, the claim record, and the evidence link record; this note follows the vocabulary of the internal methods glossary.]

A claim is only as precise as the revisions it names. When a claim cites a passage, the citation keeps the exact revision identifier that was current when the claim was written.#footnote[Revision identifiers use the pattern recorded in the methods glossary, and they are never reused within a project.]

Source corrections create new revisions and never edit accepted ones. Existing citations therefore keep pointing at the corrected bytes' predecessors, and no silent re-anchoring is permitted anywhere in the pipeline.#footnote[Silent re-anchoring means moving a citation to new bytes without recording the move as its own revision; the review treats any such move as a defect.]

Supporting and challenging links are stored as separate attributed records. The author who recorded a link is not an author who endorses the claim, and exports keep the two roles distinct.#footnote[The recording author and the carrying-forward actor are recorded as separate fields even when one person performs both actions.]

Repeated quotations remain ambiguous anchors, and unresolved anchors remain unresolved. No ranking, scoring, or automatic selection is applied to retained quotations at any stage of the review.

Frozen snapshots are never rewritten. Re-freezing after an edit produces a new snapshot that lists its own members, while the earlier snapshot stays readable for comparison.#footnote[Snapshot manifests are content-addressed and immutable; a later reopen of the same snapshot must return byte-identical member identifiers.]

Analytical reports read only the structured survey rows frozen into the snapshot, and presentation formats are recorded separately so that a change of layout cannot change an analytical value.

Where evidence conflicts, both links are kept and the conflict is reported as it stands. The review deliberately avoids averaging disagreements away, because a disagreement that disappears is a finding that disappears.

These notes are read aloud to every new researcher before their first independent pass, and every statement is checked against the retained records during onboarding.
