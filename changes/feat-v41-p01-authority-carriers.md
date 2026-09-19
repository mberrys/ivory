# V41-P01 authority carriers and source reconciliation

## Plan

1. Pin detached, PR #1, and selected-dev heads without allowing latest-head substitution.
2. Bind package/schema inspection to the exact selected-dev tree.
3. Map every V4.1 canonical surface to one structural owner and record missing fields explicitly.
4. Preserve the harness boundary: execution/replay/eval orchestration is non-semantic; Core remains the only research acceptance authority.
5. Map N1-N7 to a structural carrier or owned downstream gap.
6. Register DURABILITY, REPLAY, and Q1-Q4 as independent Not-run gates with machine, human, negative, and stop evidence.
7. Wire the validator and adversarial tests into `verify:ivory-tower`.

## Proof

Local isolated validator tests: `node --test scripts/ivory/v41-authority.spec.mjs` -> 11/11 passing.

Adversarial cases cover stale/alternate authority, latest-head substitution, inferred inventory, package drift, harness semantic authority, recursive-improvement mutation of Core authority, missing carriers, prose-only gate closure, aggregate pass flags, and pre-closed gates.

Full repository verification is delegated to the existing cross-platform Ivory Tower CI after the branch is pushed; the new validator is part of that required gate.

## Scope limits

This change establishes contracts and fail-closed validation only. It does not close Q1-Q4, durability, replay, N5 parity, N6 second-machine reproduction, N7 live-provider qualification, or any hosted/release gate.
