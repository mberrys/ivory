# N7 - reconcile the retained evidence with the merged retention tooling

## Plan

1. Repair the N7 evidence record that the closeout merge left inconsistent with the V4.1-side retention spec, without replacing the retained live-provider qualification.
2. Give the two retention toolings one policy so a deterministic re-run cannot discard retained evidence or change the decision the N-gate manifest closes on.
3. Re-derive every pinned readback that cites the changed record and modules.
4. Put the N7 deterministic suite on the required gate so a red suite cannot sit unnoticed again.

## Implementation

- **The merge dropped a retained field.** `docs/experiments/n7-v1-evidence.json` was resolved to the closeout line's canonicalized record, which carries `deterministic.{status,tests,passed,failed,skipped,scenarios}` but not `deterministic.transcripts`; `scripts/ivory/n7-evidence.spec.mjs` (V4.1 line) requires the four fixture transcripts and reads the matching `docs/experiments/n7-transcripts/*.json`. The field was restored from the V4.1-line record (`hostile-corpus`, `revoked-tool`, `stale-proposal`, `duplicate-accept`), which is exactly the set the committed transcripts directory holds. Nothing else in the record changed: `decision` stays `bounded-experiment-pass` and `liveProvider` stays the retained `run` against the loopback `qwen3-4b-instruct-2507`.
- **Regenerating the record is a trap, not a repair.** `scripts/ivory/n7-retain.mjs` re-observes only the deterministic suite and writes `liveProvider: not-run*` with the decision `deterministic-pass-live-provider-open`; running it on the merged tree therefore discards the retained live-provider run and opens the N7 gate (`6/7 N-gates closed`, `decision ... needs "bounded-experiment-pass"`). The record was therefore repaired in place rather than regenerated, and the tooling was fixed so the trap cannot fire.
- **One retention policy.** New `scripts/ivory/n7-retain-policy.mjs` holds the two pure rules the merged tooling needed: `retainedLiveProvider(previous, { liveConfigured })` carries a previously retained `status: 'run'` block forward verbatim (recording `carriedForwardFrom` and why it was not re-observed) instead of overwriting it, and `retainedDecision({ testsPassed, liveRetained })` yields `bounded-experiment-pass` only for a passing suite with retained live evidence, `deterministic-pass-live-provider-open` for a passing suite without it, and `failed-or-incomplete` otherwise. `scripts/ivory/n7-retain.mjs` reads the record it is about to replace and uses both.
- **A stale state assertion became an invariant.** `scripts/ivory/n7-evidence.spec.mjs` asserted `liveProvider.status.startsWith('not-run')`, which the retained live run legitimately advanced past; it now requires an explicit `run` or `not-run*` state and, when a run is retained, that it is a passed `loopback-http` run whose preview excluded the private canary with exactly one wire request.
- **Pins re-derived** for the changed record and modules: `configs/ivory-v41-carrier-matrix.json` (N7 fixture), `configs/ivory-v41-gates.json` (`q4-n7-record`, `q4-n7-proposal-runner`), `configs/ivory-v41-qualification.json` (Q4 fixture and evidence) and `configs/ivory-v41-canonical-model.json` (readback of the carrier matrix). Every value was recomputed from the bytes on disk in the `normalize-lf` convention.
- **Gate coverage.** `verify:ivory-tower` now runs `test:ivory-n7` after the N-gate stages, so the deterministic N7 suite — which the IV41-005 run found red on the committed tree — is part of the required gate.

## Evidence

- `npm run -s test:ivory-n7` -> 27 tests, 27 pass, 0 fail (was 23/24 on the committed record).
- `node scripts/ivory/n-gates.mjs` -> `7/7 N-gates closed.` with N7 `decision="bounded-experiment-pass"`.
- `node scripts/ivory/v41-authority.mjs` -> valid; spec 71/71. `node scripts/ivory/iv41-010-model.mjs` -> valid; spec 20/20. `node --test scripts/ivory/n-gates.spec.mjs` -> 18/18.
- The IV41-005 record's `Q4` observation (`partial`, because `verify:ivory-n7` exited 1 on this record) is left exactly as that run observed it; this note records the repair rather than rewriting another issue's retained observation.
