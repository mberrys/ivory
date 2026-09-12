# ADR-002: V1 runtime topology and repository architecture

**Status:** Accepted  
**Date:** 2026-08-02  
**Issue:** [IV-14](https://app.notion.com/p/3b09cb079ddb81089f9cee6413df7b33)  
**Supersedes:** The remaining open questions in ADR-001 §6

## Context

Ivory Tower must support a hosted web V1 while preserving a local-first desktop
profile immediately afterward. The product domain, provenance chain, policy
checks, and execution state must remain independent of Theia, providers,
Docling, PostgreSQL, and object-storage implementations.

## Decision

V1 uses a portable container topology with these independently testable
process boundaries:

```text
Theia browser workbench
  -> ivory-api (versioned REST + replayable SSE)
     -> PostgreSQL + pgvector (canonical state and rebuildable indexes)
     -> S3-compatible object store (immutable source and conversion bytes)
     -> Graphile Worker queue schema
        -> ivory-worker (leases, fencing, retries, provider egress)
           -> private docling-serve HTTP port
           -> authorized AI provider adapters
```

- `@ivory-tower/contracts` owns versioned JSON schemas. `@ivory-tower/api`
  owns HTTP and SSE transport. `@ivory-tower/worker` owns background
  execution. Domain, application, and adapter packages remain framework-free.
- Commands require `Idempotency-Key`, persist an Ivory Tower execution, and
  return an execution ID. Status is read separately; events are replayable by
  sequence through SSE; cancellation is explicit.
- Graphile Worker is the PostgreSQL-backed queue adapter. The canonical
  execution row and its queue publication are created in one database
  transaction through the public `graphile_worker.add_job` function. Queue
  records are delivery mechanisms, not audit records. Ivory Tower owns
  attempts, lease tokens, fencing, failure classes, and terminal state.
- PostgreSQL owns canonical research objects, event history, audit records, and
  metadata. Object storage owns immutable source and lossless conversion
  bytes. Search indexes are replaceable and rebuildable. The local profile uses
  a filesystem object-store adapter with the same immutable contract.
- Upload limits, hashing, and safe-open admission happen in the API before
  canonical source commit or worker dispatch. Only the worker calls Docling or
  AI providers. `DoclingHttpConversionAdapter` sends per-job bytes to the
  private `/v1/convert/file` endpoint and receives lossless Markdown bytes plus
  normalized passages; it has no database or object-store credentials. Provider
  dispatch is represented by a typed port that always receives the shared
  project/content egress policy.
- `ivory-migrate` owns forward-only application migrations and then runs the
  queue-schema migration while workers are drained. API and worker readiness
  checks refuse incompatible schema versions.
- The upstream Theia fork remains unchanged as a source fork. V1 application
  manifests do not include plugin-host packages, plugin startup flags, or
  runtime installation paths. The immediately post-V1 local desktop target is
  Theia's Electron target; local PostgreSQL/pgvector, worker, filesystem
  storage, and Docling packaging are a follow-on compatibility gate.

## Boundary failure model

| Boundary | Retry | Permanent / degraded behavior |
|---|---|---|
| API → PostgreSQL | Retry only connection failures before commit | No traffic while readiness is false |
| API → object store | Retry idempotent writes by content hash | Admission denial leaves no canonical bytes |
| API → queue publication | Transaction rolls back with execution row | No `202` if durable dispatch cannot be committed |
| Worker → Docling | Timeout/5xx retry with backoff | Unsupported or limit-exceeded input fails permanently |
| Worker → provider | Retry provider transport/quota failures | Policy, consent, or capability denial is terminal |
| Worker lease → canonical commit | Heartbeat and requeue | Stale lease token cannot commit |
| API → client stream | Replay persisted events by sequence | Client reconnects through status and `Last-Event-ID` |

## Verification

The acceptance path is an integration test covering upload, admission,
conversion, indexing, retrieval, generation, validation, persistence, and SSE
streaming. Contract tests cover invalid versions, duplicate idempotency keys,
cancellation, replay, duplicate delivery, lease expiry, stale commits, policy
denial, provider denial, Docling failure, queue outage, migration mismatch, and
secret redaction.

### 2026-08-03 implementation and runtime evidence

- Baseline checkout: `5a0bd9af4` on `dev`. No final commit was created for this
  working-tree implementation, so this record does not claim a published
  commit.
- Ivory quality evidence: `npm.cmd run check:ivory-toolchain`,
  `npm.cmd run format:check:ivory-tower`, `node
  scripts/check-ivory-boundaries.mjs`, `npm.cmd run typecheck:ivory-tower`,
  `npm.cmd run lint:ivory-tower`, `npm.cmd run test:ivory-tower`,
  `npm.cmd run -s build:ivory-tower`, the isolated Playwright health test, and
  `npm.cmd run dependency:policy` passed. The Playwright run used
  `IVORY_BROWSER_PORT=3106` and passed in 6.6 seconds; its global teardown
  terminates the test-owned Theia process tree.
- Docling image pin: `quay.io/docling-project/docling-serve:v1.21.0@sha256:32b3de41f325f93c1dd35907cd9147fa35df9f7c5abc86eb2788b6bda7ce6d10`.
  The supported registry is Quay; a mirror must preserve the same immutable
  digest and be configured explicitly.
- The real multi-service proof command was
  `npm.cmd run -s verify:ivory-runtime -- --clean`. It stopped before startup
  with `Docker Desktop daemon is unavailable; IV-14 real runtime proof cannot
  run in this environment.` A direct Docker check also reported permission
  denied on `npipe:////./pipe/docker_engine`. Therefore the real
  upload-to-SSE path, Docling interruption/retry, lease fencing, stale-commit
  rejection, restart recovery, terminal failure, and cancellation evidence
  remain unexecuted here.
- The inherited Windows Electron compatibility gate
  (`npm.cmd run -s build:electron`) reached native dependency rebuild and
  failed because `node-gyp` could not find an installed Python runtime for
  `drivelist`. This is a pre-package environment failure, not evidence of an
  Ivory Windows product.

IV-14 remains **In Progress** until the Docker-backed path and recovery matrix
are run from a clean environment and the resulting commands, logs, image
digests, configuration, and final commit are attached here.

## Consequences

Hosted V1 is portable across OCI runtimes and standard PostgreSQL/S3-compatible
services. The local desktop profile is intentionally not a V1 release blocker;
remote conversion is never an implicit fallback and must pass the same egress
policy when enabled.
