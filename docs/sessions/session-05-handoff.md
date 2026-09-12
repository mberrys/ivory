# Session 05 Handoff

## Objective completed

Deployment, configuration, and secret management (IV-22, Gate 0). Local / staging / production
profiles are a checked contract. `/health/ready` reports per-dependency checks instead of a single
boolean. Secrets cannot leak through process logs, generic HTTP 500 bodies, Sentry events, or
audit-shaped payloads. This does **not** close Gate 0 and does **not** start IV-128.

## Canonical commit / branch

Branch `cursor/session-05-deployment-secrets-9419`, atop Session 04
`origin/cursor/session-04-runtime-migrations-9419` @ `2a181b917` (PR #29 still open on `stable` at
execution). Implementation `0250381e4`, contract docs `b992489e4`. `origin/stable` was Session 03
@ `9030ac2` and did not contain Session 04.

## Files changed

**New:** `configs/ivory-deployment-profiles.json`,
`packages/ivory-tower-infrastructure/src/deployment-profiles.ts` (+ spec),
`packages/ivory-tower-infrastructure/src/runtime-readiness.ts` (+ spec),
`packages/ivory-tower-infrastructure/src/redact.ts` (+ spec),
`docs/iv-22-deployment-secrets.md`, `docs/sessions/session-05-deployment-secrets.md`, this handoff.

**Modified:** `packages/ivory-tower-infrastructure/src/{environment,index,sentry,filesystem-object-store,s3-object-store}.ts`,
`packages/ivory-tower-api/src/{api-server,start,package.spec}.ts`,
`packages/ivory-tower-worker/src/start.ts`, `scripts/verify-ivory-runtime.mjs`,
`configs/ivory-dependency-policy.json` (secret-scan allowlist for planted test URLs; IV-22 note),
`scripts/check-ivory-secrets.mjs` (boundary sentence), `docs/iv-19-dependency-governance.md`,
`docs/ivory-tower-development.md`.

No upstream Theia package was modified. `package-lock.json` was not rewritten. MinIO was not
replaced.

## Tests and commands run

- Infrastructure package tests — profiles, readiness, redaction, existing Sentry scrub via the
  shared helper
- API package tests — structured `/health/ready` 200/503 and generic HTTP 500 body
- `npx lerna run compile --scope @ivory-tower/api --scope @ivory-tower/worker --scope @ivory-tower/infrastructure --include-dependencies`
- `npm run secret:scan` — no credential findings; planted test URLs are allowlisted
- `npm run verify:ivory-tower` — local static gate green on this environment
- Docker proof is the existing Session 04 runtime job after `verify-ivory-runtime` asserts the
  ready payload. This environment has no Docker daemon.

`ivory-tower.yml` [run 33196186623](https://github.com/mberrys/ivory-tower/actions/runs/33196186623)
on `b992489e4` is green:

| Job | ID | Result |
|---|---|---|
| Verify (ubuntu-22.04) | 98933796899 | success |
| Verify (windows-2022) | 98933796778 | success |
| Dependency governance evidence (IV-19) | 98933797012 | success |
| Runtime and migration recovery (Session 04) | 98936599351 | success |

The runtime job logged `IV-14 happy path passed` for execution
`f1f68df9-5375-49f2-9887-d566eb93c65e` immediately after the structured `/health/ready` assertion
(postgres, schema, queue, and objectStore `ok`). A failed ready-payload check would have stopped
the job before that line.

A failing GitHub Advanced Security / Copilot Autofind check (`The requested model is not supported`)
and the 3-second GHAS `CodeQL` status are unrelated infrastructure failures, the same class Session
04 recorded, and are not Session 05 evidence. The CodeQL `Analyze (*)` jobs on run 33196184183
succeeded.

## Evidence produced

- Profile validator: local filesystem allowed; staging/production filesystem rejected; production
  rejects example MinIO/postgres credentials.
- Readiness: missing migration, missing queue table, and object-store probe failure → `unavailable`;
  Docling-only failure → `degraded` and not API-blocking.
- Redaction: planted `DATABASE_URL` passwords, `ivory-development-only`, and `Bearer` tokens are
  absent from serialized logs and HTTP 500 bodies.
- `secret:scan` / `sentinel-secret` still cover the repository; they do not claim runtime
  redaction.
- Ubuntu runtime job 98936599351: structured ready assertion held; IV-14 happy path execution
  `f1f68df9-5375-49f2-9887-d566eb93c65e`.

## Acceptance criteria passed

- Deployment profiles are a checked-in, fail-closed contract.
- `/health/ready` is a structured dependency report, not a boolean.
- Runtime redaction is shared across logs, Sentry, and audit-shaped payloads.
- API does not require Docling to be ready.
- Session 05 Docker evidence reuses the Session 04 Ubuntu runtime job.

## Acceptance criteria still open

- **Gate 0 is not closed.** Session 06 (IV-128 cutline manifest) is untouched.
- **MinIO AGPL-3.0 remains unreviewed.** This session recorded it as a local-dev-only limit and
  did not pick a hosted object-store vendor.
- **No Vault/KMS.** Secrets remain environment-injected.
- **Notion session-plan page** was not updated: Notion MCP is unauthenticated in this environment.

## Known regressions / risks

- Staging/production reject the documented local defaults even when S3 is configured. Operators
  must inject non-example credentials before those profiles will start.
- `/health/ready` without a readiness probe (unit tests that omit `readiness`) still returns 200
  with an empty check list. Production `start.ts` always supplies the probe.
- The health view still maps HTTP failure to `degraded` rather than reading the structured
  `status` field. That is unchanged on purpose.
- Secret-scan allowlist entries for planted test URLs are required; do not "clean" those fixtures
  by removing the passwords the redactor must prove it scrubs.

## Decisions made

- **Branch from Session 04, PR to `stable`.** Session 04 was not merged at execution.
- **No second Compose job.** `verify-ivory-runtime` now asserts postgres/schema/queue/objectStore
  `ok` and `status` in `{ready, degraded}`.
- **No AWS SDK addition.** Object-store probe reuses `HeadBucketCommand` on the existing client.
- **Docling is skipped on the API ready path.** Degraded Docling is representable later without
  flipping the API to 503.
- **Shared redactor, not a second Sentry-only scrubber.**

## Do not assume

- A green static gate does not prove HeadBucket against a live bucket; that is the runtime job.
- The IV-19 repository scan does not cover process logs or 500 bodies.
- Digest-pinned MinIO is not licence-cleared and is not a production object store.
- This session does not close Gate 0, start IV-128, choose a hosted bucket vendor, or introduce
  Vault/KMS.

## Exact prerequisite for next session

Merge this PR (and Session 04 PR #29, if it is still open) to `stable` after human review. Session
06 may assume the profile contract, structured `/health/ready`, and shared redactor as already
recorded on run 33196186623. If a later head on this branch turns the runtime job red because the
new ready payload assertion failed, the fix belongs to a Session 05 repair (`05A`), not to Session
06.

**Session 06 — IV-128 cutline:** produce the content-rights cutline manifest only. Do not reopen
deployment profiles, readiness probes, or redaction unless a Session 05 repair is required.

## Recommended next session

**Session 06 — Content-rights cutline (IV-128).** Do not start it until this branch's static matrix,
governance job, and Ubuntu runtime job are green, and do not treat that as Gate 0 closure.
