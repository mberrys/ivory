# V41-P02 — Fragment context and exact evidence

## Plan

1. Extend the canonical `@ivory-tower/research-kernel` Fragment carrier rather than creating a second evidence store.
2. Bind every new Fragment revision to an exact retained representation digest, converter revision, selector-profile revision, selector kind, and ordered-span identity.
3. Represent material structural context as bounded exact references with typed roles; preserve explicit `unavailable` and justified `not-applicable` states.
4. Keep cited/context roles on `EvidenceLink` while leaving selector identity owned by Fragment.
5. Produce deterministic mechanical citation receipts that separate byte/selector/context exactness from semantic support.
6. Remap converter changes through explicit `EXACT`, `AMBIGUOUS`, or `UNRESOLVED` outcomes; even `EXACT` creates a new Fragment revision and never rewrites history.
7. Keep Q1 fail-closed until the prerequisite `V41-I07.4` checkpoint/restore semantic readback and downstream human assessment evidence exist.

## Implementation

- Added `FragmentAnchorIdentity`, `FragmentProfile`, bounded `FragmentContext`, and exact context-reference carriers.
- Added explicit per-Fragment `cited` / `context` roles to `EvidenceLinkPayload`.
- Added `ResearchKernel.verifyCitation` mechanical receipts with `EXACT`, `BLOCKED`, and `MISMATCH` states and `semanticSupport: not-assessed`.
- Added `ResearchKernel.remapFragment` with fail-closed exact/ambiguous/unresolved remap semantics.
- Legacy Fragment callers remain readable, but missing structural context is retained as `unavailable` and blocks an exact mechanical receipt instead of being silently treated as not-applicable.
- Updated the V4.1 owner/gap and N4 carrier manifests to point to the implemented structural carriers.

## Adversarial coverage

The focused research-kernel fixture covers:

- empty applicable context;
- unjustified not-applicable context;
- context collapsed onto the cited span;
- missing EvidenceLink cited/context roles;
- converter/profile drift through the create path;
- changed representation with one exact candidate;
- duplicate exact candidates that must remain ambiguous;
- missing exact candidates that must remain unresolved;
- immutable historical Fragment readback after remap;
- deterministic mechanical receipts from identical exact reconstruction.

## Qualification boundary

This PR does **not** close Q1 or claim durable restart proof. `V41-I07.4` is still a prerequisite and remains independently evidence-gated. The deterministic reconstruction fixture proves the exact contract is stable for identical retained inputs; it is not a substitute for checkpoint/restore semantic readback.
