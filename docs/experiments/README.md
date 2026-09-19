# Spike evidence records

Every architectural spike (N1–N7) keeps two things: a hand-written document that explains the
experiment, and a machine-written evidence record that states what was observed.

## File conventions

| File | Owner | Meaning |
|---|---|---|
| `docs/experiments/<name>.md` | human | Boundary, contract under test, how to reproduce, decision, remaining work. First line is `**Status:** …`. |
| `docs/experiments/<name>-evidence.json` | the verifier | Observed result. Never hand-edited. |
| `docs/experiments/<name>-record.json` | human | Human observations (participants, onboarding, attestations). The verifier reads this file; it is never generated. |
| `artifacts/<n>/**` | the verifier | Raw artifacts, gitignored, bound to the retained record by sha256. |

## Rules

1. A spike is complete only when its evidence record is committed **and**
   `npm run verify:ivory-n-gates -- --require-closed <ids>` exits 0 (ADR-003 rule 6).
2. A document may not claim a gate is open while its record says closed. `n-gates.mjs` fails on that
   drift; the fix is to update the document, never to weaken the check.
3. Adding a spike means: an entry in `configs/ivory-n-gates.json`, a document with a `**Status:**`
   first line, a verifier under `scripts/`, and a record.
4. Record-only invocations (`retain:*`, `n-gates`) may never manufacture a pass. A passing
   qualification requires the real run.
5. Evidence that cannot be produced (no hardware, no network, no cohort) is recorded as
   `blocked`/`not-applicable` with the reason. It is never rounded up to a pass.

## Retained records

One row per retained record file currently in this directory. Records bind raw artifacts by
SHA-256; the raw-artifact folders (`n7-evidence/`, `n7-live-provider/`) are committed and cited
from the record that owns them.

| Record | Experiment | Kind |
|---|---|---|
| `n1-v2-evidence.json` | N1 | machine-written evidence |
| `n1-human-record.json` | N1 | human record (participant attestation) |
| `n1-reader-protocol.md` | N1 | protocol |
| `n1-v2-reference-kernel.md` | N1 | document |
| `n2-v2-evidence.json` | N2 | machine-written evidence |
| `n2-v2-reference-machine.md` | N2 | document |
| `n2-v2-storm-cycles.json` | N2 | raw artifact |
| `n3-evidence.json` | N3 | machine-written evidence |
| `n3-onboarding-protocol.md` | N3 | protocol |
| `n3-onboarding-record.json` | N3 | human record |
| `n4-v2-evidence.json` | N4 | machine-written evidence |
| `n4-v2-qualification.md` | N4 | document |
| `n6-evidence.json` | N6 | machine-written evidence |
| `n6-portable-reproduction.md` | N6 | document |
| `n6-researcher-study-kit.md` | N6 | protocol |
| `n7-v1-evidence.json` | N7 | machine-written evidence |
| `n7-scoped-agent-proposals.md` | N7 | document |
| `n7-canonicalization.md` | N7 | document (canonicalization decision) |
| `n7-evidence/build.log`, `n7-evidence/tests.log`, `n7-evidence/n1-regression.log` | N7 | raw command logs |
| `n7-evidence/transmissions.json` | N7 | recorded transmissions |
| `n7-live-provider/run.json` | N7 | machine-written live-provider record |
| `n7-live-provider/outgoing-body.txt` | N7 | raw artifact (exact transmitted bytes) |
| `n7-live-provider/response-body.json` | N7 | raw artifact (raw model response) |
