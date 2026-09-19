# V41-I02.1 / IV41-010A / V41-I02.2 — exact Fragment context hardening

## Context and scope

This branch builds on the existing V41-P02 and IV41-010 implementation at PR #5, head `bce1896d4dac8e3c8bd0e5a85e235b03c2d9e9b3`. It is intended as a new, reviewable replacement PR against `dev`, not a new authority or duplicate store. The foundation in PR #5 also includes adjacent I02.3/I02.4 work; those commits remain visible in this PR and are not claimed as new hardening work.

## Contract changes

- A Fragment may reference an Artifact only if it retains the Fragment's exact Source revision. Unrelated source/article pairs fail before a revision is appended.
- Mechanical readback checks the branded anchor, selector kind, exact Source/Artifact representation ref, converter and selector revision presence, and recomputed ordered span identity, in addition to retained bytes and representation digest.
- Applicable context readback checks each reference's representation ref, digest, selector bytes, recomputed span identity, independence from the cited span and uniqueness among context spans.
- `not-applicable` is a **narrow, mechanically verifiable absence witness**: an exact full-span single-line text selector with identical retained Source and Artifact text and no recognized structural marker. Table selectors, extracted excerpts, multiline material, qualifiers such as methods/limitations, and uncertain structure must carry separately anchored applicable context or stay `unavailable`; a plausible-sounding reason alone cannot waive structure.
- Existing unavailable/legacy records remain explicit and do not become a false negative claim. No historical revisions are rewritten.

## Reproducible review procedure

1. Inspect the complete diff against `dev` and confirm the owner map and IV41-010A inventory still assign semantic writing and acceptance exclusively to the research kernel.
2. Run `npm run test:ivory-canonical-model`, `npm run verify:ivory-canonical-model` and `npm run verify:ivory-tower` with the pinned repository toolchain. Review both Windows and Ubuntu GitHub Actions results.
3. Confirm the focused Fragment adversarial suite rejects header, units, denominator, legend, footnote, methods, limitation, cross-source and table cases without increasing project sequence; verify the exact one-sentence positive case.
4. Confirm the inherited N1 error test checks behavior with the now-explicit source/artifact error; confirm the CRLF cutline fixture normalizes preexisting CRLF before constructing the case.

## Evidence boundary

This documents implementation and executable fixture obligations, **not a claimed passing run**. The exact resulting commit, workflow run IDs, runner OS, toolchain, observed output, reviewer acceptance and remaining limitations must be retained in the PR after execution. V41-I07.4 checkpoint/restore remains blocked/not-run and Q1 stays unqualified. The standalone-witness rule is intentionally conservative: converted, structured or partially inspected research may remain unavailable until a richer structure inventory is implemented.
