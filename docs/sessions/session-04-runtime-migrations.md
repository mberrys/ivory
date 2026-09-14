# Session 04 — Runtime, clean-install, and migration-recovery implementation

**Primary owner:** IV-21 (Establish local development, migrations, and seed workflow)
**Gate:** 0 — Canonical executable baseline
**Branch:** `cursor/session-04-runtime-migrations-9419`, atop `origin/stable` @ `9030ac2`.

## Scope delivered

- Added `check:ivory-install`, a fail-fast bootstrap verifier for the pinned Node/npm toolchain and
  the linked `@theia/ext-scripts` workspace binary. It diagnoses a broken install; it does not
  mutate `node_modules`.
- Inserted that verifier before the aggregate Ivory compile/test gate and as an explicit CI step
  after every clean `npm ci` in `.github/workflows/ivory-tower.yml`.
- Added `verify:ivory-session-04`: disposable Compose startup, deterministic database/object-store
  seeding, immediate N-1 dump/restore/upgrade, reconciliation, runtime happy path, sanitized
  failure diagnostics, and checkout-local teardown.
- Extended the production migration runner with a validated, inclusive upper boundary so the N-1
  fixture uses the same code as deployment, not a test-only fork. Unknown filenames fail.
- Made `verify:ivory-runtime` portable between Windows (`docker.exe`) and Unix (`docker`), and
  compile API/worker before starting them so a lockfile install plus Docker is sufficient.
- Pinned pgvector, MinIO server, and MinIO client to resolved immutable manifest digests and
  retired their former local-image exceptions.
- Teardown of `.ivory-tower/` deletes root-owned bind-mount children through the pinned Postgres
  image instead of a host `rm` that cannot unlink MinIO/Postgres files.

A first attempt of this work landed on `origin/dev` at `1e45afd` and failed
`verify:ivory-tower` (CI run 32406462913); the runtime job never ran. This session re-implements
the contract from `origin/stable` after Session 03 addenda, without the incidental lockfile churn.

The first CI run of this branch (33183761714) proved the N-1 dump/restore/upgrade path, then
failed to start API/worker (`lib/start.js` missing because the runtime job does not run the
static compile gate) and failed to remove `.ivory-tower/minio` (`EACCES`). Those two gaps are
closed in the follow-up commit on this branch.

## Evidence boundary

The Ubuntu `Runtime and migration recovery (Session 04)` job is the required clean-install,
Docker-backed evidence producer. A passing static gate is not Session 04 sign-off.

Recorded on [run 33186189634](https://github.com/mberrys/ivory-tower/actions/runs/33186189634)
(`f882f5254`): verify Ubuntu/Windows, governance, and runtime job 98902380283 all succeeded.
The runtime log records `001_runtime_topology.sql` restored and migrated through
`002_source_rights.sql`, then the IV-14 happy path.

See [IV-21](../iv-21-local-runtime.md) for the operational contract and
[the handoff](session-04-handoff.md) for commands, CI, and remaining gaps.
