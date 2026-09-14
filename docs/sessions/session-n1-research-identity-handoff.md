# N1 Research Identity Handoff

## Objective completed

Built the headless `@ivory-tower/research-kernel` reference implementation and advising-agency
fixture. The tests prove immutable object revisions, exact references, IV-17 source/passage and
artifact attachments, explicit carry-forward, semantic-only snapshot closure, competing claim
attribution, and deterministic parity through two thin clients.

## Canonical commit / branch

Working tree handoff on branch `n1-v4`; no commit or push was requested.

## Files changed

- `packages/ivory-tower-research-kernel/` — package, kernel, clients, fixture, protocol, and tests.
- `scripts/check-ivory-boundaries.mjs` — research-kernel layer with the sole `@theia/ivory-identity`
  exception.
- `configs/ivory-dependency-policy.json` — inventory entry for the identity dependency.
- `docs/n1-research-identity.md` — decision record.

## Tests and commands run

Passed on 2026-09-07:

- `npx lerna run compile --scope @ivory-tower/research-kernel --stream`
- `npx lerna run test --scope @ivory-tower/research-kernel --stream` — 7 passing
- `npm run --workspace @ivory-tower/research-kernel lint`
- `node scripts/check-ivory-boundaries.mjs`
- `node scripts/check-ivory-dependency-policy.mjs`
- `npx prettier@3.6.2 --config configs/ivory-prettier.json --check ...`
- `git diff --check`

The exact `npm run check:ivory-boundaries` wrapper could not start in this environment because
the npm launcher referenced a missing global `npm-cli.js`; its underlying checker passed directly.

## Evidence produced

The golden fixture creates S1 and S2 and exposes `explainClaim` output plus the protocol rubric.
The focused test suite is green; formatting, lint, boundary, and dependency-policy checks are
green.

## Acceptance criteria passed

The implementation and focused machine evidence are complete. The human three-researcher gate
remains open by design.

## Acceptance criteria still open

The three-researcher human validation gate is intentionally open. N2 persistence, N3 isolation,
N4 PDF/OCR anchors, N5 UI, and full IV-16 persistence remain out of scope.

## Known regressions / risks

The kernel is an in-memory reference model. Its canonicalizer is deliberately limited to the
JSON-shaped data used here and is not a general persistence serializer.

## Decisions made

Competing interpretations remain parallel claims; provenance edges stay outside the revision hash;
carry-forward is explicit; no confidence score is stored.

## Do not assume

Do not treat the proposal mapping as an IV-16 schema freeze or the protocol as evidence that three
researchers have completed the exercise.

## Exact prerequisite for next session

Run the focused package test and boundary check on a clean dependency installation, then review
the decision record before mapping the primitive to N2 persistence.

## Recommended next session

N2 persistence spike: map the proven revision and snapshot contracts onto a durable store without
changing their exact-reference or semantic-closure behavior.
