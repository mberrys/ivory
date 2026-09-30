# IV5-6 qualification evidence

Evidence for the slice-1 store bake-off and kill harness (gates N2 and J7), produced by `@ivory/qualification`. See [`packages/ivory-qualification/README.md`](../../../../packages/ivory-qualification/README.md) for the criteria, the commands and the record schema.

Each run adds two files, named `<kind>-<platform>-<synchronous>`:

| File | Content |
|---|---|
| `kill-<platform>-FULL.json`, `kill-<platform>-OFF.json` | evidence record of the kill harness: K1 (or K0 for OFF), P1, R1 |
| `latency-<platform>-FULL.json` | evidence record of the latency run: L1, P1, R1 |
| `*.ledger.jsonl` | the ledger each record digests: one row per cycle (kill) or per event (latency) |

Evidence files are added from real runs on a clean tree, never from the smoke specs.

| Run | Command | Status |
|---|---|---|
| Windows 11 NTFS, FULL | `kill --cycles 1000` | not yet run |
| Windows 11 NTFS, OFF control | `kill --cycles 1000 --synchronous OFF` | not yet run |
| Windows 11 NTFS, latency | `latency --duration 300` | not yet run |
| Linux CI, FULL, OFF and latency | `.github/workflows/ivory-qualification.yml`, artifact `iv5-6-linux-evidence` | not yet run |
