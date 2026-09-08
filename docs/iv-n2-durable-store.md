# N2 — Durable store, blob admission and recovery

Disposable spike. It answers whether PGlite plus the filesystem can preserve
acknowledged research commits and round-trip export/import with no server and
no second authoritative log.

This is evidence tooling, not a production Core kernel. Astra is involved only
if blob-then-DB sequencing cannot be implemented without changing the semantic
commit abstraction. Linear: [MB-592](https://linear.app/mbx2/issue/MB-592/n2-durable-store-blob-admission-and-recovery).

## Grounding

`dev` already has a functioning Postgres-dialect commitment: `ivory-migrate`
(`pg` Pool + `ivory_schema_migrations`), `postgres-execution-store`, Graphile
Worker, and Docker Postgres. That blocks a SQLite comparison unless this spike
fails the integrity gate. Production `FilesystemObjectStore.putImmutable` is
not crash-safe (`writeFile` with `wx`, no staging, no `fsync`). This spike wraps
the `ObjectStorePort` contract locally and leaves that production class
unchanged.

## Run

From the repository root, after `npm install` inside `spikes/n2-durable-store`:

```powershell
npm.cmd run test:ivory-n2
npm.cmd run verify:ivory-n2
```

`test:ivory-n2` covers commit/idempotency, expected-head conflicts, search,
export/import, backup/restore, second-writer contention, missing/corrupted
blobs, simulated `ENOSPC`, one kill/reopen per critical transition, and interrupted
migration.

`verify:ivory-n2` repeats those tests, then runs 1,000 process-abort/reopen
cycles, a semantic export/import check, and the scale load. Skip pieces with
`--skip-tests`, `--skip-storm`, `--skip-export`, `--skip-scale`, `--cycles N`.

Evidence is written to the ignored path `artifacts/n2/evidence.json`.

## Storage port

`DurableStore` in `spikes/n2-durable-store/src/durable-store.mjs`:

- `open` / `close` — exclusive `.ivory/local/writer.lock` (steal only a dead pid)
- `commit` — blob admission, then one SQL transaction for revisions, heads,
  activity, receipt, `blob_refs`, outbox, project sequence
- `getVisible` — head revision; blob digest must have a `blob_refs` row and a
  matching CAS file
- `searchSources` — `ILIKE` over document payload text/title
- `freezeUnchanged` — metadata pin of current heads (no blob copy)
- `exportSemantic` / `importSemantic` — JSON projection + blob bytes + hashes
- `backup` / `restore` — `CHECKPOINT` + `dumpDataDir` + `objects/sha256` copy

Engine: `@electric-sql/pglite` 0.3.16, Node FS `dataDir` = `.ivory/store/`,
`relaxedDurability: false`. SQL envelope: one writer, no `LISTEN/NOTIFY`, no
background workers, no Graphile.

## Acknowledgement

A commit is acknowledged only after the SQL `COMMIT` of the
revision/activity/receipt/`blob_ref`/outbox transaction returns. The spike also
issues `CHECKPOINT` when the engine accepts it. Blob install (stage, SHA-256,
`fsync`, atomic rename into `objects/sha256/<ab>/<digest>`) happens **before**
that transaction. A crash before `COMMIT` may leave an unreferenced blob and
must not create a visible reference. Filesystem rename and SQL are not one
native transaction.

Idempotency keys are unique on `receipts`. Retry of an acknowledged command
returns the original receipt. Unacknowledged work is retried with the same key
and produces one semantic effect.

Notification outbox is at-least-once and is not a source of truth. Output
publication writes `.ivory/published/<seq>.json` after outbox delivery.

## Fault matrix

Termination is injected at `beforeBlobInstall`, `afterBlobInstall`,
`beforeDbCommit`, `afterDbCommit`, `beforeOutboxDelivery`,
`afterOutboxDelivery`, `beforeOutputPublish`, and `afterOutputPublish`. The
child writes a ready marker and `process.abort()`s without `close()`. The parent
force-kills any leftover process (`taskkill /F` / `SIGKILL`), reopens, asserts
invariants, and retries the identical command.

Also covered: interrupted forward migration (resume remaining files), second
writer (typed contention, no mutation), missing blob, corrupted blob, simulated
`ENOSPC` on blob write and on DB write.

## Backup and migration

Backup takes the writer lock, checkpoints, dumps the PGlite data directory,
and copies the pinned blob closure. Restore is into a fresh path, then open.

Migrations are forward-only SQL files, one transaction per file (apply +
`schema_migrations` row), under the exclusive writer lock. Interrupted
migration resumes remaining files. Immutable payload hashes are not rewritten.

## Durability envelope

Tested envelope: unclean process termination (`process.abort` plus `taskkill
/F` or `SIGKILL`) of a Node process using PGlite NodeFS on NTFS, then reopen.
This does **not** prove survival of hardware power loss, USB yank, firmware
crashes, or live cloud-drive sync of an open store. Windows `fsync` of a
read-only handle is `EPERM`; the spike `fsync`s installed blobs through a
writable handle.

## Decision

Recorded in `artifacts/n2/evidence.json` after `verify:ivory-n2`. Integrity
failure is a hard fail. Performance miss requires a measured query/index/batch
fix before an engine rewrite. Persistent performance failure or unbounded
memory growth forces the fallback in architecture §J (SQLite if dialect
migration is bounded; otherwise bundled native PostgreSQL). Do not ship a
dual-engine production abstraction.
