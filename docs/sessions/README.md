# Session execution record

This directory is the in-repo record of the **AI coding-agent sessions** that build Ivory Tower's
V1. Each session is one bounded execution objective drawn from the V1 roadmap; this tree records
what each session actually did, so the repository — not a planning tool — remains the authoritative
account of progress.

## Governing sources

- **Session plan (sequencing):** the "Ivory Tower — AI Agent Session Plan — V1 Roadmap" Notion
  page splits the roadmap into sessions gated **0 → 1 → 2 → 3**.
- **Critical path (priority):** `../v1-build-vs-open-source.md` (repository map + non-negotiable
  release gates) and the audit-aligned critical path in the Notion tracker.
- **Issue detail (requirements/acceptance):** the Notion `IV-#` issue bodies. This repo references
  work by issue ID; it does not duplicate acceptance criteria.

The Notion tracker sequences and specifies work. It does **not** substitute for repository evidence.

## Operating rules (enforced here)

1. **One session = one bounded objective.** A session does not opportunistically expand into later
   gates.
2. **Repository evidence is authoritative.** A Notion plan, or a doc that says "complete", is not
   implementation evidence. Code, tests, and reproducible artifacts are.
3. **Do not advance a gate on prose.** A session closes only with code/tests/artifacts, or an
   explicit documented blocker.
4. **Every session writes a handoff.** Use `HANDOFF_TEMPLATE.md`. The handoff records files
   changed, commands run, evidence produced, unresolved gaps, regressions, and the exact
   prerequisite for the next session.
5. **No broad feature work before Gate 0 + Gate 1 exit.**

## Files

- `HANDOFF_TEMPLATE.md` — the required handoff skeleton; copy it per session.
- `session-NN-*.md` — per-session report and/or handoff (e.g. `session-01-canonical-reconciliation.md`,
  `session-01-handoff.md`).

## Numbering and repairs

Sessions are numbered `01`, `02`, …. When a verification session fails, insert a **targeted repair
session** between the failing session and the next number, named `Session 12A`, `12B`, etc. — do
not renumber the plan. A repair session contains only: failing evidence, suspected ownership
boundary, minimal fix scope, regression tests, and the exact evidence to rerun.

## Delivery-evidence states

Every roadmap issue carries a delivery-evidence state, used in these reports so a "done" doc is
never mistaken for shipped code:

`unimplemented` → `implemented-local` → `canonical` (present at the canonical commit) →
`verified-release` (proven from the release commit).
