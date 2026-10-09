# ADR-011: One local Core owner and durable byte admission

Status: implementation contract for [V5 P3a](https://github.com/mberrys/ivory-issues/issues/4).

## Trigger and scope

The explicit request to implement issue #4 requires one live headless Core writer, an OS-backed exclusive owner and epoch, immutable project-scoped bytes, and CLI reconnection after a workbench host closes.

This changes the ownership part of ADR-009 and decision package D1: writable clients attach to one local service instead of embedding simultaneous writable hosts. The selected SQLite engine, worker-thread store, project-directory format, synchronous commit path, CAS-before-reference ordering, omitted evaluator, and human research authority remain the baseline. The historical ADRs and decision package retain their pinned text.

P2 remains the separate contract dependency in [PR #11](https://github.com/mberrys/ivory/pull/11). This slice uses the exact project identity and SHA-256 primitives already on dev. It does not import unmerged P1/P2 changes or implement research revision acceptance.

## Ownership

1. The main thread takes an exclusive SQLite lock on the permanent core-writer.sqlite file before starting a writable store worker. The database uses DELETE journaling and a lifetime BEGIN EXCLUSIVE transaction, which the OS releases when the process dies.
2. Never unlink, rename or replace that lock database. A stale PID, absent discovery record, or process ID reuse cannot bypass the lock. Unexpected worker failure leaves ownership held until the owner closes or dies.
3. Every ownership interval gets a fresh random UUID epoch. Writable openProjectStore calls also take this lock; a direct library caller cannot become a second writer. Read-only observers take no writer lock, perform no recovery and cannot mutate.
4. The detached headless process owns the worker. Client close detaches only that client. Explicit stop closes the endpoint, retires discovery, drains the worker and then releases ownership.
5. Core publishes core-service.json atomically only after the store is ready and the loopback endpoint is listening. Discovery binds canonical directory, project ID, store instance ID, process identity, epoch, port and a random capability token.
6. Attach performs an authenticated status round trip and verifies the directory and identities. A copied descriptor cannot redirect a clone to the original project. A stale descriptor is retried through a lock-contending starter, never PID-based takeover.

Process leases under leases/ remain staging/recovery identities, distinct from the singleton writer lock.

## Byte admission and visibility

1. Validate bytes and any caller-supplied expected SHA-256 before staging.
2. Stage to a unique process-tagged file, flush it, and hash the staged file.
3. Publish with an atomic hard link that refuses an existing target name. The staging and destination directories are on the same project filesystem. A racing existing target is verified and touched; it is never overwritten.
4. Flush the installed file and directory entries, then verify installed readback before acknowledging. Verification failure refuses admission. The staging name is removed on ordinary success or failure; dead-process recovery removes interrupted staging.
5. Admission creates no semantic reference. readBlob requires a committed blob_refs entry and verifies the bytes on every read. Incomplete staging and installed orphans remain invisible to semantic reads.
6. A commit's requireBlob hashes the installed file synchronously before adding its reference. Missing or corrupted bytes refuse the transaction without consuming a sequence number. This strengthens the existing blob-reference seam; research domain transactions remain P3b.

## Local bootstrap transport

The service binds 127.0.0.1 on an OS-assigned port. Each request requires the discovery token and ownership epoch, the exact loopback Host, and no browser Origin. The POSIX discovery file is created with mode 0600; Windows uses inherited filesystem ACLs. The token is a same-user local bootstrap capability, not a human decision, research grant or protection against a hostile process that already has access to the user's project files.

The versioned transport exposes the existing storage interface and lifecycle only. Clients cannot configure handlers, load modules or set qualification options through requests. The default product service registers no research mutation handlers. Commands use bounded JSON and canonical base64; admission is limited to 8 MiB per request. Domain sessions, research authorization, public CLI design and streaming belong to P4/P5.

## Qualification and limits

The [P3a evidence package](../ivory/qualification/p3a/README.md) retains implementation SHA, fixture and source digests, exact commands, runtime/OS/filesystem, measured test results, failures and limits. CI executes the same validator on Windows and Linux.

Tests cover live ownership with stale PID/absent metadata, contention between starters, takeover after process kill, new epochs, corruption before and after installation, refusal to overwrite a competing blob, semantic orphan invisibility, project/directory isolation, and CLI reconnection after a real client host exits. The host fixture stands in for Theia; it does not qualify a bundled workbench UI.

The IV5-6 latency harness now uses one owner and shared clients. Victims retain client process leases for recovery checks. Its kill observer is read-only, and an owner initializes the schema before observation. Earlier embedded-host evidence remains historical.

The durability claim is unclean process termination on the recorded local filesystem. Power loss, OS crashes, live cloud sync, removable media, hosted storage, migrations, outbox delivery and a full research-study release remain unqualified. The archived N2 sources are reference material, not imported implementation or transferred qualification.
