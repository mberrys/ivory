# N5 — Theia shell and external-client equivalence

Status: **BLOCKED — partial prototype, no baseline approval**.

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
execution events. It does **not** publish project-open, exact citation resolution,
resolved RunSpec, or revision-based project-edit contracts. The corresponding
widget actions are visibly disabled. An execution request is not called a RunSpec
or used as a substitute for one. No project service, conflict semantics, citation
anchor schema, or persistence layer has been invented in N5.

The current contracts barrel imports domain code, so the transport carries opaque
JSON without importing that barrel. The CLI and helpers preserve service response
bodies, including conflict details. Once the prerequisite publishes its contracts,
bind all four clients to them and replace the blocked controls. This prerequisite
also needs a fixture/reset mechanism for equivalent initial project states and
an operator-owned stop/start procedure for the one canonical service.

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

- N5 TypeScript compilation and lint passed; the browser bundle completed.
- Eight synthetic transport/comparison tests and both boundary checks passed.
- All seven VSIX archives and extracted contents verified against the lock.
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
- Repository verification passed toolchain, dependency bootstrap, formatting,
  and boundaries, then stopped because this checkout references but does not
  define `verify:ivory-cutline`. The remaining aggregate checks did not run.
- The shell smoke test is provided as `npm run test:n5-browser`; it first
  requires a successful full build. Browser and language runtime cases remain blocked.
- R and Quarto are absent from PATH. The Python helper test used an explicit
  bundled interpreter because the default launcher points at a missing Python 3.11.

For this machine, setting the process-local `npm_config_prefix` to the directory
containing the pinned npm avoided a different global npm version selected by the
Windows npm shim. No global configuration was changed.
