# N5 — Theia shell and external-client equivalence

Status: **PARTIAL — research contracts published and clients bound; qualification protocol and Windows Spectre install pending.**

The isolated `@ivory-tower/n5-browser` application targets Windows/browser and
Theia 1.74.0. The existing V1 application and its plugin-host prohibition remain
unchanged. No desktop or cross-platform qualification is claimed.

## Implemented and prerequisite boundary

The prototype provides a command-driven execution widget, a framework-independent
HTTP/SSE client, CLI, Python and R helpers, a same-origin streaming proxy, an
extension allowlist, fixtures, and evidence/comparison tools. The proxy has no
research-service lifecycle or persistence behavior. Source files remain ordinary
editor files; they are not canonical research records.

The current API publishes `/health/ready`, `/v1/executions`, execution status and
execution events. It now also publishes the research contracts the N5 clients
require: `POST /v1/projects/open` (project-open), `POST /v1/citations/resolve`
(exact citation resolution), `POST /v1/runspecs/resolve` (resolved RunSpec), and
`POST /v1/projects/edits` (revision-based project-edit with first-writer-wins
conflict semantics), backed by an in-memory fixture research service with a
`POST /v1/fixtures/reset` mechanism for equivalent initial project states. The
four N5 clients (Theia widget, CLI, Python, and R helpers) are bound to these
routes and the previously disabled widget actions are enabled. The service is an
in-memory fixture (`InMemoryResearchService`), not a persistence layer; the
6-step qualification protocol is still pending.

The current contracts barrel imports domain code, so the transport carries opaque
JSON without importing that barrel. The CLI and helpers preserve service response
bodies, including conflict details. An execution request is not called a RunSpec
or used as a substitute for one. The operator-owned stop/start procedure for the
one canonical service remains to be exercised with real cross-client evidence.

Submission has no implicit retry: callers retain the request and idempotency key
before sending and reuse both after uncertainty. Theia's read-only watcher refreshes
status and resumes SSE with bounded reconnect backoff. Both current event stores
emit `executionId:sequence`; the HTTP endpoint accepts a numeric replay cursor.
The adapter checks the execution prefix before translating that cursor. It never
starts another writer. Restart qualification still requires real service evidence.

## Reproduce

From the repository root with the pinned Node/npm toolchain:

```powershell
npm.cmd ci
```

### Windows prerequisite — MSVC Spectre-mitigated libraries

`@vscode/windows-ca-certs@0.3.4` (optional native dependency of `@vscode/proxy-agent`
under the `@theia/plugin-ext` subtree) sets `"SpectreMitigation": "Spectre"` in its
`binding.gyp`, so `npm.cmd run build:n5` (the `theia rebuild:browser` step) requires
the Spectre-mitigated MSVC libraries. Probe the install path, toolset, and Spectre
directories:

```powershell
& "C:/Program Files (x86)/Microsoft Visual Studio/Installer/vswhere.exe" -latest -products "*" -property installationPath
& "C:/Program Files (x86)/Microsoft Visual Studio/Installer/vswhere.exe" -latest -products "*" -find "VC/Tools/MSVC/*"
& "C:/Program Files (x86)/Microsoft Visual Studio/Installer/vswhere.exe" -latest -products "*" -find "VC/Tools/MSVC/*/lib/*/spectre"
```

The last command lists `lib/<arch>/spectre` directories; empty output means the
component is missing. Map the probed toolset's `14.4X` to the full catalog component
ID — the installer rejects the abbreviated `VC.14.4X.Spectre` form and requires the
versioned `VC.14.4X.17.1Y.x86.x64.Spectre` ID from the catalog:

```powershell
& "C:/Program Files (x86)/Microsoft Visual Studio/Installer/setup.exe" modify `
  --installPath "C:/Program Files/Microsoft Visual Studio/2022/BuildTools" `
  --add Microsoft.VisualStudio.Component.VC.14.44.17.14.x86.x64.Spectre `
  --quiet --norestart
```

This must run elevated (admin): a non-elevated run fails with installer exit code
5007 ("Commands with --quiet or --passive should be run elevated from the
beginning"). Re-run the third probe to confirm the directories exist before
continuing. This machine's toolset is 14.44.35207 under Visual Studio Build Tools
2022 17.14.35.

```powershell
python scripts/n5/extensions.py install
npm.cmd run test:n5
npm.cmd run build:n5
$env:IVORY_N5_SERVICE_URL = 'http://127.0.0.1:4100'
npm.cmd run start:n5
```

The shell listens on loopback port 3107. `IVORY_N5_SERVICE_URL` selects an existing
service origin; it does not launch one. `prestart` checks every VSIX hash and every
extracted file and rejects unexpected plugin directories. The backend scanner
rejects extension IDs/versions outside the candidate and excludes optional packs.
The app omits the extension registry. Do not use the root `download:plugins` task:
its broader extension set is not this candidate.

```powershell
node packages/ivory-n5-client/src/cli.cjs ready
node packages/ivory-n5-client/src/cli.cjs get EXECUTION_ID
node packages/ivory-n5-client/src/cli.cjs submit REQUEST.json RETAINED_KEY
node packages/ivory-n5-client/src/cli.cjs events EXECUTION_ID 0
python packages/ivory-n5-client/helpers/ivory_n5.py get EXECUTION_ID
Rscript packages/ivory-n5-client/helpers/ivory_n5.R get EXECUTION_ID
npm.cmd run evidence:n5
```

`evidence:n5` writes `artifacts/n5/evidence.json` and exits **2** for blocked
qualification. It records the base commit and dirty state rather than falsely
claiming an uncommitted implementation is the base commit. R helpers require
`httr2` in the selected R environment. Their versions must be
recorded before qualification. Python uses only its standard library.

If the system Python launcher is broken, set `IVORY_N5_PYTHON` to a working
interpreter's absolute path. `node scripts/n5/extensions.mjs install`, the tests,
and `prestart` honor that override. The R helper accepts/returns complete JSON
text, avoiding R's scalar/array simplification during transport.

## Candidate version, license and compatibility matrix

Exact URLs, manifest engine ranges, artifact SHA-256s and dependency closure are
in `examples/ivory-n5-browser/extensions.lock.json`. License entries below were
read from the pinned artifacts; bundled/transitive notices remain applicable.
Registry compatibility claims and engine ranges are not activation evidence.

| Component | Candidate | License/source | Compatibility evidence |
|---|---|---|---|
| Theia source fork | 1.74.0; API constant 1.130.0 | Repository EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0 | Build/runtime recorded separately; API constant alone proves no behaviors |
| R extension | REditorSupport.r 2.8.8 | [MIT license](https://open-vsx.org/api/REditorSupport/r/2.8.8/file/LICENSE.txt) | Requires VS Code ^1.75.0 and r-syntax; R/languageserver execution unqualified |
| R syntax | REditorSupport.r-syntax 0.1.4 | [MIT license](https://open-vsx.org/api/REditorSupport/r-syntax/0.1.4/file/LICENSE.txt) | Hard R extension dependency; ^1.90.0 |
| Python | ms-python.python 2026.2.0 | [MIT license](https://open-vsx.org/api/ms-python/python/2026.2.0/file/LICENSE.txt) | ^1.95.0; optional Pylance/debugpy/environments pack excluded |
| Python language server | detachhead.basedpyright 1.40.0 | [MIT license](https://open-vsx.org/api/detachhead/basedpyright/1.40.0/file/LICENSE.txt) | ^1.101.0; completion/diagnostics/navigation require live verification |
| Quarto extension | quarto.quarto 1.137.0 | [MIT license](https://open-vsx.org/api/quarto/quarto/1.137.0/file/LICENSE.txt) | ^1.75.0; Quarto CLI and R/knitr required for the fixture |
| Python grammar | vscode.python 1.95.3 | [Artifact notices](https://open-vsx.org/api/vscode/python/1.95.3/file/LICENSE-vscode.txt) | Required because ms-python.python does not supply Python syntax |
| YAML grammar | vscode.yaml 1.95.3 | [Artifact notices](https://open-vsx.org/api/vscode/yaml/1.95.3/file/LICENSE-vscode.txt) | Quarto frontmatter syntax dependency |
| R, languageserver, httr2, knitr | Unselected: R absent from PATH | Must capture from installed runtime/packages | Blocked |
| Python runtime | Probe in evidence.json | Installed interpreter notices | Helper transport is tested; editor execution is separate |
| Quarto CLI | Unselected: absent from PATH | Must capture selected distribution notices | Blocked |
| Notebook/kernel bundle | Not included | No selection made | Conditional, not tested |

## Qualification protocol

All service observations must identify the service version, initial project
revision, input fixture digest, client version, command, and raw response. Do not
fill blocked cases with synthetic-server outputs.

1. From equivalent initial state, each of Theia, CLI, R and Python opens the same
   project, resolves the same citation, requests the same run, and reads its
   complete resolved RunSpec and semantic result. Preserve raw receipts. Feed
   full content projections to `compareClients` in `scripts/n5/compare.mjs`.
   Actor/receipt/time metadata may differ outside those projections only when
   the prerequisite contract documents that separation. Never recursively strip
   similarly named fields from RunSpecs/results or reorder arrays.
2. Run all twelve ordered distinct-client edit pairs from an identical revision.
   The first edit succeeds, the second conflicts identically; record authoritative
   state and unchanged rejected fields. This covers every pair in both orders.
3. Disconnect each client, restart the one service, and reconnect. Repeat after
   acceptance but before receipt delivery. Record process IDs/command lines,
   service logs, accepted command IDs, and persistence observations proving no
   duplicate command or second canonical writer. Transport unit tests do not
   establish this result.
4. Navigate to the exact immutable source version and passage/range. Compare
   displayed bytes and anchor against authoritative resolution. Missing and stale
   anchors must produce explicit errors without nearby/latest-source substitution.
5. In the built application, open `fixtures/research.py`, `research.R`, and
   `research.qmd`. Record syntax highlighting, `square` completion and definition
   navigation, diagnostics from the separate intentionally invalid fixtures,
   R/Python terminal output 9/9.0, and rendered Quarto heading and computed 9.
   Capture extension activation and language-server logs. Quarto-specific
   completion, diagnostics and document navigation also need observed results.
6. Separately test `conditional.ipynb`: open, select a pinned kernel, execute to
   9, preserve output, disconnect/reconnect. Notebook absence does not qualify it
   and must not silently become a mandatory-language failure.

Approve no N5 decision until all mandatory cases have real evidence. Missing
prerequisites are blocked. Theia owning records, a second canonical writer,
widget command bypass, or major IDE reconstruction is a failed candidate.
The small scanner override is isolated product composition, with no upstream edits.

## Evidence interpretation

`npm run test:n5` tests request/key preservation, conflict payload transport,
chunked SSE/replay, reconnect reads, CLI/Python wire behavior, strict comparison,
and boundaries. Its synthetic HTTP tests are explicitly **not** service equivalence.
The complete research integration suite and browser qualification cannot be
implemented against absent contracts; they remain the protocol above, not passing
placeholder tests. Generated build and repository-check logs live under
`artifacts/n5/`. No merge, push, or baseline adoption is implied.

### Local validation, 2026-09-07

- `npm run -s verify:ivory-cutline` passes: `PASS  130 tracker issues validated`
  (112 Required, 1 Conditional, 17 Post-V1), exit 0.
- `npm run -s verify:ivory-phase-gates` emits the phase report and exits 0
  (intentionally run without `--require-pass`; phases still report incomplete
  Required/Conditional issues by design).
- `npm run -s test:ivory-cutline` passes 7/7, exit 0.
- `npm run -s test:ivory-runtime` passes — contracts 8, api 5 (including the
  fixture-research-service routes and the 503 without the service), worker 3 —
  exit 0.
- `npm run -s test:n5` passes 10/10 plus `N5 client boundaries: OK`, exit 0.
- `npm run typecheck:ivory-tower` compiles 56 projects, exit 0.
- `npm run lint:ivory-tower` lints 11 projects, exit 0.
- `npm run -s secret:scan` passes (`no sentinel value or credential pattern
  found`), exit 0.
- `npm run -s dependency:policy` still exits 1: the N5 browser and shell packages
  depend on `@theia/*` packages with no entry in the dependency inventory and
  fall outside the `format:check:ivory-tower` quality scope. This predates the
  research-contract work and is not caused by it.
- `node scripts/n5/evidence.mjs` exits 2 with `decision: blocked`,
  `liveService.available: false` (ivory-api is not running on this machine), and
  the protocol-pending reason; no qualification is claimed.
- Backend bundling remains machine-blocked: the pinned 0.3.4 native module
  (`@vscode/windows-ca-certs`, `"SpectreMitigation": "Spectre"`) rebuild fails
  with MSB8040 because the installed Visual Studio Build Tools 2022 toolset
  (14.44.35207) lacks the Spectre-mitigated libraries. A machine install of
  `Microsoft.VisualStudio.Component.VC.14.44.17.14.x86.x64.Spectre` was attempted
  on 2026-09-07 and failed with installer exit code 5007 (requires an elevated
  admin run). Exact probe and install commands are recorded in Reproduce above.
  The toolchain check now exits 1 with a remediation message until the component
  is installed (`IVORY_SKIP_SPECTRE_CHECK=1` skips it). No certificate-handling
  bypass was added.
- The full gate `npm run -s verify:ivory-tower` stops at `check:ivory-toolchain`
  on this machine. Its actual first failure is the Windows npm shim selecting
  npm 11.17.0 instead of the pinned 11.13.0:

  ```
  Ivory Tower requires Node 24.16.0 and npm 11.13.0; found Node 24.16.0 and npm 11.17.0.
  ```

  With the pinned npm selected (`npm_config_prefix` pointed at the directory
  holding the pinned npm, see below), the toolchain check then fails on the
  Spectre prerequisite above — the component is still pending an elevated
  install:

  ```
  Ivory Tower Windows backend bundling requires the MSVC Spectre-mitigated libraries.
  Install the component, e.g.: Visual Studio Installer > Modify > Individual components > "MSVC v143 - VS 2022 C++ x64/x86 Spectre-mitigated libraries", or see docs/n5-theia-client-equivalence.md.
  ```

  Downstream steps (`build:ivory-tower`, `test:ivory-browser`) therefore did not
  run.
- The shell smoke test is provided as `npm run test:n5-browser`; it first
  requires a successful full build. Browser and language runtime cases remain blocked.
- R and Quarto are absent from PATH. The Python helper test used an explicit
  bundled interpreter because the default launcher points at a missing Python 3.11.

For this machine, setting the process-local `npm_config_prefix` to the directory
containing the pinned npm avoided a different global npm version selected by the
Windows npm shim. No global configuration was changed.
