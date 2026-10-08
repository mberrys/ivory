# ADR-009: Ivory V5.0 topology — library Core over one project directory

**Status:** Accepted as the V5.0 architecture baseline (2026-09-28). Release gates remain open; see `v5-qualification.md`.
**Decision page:** [Ivory V5.0 Architecture](https://app.notion.com/p/3e99cb079ddb8105aaabfa282dcda257) (§§1–9, 11–14). Arena and interrogation record: [V5.0 arena and interrogation record](https://app.notion.com/p/3e99cb079ddb8154a0b3e02b035bf606).
**Process:** four independent concurrent architecture candidates and four independent concurrent interrogations, per the Engineering Foundation standard.
**Amends:** ADR-001, ADR-004, ADR-005, ADR-006, ADR-007 (historical texts in `docs/archive-evidence/`). **Supersedes for V5:** ADR-002.

## Context

The reset (see `docs/reset/project-frame.md`) restored the Theia baseline and demoted the archived development line to evidence. N1–N7 left bounded contracts, not production code. The arena compared four whole shapes:

- a record-centered Core with a judgment adapter;
- a receipt-ledger Core;
- a deterministic Core with no classifier;
- an embedded library over a project directory.

Three of the four chose PGlite plus a Core daemon. That daemon, its discovery, its token and its dead-pid writer lock exist only because a PGlite data directory is owned by one process (ADR-005 §3). V5 must re-prove N2 on its own schema regardless, so PGlite's historical interruption evidence does not transfer.

## Decision

1. **Core is a framework-free library, `@ivory/core`.** It exposes typed `ResearcherSession`, `AgentSession` and `ReaderSession` objects and one `commit()` path. The Theia workbench backend, the `ivory` CLI and `ivory mcp` each embed it.
   - Every host runs the store in **one dedicated worker thread** that owns the write connection and serves a FIFO queue. The main thread only exchanges messages with it.
   - Commit handlers are synchronous by type. No `await` may occur between `BEGIN` and `COMMIT`.
2. **The store is SQLite via Node 24 `node:sqlite`** (WAL, `synchronous=FULL`, STRICT tables) in a self-describing project directory:
   - `ivory-project.json`
   - `store.sqlite`
   - `cas/sha256/…`
   - `leases/`
   - `runs/`

   The durability claim is process kill on local NTFS only.
3. **Records** are generic, schema-tagged, content-addressed revisions. `revisionId = canonicalDigest(preimage)`, and the preimage includes author, initiatedBy and origin. Each object has a linear history. Heads are stored behind a linearity trigger, and the commit log is hash-chained. Authority per kind is a fixed `AuthorOf` table, checked in types and in `commit()`.
4. **The commit protocol keeps ADR-005 §2's order:**
   1. Admit the CAS bytes (exists → verify → skip rename; directory fsync through an `r+` handle).
   2. `BEGIN IMMEDIATE`.
   3. Check the version/maintenance fence and idempotency, scoped by principal, key and request digest over *content*.
   4. Check heads, decision-key heads, grants, the presentation basis and blob presence.
   5. Insert, chaining the commit to its predecessor.
   6. `COMMIT` and acknowledge.
5. **Snapshots use basis expansion `claim-basis@1`.** Freezing a statement materializes its incoming evidence-link heads, their mechanical findings and the current decision-key heads as explicit members (ADR-004's "explicit context members"). Forward closure then runs over all members. Decisions that reference a snapshot are attestations about it, not members.
6. **Decisions are researcher-only and attested.**
   - They are keyed by `DecisionKey` = (question, subject objectId, discriminator).
   - A decision is current only while its subject revision is current.
   - Narrowing is one command.
   - The presentation fence is a digest over exact refs: no sequence numbers, no clock.
   - The attestation level is `workbench-gesture`, `cli-tty` or `unattested`, with `webauthn-uv` reserved.
   - CLI authority commands require a TTY and a typed digest prefix.
7. **Release** is `releasePredicate@1`: a pure function over snapshot members plus attestations, with an enumerated blocker union. It is evaluated inside the `claim-acceptance` commit and again at export. Each verdict is stored as a receipt.
8. **Liveness without a daemon.**
   - Each process holds `leases/<processId>.sqlite` in `BEGIN EXCLUSIVE` for its whole lifetime; the OS releases it when the process dies.
   - Out-of-transaction work is tagged with its lease.
   - `recover` and GC act only on dead leases.
   - Orphaned containers are re-adopted by label behind the attempt fence.
9. **Migration.**
   1. Commit a `meta.maintenance` sentinel. Every library version refuses reads and writes while it is set.
   2. Back up via `backup()`.
   3. Apply the whole chain in one transaction.
   4. Clear the sentinel.

   Each commit records `library_build`. DTO digests include the DTO schema and Core version.
10. **Compute** has one OCI provider.
    - The RunSpec is immutable and pinned by digest. `egress:'none'` is the only value.
    - Unsupported controls refuse the run before start; there is no native fallback.
    - `/ivory/out` is a size-capped tmpfs, copied out with `docker cp`. Only regular files are admitted.
    - Output rights are the most restrictive rights of the inputs.
11. **Agents** are external MCP clients of `ivory mcp`, which constructs only an `AgentSession`.
    - Disclosures are reserve-then-serve, with budgets enforced inside the transaction.
    - Rights are effective and monotone.
    - Adopted content records `origin.adopted` (drafter, edited).
    - Grants are a cooperation contract, not isolation. The V5.0 pilot requires an agent host with no shell or file access to the project directory and no access to the workbench port.
12. **Theia** remains the workbench under an additive-only fence: no edits to upstream-owned files, checked in CI.
    - Bind `127.0.0.1` and set `THEIA_HOSTS`.
    - The Ivory WebSocket validator requires a launch secret.
    - The filesystem provider refuses project directories.
    - `/services/ivory` is a catalog facade.
    - The app is an allow-list that excludes `@theia/ai-*`, `plugin-ext*` and `vsx-registry`. Electron is deferred.
13. **Profile:** local, single-researcher. The hosted topology of ADR-002 is deferred and not abstracted over.
14. **One format** serves the live store, backups and capsules.
    - A capsule holds the basis-expanded members, their attestations, a recorded verdict and a chain anchor, and is checked by its own verify profile.
    - The Python stdlib plus `ivory_contracts` can verify it independently.
    - Redaction deletes bytes but keeps digests, and `verify` treats a redacted blob as legal.
15. **Branches:** Ivory PRs target `dev`. `master` mirrors upstream Theia.

## Consequences

- **Packages:** `@ivory/contracts` (exists), `@ivory/core`, `@ivory/cli`, `@ivory/workbench`, and the app `examples/ivory-browser`. Only `@ivory/workbench` uses Theia DI. `@ivory/core` is deliberately not rebindable, because it defines authority.
- **`verify`** detects corruption, not impersonation. The chain is unkeyed, so a same-user process can forge surface-asserted attestations. This limit is stated and not hidden.
- **Slice 1 is a bake-off.** Its exit criteria:
  - the workbench-shaped process keeps `monitorEventLoopDelay` p99 under 100 ms while the CLI holds 3 s transactions and a scripted agent reads at 10 Hz;
  - no phantom `seq` is ever observed;
  - leases never let `recover` kill live work;
  - the kill harness proves ordering, backed by a `synchronous=OFF` control.

## Rejected alternatives

- **A Core daemon as the authority boundary.** A same-user token file gives it no more protection. It is kept as the fallback.
- **PGlite 0.3.16.** It is single-process by construction and its data directory is not an archival format. It is kept as the fallback engine.
- **A pure event-sourced ledger with lazily derived heads.**
- **Hosted or dual-topology ports.**
- **Theia AI as the agent harness.**
- **A Core-owned model gateway.** It is deferred until a first-party harness exists.

## Reopen triggers

- **Slice 1 misses its exit criteria.** Move the same library into a single host process over PGlite. A new four-way interrogation of that fallback is required first.
- **A `node:sqlite` API break.** Pin the Node minor version, or switch to `better-sqlite3` over the same file format.
- **A multi-user or hosted requirement signed by the owner.** Start a new architecture round.
- **Shell-capable agents are required.** `webauthn-uv` becomes blocking.
- **An upstream Theia file edit becomes necessary.**
