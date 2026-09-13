# N6 — clean-install reproduction runbook

This runbook is the procedure for the one N6 acceptance step the automated verifier cannot supply: a
reproduction on a **second installation** — a different physical machine or a fresh VM — using nothing
but the declared dependencies. The retained verifier isolates paths, processes, runtime copies and user
state, but it runs on this machine. An isolated restore on one machine is not clean-install evidence,
and nothing in this runbook may be used to relabel it as one.

Companions: [n6-portable-reproduction.md](n6-portable-reproduction.md) (boundary, contract and
comparisons), [n6-evidence.json](n6-evidence.json) (stated result and source digests). The runtime lock
is `spikes/n6-portable-reproduction/fixtures/runtime-lock.json`.

## Target

Any OS that can run Node 24.16.0 and download the pinned runtimes: Python 3.12.12 and Quarto 1.8.27
with Typst 0.13.0 are fetched into the artifact directory, and R 4.6.1 is copied from the machine's own
installation. The point is that the declared dependency set is sufficient: the target must **not**
carry R, Quarto or Python on `PATH`, and nothing may be installed globally by hand. Node 24.16.0 with
the pinned npm is the only prerequisite (see note b).

## Procedure

1. **Confirm the target is clean** and keep the raw check output:

   ```bash
   (R --version; quarto --version; python --version) 2>&1 | grep -i 'not recognized\|command not found' | wc -l
   ```

   Expected: a number equal to the number of tools that were absent before preparation (3 on a fully
   clean target).

2. **Get the source at the exact commit the evidence record names.** Clone the repository and check out
   `baseCommit` from `docs/experiments/n6-evidence.json`; the record's `worktreeStatus` lists any
   uncommitted difference that this particular run carried. (Or receive the export directory plus a
   source archive of the same commit; verify the commit identity either way.) Install the spike
   dependencies from the lockfile:

   ```bash
   npm ci --prefix spikes/n2-durable-store
   npm ci --prefix spikes/n6-portable-reproduction
   ```

3. **Prepare the pinned runtime** into an artifact directory the repository does not track:

   ```bash
   node spikes/n6-portable-reproduction/cli.mjs prepare artifacts/n6/runtime
   ```

   This installs Python 3.12.12 into the artifact directory, downloads the checksum-pinned Quarto
   1.8.27 archive, and copies R 4.6.1 from the R home (the optional second argument to `prepare`,
   default `C:/Program Files/R/R-4.6.1`). It changes no global `PATH` or system installation; the
   first invocation needs network access. On a cold machine, follow note (a) instead of calling the
   CLI directly.

4. **Restore the export into a fresh directory** (the destination must be absent or empty):

   ```bash
   node spikes/n6-portable-reproduction/cli.mjs restore <export-dir> <fresh-study-dir>
   ```

   Expected: the exact-inventory validation passes, and the destination is published only after the
   semantic readback matches the export.

5. **Reproduce**:

   ```bash
   node spikes/n6-portable-reproduction/cli.mjs reproduce <fresh-study-dir> artifacts/n6/runtime/runtime.json
   ```

   Expected: the declared comparisons report 30 rows, 27 observed and 3 missing scores, sum 405, and
   mean 15 within `1e-12`; source, code, record and blob integrity match by exact digest; both render
   lanes produce output; and the PDF citation assertions read `analysis/dossier.typ`. The result lands
   in `<fresh-study-dir>/.ivory/local/n6-last-attempt.json`.

6. **Record the run** in the `## Observed run` section below: machine identity (OS build, CPU, RAM),
   the exact commit, every command as run, the tool versions reported by the runtime preflight, and the
   reproduced digests — the semantic digest and both presentation digests (HTML and PDF). A `blocked`
   outcome is recorded with its reason; it is never rounded up to a pass.

## Operational notes

**(a) A cold `prepare` exceeds the CLI's per-command timeout.** `reproduce.mjs`'s `run()` kills any
child after 120 s, and `cli.mjs prepare` goes through it. A cold prepare — empty uv cache, Python
download plus the Quarto archive — takes about 5 minutes and is killed mid-provisioning. Run it
directly, where no 120 s wrapper applies:

```powershell
powershell -File spikes/n6-portable-reproduction/prepare-runtime.ps1 -Destination artifacts/n6/runtime
```

(or raise the timeout in `run()` before invoking the CLI). A killed prepare leaves a partly provisioned
directory; delete it and start over rather than resuming. Warm re-runs through the CLI complete
quickly.

**(b) npm version drift.** The repository pins npm 11.13.0 (`configs/ivory-toolchain.json`), but the
Windows shim may select 11.17.0, and `npm run check:ivory-toolchain` will report
`found Node 24.16.0 and npm 11.17.0`. Point the process-local `npm_config_prefix` at the directory
holding the pinned npm and re-run the check; never edit `configs/ivory-toolchain.json` to match a
wrong npm.

## Observed run

Status: blocked — no second installation was available in this cycle. The same-machine isolated restore is retained but is not clean-install evidence. Re-run this runbook before any format freeze.
