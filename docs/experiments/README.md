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
