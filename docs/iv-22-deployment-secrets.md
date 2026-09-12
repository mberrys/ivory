# IV-22 — Deployment, configuration, and secret-management contract

## Contract

Local, staging, and production are a checked profile contract, not a boolean environment flag.
Secrets stay environment-injected. There is no Vault or KMS product in V1. Startup fails closed
when a profile's required keys, storage mode, or known local defaults are wrong. `/health/ready`
reports per-dependency checks. Process logs, HTTP 500 bodies, Sentry events, and audit-shaped
payloads share one redactor.

This contract does **not** close Gate 0. Sessions 01–06 together own that gate. It does **not**
start Session 06 / IV-128.

## Deployment profiles

The machine-readable manifest is `configs/ivory-deployment-profiles.json`. The same values live in
`IVORY_DEPLOYMENT_PROFILES` and are applied by `validateIvoryTowerEnvironment` after the existing
role, database, S3 pair, topology, and Docling-digest checks.

| Profile | Storage | Secrets | Notes |
|---|---|---|---|
| `local` | filesystem **or** S3-compatible | local defaults allowed (`ivory` / `ivory-development-only` / `postgres://ivory:ivory@`) | MinIO is local-dev/test only; AGPL-3.0 is recorded, not cleared |
| `staging` | S3-compatible required | both access keys required; known local defaults rejected | filesystem mode fails closed |
| `production` | S3-compatible required | both access keys required; known local defaults rejected | filesystem mode fails closed |

`IVORY_DEPLOYMENT_TOPOLOGY` (`vendorHosted` | `selfHosted`) remains a rights input. This contract
does not pick a hosted object-store vendor, a desktop wrapper, or a Kubernetes/Vercel shape.

Rejected local defaults are listed in the manifest as
`rejectedLocalSecretDefaults`. They are the values that must never leave a developer machine, not
credentials to copy into staging.

## Readiness

`/health/live` is a liveness ping (`{ "status": "ok" }`).

`/health/ready` is owned by `@ivory-tower/infrastructure` (`evaluateIvoryReadiness`) and returns:

```json
{
  "status": "ready | degraded | unavailable",
  "checks": [
    { "name": "postgres", "status": "ok | unavailable" },
    { "name": "schema", "status": "ok | unavailable" },
    { "name": "queue", "status": "ok | unavailable" },
    { "name": "objectStore", "status": "ok | unavailable" },
    { "name": "docling", "status": "ok | unavailable | skipped" }
  ]
}
```

| Check | Probe | Required for HTTP 200 |
|---|---|---|
| `postgres` | `SELECT 1` | yes |
| `schema` | `IVORY_RUNTIME_MIGRATIONS` ledger (`001`, `002`) | yes |
| `queue` | `graphile_worker.jobs` | yes |
| `objectStore` | filesystem `stat` of the object directory, or S3 `HeadBucket` on the existing client | yes |
| `docling` | HTTP check on the **worker** path only | no |

HTTP 200 when status is `ready` or `degraded`; HTTP 503 when status is `unavailable`. The API
startup path sets `includeDocling: false`, so a down Docling worker cannot flip the API to 503. A
later worker-side Docling probe can be represented as `degraded` without changing that HTTP rule.

The Playwright health view still uses `fetch(.../health/ready).ok` and displays
`Status: (ok|degraded|unavailable)`. Structured-body proof belongs to
`scripts/verify-ivory-runtime.mjs` on the existing Ubuntu **Runtime and migration recovery** job.
There is no second Compose job for Session 05.

## Secret handling

IV-19 `npm run secret:scan` remains a **repository and build-output** scan. It does not cover
runtime logs. Runtime redaction is this contract.

`redactSecrets` / `redactText` / `logIvoryError` in `@ivory-tower/infrastructure` are the shared
helpers. They are used for:

- `console.error` and uncaught startup failures in API and worker `start.ts`
- Sentry `beforeSend`, breadcrumbs, and `captureIvoryException` context
- audit-shaped or error-context objects that include env, URLs, or source bytes

HTTP 500 bodies stay generic (`internal_error` / `The request could not be completed.`). Adversarial
tests fail if `DATABASE_URL` passwords, `ivory-development-only`, or `Bearer` tokens appear in
serialized logs or 500 bodies.

## Operating limits

- MinIO AGPL-3.0 is an unreviewed **licence** gap. Digest-pinning and this profile contract do not
  clear it. Do not replace MinIO locally in order to dodge the question, and do not treat local
  MinIO as a production object store.
- Do not invent a secret store. Inject secrets through the environment, fail closed at startup, and
  redact at the log/telemetry/error boundary.
- Do not claim the IV-19 scan covers runtime redaction.
