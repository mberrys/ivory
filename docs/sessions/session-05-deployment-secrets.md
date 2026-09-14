# Session 05 — Deployment, configuration, and secret management

**Primary owner:** IV-22 (Define deployment, configuration, and secret-management contract)
**Gate:** 0 — Canonical executable baseline
**Branch:** `cursor/session-05-deployment-secrets-9419`, atop Session 04
(`origin/cursor/session-04-runtime-migrations-9419` @ `2a181b917`) because PR #29 was not an
ancestor of `origin/stable` at execution. PR base remains `stable`.

## Scope delivered

- Added `configs/ivory-deployment-profiles.json` and `validateIvoryDeploymentProfile`, wired into
  the existing `validateIvoryTowerEnvironment` fail-closed startup path. Local may use filesystem
  or S3 and may use documented local defaults. Staging and production require S3-compatible storage
  and reject `ivory` / `ivory-development-only` / `postgres://ivory:ivory@`.
- Replaced the boolean `/health/ready` body with `evaluateIvoryReadiness`: postgres, schema, queue,
  object-store (`stat` or `HeadBucket`), and a Docling slot that the API marks `skipped`. HTTP 200
  for `ready`/`degraded`, 503 for `unavailable`.
- Extracted a shared redactor used by Sentry, `logIvoryError` on API/worker startup failures, and
  adversarial tests for logs and HTTP 500 bodies. The IV-19 repository scan is unchanged in spirit
  and now points at this contract for runtime breadth.
- Asserted the structured ready payload from `scripts/verify-ivory-runtime.mjs` so the existing
  Ubuntu Session 04 runtime job is Session 05's Docker evidence. No second Compose job.

The Playwright health view was not changed: it still uses `fetch(.../health/ready).ok`.

## Evidence boundary

Package tests prove profile rejection, structured ready statuses, and redaction. Docker proof is
the existing `Runtime and migration recovery (Session 04)` job after the ready-payload assertion.

Recorded on [run 33196186623](https://github.com/mberrys/ivory-tower/actions/runs/33196186623)
(`b992489e4`): verify Ubuntu/Windows, governance, and runtime job 98936599351 all succeeded.
The runtime log records the IV-14 happy path after that assertion (execution
`f1f68df9-5375-49f2-9887-d566eb93c65e`).

See [IV-22](../iv-22-deployment-secrets.md) for the operational contract and
[the handoff](session-05-handoff.md) for commands, CI, and remaining gaps.
