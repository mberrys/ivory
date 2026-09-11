# N3 — Compute onboarding protocol

Target: **four of five pilot users enable the Compute runtime from these
instructions within 15 minutes**, excluding an explicitly reported large
download.

This target is recorded in the canonical V1 plan as **provisional**, and it feeds
the **support-matrix decision only**. It never changes `runtime-qualified` in
[`n3-evidence.json`](n3-evidence.json).

Authority: `Ivory Tower V1 High-Level Architecture and Implementation Plan`
(Notion) and the mirrored Linear document `Architectural spikes N1–N7`, which
lists the N3 required-close set as hostile canaries, R/Python, cancel/restart,
cold/warm measurements and the support-matrix decision — onboarding is *not* in
that list.

## Participant instructions (the thing being measured)

Read these to the participant. Do not help them past a step; a step that needs
help is a documentation defect and must be recorded as one.

1. **Start clean.** The machine must be on the recorded platform (Windows 11 x64)
   with Docker Desktop installed and **not running**.
2. **Run the offline suite.** From the repository root:
   ```powershell
   npm.cmd run test:ivory-n3
   ```
   Expected: `tests 21`, `pass 21`, `fail 0`. If it fails, stop and report the
   failure — the instructions are broken, not the user.
3. **Start Docker Desktop** and wait until this prints a version:
   ```powershell
   docker info --format '{{.ServerVersion}}'
   ```
   Record how long the wait took (this is usually the dominant cost).
4. **Pull the pinned images exactly as written** — no substitutions, no extra
   flags, no `:latest`:
   ```powershell
   docker pull python@sha256:78387bc3881b8273120a12ebe6c1ab22b018ccc2c9adf565ae1ac9b536e184ea
   docker pull r-base@sha256:e7032f2f6fd273ee944a717b436bc66d1a89b1b90a9bbcaafcf1318d68a7d8b2
   ```
   The R image is the large download: a cold pull measured **97.3 s** on the
   qualification machine, and ~1 GB on the wire. Report the participant's actual
   size and time.
5. **Run the proof:**
   ```powershell
   $env:IVORY_N3_PYTHON_IMAGE = 'python@sha256:78387bc3881b8273120a12ebe6c1ab22b018ccc2c9adf565ae1ac9b536e184ea'
   npm.cmd run verify:ivory-n3 -- --interrupt-publication
   ```
   Expected: exit code 0 and an evidence object with `"status": "observed"`.
6. **Record the end time.** The clock stops when step 5 exits 0.

## What is recorded per user

- the exact command sequence used, verbatim;
- wall-clock time from step 1 to the end of step 5;
- whether an image pull exceeded 5 minutes, and its size if reported;
- every deviation from these instructions, including documentation fixes applied
  mid-flight.

## Recording rules

- One object per participant in
  [`n3-onboarding-record.json`](n3-onboarding-record.json). Never a summary.
- A participant who fails is recorded as `outcome: "blocked"` with the blocking
  step. Do not restart a participant's clock without recording the retry.
- If these instructions change partway through, record a different
  `instructionsVersion` and note that the cohort was not uniform.
- A participant who cannot use Compute from these instructions is a **result**.
  It is never edited out of the record.

## Validating the record

```powershell
npm.cmd run verify:ivory-n3-onboarding
```

An empty record prints `not-applicable` and exits 0 — an absent observation is
neither a pass nor a failure, exactly like a `null` acceptance check in the OCI
evidence. Once participants are recorded, the command exits 1 unless at least
four of five enabled within 15 minutes.

## Folding the result into the retained record

```powershell
npm.cmd run retain:ivory-n3 -- ^
  --python artifacts/n3/python/evidence.json ^
  --r artifacts/n3/r/evidence.json ^
  --onboarding docs/experiments/n3-onboarding-record.json ^
  --out docs/experiments/n3-evidence.json
```

`decision.supportMatrix` becomes `pilot-decided` **only** when the record shows
the target met. Until then it stays `open-pending-onboarding`, and
`scripts/ivory/n3-retained.spec.mjs` fails if the two files disagree.
