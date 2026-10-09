# @ivory/core

P3a introduces a detached, reconnectable Core owner. Product clients call startOrAttachCore or connectCore; close detaches the client and stop explicitly shuts down the owner. Every writable openProjectStore also takes the permanent OS-backed singleton lock. Read-only observers can use the readOnly option. [ADR-011](../../docs/architecture/adr-011-p3a-core-ownership.md) is the current ownership and byte-admission contract.

The service descriptor binds the canonical directory, project/store identities and an ownership epoch. PID records never grant ownership. Staging is verified before an atomic installation that cannot overwrite another blob, and installed readback is verified before acknowledgement. readBlob only returns bytes with a committed semantic reference and matching digest; admission by itself leaves an invisible orphan.

After compilation, the local lifecycle CLI is available directly or through npm run core --workspace @ivory/core:

~~~text
node packages/ivory-core/lib/node/core-cli.js init tmp/p3a-demo fixture-project
node packages/ivory-core/lib/node/core-cli.js start tmp/p3a-demo
node packages/ivory-core/lib/node/core-cli.js admit tmp/p3a-demo README.md
node packages/ivory-core/lib/node/core-cli.js status tmp/p3a-demo
node packages/ivory-core/lib/node/core-cli.js stop tmp/p3a-demo
~~~

The local bootstrap transport limits admission to 8 MiB per request. Its same-user capability is not research authorization. A workbench backend can detach and exit while the same headless Core remains available to CLI; UI integration and domain sessions remain later slices.

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
                qualification/      failpoint, and the qual.put and qual.hold handlers (IV5-6, never loaded by a product host)
```

A project directory holds `ivory-project.json`, `store.sqlite` (with `-wal` and `-shm`), `cas/sha256/<h0h1>/<h2h3>/<64-hex>`, `cas/tmp/<processId>-<random>.tmp` for staging, `leases/<processId>.sqlite` and `runs/`.

`no-restricted-imports` bans `node:sqlite` everywhere in `src/` except `src/node/store/`. The lease is a SQLite file, so it lives there too, although the main thread takes it.

## Thread model

`openProjectStore` takes the singleton writer lock and process lease on the main thread and starts exactly one `worker_threads` Worker per writable project. Read-only observers have only a read connection and no ownership or recovery. The main thread and worker exchange requests `{id, op, args}` and responses `{id, ok, result | error}`. A refusal is an `ok: true` result. The writable worker owns one write connection (WAL, `synchronous=FULL`, foreign keys on) and one read-only connection. Every read (`headSeq`, `head`, `receiptFor`, `readBlob`, change polling, `verifyChain`) uses the read connection, so nothing uncommitted is reported. Functions cannot cross threads, so commit handlers are registered by `kind` from modules that the owner supplies at startup: each exports `commitHandlers`. Clients cannot configure those modules. The built-in module loads first, and a duplicate kind is a startup error.

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

Blobs are admitted before and outside any transaction: staged in `cas/tmp`, fsynced, verified, then atomically linked without overwriting a digest name. The installed file and directories are flushed and readback is verified before acknowledgement. An existing blob is verified and touched, which restarts its GC grace. Admission creates no semantic reference. `requireBlob` hashes bytes before committing a reference, and `readBlob` requires that committed reference and matching bytes. GC deletes unreferenced blobs older than the grace period in short write transactions that re-check the mtime and references and unlink inside the transaction.

## Reads for observers

- `store.head(): Promise<{seq, digest} | undefined>` is the last committed sequence number and its chain digest, or `undefined` for an empty log. Observers use it to detect a sequence number that never made it into the log.
- `store.receiptFor(principal, idempotencyKey): Promise<{seq, digest} | undefined>` is the commit that an idempotency key produced, or `undefined` when it committed nothing. Both are read on the read connection.

## Qualification hooks (internal)

`OpenProjectStoreOptions.qualification` is `@internal`. It exists for the IV5-6 harness in `@ivory/qualification` and is never set by a product host. It reaches the worker through `workerData`.

- `synchronous: 'FULL' | 'OFF'` sets `PRAGMA synchronous` of the write connection. The default is `FULL`.
- `failpoint: {name, afterHits, markerFile}` arms one of five places where the host kills itself. On hit number `afterHits` of `name`, `failpoint(name)` writes `markerFile` synchronously, with the point name and the pid, and then calls `process.kill(process.pid, 'SIGKILL')`. From the worker thread this ends the whole process on Windows and on POSIX. Without a configured failpoint the call does nothing.

| Crash point | Name | Place |
|---|---|---|
| C1 | `duringBlobStage` | in blob staging, after the first half of the bytes is written, before fsync and installation |
| C1 | `beforeBlobInstall` | after the staging file is written, fsynced, verified and closed, before installation |
| C2 | `afterBlobInstall` | after atomic installation, file/directory fsync and verified readback (or durable dedup), before `admitBlob` returns |
| C3 | `beforeDbCommit` | inside the transaction after the `commits` and `blob_refs` inserts, before COMMIT; synchronous |
| C4 | `afterDbCommit` | after COMMIT, before the worker posts the response |

`qualificationHandlerModule` (exported from `@ivory/core/lib/node`) is the compiled module of two commit kinds, for `handlerModules`:

- `qual.put {key, blob?}` creates `qual_kv(key, blob, seq)` if needed, requires the blob when there is one, inserts the row and returns `{key, seq}`.
- `qual.hold {ms}` (at most 10 000) blocks synchronously inside `apply` with `Atomics.wait`, so the write lock is held the way a long CLI transaction holds it, and returns `{held: ms}`.

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

- IV5-6: the bake-off and kill harness live in `@ivory/qualification`. This package holds only its hooks.
- IV5-7: migration, fences and the unsafe-location check.
- Slice 8: bundling the worker file for Theia.
- Slice 9: full `verify`. `verifyChain` here exists for the specs and for the N2 evidence.
