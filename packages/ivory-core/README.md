# @ivory/core

The Ivory store host: a project directory with a SQLite commit log, a content-addressed blob store and process leases. It depends on `@ivory/contracts` and Node built-ins only, with no Theia, inversify or other storage dependency. Domain commit kinds are added by later slices; this package ships none.

## Layout

```text
src/common/   store-protocol      types, refusal and error codes, the request/response messages
              project-manifest    ivory-project.json and its parser
src/node/     project-layout      paths, initProject(), readManifest()
              durable-fs          fsyncFile, fsyncDirectory
              store-host          openProjectStore(): the main-thread client
              store/              all SQL lives here (lint-enforced)
                store-worker-main   worker entry point
                store-runtime       what the worker owns: connections, write queue, handlers
                store-schema        schema v1, connections
                commit-log          the commit transaction and the digest chain
                commit-handler      CommitHandler, defineCommitHandler, the registry
                write-queue         FIFO queue, BEGIN IMMEDIATE with async backoff
                cas                 blob admission and GC
                process-lease       the process id, the lease (taken on the main thread), the sweep of dead leases
                recovery            crash recovery at open
                verify-chain        chain check over the read connection
                handlers/           built-in commit kinds (none yet)
```

A project directory holds `ivory-project.json`, `store.sqlite` (with `-wal` and `-shm`), `cas/sha256/<h0h1>/<h2h3>/<64-hex>`, `cas/tmp/<processId>-<random>.tmp` for staging, `leases/<processId>.sqlite` and `runs/`.

`no-restricted-imports` bans `node:sqlite` everywhere in `src/` except `src/node/store/`. The lease is a SQLite file, so it lives there too, although the main thread takes it.

## Thread model

`openProjectStore` takes the process lease on the main thread and starts exactly one `worker_threads` Worker per open project. The two exchange messages only: requests `{id, op, args}` and responses `{id, ok, result | error}`. A refusal is an `ok: true` result. The worker owns one write connection (WAL, `synchronous=FULL`, foreign keys on) and one read-only connection. Every read (`headSeq`, change polling, `verifyChain`) uses the read connection, never the write connection, so nothing uncommitted is ever reported. Functions cannot cross threads, so commit handlers are registered by `kind` from modules that the worker `require`s: each exports `commitHandlers`. The built-in module loads first, and a duplicate kind is a startup error.

## Commit protocol

`store.commit({kind, input, principal, idempotencyKey})` runs in the worker, on a FIFO queue shared with `admitBlob` and `gc`:

1. Boundary parse before BEGIN: the kind is registered, principal and key are non-blank strings of at most 256 characters, the canonical input is at most `maxInputBytes` (256 KiB), and `handler.parse` accepts it. The request digest is `canonicalDigest({kind, input})`.
2. `BEGIN IMMEDIATE`. On `SQLITE_BUSY` the worker waits with async backoff outside any transaction and retries, until `writerBusyBoundMs` (10 s), then refuses with `writer-busy`.
3. Idempotency, before anything else: the same `(principal, key)` with the same request digest returns the stored receipt with `replayed: true`, and with a different digest refuses with `idempotency-conflict`.
4. Head: `prev` is the last digest, or `genesisDigest(projectId)` for an empty log.
5. Apply: `handler.apply(tx, input)` is strictly synchronous. `tx.requireBlob` checks the blob file inside the transaction and records the reference. A promise from `apply` rolls back and rejects with `handler-not-synchronous`. A `StoreRefusal` rolls back and comes back as a refusal, and a failed commit consumes no sequence number.
6. Receipt and chain: `receipt = {seq, kind, value}`, `row.digest = canonicalDigest({seq, prev_digest, principal_key, idem_key, request_digest, receipt_digest, library_build})`.
7. `COMMIT`, acknowledge, then post `advanced(seq)`.

Nothing awaits between BEGIN and COMMIT or ROLLBACK: the transaction body is one synchronous call. Handlers are held to it three ways: the `defineCommitHandler` type rejects an `apply` that returns a promise, the ESLint overrides in `.eslintrc.js` ban async functions, `await`, `yield` and `.then` in `src/node/store/handlers/**` and `src/node/**/test/*-handlers.ts`, and the runtime guard above.

Blobs are admitted before and outside any transaction: staged in `cas/tmp`, fsynced, then renamed. A blob that already exists is verified and touched, which restarts its GC grace. GC deletes unreferenced blobs older than the grace period in short write transactions that re-check the mtime and the references and unlink inside the transaction.

## Owner decisions of 2026-09-29

These fill gaps that the V5 architecture (D1–D3, §6, §7) and ADR-009 (§1–4, §8) leave open. They are recorded on IV5-5.

1. **Commit chain.** Seq 1's `prev_digest` is `canonicalDigest({chain: 'ivory-commit-chain@1', projectId})`. Each commit's `digest` covers every chained column. A chain spliced in from another project fails verify.
2. **Lease name.** `leases/<processId>.sqlite`, where `processId` is a random 128-bit id. The pid, host kind and start time are stored inside. A reused pid can never make a dead host's staging look live.
3. **Lease liveness.** A lease is dead only when its `BEGIN EXCLUSIVE` probe succeeds and its stored pid is gone (`ESRCH`). A pid that is still running is skipped.
4. **Directory fsync.** An `r+` handle on Windows, `r` elsewhere. CI runs on Ubuntu and Windows.
5. **Lease owner.** The main thread holds the lease for as long as the project is open, so a worker restart does not release it.
6. **GC vs dedup.** A dedup admission touches the blob. GC unlinks inside its write transaction, and `commit()` checks the blob inside its own. If GC wins, the commit refuses with `blob-missing`, and no reference ever dangles.
7. **Synchronous handlers.** Enforced by the handler type, lint (`no-restricted-syntax` plus the type-aware promise rules on handler files) and a runtime rollback when `apply` returns a thenable.
8. **Writer busy.** Async backoff outside any transaction, in FIFO order, refused with `writer-busy` after 10 s. Configurable per host.

## Running

```text
npx lerna run compile --scope @ivory/core --include-dependencies
npx lerna run lint,test --scope @ivory/core
```

`.github/workflows/ivory-core.yml` runs both on Ubuntu and Windows, because the lease, the rename and the fsync behave differently there. Specs that simulate other hosts fork the compiled fixtures in `lib/node/store/test`, so compile before testing.

## Out of scope

- IV5-6: the bake-off and kill harness.
- IV5-7: migration, fences and the unsafe-location check.
- Slice 8: bundling the worker file for Theia.
- Slice 9: full `verify`. `verifyChain` here exists for the specs and for the N2 evidence.
