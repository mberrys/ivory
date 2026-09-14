# Ivory Tower local runtime

This profile provides the external services used by the hosted-style local
stack: PostgreSQL with pgvector, an S3-compatible MinIO endpoint, and a private
Docling HTTP service. The one-shot MinIO initializer creates the project bucket
automatically. All volumes are beneath `.ivory-tower/`, which is ignored by Git
and is owned by this checkout. Every Compose image is digest-pinned.

## Local workstation

```powershell
copy .env.example .env
# For this Compose profile, set IVORY_S3_BUCKET=ivory-tower and
# IVORY_S3_ENDPOINT=http://localhost:9000 in .env when running the API locally.
npm.cmd ci
npm.cmd run check:ivory-install
npm.cmd run verify:ivory-session-04
```

On Unix, use `npm ci`, `npm run check:ivory-install`, and
`npm run verify:ivory-session-04`.

For an interactive local stack after the clean-environment proof succeeds:

```powershell
docker compose -f infra/docker-compose.yml up -d --wait
npm.cmd run migrate:ivory
npm.cmd run compile:ivory-services
npm.cmd run start:ivory-api
npm.cmd run start:ivory-worker
```

`verify:ivory-session-04` owns its reset: it stops the Compose profile and
removes only the project-owned `.ivory-tower/` data directories before and after
the proof. Pass `--keep` for diagnosis. The migration command is forward-only;
production deployments must never use a reset command. See
[`docs/iv-21-local-runtime.md`](../docs/iv-21-local-runtime.md) for the exact
bootstrap, N-1 restore, and evidence contract.

The Docling endpoint is private to the runtime. A source is admitted before it
is committed to canonical storage or dispatched to any worker. A remote
conversion endpoint is an explicit policy choice, not an automatic fallback.

The API uses the S3-compatible adapter whenever `IVORY_S3_BUCKET` is set.
Leaving it empty selects the filesystem adapter for the post-V1 local profile
only.

MinIO is local-dev/test infrastructure only. Digest-pinning does not clear the
unreviewed AGPL-3.0 licence recorded in
[`docs/iv-19-dependency-governance.md`](../docs/iv-19-dependency-governance.md).
