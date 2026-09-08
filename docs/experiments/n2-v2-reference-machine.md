# N2 V2 reference-machine qualification

Status: protocol pass; engine decision provisional. The retained record is
[`n2-v2-evidence.json`](./n2-v2-evidence.json).

## Question and boundary

Can the bounded PGlite durable-store protocol preserve acknowledged semantic
commits across process interruption, admit immutable blobs before semantic
acknowledgement, round-trip a semantic export, and meet the V2 ordinary
metadata, search, and unchanged-snapshot budgets on the recorded reference
machine?

This remains a disposable reference implementation behind the narrow storage
port. It does not establish a filesystem/database two-phase commit, a second
production engine, hardware power-loss durability, or a cross-platform support
claim.

## V2 changes from the original spike

- Snapshot closure orders by the indexed `heads.object_id` rather than the
  joined revision column. The former produced a pathological PGlite plan at
  100,000 members; the latter keeps the measured snapshot within the budget.
- Snapshot member manifests are retained in a text projection with a forward
  migration. The legacy JSONB column remains for compatibility during this
  spike transition.
- Semantic import now restores snapshot rows and their retained member
  manifests, with an explicit test covering the round trip.
- The V2 evidence wrapper records the repository commit, platform/runtime,
  fixture file digests, exact command/configuration, raw-artifact digest,
  measured observations, criteria, decision, and limitations.

## Qualification command

Install the isolated spike dependency once:

```powershell
npm.cmd ci --prefix spikes/n2-durable-store
```

Run the full V2 qualification:

```powershell
npm.cmd run verify:ivory-n2-v2 -- --cycles 1000
```

The wrapper invokes the existing 18-test harness, the 1,000 process-abort /
reopen cycles, semantic export/import, and the required scale fixture of
1,000 documents, 100,000 annotations, and 10 GB of externally stored
material. It writes the ignored raw artifact at `artifacts/n2/evidence.json`
and the retained V2 record at `docs/experiments/n2-v2-evidence.json`.

Use `--record-only` only to rebuild the retained record from an already
completed raw verifier artifact; it does not substitute for the qualification
run.

## Declared criteria

The run passes only when all of the following are observed:

- at least 1,000 interruption/reopen cycles across blob admission, database
  commit, outbox delivery, and output publication transitions;
- no acknowledged commit is lost, no idempotency key creates two semantic
  effects, and no visible revision references an uninstalled blob;
- semantic export/import preserves retained records, snapshot member
  manifests, and blob hashes;
- metadata p95 is below 200 ms, source search is below one second, and an
  unchanged snapshot is below two seconds at the required scale;
- startup and memory observations are present in the retained record.

## Decision and limitations

The recorded Windows reference-machine run passes the automated criteria with
PGlite 0.3.16 and `relaxedDurability: false`. PGlite remains the provisional
engine candidate; SQLite was not compared because the PGlite integrity gate
passed, and production persistence still waits for architecture-owner engine
sign-off.

The tested durability envelope is unclean Node process termination followed by
reopen on Windows NTFS. The 10 GB fixture is sparse, so it measures the
metadata/search/snapshot path rather than a physical 10 GB copy. The result is
one reference-machine observation, not a universal platform or power-loss
claim.
