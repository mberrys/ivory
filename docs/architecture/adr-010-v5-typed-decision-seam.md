# ADR-010: Typed decision seam (Jev-like) omitted from the V5.0 runtime

**Status:** Accepted (2026-09-28). This is the R5 decision the Jev research epic asked for, scoped to V5.0.
**Decision page:** [Ivory V5.0 Architecture](https://app.notion.com/p/3e99cb079ddb8105aaabfa282dcda257) §10.
**Evidence:** `experiment/jev-r2-r3-semantic-seam` @ `e0755eac4` (reference only, never merged): `docs/reset/jev-r5-bounded-disposition.md`, `jev-r4-remainder-closeout.md`, `synergy-nli-cascade-experiment.md`, `qwen3-*.md`. The reset-branch control lives in `experiments/jev-seam/`.

## Context

The reset plan asked whether a snapshot-bound "state + typed questions → typed distribution" component should be adopted, limited or omitted.

The evidence gathered for that question:

- **Qwen3 prompted forced choice** (0.6B and 1.7B, Q8_0) collapsed to constant labels and recognized 0 of 12 explicit exclusions (runs 35945776462, 35946966485).
- **MiniLM and DeBERTa NLI on real public screening labels** (SYNERGY `Nagtegaal_2019`, 2 × 96 records) gave a ranking gain at top-48 whose intervals include zero, and sometimes lowered final-inclusion recall. The preregistered `entailment ≥ 0.5` candidate gate fired 0 of 96 times (runs 35947960101, 35949038033).
- **The independent human benchmark** is a blinded 120-record packet with 0 votes (run 35952537458).
- **Every protective behaviour observed was deterministic and ran before any model call:**
  - never dispatching the archived N1 `BLOCKED/context-unavailable` citation;
  - refusing stale or forged refs;
  - refusing unauthorized egress;
  - failing closed on malformed output.

In the arena, three of four candidates chose LIMIT and one chose OMIT. The interrogation showed three problems with LIMIT:

- Ordering-only advice still decides what goes unreviewed when the review budget is finite.
- A support-advice lane placed next to the decision control invites anchoring.
- The limited seam still needed an evaluator principal, a record kind, a `consideredAdvice` field, a queue decoder, a UI lane, batching, exposure receipts and an advice-basis snapshot purpose. A removal test would have passed trivially.

## Decision

1. **V5.0 ships none of the seam machinery:** no evaluator runtime, no `requestAdvice` command, no state compiler, no advice record kind and no evaluator principal. The J1 preregistered stop rule ("simpler rules perform equivalently → reject or scale back") is met for routing and gating.
2. **The review queue uses a deterministic policy order:**
   1. blocked citations;
   2. stale decisions;
   3. unadjudicated challenges;
   4. missing required decisions;
   5. pending proposals;
   6. triage flags.

   Ties break by `seq`. The no-model research path is the product.
3. **Every deterministic protection** listed above stays as Core mechanics: mechanical citation findings, the exact-ref and version fences, and effective rights.
4. **Re-entry is reserved and additive**, and needs no schema rewrite:
   - **(a) Ordering aid.** A pinned evaluator runs as an ordinary governed run (`egress:'none'`) and produces a `score-table/1` artifact. The researcher must select it explicitly. It may reorder only within the triage tier. A queue-exposure receipt records how much was reviewed under that order, and coverage can never read "complete".
   - **(b) Draft author.** Agent proposals, which V5.0 already supports.
   - **(c) Obligation-reducing policy.** A `policy` field referencing `calibration-evidence/1`, which requires a new ADR and a new enum value.
5. **The re-entry artifact schema carries the contract fixes:**
   - an RFC 8785 digest;
   - async evaluation with timeout and abort;
   - abstention on a tie or low margin;
   - no self-declared locality;
   - an exact snapshot, question set, policy, and evaluator image and weights digest;
   - the digest of the bytes actually disclosed;
   - the calibration status.

## Re-entry predicate (all required)

- A frozen, rights-approved benchmark reviewed by two independent reviewers, with group-disjoint splits.
- A pinned evaluator that beats the deterministic order on a preregistered workload metric, with an interval that excludes zero.
- No loss of final-inclusion recall, and a bounded false-support rate.
- A J3 disclosure proof.

## Consequences

- J1 is closed as negative for V5.0 routing and gating.
- J4 becomes the re-entry predicate and no longer gates V5.0.
- J9 is reframed: it now covers no-model completeness plus re-entry through a fixture `score-table/1` with no schema change.
- The experiment branch remains the research lane.
