# N6 — Portable reproduction and real research value

N6 is a disposable technical experiment, not a production project format. See
[retained evidence](n6-evidence.json) for the observed result and exact source
digests. Human qualification and the executable no-code product workflow remain
pending; the experiment does not authorize public-format freeze.

Authority: [Architectural spikes N1–N7](https://linear.app/mbx2/document/architectural-spikes-n1-n7-17f7e0721f67).

## Study and implementation boundary

The fixture contains 30 fictional short interviews, a 30-row survey with three
missing scores, one codebook, 30 annotations, competing claims, supporting and
challenging EvidenceLinks, a source correction, and two snapshots. All participant
and researcher identities are synthetic. No model, provider key, private corpus,
GUI state, or researcher outcome is used to generate the evidence.

The N1 kernel is imported unchanged from `origin/v2-n1-experiment` at
`a5cad0b612e24c82018d74a94ab97cb7e4670317`. It creates the research revisions and
semantic snapshot closure. N6 stores those exact records through the N2 V2
PGlite/CAS port based on `f30f44873945056d90d6fc2f99eca998c195f447`; it does not
introduce a second revision model. N2 import now restores provenance edges and
orders predecessors before successors. N2 export uses deterministic row order.

N6's retained-record reader validates exact references, revision digests, typed
links, selectors and snapshot closure without replaying authoring commands.
Generated authoring files are captured CAS bytes. Edits require a new capture;
the fixture runner rejects working files that differ from its captured study.

## Run on Windows

Use Node 24.16.0. Install only the isolated spike dependencies; the Theia monorepo
bootstrap is not required for these commands:

```powershell
npm.cmd ci --prefix spikes/n2-durable-store
npm.cmd ci --prefix spikes/n6-portable-reproduction
node spikes/n6-portable-reproduction/cli.mjs prepare artifacts/n6/runtime
npm.cmd run test:ivory-n6
npm.cmd run verify:ivory-n6
```

Preparation requires `uv` and an installed R 4.6.1 distribution. The optional
second argument to `prepare` supplies its R home. Preparation explicitly installs
Python 3.12.12 into the artifact directory, downloads the checksum-pinned Quarto
1.8.27 archive, and copies R into an isolated runtime directory. It changes no
global PATH or system installation. It requires network access on first use.
R and Quarto licenses remain with the installed distributions; runtime binaries
are not checked into this repository.

The captured runtime lock declares standard-library-only Python and R's base and
utils packages. Execution uses `-I -S`, R `--vanilla`, disabled default R packages,
empty user library paths, and fresh HOME/cache directories. No credentials are
forwarded to analysis processes. This is trusted-fixture portability evidence,
not an operating-system sandbox or N3 isolation qualification.

The verifier creates a study, executes a baseline, exports it, and restores into
a new directory in another process. Original project/export paths are renamed
out of use. A separate runtime copy and fresh user state run the restored study.
It then removes one canonical blob, removes the real R `utils` package, and
removes the survey input in turn. Each must produce its specific expected error,
invalidate previous success, and recover after the missing material is restored.

## Experimental command contract

```powershell
node spikes/n6-portable-reproduction/cli.mjs create artifacts/n6/my-study
node spikes/n6-portable-reproduction/cli.mjs export artifacts/n6/my-study artifacts/n6/my-export
node spikes/n6-portable-reproduction/cli.mjs restore artifacts/n6/my-export artifacts/n6/my-restored
node spikes/n6-portable-reproduction/cli.mjs verify artifacts/n6/my-restored
node spikes/n6-portable-reproduction/cli.mjs reproduce artifacts/n6/my-restored artifacts/n6/runtime/runtime.json
```

Create/export/restore destinations must be absent or empty. Verify reads canonical
state through N2's exclusive writer ownership; it does not run analysis or install
dependencies. Restore validates before opening its private staging store and
publishes the destination only after a semantic readback matches the export.

The portable directory has `ivory.project.json` (`ivory-n6-portable/1`), a recorded
project sequence, JSON records, SHA-256-addressed blobs, analysis files, and the
captured runtime lock. An exact file inventory rejects undeclared files, missing
bytes, digest mismatch, unsafe paths, symlinks, and case collisions. The manifest
is an integrity inventory, not a signature or an authenticity guarantee.
Machine-local locks, environment installs, caches, and previous output copies
are not exported. This directory is a readable semantic interchange format,
not a database backup or a format suitable for merging live stores in Git.

## Comparisons and acceptance

Python preserves participant IDs 1–30 and missingness. R must reproduce exactly
30 rows, 27 observed scores, three missing scores and sum 405; mean 15 uses an
absolute tolerance of `1e-12` plus relative tolerance `1e-12`. These expectations
are declared independently of the rerun. Nonfinite or changed analytical values
fail. Source, code, record and blob integrity use exact digests, not tolerances.

Quarto renders an HTML dossier with exact retained/current source citations,
link roles and author attribution. Every declared dossier citation must be
present in the rendered document. Presentation digests are reported separately;
HTML byte variation cannot change analytical acceptance. PDF rendering is not
qualified by this HTML fixture. A PDF lane must use the same analytical and
citation gates before gaining an equivalent result.

`test:ivory-n6` runs the 12 imported N1 tests and the N6 contract tests. Full
qualification also runs the N2 regression suite, including process interruption.
Large raw artifacts remain under ignored `artifacts/n6/qualification-*`; the
retained record includes base commit, dirty status, implementation and fixture
digests, commands, versions, platform, comparisons and limitations. A dirty
working-tree run is not mislabeled as proof of its base commit alone.

The overall repository verifier is separate. During this implementation it was
blocked by the isolated checkout's missing root dependency bootstrap (and one
invocation used npm 11.17.0 instead of the pinned 11.13.0). No full Theia build,
browser qualification, or hosted CI success is claimed.

## Decision and remaining human gate

A technical pass supports further development of deterministic semantic export,
strict restoration and separate analytical/presentation comparisons. It does not
establish a public reproducibility badge, a production UI, another supported OS,
or completion of the researcher study.

Use the [researcher study kit](n6-researcher-study-kit.md) when the executable
no-code workflow is available. At least four of five researchers must finish the
qualitative loop without code and explain both a supporting and a challenging
link before N6's human gate can pass. No researcher result is inferred from tests.
