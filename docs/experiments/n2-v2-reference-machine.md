# N2 V2 reference-machine qualification

Status: **not a protocol pass**. The retained wrap is
[`n2-v2-evidence.json`](./n2-v2-evidence.json). Historical Windows observations
are kept as observations only. `--record-only` cannot complete the verifier
gate; storm flags require per-cycle `results`; the 10 GiB fixture is a sparse
zero placeholder and fails `contentAddressedScaleProof`.

## Question and boundary

Can the bounded PGlite durable-store protocol preserve acknowledged semantic
commits across process interruption, admit immutable blobs before semantic
acknowledgement, round-trip a semantic export, and meet the V2 ordinary
metadata, search, and unchanged-snapshot budgets on the recorded reference
machine?

This remains a disposable reference implementation behind the narrow storage
port. It does not establish a filesystem/database two-phase commit, a second
production engine, hardware power-loss durability, a cross-platform support
claim, or a 10 GB content-addressed scale proof.

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
- `--record-only` records `verifierCompleted` as skipped and refuses
  `automatedPass`. Storm criteria recompute from `interruptStorm.results`.
  Sparse zeros are a failing `contentAddressedScaleProof` criterion, not a
  CAS scale pass.

## Qualification command

Install the isolated spike dependency once:

```powershell
npm.cmd ci --prefix spikes/n2-durable-store
```

Run the full V2 qualification:

```powershell
npm.cmd run verify:ivory-n2-v2 -- --cycles 1000
```

The wrapper invokes the existing test harness, the 1,000 process-abort /
reopen cycles, semantic export/import, and the scale fixture of 1,000
documents, 100,000 annotations, plus a sparse 10 GiB zero-file placeholder
(not a CAS admission). It writes the ignored raw artifact at
`artifacts/n2/evidence.json` and the retained V2 record at
`docs/experiments/n2-v2-evidence.json`.

`--record-only` rebuilds the retained JSON from an existing raw artifact. It
does not run the verifier, cannot set `verifierCompleted.pass`, cannot set
`automatedPass: true`, and exits non-zero. It is not a qualification run.

## Declared criteria

A qualification claim passes only when all of the following are observed
in the criteria object (not merely in limitations prose):

- the live verifier process ran and exited 0 (`--record-only` cannot satisfy
  this);
- at least 1,000 interruption/reopen **results** (not a claimed cycle count);
- storm flags computed from those results: no acknowledged commit lost, one
  semantic effect per idempotency key, no visible uninstalled blob, and the
  child actually exited before reopen;
- semantic export/import measured on this run;
- metadata p95 below 200 ms, source search below one second, and an unchanged
  snapshot below two seconds, measured on this run;
- startup and memory observations present;
- `contentAddressedScaleProof` is a real CAS admission of the configured
  large blob. The current sparse `sha256(zeros)` placeholder **fails** this
  criterion.

## Decision and limitations

The retained wrap is incomplete: it does not claim protocol pass. PGlite
remains an engine candidate only where integrity was actually measured; the
sparse 10 GiB file is not a content-addressed scale proof. Production
persistence still waits for architecture-owner engine sign-off.

The tested durability envelope is unclean Node process termination followed by
reopen. Interrupt wait must not proceed while the child is still alive. The
result is one machine observation, not a universal platform or power-loss
claim.
