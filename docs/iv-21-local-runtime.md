# IV-21 — Reproducible local runtime and migration recovery

## Contract

The local hosted-style profile is a disposable, deterministic verification environment. It contains
PostgreSQL with pgvector, MinIO, a one-shot MinIO client, and the private Docling service. Every
Compose image is pinned to a resolved `@sha256` digest in both `infra/docker-compose.yml` and
`configs/ivory-dependency-policy.json`.

The profile owns only the checkout-local `.ivory-tower/` directory. A reset may remove that exact
directory after Compose is down; it must never remove a host Docker volume, a parent directory, or
production data.

MinIO remains local-dev/test infrastructure. Digest-pinning does not clear the unreviewed AGPL-3.0
licence recorded in `docs/iv-19-dependency-governance.md` §13.

## Bootstrap contract

After a clean install, run:

```powershell
npm.cmd ci
npm.cmd run check:ivory-install
```

On Unix, use `npm ci` and `npm run check:ivory-install`. The verifier proves the pinned Node/npm
toolchain, the checked-in `dev-packages/private-ext-scripts` workspace package, the installed
`@theia/ext-scripts` package identity/version, and its `bin/theia-ext.js` entry point. It is
diagnostic only: it never copies files into `node_modules` or runs an implicit repair. A failure
requires a fresh lockfile installation from the repository root.

`verify:ivory-tower` invokes this check before compile, lint, test, or browser work. CI invokes it
immediately after `npm ci` as a separate, readable failure boundary.

## Session 04 runtime proof

Run the full clean-environment and recovery proof with:

```powershell
npm.cmd run verify:ivory-session-04
```

The command performs this sequence:

1. checks the bootstrap contract and Docker daemon;
2. tears down the Compose project and removes only `.ivory-tower/`;
3. starts Postgres, MinIO, and Docling with `docker compose up --wait`, then starts the one-shot
   bucket initializer and waits for the bucket to be reachable;
4. migrates the primary database only through its immediate N-1 migration boundary;
5. writes a deterministic source row and immutable MinIO object, then reconciles its content hash
   and object key across the database and object store;
6. takes a PostgreSQL custom-format snapshot, restores it into an isolated database, and migrates
   both the primary and restored databases to the latest migration;
7. verifies migration ledgers, original source identity, object hash metadata, and the current
   migration's compatibility/backfill expectation; compiles `@ivory-tower/api` and
   `@ivory-tower/worker` from the lockfile install; then runs the API/worker/Docling happy-path
   runtime proof; and
8. records non-secret evidence in `artifacts/session-04/result.json`, tears down Compose, and
   removes only `.ivory-tower/`. Postgres and MinIO write bind-mount files as root, so the
   verifier deletes those children through the digest-pinned Postgres image with the host path
   bound at `/ivory-tower-state`, then removes the now-empty checkout-local directory. It still
   refuses any path other than `<repo>/.ivory-tower`.

Pass `--keep` to retain the Compose profile and `.ivory-tower/` for diagnosis. On failure the
verifier writes redacted Compose logs to `artifacts/session-04/compose.log`; credentials and
PostgreSQL URL passwords are scrubbed before the file is created.

The immediate N-1 boundary is derived from the two newest sorted migration filenames. With the
current `001_runtime_topology.sql` and `002_source_rights.sql`, it proves a snapshot made at `001`
can be restored and upgraded through `002`, including the source-rights defaults on the legacy
source record.

## CI evidence

The `Runtime and migration recovery (Session 04)` Ubuntu workflow job performs a clean `npm ci`,
the bootstrap check, and `verify:ivory-session-04`. It uploads the sanitized Session 04 artifact
only when the runtime job fails. A passing job is the runtime/migration evidence; static checks do
not substitute for Docker, database, object-store, Docling, API, or worker execution.

## Operating limits

Docling remains private to the runtime. The verification fixture uses a deterministic public-reuse
source only; it does not authorize user content or a remote conversion fallback. The migration
runner is forward-only. The `IVORY_MIGRATIONS_UP_TO` environment variable exists solely to create
the verifier's N-1 fixture and rejects a filename not present in the checked-in migration set.
