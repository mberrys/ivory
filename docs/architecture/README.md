# Ivory V5 architecture record

The approved Ivory V5.0 architecture baseline, its source-head manifest, and the rules for recording evidence. Start here.

## Contents

| Path | Content |
| --- | --- |
| [v5-decision-package.md](v5-decision-package.md) | The decision package: reset findings (§0), decisions D1–D17 (§1), candidate architectures and interrogation dispositions (§21), rejected alternatives (§18), reopen triggers (§19), open owner decisions (§20). Rendered from Notion; the text is unedited. |
| [adr-009-v5-topology.md](adr-009-v5-topology.md) | ADR-009: library Core over one project directory (SQLite and content-addressed blobs), worker-thread store, local profile. |
| [adr-010-v5-typed-decision-seam.md](adr-010-v5-typed-decision-seam.md) | ADR-010: the typed decision seam is omitted from the V5.0 runtime, with a re-entry path and predicate. |
| [v5-qualification.md](v5-qualification.md) | The qualification ledger: reset gates, N1–N7 and J1–J9 status, slices 0–11, and the V5.0 release predicate. |
| [evidence-record.md](evidence-record.md) | The evidence record every later slice must produce. |
| [../reset/archive-source-manifest.json](../reset/archive-source-manifest.json) | The exact source-head and evidence manifest: pinned archive heads, blob counts, and the relocation record. |
| [../reset/](../reset/) | Reset evidence: project frame, branch reconciliation, integration disposition, baseline verification, experiment plan, lesson-to-carrier map. |
| [../archive-evidence/](../archive-evidence/) | Historical ADR-001 to ADR-008 and experiment texts, copied verbatim from the archive. |

## Pinned source

The ADRs, the ledger, `docs/reset/` and `docs/archive-evidence/` are copied verbatim from `integration/ivory-v5-reset-archive` at `df3a0a340`. The decision package is a Markdown rendering of the Notion page, pinned to that page's edit time (2026-09-29 02:25 UTC).

Three links in `archive-evidence/experiments/n1-v2-reference-kernel.md` point to files that were never imported (`n1-human-record.json`, `n1-reader-protocol.md`). The historical text keeps them as written.

To confirm that the copies match the pinned commit, run this in a clone that has it. It prints nothing when they match:

```bash
git diff df3a0a340 HEAD -- docs/architecture/adr-009-v5-topology.md docs/architecture/adr-010-v5-typed-decision-seam.md docs/architecture/v5-qualification.md docs/reset docs/archive-evidence
```

## Contract versions

| Version | Date | Source | Change |
| --- | --- | --- | --- |
| V5.0 baseline v1 | 2026-09-28 | `0e9e31341` | ADR-009 and ADR-010 accepted as the architecture baseline. The four-way interrogation revised the provisional baseline before acceptance (decision package §0, §1, §21). |

ADR-009 and ADR-010 have not changed since `0e9e31341`; `df3a0a340` confirms it. Each later contract change adds a row here. The row cites the trigger that justifies the change (an ADR reopen trigger or decision package §19) and links the record that supports it.

## Open items

These stay open. Accepting the design does not pass them.

- **Release gates** in `v5-qualification.md`: slices 0–11; J2, J3, J5, J6, J7, J8 (reduced) and J9 (reframed); the R1 licence and per-port proof for each slice; documentation that matches the selected head.
- **Owner confirmations** in decision package §20, still unchecked: accept SQLite and the embedded library (slice 1 is the bake-off, with PGlite plus a host process as the fallback); local-only V5.0; Docker Desktop as a pilot prerequisite; the agent pilot precondition, or prioritizing `webauthn-uv`; the seam omission in ADR-010.
- **Open and labelled, not blocking:** power-loss durability; independent-machine reproduction; live-provider agents; calibration and seam re-entry; heterogeneous-converter remap; the hosted profile.
- **Interrogation findings** are recorded at cluster level: 51 findings (5 critical, 34 major, 12 minor) in 24 clusters, each with a disposition (decision package §21). The per-finding IDs are in the four Notion review attachments and are not retained here.
