# ADR-005 — Select PGlite 0.3.16 as the single local V1 engine

Status: accepted (2026-09-13). Amends ADR-002 §"Decision" (database row) for the local V1 profile.
Evidence: `docs/experiments/n2-v2-evidence.json` (`7ed5b5f0`), `spikes/n2-durable-store/**`.

## Context

ADR-002 chose PostgreSQL + pgvector + S3 + Graphile Worker for the hosted V1 topology, and the
repository already runs that stack (`postgres-execution-store`, `graphile-worker-adapter`,
`s3-object-store`, `ivory-migrate`). The N2 spike answers the *local single-writer* question and reports
`protocol-pass-engine-decision-provisional` with `engine: pglite`, `automatedPass: true`, 1 000/1 000
interruption cycles with no failed cycle, eight fault points exercised, one semantic effect per
idempotency key, no visible reference to an uninstalled blob, a physical 10 GiB CAS admission, and
1 000 documents / 100 000 annotations inside the declared latency budgets. The SQLite comparison is
deliberately not triggered because PGlite passed its integrity gate.

## Decision

1. **PGlite 0.3.16** (`@electric-sql/pglite`, NodeFS `dataDir` = `.ivory/store/`,
   `relaxedDurability: false`) is the single local V1 engine. No dual-engine production abstraction.
2. Acknowledgement order is part of the contract: **admitted blob → one SQL transaction** containing
   revisions, heads, activity, receipt, `blob_refs`, outbox and project sequence. An admitted but
   unreferenced blob is recoverable garbage.
3. One writer per project, enforced by the exclusive `.ivory/local/writer.lock` (steal only a dead pid).
   Notification outbox is at-least-once and is never a source of truth.
4. Migrations are forward-only SQL files, one transaction per file, applied under the writer lock;
   interrupted migration resumes the remaining files. Immutable payload hashes are never rewritten.
5. Backup = writer lock + `CHECKPOINT` + data-directory dump + pinned blob closure; restore is into a
   fresh path and must pass a semantic readback.
6. **Tested durability envelope (claim no more than this):** unclean process termination
   (`process.abort()` plus `taskkill /F`/`SIGKILL`) of a Node process using PGlite NodeFS on NTFS,
   followed by reopen, on the recorded reference machine. Not claimed: hardware power loss, removable
   drive removal, firmware crash, live cloud-drive sync of an open store, cross-platform equivalence.
7. **Coexistence with ADR-002, and the open profile choice.** PGlite 0.3.16 serves the local
   single-writer profile. The hosted/self-hosted PostgreSQL + pgvector + S3/MinIO + Graphile Worker
   topology of ADR-002 is not superseded: it remains the deployable topology selected per
   `configs/ivory-deployment-profiles.json`, and repository code (`postgres-execution-store`,
   `graphile-worker-adapter`, `s3-object-store`, `ivory-migrate`) keeps running it. Both topologies sit
   behind the same port, promoted to `packages/ivory-tower-contracts/src/durable-store-port.ts`: the
   local engine is one implementation of that port, the Postgres stack is another. Which deployment
   profile V1 actually ships is a product decision, not an experiment result — recorded here as an
   **owner decision that remains open**, and this ADR does not settle it.

## Consequences

- `decision.architectureStatus` in the N2 record moves to `engine-decided` when the record is refreshed
  with the accepted decision (a separate change; this ADR alone does not flip the record).
- Any change to snapshot/closure semantics must re-run
  `npm run verify:ivory-n2-v2 -- --cycles 1000 --skip-tests` and record the new `snapshotMs`
  (ADR-003 §"Constraint: snapshot closure cost").
- The spike directory stays frozen after the port promotion; production code does not import `spikes/`.
