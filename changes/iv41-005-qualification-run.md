# IV41-005 - retain the V4.1 qualification run at the pinned authority head

## Plan

1. Bind `configs/ivory-v41-qualification.json` to the pinned selected-dev head and its real quality-gate run as the retained verifier execution.
2. Execute every registered gate runner that can run in this environment and retain what was actually observed, with the real exit code and the worktree state at the time.
3. Keep the gates that could not execute, and the unbound `Q2`, explicitly `not-run` with their precise blocker instead of a proxy observation.
4. Keep the registry all `not-run`, add no aggregate outcome field, and qualify nothing.

## Implementation

- `configs/ivory-v41-qualification.json` now carries a `runContext` bound to `refs/heads/dev` at `41fa0e19889fad7fdedef45a8c21944e7d923e68`, tree `14e6e62079396a33409752b17a6a380db31571c1`, `dirty: false`, with `authorityBasis` `selectedDev` / `equal` against `configs/ivory-v41-authority-heads.json`. The verifier is GitHub Actions run `35481120037` (workflow `Ivory Tower quality gate`, event `push`, created `2026-09-20T01:20:02Z`, completed `2026-09-20T01:34:06Z`, conclusion `success`, exit code `0`) with all four jobs green: `Verify (windows-2022)` 01:20:04Z → 01:29:23Z, `Verify (ubuntu-22.04)` 01:20:05Z → 01:24:57Z, `Dependency governance evidence (IV-19)` 01:20:05Z → 01:21:29Z, `Runtime and migration recovery (Session 04)` 01:29:25Z → 01:34:05Z. The workflow file gained `fetch-depth: 0` and a dev-ref fetch after the pinned head, so the record keeps the pinned-head blob digest (`2abb809f...`) beside the digest the validator re-verifies on this tree (`caab3789...`).
- Environment recorded from the machine the observations were taken on: `win32` / `10.0.26200` / `x64`, Node `v24.16.0`, npm `11.13.0`, Docker Desktop `29.8.0`, `secretValuesOmitted: true`, `lockfileSha256` `f877e83688e8103ea7e9508d91a5b5fce98a04a0106560eb8ac871505b8f0dd1`.
- Per-gate records, from runs taken at the current dev tip `f99bd64d8d9b90370f2615e7728259f33d929376` (the pinned head is an ancestor; `git diff 41fa0e19..f99bd64d8 -- scripts spikes` touches only `scripts/ivory/v41-authority.mjs` and its spec, so every runner module and retained record is byte-identical at both heads):
    - `Q1` `passed` (machine) / `inconclusive`: `npm run -s verify:ivory-n1` exit 0 (`ok=true`, 02:19:30Z → 02:19:32Z) and `npm run -s verify:ivory-n4-v2` exit 0 (`N4 V2 qualification passed: 120 real anchors, false-exact=0.`, 02:25:16Z → 02:30:33Z, both digest-pinned Docling images already local and re-verified).
    - `REPLAY` `passed` (machine) / `inconclusive`: `npm run -s verify:ivory-n6` exit 0 (`technical-pass`, 02:19:32Z → 02:23:06Z). This run started with `docs/experiments/n1-v2-evidence.json` dirty from the immediately preceding N1 run; the record states that exactly.
    - `Q3` `partial` (machine) / `inconclusive`: `npm run -s test:n5` exit 0 (11/11 tests, `N5 client boundaries: OK`); `npm run -s evidence:n5` exit 1 (`ENOENT: no such file or directory, scandir artifacts/n5` - the writer folds raw live observations the live/restart/language harnesses produce, and that set is absent here).
    - `Q4` `partial` (machine) / `inconclusive`: `npm run -s verify:ivory-n3` exit 1 (fail-closed `imageDigestValid`, no immutable image supplied), then the retained invocation with the pinned images (`IVORY_N3_PYTHON_IMAGE=python@sha256:78387bc3...`, `IVORY_N3_R_IMAGE=r-base@sha256:e7032f2f...`) exit 0 for both languages with every required acceptance check true and an identical result `{"mean":20,"rowCount":3,"sum":60}`, and `node scripts/ivory/n3-retain.mjs --python ... --r ...` exit 0 (`runtime-qualified`). `npm run -s verify:ivory-n7` exit 1 (`failed-or-incomplete`: 23/24 deterministic tests; `scripts/ivory/n7-evidence.spec.mjs` expects `deterministic.transcripts` on the committed N7 record and it does not carry that field). `npm run -s test:ivory-n7` reproduces the same failure on the committed record from a clean worktree, so it predates this change and is left red rather than repaired by rewriting another issue's evidence.
    - `DURABILITY` `not-run`: `verify:ivory-n2-v2` was not executed. Its storm is fixed at 1000 cycles and the retained raw artifact for this machine measures `interruptStorm.elapsedMs` `2022520` ms (33.7 minutes) for those cycles alone, beyond the bounded window, and running it beside the N4 Docker qualification would perturb a timing-sensitive fault-injection storm. No fixture, evidence, or observation is claimed.
    - `Q2` `not-run`: the registry itself binds no runner (`machineRunners: []` with an `unboundReason`), so nothing was executable. The record keeps empty fixtures and evidence, both observations `not-run`, and architectural gaps pointing at `IV41-036` (coverage/stopping receipt refs) and `IV41-031` (bounded query/provider receipt refs).
- Every runner that rewrote its own retained record was reverted to the committed bytes (`git checkout -- <path>`) so the V41-I01.4 `machineReadback` and the carrier-matrix N4 readback stay exact, and the regenerated digest is recorded inside the gate record. The N4 regeneration drifted one byte (`36083` bytes / `beba9a3d...` against the committed `36082` / `f9da58d4...`); it was not retained, and the same treatment was applied to N1, N3, N5, N6, and N7.
- `scripts/ivory/v41-authority.spec.mjs`: the qualification test that asserted `runContext === null` against the live manifest (a live-state assertion that the first retained run must falsify) now builds a canonical all-`not-run` candidate from a helper, and two fail-closed cases were added: a terminal record cannot be reached without retained fixtures and evidence, and a `not-run` record cannot claim fixtures or evidence.

## Validation

```
node scripts/ivory/v41-authority.mjs
node --test scripts/ivory/v41-authority.spec.mjs
node scripts/ivory/iv41-010-model.mjs
node --test scripts/ivory/iv41-010-model.spec.mjs
node scripts/ivory/n-gates.mjs
node --test scripts/ivory/n-gates.spec.mjs
```

All six exit 0: the bundle is valid with qualification digest `79c7a161d8f0827344af74d738e911fb6f60cc612ceec81218b0fe17a53516f3`, 71/71 authority tests pass, the canonical model is valid, 20/20 of its tests pass, and the N-gates report `7/7 N-gates closed`. Four negative cases were proved in isolation and are rejected by the same validator: a terminal record with empty fixtures and evidence (`terminal records require retained fixtures` / `... evidence`), a `qualified` decision with machine-only authority (`qualified decisions require human or joint authority`), a `not-run` record claiming fixtures and evidence (`not-run records cannot claim fixtures` / `... evidence`), and an aggregate pass flag (`aggregate outcome field aggregatePass is forbidden`).

No gate is closed by this change and no human qualification exists: every record is `not-run` or `inconclusive`, nothing is `qualified`, no aggregate outcome field was added, `configs/ivory-v41-gates.json` still reads `not-run` for all six gates, and IV41-005 stays In Review.
