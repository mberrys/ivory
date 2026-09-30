# IV5-6 qualification evidence

Evidence for the slice-1 store bake-off and kill harness (gates N2 and J7), produced by `@ivory/qualification`. See [`packages/ivory-qualification/README.md`](../../../../packages/ivory-qualification/README.md) for the criteria, the commands and the record schema.

Each run writes a record and its ledger, named `<kind>-<platform>-<synchronous>`:
- `*.json` is the evidence record: head, command, environment, fixture digests, criteria, outcome and limits.
- `*.ledger.jsonl.gz` is the ledger that record digests, gzipped with `gzip -9 -n`. It holds one row per cycle for kill runs, and one per event for latency runs. `ledger.sha256` in the record is the digest of the uncompressed file.

Every criterion is derived from ledger rows. All runs measured `0358eea4a` on a clean tree.

## Result: every gated criterion passes

| Criterion | Windows 11 Home, NTFS | Linux CI, ubuntu-22.04 |
|---|---|---|
| **L1** workbench `monitorEventLoopDelay` p99 < 100 ms | **16.8 ms** (p50 15.5, max 23.4, 19,302 samples over 300 s) | **11.4 ms** (120 s) |
| **P1** no phantom seq | 0 phantoms in 97,409 observations across the three runs | 0 |
| **R1** `recover` never kills a live lease | 0 violations in 7,215 sweeps and 181 periodic reports | 0 |
| **K1** C1–C4 kills, 0 lost acknowledged receipts | 6,000 cycles (5 failpoints plus random, 1,000 each), 0 lost, 0 failed rows | 600 cycles (100 each), 0 lost |
| **K0** `synchronous=OFF` control (recorded, not gated) | 1,200 cycles (200 each), 0 lost | 600 cycles, 0 lost |

**Windows latency run**, under contention:
- The CLI held 75 transactions of 3 s each.
- The workbench made 597 commits, all of which committed, with 0 `writer-busy`.
- Workbench commit latency was p50 283 ms and p99 4,026 ms. This is expected, since commits queue behind a 3 s hold.
- The event loop stayed at a 16.8 ms p99 throughout, against the 2.4–3.0 s main-thread stall that the V5 interrogation measured without the worker.

**Windows kill run**, FULL:
- Kills at `afterDbCommit` were durable in 1,000 of 1,000 cycles, and each retry replayed the stored receipt (C4).
- The four earlier failpoints were durable in 0 of 1,000 cycles each. Recovery swept every dead lease with its staging (C1), orphans were left and later referenced (C2), and every in-transaction kill rolled back (C3).
- 8 of the random kills landed after a COMMIT.
- The final log has 18,579 commits, the chain verifies, and no blob is unreferenced or missing.

## Runs

| Run | Command | Elapsed | Record |
|---|---|---|---|
| Windows 11 NTFS, latency | `latency --duration 300` | 5 min | `windows-11/latency-win32-FULL.json` |
| Windows 11 NTFS, FULL | `kill --points <all six> --cycles 1000 --synchronous FULL` | 144 min | `windows-11/kill-win32-FULL.json` |
| Windows 11 NTFS, OFF control | `kill --points <all six> --cycles 200 --synchronous OFF` | 27 min | `windows-11/kill-win32-OFF.json` |
| Linux CI, FULL, OFF and latency | `ivory-qualification.yml` run 36667058570, artifact `iv5-6-linux-evidence` | | `linux-ci/*.json` |

## Limits

- **Process kill only.** Power loss, OS crash and cloud-synced folders are not claimed.
- **The OFF control loses nothing, just like FULL.** A process kill leaves the OS page cache intact, so this harness cannot tell `synchronous=OFF` from `FULL`, as the V5 interrogation predicted. Claiming durability beyond process kill would need a VM hard-off test.
- **Windows is one machine.** The runs used the owner's machine (Node 24.16.0, SQLite 3.53.0). Independent-machine reproduction stays open and non-blocking, per the release predicate.
- **Linux filesystem not recorded.** The Linux records say `filesystem: unknown`, because the harness ran `stat -f` on a temporary project it had already removed. This is fixed in the next commit. Nothing else in those records depends on it.
- **C5 is out of scope here.** Re-adopting runs belongs to slice 6 (IV5-11). Migration kills belong to IV5-7.
