# @ivory/qualification

The IV5-6 qualification harness for the slice-1 store in `@ivory/core`: a kill harness that crashes a child host at the crash points of V5 section 6, and a latency run that puts a workbench, a CLI, an MCP agent and dying hosts on one project. Private, and never loaded by a product host. It has no SQL and no `node:sqlite` import: it talks to the store through `@ivory/core`, using `head()`, `receiptFor()`, the `qualification` open option and the `qual.put` and `qual.hold` commit kinds.

## Running

```text
npx lerna run compile --scope @ivory/qualification --include-dependencies
npx lerna run lint,test --scope @ivory/qualification

cd packages/ivory-qualification
node lib/node/qualify.js kill    --out <dir> [--points <list>] [--cycles 100] [--synchronous FULL|OFF] [--project <dir>] [--seed 1] [--full-check-every 10]
node lib/node/qualify.js latency --out <dir> [--duration 300] [--project <dir>] [--seed 1] [--warmup 5] [--victim-interval 20]
```

`--points` is a comma-separated subset of `duringBlobStage,beforeBlobInstall,afterBlobInstall,beforeDbCommit,afterDbCommit,random` and defaults to all six. K1 passes only with all six at the same cycle count. `--project` defaults to a fresh temporary directory that the run deletes; give a directory to keep it.

Exit code: `0` when every gated criterion of the run passes, `1` when one does not, `2` for a harness error (a wrong command line, a child that will not die, a dirty tree without `--allow-dirty`), which is never a pass and writes no record.

An evidence run needs a clean git tree. `--allow-dirty` runs anyway and marks the record `outcome: 'fail'` with the reason `dirty-tree`, which is what the specs and local trials do.

## Criteria

| | Meaning | Gated |
|---|---|---|
| **L1** | The workbench process has `monitorEventLoopDelay` p99 under 100 ms while the CLI holds 3 s transactions and an MCP agent reads at 10 Hz. The histogram is raw: its floor is the 10 ms resolution. | latency |
| **P1** | No phantom seq: every `(seq, digest)` any observer saw is in the final log with the same digest. The final log is read back, key by key, from the receipts the committers were given, and must account for every commit. | both |
| **R1** | `recover` never sweeps a live lease: every swept process id belonged to a host that had already been killed or had exited. Latency also requires every victim's lease to be swept by the end of the run plus one final `recover`. | both |
| **K1** | Kill harness with `synchronous=FULL`: no acknowledged receipt lost, at every crash point. | kill FULL |
| **K0** | The same run with `synchronous=OFF`. It is expected to lose nothing as well, which shows what the harness cannot detect: a process kill leaves the OS page cache intact. Recorded, not gated. | no |

Targets: 1,000 cycles per point on Windows 11 NTFS and 100 per point on Linux CI. The record states `targetCyclesPerPoint` and `meetsTargetCycles`, and does not gate on them.

## Kill cycle

One project holds every point and every cycle. An observer host (`mcp`) reads `head()` at 10 Hz for the whole run. A cycle:

1. Forks a child host (`cli`) with the qualification handlers and, for a failpoint cycle, a failpoint that fires on hit `1 + rng(4)`. The child loops: `intent` over IPC, `admitBlob`, `commit qual.put`, then `ack` over IPC. Every 5th key reuses the bytes of the key three before it, for dedup.
2. Waits for the failpoint marker (or a random 0 to 400 ms), then applies the backstop kill (`taskkill /F /T` on Windows, SIGKILL elsewhere), and waits for the exit.
3. Records the child's staging files and lease file, then reopens the store, which runs recovery.
4. Checks, before any retry: every acknowledged receipt of the cycle exists with the same seq and digest, whether the in-flight key was durable (false for C1 to C3, true for C4, either for random), the C2 orphan blob, that recovery swept the child and left no staging file or lease, and that the head is what the cycle's acknowledgements imply.
5. Retries the in-flight key with the identical request: `replayed` must equal the durable state, never a refusal, and the key ends with one receipt.
6. Every `--full-check-every` cycles (and on the last) also runs `verifyChain` and reads back every receipt ever acknowledged.

At the end: `gc({graceMs: 0})` leaves no unreferenced blob and every referenced blob present and intact, the whole log is read back key by key, and the observer's samples are checked (P1).

## Evidence record

`<kind>-<platform>-<synchronous>.json` and `<kind>-<platform>-<synchronous>.ledger.jsonl` in `--out`.

```text
{ record: 'ivory-qualification@1', issue: 'IV5-6', gates: ['N2', 'J7'], kind: 'kill' | 'latency',
  head: { commit, branch, dirty }, command, startedAt, finishedAt, elapsedMs,
  environment: { platform, osVersion, release, arch, cpuModel, cpuCount, memoryBytes, node, sqlite, filesystem, projectDir },
  config, configDigest,                    // canonicalDigest(config)
  fixtures: { harnessDigest, coreDigest }, // sha256 over the compiled lib files, sorted by path
  ledger: { file, rows, sha256 },          // sha256 of the final ledger bytes
  criteria: { K1 | K0 | L1 | P1 | R1: { pass, gated, ...numbers } },
  outcome: 'pass' | 'fail', failReasons: ['criterion:K1', 'dirty-tree', ...],
  limits: [ ... ] }
```

Every boolean in `criteria` is computed from ledger rows and observations. The kill ledger has one row per cycle, appended as the cycle ends and flushed to disk every 50 rows and at the end. The latency ledger has one row per role, commit, observation, victim and recovery report, written when the run ends.

## Limits

- Process kill only. Power loss, OS crash and cloud-synced folders are not claimed.
- A process kill leaves the OS page cache intact, so this harness cannot tell `synchronous=OFF` from `FULL`.
- The failpoints sit in the store code. A crash between two failpoints is covered only by the random-timing cycles, which mostly land in the child's start-up and between commits.
- Migration kills belong to IV5-7, and C5 to IV5-11.
