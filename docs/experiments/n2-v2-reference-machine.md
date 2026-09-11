# N2 V2 reference-machine qualification

Status: **measured pass** on commit `7ed5b5f09`; the PGlite engine decision is unlocked for
architecture-owner sign-off (this run does not perform that sign-off). The retained record is
[`n2-v2-evidence.json`](./n2-v2-evidence.json) and the retained per-cycle ledger is
[`n2-v2-storm-cycles.json`](./n2-v2-storm-cycles.json).

## Question and boundary

Can the bounded PGlite durable-store protocol preserve acknowledged semantic commits across process
interruption, admit immutable blobs before semantic acknowledgement, round-trip a semantic export,
and meet the V2 ordinary metadata, search, and unchanged-snapshot budgets on the recorded reference
machine?

This remains a disposable reference implementation behind the narrow storage port. It does not
establish a filesystem/database two-phase commit, a second production engine, hardware power-loss
durability, or a cross-platform support claim.

## Qualification command

Install the isolated spike dependency once:

```powershell
npm.cmd ci --prefix spikes/n2-durable-store
```

Run the full V2 qualification:

```powershell
npm.cmd run verify:ivory-n2-v2 -- --cycles 1000
```

The wrapper invokes the 51-test harness, the 1,000 process-abort / reopen cycles, semantic
export/import, and the scale fixture of 1,000 documents, 100,000 annotations, and a physically
admitted 10 GiB blob. It writes the ignored raw artifact at `artifacts/n2/evidence.json` and the
ignored raw ledger at `artifacts/n2/storm-cycles.jsonl`, and retains
`docs/experiments/n2-v2-evidence.json` plus the per-cycle ledger.

`--record-only` only rebuilds the retained record from an already completed raw artifact. It can
never produce a passing qualification.

## What this branch carries

Three lines of work were merged onto this branch; the gate is the union of their criteria:

- **Per-cycle measurement**: the interruption harness writes one measured row per cycle to a
  crash-safe append-only JSONL ledger as it runs, and the three durability booleans are derived from
  those rows (`src/storm-ledger.mjs`). A boolean can only be true because every retained row says so.
- **Strict child-exit handling** (`src/child-exit.mjs`): the interrupted child is killed *and*
  confirmed exited before the store is reopened; a child still alive after the kill timeout fails
  the cycle instead of being silently ignored, and `childrenExitedBeforeReopen` is recorded per
  cycle and asserted as a criterion. This also fixed a hang in `test/migrate.spec.mjs`, where a bare
  `once('exit')` listener was attached after the child had already aborted.
- **Physical CAS admission + blob classification** (`src/cas-scale.mjs`, `src/scale.mjs`): the large
  fixture is generated from a non-zero byte pattern and admitted through
  `CasBlobAdmission.admitFile`; `describeLargeBlob` / `isContentAddressedScaleProof` label the
  fixture, and a sparse-zero placeholder is rejected by construction rather than merely annotated.

## Superseded previous record

The first version of this file reported a "protocol pass" that rested on a `--record-only`
invocation: the recorded booleans (`acknowledgedNeverLost`, `oneEffectPerKey`,
`noVisibleUninstalledBlob`) were hardcoded literals in `verify.mjs`, the 1,000 per-cycle
observations were discarded, the `verifierCompleted` criterion was `{observed: 0, required: 0}`, and
the "10 GB" fixture was a sparse hole with `physicalBytesCopied: 0`.

That record does not survive the gate. Reconstructed from its own `observations` and put through
`--record-only`, it fails **14 of the 19 criteria that existed at the time**, passing only the five
observations it genuinely measured (semantic export/import, the three performance budgets, and
startup/memory recording):

```
fullVerifierRunCompleted  allSectionsRan  verifierCommitMatchesHead  fixtureUnchanged
stormMeasuredFromResults  stormResultCount  stormResultLedgerRetained
acknowledgedCommitsNeverLost  oneSemanticEffectPerIdempotencyKey
noVisibleReferenceToUninstalledBlob  noFailedStormCycles
bothAcknowledgementPathsExercised  casPhysicalAdmission  casBlobBoundToVisibleRevision
```

The current gate is strictly stronger: it adds the child-exit criterion and the large-blob
classification criterion, neither of which a legacy record can satisfy.

## Measured result

Every one of the 21 criteria is derived from the run performed at commit `7ed5b5f09`; the raw
artifact and the retained per-cycle ledger are bound to that commit, to the fixture digest
`9cd2374a828b6f149aaa01197633f48343f9109377200a8a9250f9ce3d122aab` (30 fixture files), and to each
other by sha256.

**Interruption storm** (unclean `process.abort` + `taskkill /F`, then reopen, retry the identical
idempotency key):

| Observation | Value |
|---|---|
| Retained per-cycle rows | 1,000 (of 1,000 requested) |
| Failed cycles | 0 |
| Acknowledged before the kill | 625 |
| Unacknowledged before the kill | 375 |
| `childrenExitedBeforeReopen` | true (every cycle) |
| Fault points exercised | 8 of 8 |
| `acknowledgedNeverLost` | true (derived from the rows) |
| `oneEffectPerKey` | true (derived from the rows) |
| `noVisibleUninstalledBlob` | true (derived from the rows) |
| Elapsed | 1,809,648 ms (30.2 min) |

An acknowledged commit survives the kill as a replay of the same receipt with exactly one visible
revision; an unacknowledged retry produces exactly one semantic effect. The acknowledgment boundary
sits exactly at the SQL `COMMIT`: all three pre-COMMIT fault points are unacknowledged, all five
post-COMMIT points are acknowledged.

**Physical content-addressed storage**: a 10 GiB fixture generated from a non-zero byte pattern was
admitted through `CasBlobAdmission.admitFile` (SHA-256 → staged copy → `fsync` → atomic rename →
re-hash) and bound to a visible revision.

| Observation | Value |
|---|---|
| Configured / admitted bytes | 10,737,418,240 (10 GiB) |
| `physicalBytesCopied` | 10,737,418,240 |
| `casVerifiedBytes` (re-hashed after install) | 10,737,418,240 |
| Free-space delta across the exercise | 10,737,082,368 (10.00 GiB) |
| `casStagingLeftover` | false |
| `sparsePlaceholder` | false |
| `largeBlob.kind` / `contentAddressedScaleProof` | `cas-admitted-bytes` / true |
| `digestSource` | `sha256-of-pattern-file` |
| Installed digest | `3f4105f8c04b77f95882fd493b4b25cc5aebe9ca23cd379b514227f32bd649f5` |
| Source write / digest / admit / verify / bind | 32.4 s / 10.6 s / 48.7 s / 10.2 s / 78.4 s |

The fixture is not compressible to a hole: the installed file re-hashes to the digest of the
generated non-zero pattern, and a sparse hole would read back as zeros and fail that check.

**Scale and latency** (1,000 documents, 100,000 annotations):

| Budget | Observed | Limit |
|---|---|---|
| Metadata p95 | 1.55 ms | < 200 ms |
| Source search | 297.4 ms (50 hits) | < 1 s |
| Unchanged snapshot | 399.1 ms | < 2 s |
| Open / scale load | 2,280 ms / 139,271 ms | recorded |

**Semantic export/import** preserves records, snapshot member manifests, and blob hashes.

## Decision

All 21 automated criteria pass with PGlite 0.3.16 and `relaxedDurability: false`
(`automatedPass: true`, `failedCriteria: []`, `engineDecisionUnlocked: true`). PGlite is the
provisional engine candidate; SQLite was not compared because the PGlite integrity gate passed.
Production persistence still waits for architecture-owner engine sign-off.

## Limitations

- The tested envelope is unclean Node process termination on Windows NTFS followed by reopen. It
  does **not** prove survival of hardware power loss, USB yank, firmware crashes, or live
  cloud-drive sync of an open store.
- The physical admission proof is one 10 GiB blob on one reference machine; it does not establish a
  throughput envelope for many concurrent writers or a full-disk behaviour beyond the simulated
  `ENOSPC` tests.
- The result is one reference-machine observation, not a universal platform claim.
- The raw verifier artifact and the raw JSONL ledger are ignored by git; the retained per-cycle
  ledger is committed and bound to the raw artifact by sha256, so the record is re-derivable by
  rerunning the exact command.
- The gate itself is pinned by 51 spike tests, of which 26 are the purpose-built unit tests of the
  derivation, the criterion function, the child-exit wait, and the large-blob classifier; the
  qualification run is the slow confirmation, not the specification.
