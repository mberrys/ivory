# N5 live qualification — ordered protocol notes

**Status:** working notes — the ordered runbook for the live N5 qualification. Nothing here is retained
evidence: the commands below have not been run beyond the prerequisite checks listed at the end.
`docs/experiments/n5-theia-client-equivalence.md` stays `blocked` and the N5 gate stays open until the
live observations exist and `npm run evidence:n5` writes the record from them.

Derived from `docs/experiments/n5-theia-client-equivalence.md` (`## Reproduce`, `## Qualification
protocol`, items 1–6) and the committed harness (`scripts/n5/**`, `packages/ivory-n5-client/**`,
`packages/ivory-n5-shell/**`, `examples/ivory-n5-browser/**`). Machine state was probed 2026-09-13;
re-probe before the live run.

Raw evidence (gitignored) lives under `artifacts/n5/`. The single retained record is
`docs/experiments/n5-v2-evidence.json` (machine-written; `configs/ivory-n-gates.json` reads it).

## Step 0 — one-time machine prerequisites

### 0.1 Spectre-mitigated MSVC libraries — the only hard build blocker

Observed 2026-09-13: probe empty (missing); toolset `14.44.35207` has no `lib/<arch>/spectre` directory.

Probe (empty output = missing):

```bash
"C:/Program Files (x86)/Microsoft Visual Studio/Installer/vswhere.exe" -latest -products '*' -find "VC/Tools/MSVC/*/lib/*/spectre"
```

Install **elevated** (PowerShell; a non-elevated run fails with installer exit code 5007):

```powershell
& "C:/Program Files (x86)/Microsoft Visual Studio/Installer/setup.exe" modify --installPath "C:/Program Files/Microsoft Visual Studio/2022/BuildTools" --add Microsoft.VisualStudio.Component.VC.14.44.17.14.x86.x64.Spectre --quiet --norestart
```

Confirm: re-run the probe (expect `.../lib/x64/spectre` paths) and `npm run check:ivory-toolchain`
(exit 0; prints `Ivory Tower toolchain: Spectre-mitigated MSVC libraries (<n> toolset directories)`).
Never set `IVORY_SKIP_SPECTRE_CHECK`.

npm pin for the toolchain check: the machine shim selects npm 11.17.0; the pinned 11.13.0 is selected
per call with `export npm_config_prefix="$HOME/AppData/Roaming/npm"` (verified 2026-09-13:
`npm --version` → `11.13.0`). Do not edit `configs/ivory-toolchain.json`.

- Feeds: nothing; it unblocks Step 1.

### 0.2 Runtime PATH and versions

```bash
export PATH="/c/Program Files/R/R-4.6.1/bin:/c/Users/micha/AppData/Local/Programs/Quarto/bin:$PATH"
R --version | head -1   # observed 2026-09-13: R version 4.6.1 (2026-06-24 ucrt)
quarto --version        # observed 2026-09-13: 1.10.18  (machine Quarto; never record 1.8.27 for N5 — that is the N6 pinned runtime)
python --version        # observed 2026-09-13: Python 3.11.9
```

The R client helper requires `httr2` (`packages/ivory-n5-client/helpers/ivory_n5.R`). Observed
2026-09-13: **missing**. Install once and record the version:

```bash
Rscript --vanilla -e 'install.packages("httr2", repos="https://cloud.r-project.org")'
Rscript --vanilla -e 'cat(as.character(packageVersion("httr2")), "\n")'
```

If the `python` launcher breaks, set `IVORY_N5_PYTHON` to a working interpreter's absolute path
(honored by `scripts/n5/extensions.mjs`, the tests and `prestart`).

- Feeds: the record's `runtimes` block (`scripts/n5/evidence.mjs` probes python/R/Quarto).

### 0.3 Pinned workbench extensions

```bash
python scripts/n5/extensions.py install   # downloads into artifacts/n5/vsix, verifies every sha256, extracts, re-reads every file
python scripts/n5/extensions.py verify    # re-checks the extracted tree; also runs as prestart of start:n5
```

Expected/observed (2026-09-13, exit 0; exact lines):

```
REditorSupport.r@2.8.8 verified 9add9b7aceda1dc0072cc9e048b5bfcc8de4488ccd2802ea5fe834517a3ce2e2
REditorSupport.r-syntax@0.1.4 verified 110af62e93b38c240ce2ea5c0f89a0b5fe58e9c6ba5400fe3175547324846eba
ms-python.python@2026.2.0 verified f958e2df01d4eb4cdd4455728afd0576c0de9a8bd892e1a5e2603f612d1004f6
detachhead.basedpyright@1.40.0 verified 67e47122039ab2a687dd31e470eaa282093efefe7ad20f502c76331b8d058333
quarto.quarto@1.137.0 verified 179b5f14eeae729839ae459d826a16c9e452451db94200f9faa308f5effb6ffd
vscode.python@1.95.3 verified 37c2a0cdfa668bd4dc37265d7d172300a20350098651b1843ee220a30c5e2d88
vscode.yaml@1.95.3 verified 1c60f93adad36f20de0696bc75f8b3829f3fc4c760f4d8022ec9f934436bbeb0
```

- Feeds: `artifacts/n5/vsix/*.vsix` (hash-pinned archives) and the extracted tree
  `examples/ivory-n5-browser/plugins/<id>/**`; the set of record is
  `examples/ivory-n5-browser/extensions.lock.json` (7 entries). A single unexpected plugin directory
  fails the run by design.

## Step 1 — build the workbench (unblocked by 0.1)

```bash
npm run build:n5 2>&1 | tee artifacts/n5/build.log
```

- Expected: the `theia rebuild:browser` step compiles the native modules (including
  `@vscode/windows-ca-certs@0.3.4`, the MSB8040 source) and the webpack bundle completes; exit 0.
  Watch for MSB8040 = Spectre still missing.
- Feeds: `artifacts/n5/build.log`.

## Step 2 — pre-run checks (currently green; not equivalence evidence)

```bash
npm run test:n5                  # observed 2026-09-13: tests 10, pass 10, fail 0 + "N5 client boundaries: OK"
npm run check:ivory-boundaries   # observed: "N5 client boundaries: OK" + "Ivory Tower module boundaries: OK"
```

`test:n5` is synthetic transport testing, explicitly not service equivalence.

## Step 3 — canonical Core service

### 3.1 Containers

The API validates `DATABASE_URL` at startup and reports postgres/schema/queue/objectStore in
`/health/ready` (`packages/ivory-tower-api/src/start.ts`). Bring up the pinned stack (mirrors
`scripts/verify-ivory-runtime.mjs`):

```bash
docker compose -f infra/docker-compose.yml up -d postgres object-store object-store-init docling
```

Expected: `docker ps` shows the containers; `object-store-init` creates the `ivory-tower` bucket.
Docling is not exercised by N5 (the API is ready without it).

### 3.2 Environment (the service reads `process.env`; no loader reads `.env` — export in the shell; values mirror `scripts/verify-ivory-runtime.mjs`)

```bash
export IVORY_TOWER_ENV=local IVORY_DEPLOYMENT_TOPOLOGY=vendorHosted
export DATABASE_URL='postgres://ivory:ivory@127.0.0.1:5432/ivory_tower'
export IVORY_S3_BUCKET=ivory-tower IVORY_S3_ENDPOINT=http://127.0.0.1:9000 IVORY_S3_REGION=us-east-1
export IVORY_S3_ACCESS_KEY_ID=ivory IVORY_S3_SECRET_ACCESS_KEY=ivory-development-only
export DOCLING_ENDPOINT=http://127.0.0.1:5001
export DOCLING_IMAGE='quay.io/docling-project/docling-serve:v1.21.0@sha256:32b3de41f325f93c1dd35907cd9147fa35df9f7c5abc86eb2788b6bda7ce6d10'
export PORT=4100
```

### 3.3 Migrate, compile, start

```bash
npm run migrate:ivory            # forward-only migrations; needed by the schema/queue readiness checks
npm run compile:ivory-services   # lib/start.js for @ivory-tower/api
npm run start:ivory-api 2>&1 | tee artifacts/n5/service/api.log
```

Expected observable (capture the ready report):

```bash
curl -s http://127.0.0.1:4100/health/live                 # {"status":"ok"}
curl -s http://127.0.0.1:4100/health/ready                # HTTP 200; postgres/schema/queue/objectStore all ok
curl -s http://127.0.0.1:4100/health/ready > artifacts/n5/service/ready.json
```

Reset to an equivalent initial state before **every** observation below:

```bash
curl -s -X POST http://127.0.0.1:4100/v1/fixtures/reset -H 'content-type: application/json' \
  -d '{"projectId":"n5-demo","fixture":"all"}' | tee artifacts/n5/<step>/reset.json
```

Expected: `{projectId:"n5-demo", revision:"rev-1", entryPaths:[...4 fixtures], sourceHashes:{...}, resetAt}`.
Citations are bound per fixture file: `cite-research-py`, `cite-research-R`, `cite-research-qmd`,
`cite-conditional-ipynb` (the service seeds them at reset from the committed
`examples/ivory-n5-browser/fixtures/`; override with `IVORY_N5_FIXTURES_DIR`).

- Feeds: `artifacts/n5/service/{api.log,ready.json}`; the record's `liveService` block.

### 3.4 Workbench (second terminal)

```bash
export IVORY_N5_SERVICE_URL='http://127.0.0.1:4100'
npm run start:n5 2>&1 | tee artifacts/n5/service/shell.log
```

- `prestart` re-verifies all 7 VSIXs; the shell listens on `127.0.0.1:3107`; `curl -s
  http://127.0.0.1:3107/` returns the app HTML. `IVORY_N5_SERVICE_URL` must be a credential-free
  HTTP(S) origin that is already running — it selects the service, never launches it.
- Browser smoke test — its `webServer` starts its own shell with `reuseExistingServer:false`, so stop
  the 3.4 shell first or it will fail on port 3107:

```bash
cd examples/ivory-n5-browser && IVORY_N5_SERVICE_URL=http://127.0.0.1:4100 npx playwright test
# equivalent from the root (rebuilds first): npm run test:n5-browser
```

Expected: `shell.spec.ts` passes (N5 heading; Open project / Resolve citation / Request run / Submit
edit enabled; the "Read status" prompt; Disconnect status). Output: `artifacts/n5/browser/`.

## Step 4 — the six protocol observations

All raw outputs go under `artifacts/n5/<observation>/`; the projections feed the record, which is only
written by `npm run evidence:n5`.

### 4.1 Client equivalence on identical state (protocol item 1)

Reset (3.3), then every client runs the same three actions at `rev-1`. Request files under
`artifacts/n5/requests/`:

- `open.json` = `{"projectId":"n5-demo","revision":"rev-1"}`
- `cite.json` = `{"projectId":"n5-demo","revision":"rev-1","citationId":"cite-research-py"}`
- `run.json` = `{"projectId":"n5-demo","revision":"rev-1"}`

| client | command |
|---|---|
| CLI | `node packages/ivory-n5-client/src/cli.cjs open artifacts/n5/requests/open.json` (then `cite`, `run`) |
| Python | `python packages/ivory-n5-client/helpers/ivory_n5.py open artifacts/n5/requests/open.json` (then `cite`, `run`) |
| R | `Rscript packages/ivory-n5-client/helpers/ivory_n5.R open artifacts/n5/requests/open.json` (then `cite`, `run`) |
| Theia | widget "N5 research client": paste the request JSON into the research textarea, click Open project / Resolve citation / Request run, copy the status-pane JSON |

Expected: identical resolved RunSpec content and semantic result in all four clients
(`semanticResult: {status:"succeeded", output:["9"]}`; `runId` is content-derived). Only
actor/receipt/time metadata outside the compared projection may differ.

Save each client's raw `run` response as `artifacts/n5/clients/<client>.json` (for Theia, the copied
status-pane JSON) and compare with the committed comparator:

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { compareClients } from './scripts/n5/compare.mjs';
const records = ['theia','cli','r','python'].map(client => {
  const raw = JSON.parse(readFileSync('artifacts/n5/clients/' + client + '.json','utf8'));
  return { client, resolvedRunSpec: raw.resolvedRunSpec, semanticResult: raw.semanticResult };
});
console.log(JSON.stringify(compareClients(records)));
"
```

Expected: `{"status":"passed"}`.

- Reconciliation needed before the run: `resolvedRunSpec.resolvedAt` is generated per call by the
  service clock, and `compareClients` deep-compares the full RunSpec while forbidding field-stripping.
  State the rule that makes "identical content" true (e.g. all four clients read one frozen resolution)
  and record it; do not silently trim fields.
- Feeds: `artifacts/n5/clients/*.json` → the record's `clients` block.

### 4.2 Twelve ordered competing edits (protocol item 2)

For each ordered pair (first ≠ second) over theia/cli/r/python — 12 permutations: reset, then the first
client edits at `rev-1`, then the second edits the same `sourcePath` from the stale `rev-1` (retain an
`Idempotency-Key` per edit; use each client's `edit` command / the widget's Submit edit):

`edit.json` = `{"projectId":"n5-demo","baseRevision":"rev-1","sourcePath":"research.py","edit":{"kind":"insert","startOffset":0,"endOffset":0,"text":"# edit by <client>\n"}}`

Expected: first edit → `{projectId, sourcePath, baseRevision:"rev-1", newRevision:"rev-2", appliedAt}`
(HTTP 200); second edit → HTTP 409 `{code:"revision_conflict", baseRevision:"rev-1",
headRevision:"rev-2", authoritative:{sourcePath, revision, bytes, contentHash},
rejectedRequest:{unchanged}}` — the same conflict body in every client; the CLI/Python/R helpers print
the body and exit non-zero (never translate an error into a success); Theia shows it in the status
pane. Record the authoritative state (unchanged bytes/hash) and the unchanged rejected fields.

- Feeds: one file per pair, `artifacts/n5/conflicts/<first>--<second>.json` → the record's
  `orderedConflicts` block.

### 4.3 Restart around an accepted-but-undelivered receipt (protocol item 3)

1. Submit: `node packages/ivory-n5-client/src/cli.cjs submit artifacts/n5/requests/execution.json RETAINED-KEY-N5`
   with `execution.json` = `{"kind":"validate","input":{},"contractVersion":1}`. Expected: HTTP 202 +
   receipt (`{id, kind, status, idempotencyKey, attempt:0, ...}`) → `artifacts/n5/restart/receipt-first.json`;
   note the acceptance line in `api.log` (accepted command id).
2. Kill the service between durable acceptance and the client's read: record the PID/command line
   (`tasklist` / `wmic process`), then `taskkill /PID <pid> /T /F`. The client must end without a body.
3. Restart `npm run start:ivory-api` with the same environment; wait for ready.
4. Re-read: re-submit the same body with the same key — expected HTTP 200 replay with the same
   execution `id` (one semantic effect, exactly one writer, no second submission);
   `... cli.cjs get <id>` returns the same record; an events read shows one effect.
5. Reconnect the workbench (reload the tab; `reloadOnReconnect:true`) and confirm it resumes against
   the same service without launching anything.

- Feeds: `artifacts/n5/restart/*.json` (receipts, process evidence, replay) → the record's `restart`
  block. Transport unit tests are explicitly not this result.

### 4.4 Exact citation navigation to an immutable revision (protocol item 4)

- Resolve at head before any edit (4.1 `cite`): anchor `{sourcePath:"research.py",
  sourceRevision:"rev-1", anchorId:"anchor-research.py", passage:<fixture bytes>,
  startOffset:0, endOffset:<length>, contentHash:<sha256>}`. Verify `sha256(passage) === contentHash`
  and the passage equals the committed `fixtures/research.py` bytes.
- After an accepted edit moves head to `rev-2`, resolve again at `rev-2`: the anchor still names
  `sourceRevision:"rev-1"` with the original bytes/hash (immutable revision; no remap of the range).
- Errors: resolve with `"revision":"rev-1"` while head is `rev-2` → `citation_stale`; unknown
  `citationId` → `citation_not_found`. No nearby/latest-source substitution anywhere.
- Feeds: `artifacts/n5/navigation/*.json` → the record's `exactNavigation` block.

### 4.5 Language surfaces in the built workbench (protocol item 5)

Open `fixtures/research.py`, `fixtures/research.R`, `fixtures/research.qmd`; record what each actually
does:

- Python: hover/definition on `square` → `(value: float) -> float`; execute → `9.0`.
- R: definition navigation on `square(3)` reaches line 2; execute → `9`.
- Quarto: rendered heading "Reproducible result" + computed `9`; completion, diagnostics and document
  navigation observed separately for Quarto.
- Diagnostics: `fixtures/python-diagnostic.py` → basedpyright diagnostic (str assigned to int);
  `fixtures/r-diagnostic.R` → parser diagnostic on the incomplete expression (do not execute).
- Capture extension activation and language-server logs.
- Feeds: `artifacts/n5/language/**` → the record's `languageWorkflows` block (claim nothing that was
  not exercised).

### 4.6 Notebook — conditional, never mandatory (protocol item 6)

`fixtures/conditional.ipynb` only if a pinned kernel is selectable and it passes on its own: open,
execute to 9, preserve output, disconnect/reconnect. Otherwise record `conditional-not-tested`;
notebook absence must not become a mandatory-language failure.

### 4.7 Extension matrix (protocol step 5)

Record id, version, license, engines and observed behaviour for all 7 locked extensions
(`examples/ivory-n5-browser/extensions.lock.json`; behaviour from 4.5 logs). Registry compatibility
claims and engine ranges are not activation evidence.

## Step 5 — write the record, then check the gate

```bash
npm run evidence:n5    # writes docs/experiments/n5-v2-evidence.json; exits 2 while blocked
node -e "const e=require('./docs/experiments/n5-v2-evidence.json');console.log(e.decision, e.liveService && e.liveService.available)"
npm run verify:ivory-n-gates -- --require-closed N5   # exit 0 only when the record's decision === "passed"
```

- Harness gap to close during the live run: as committed, `scripts/n5/evidence.mjs` writes
  `decision:"blocked"` and the protocol-pending reason unconditionally — it has no input path for the
  observations. Extend it to fold in the raw observations from `artifacts/n5/**` (fields already
  defined: `clients`, `orderedConflicts`, `restart`, `exactNavigation`, `languageWorkflows`,
  `notebook`, `runtimes`, `extensions`, `liveService`, `decision`). Never hand-edit the record.
- The document flips to `**Status:** qualified ...` only when the record genuinely says passed
  (the manifest closes N5 on `decision == "passed"`; a `blocked` status keeps the gate open).
- Then: `npm run verify:ivory-n-gates` and the full `npm run verify:ivory-tower`.

## Findings recorded while writing these notes (2026-09-13)

1. Spectre component missing → `npm run build:n5` blocked; exact elevated command in 0.1.
   `IVORY_SKIP_SPECTRE_CHECK` deliberately unused; no certificate-handling bypass.
2. `httr2` missing in R 4.6.1 → install before the R client can run (0.2).
3. Machine Quarto is **1.10.18**; never record 1.8.27 for N5 (that is the N6 pinned runtime).
4. npm shim selects 11.17.0; pinned npm 11.13.0 via `npm_config_prefix="$HOME/AppData/Roaming/npm"`
   (verified).
5. `resolvedRunSpec.resolvedAt` is clock-derived per call while `compareClients` requires full deep
   equality without field-stripping — the equivalence projection rule must be stated at live-run time
   (4.1).
6. `scripts/n5/evidence.mjs` cannot ingest observations yet (5).
7. Document path correction pending: `## Evidence interpretation` says `evidence:n5` writes
   `artifacts/n5/evidence.json`; the script and `configs/ivory-n-gates.json` both use
   `docs/experiments/n5-v2-evidence.json`. Fix the sentence when the document is next edited
   (Task 6.10).

## Prerequisite checks executed 2026-09-13 (not protocol evidence)

- `python scripts/n5/extensions.py install` → the 7 exact `verified` lines in 0.3, exit 0;
  `verify` → same, exit 0.
- `npm run test:n5` → `tests 10 / pass 10 / fail 0`, `N5 client boundaries: OK`, exit 0.
- `npm run check:ivory-boundaries` → `N5 client boundaries: OK`, `Ivory Tower module boundaries: OK`, exit 0.
- `git status --short` after the installs → empty (archives and plugin tree are gitignored).
- Runtime probes: R 4.6.1 (2026-06-24 ucrt), Quarto 1.10.18, Python 3.11.9, Node v24.16.0, npm 11.17.0
  (shim; pinned 11.13.0 available via `npm_config_prefix`).
