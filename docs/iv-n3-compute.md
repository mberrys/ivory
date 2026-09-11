# N3 v2 - Governed computation and publication

N3 v2 is an experimental proof harness for the local Compute boundary. It
answers a narrow question: can one captured table be processed by a bounded
runtime while the semantic execution protocol fences stale attempts, survives
interruption, and lets Core publish at most one current result?

The semantic protocol and the isolation adapter are separate decisions. N3
retains attempt identity, cancellation, staged outputs, digest verification,
and Core-only publication as the protocol. OCI/container technology is only the
current runtime adapter.

This is evidence tooling, not a production Compute adapter. It does not change
the existing IV-14 execution API or claim that any operating system is
supported.

## Status

**V1 gate — runtime qualification open.** N3 is one of the V1 architectural
spikes and its runtime qualification is what unlocks the Compute runtime
adapter, the supported pilot OS, the capability profile, and the production
publication state machine. The canonical V1 plan records the current state as
*"Semantic execution protocol pass. Runtime qualification open"*, lists the
isolation runtime/platform as **OPEN—GATED N3**, and states the consequence
plainly: *"Core ResultEnvelope acceptance can proceed; production runtime
shipping cannot."*

Authority:

- `Ivory Tower V1 High-Level Architecture and Implementation Plan`
  (Notion, 4 September 2026, Architecture V2 update 8 September 2026),
  mirrored as the Linear document `Architectural spikes N1–N7` (project
  *Ivory*).

What is proven today is the semantic execution protocol — the fault-injection
matrix and `npm.cmd run verify:ivory-n3 -- --protocol-only`. The OCI runtime
gate is **not** proven until a retained record exists at
[`docs/experiments/n3-evidence.json`](experiments/n3-evidence.json). See
[Decision boundary](#decision-boundary) for the exact remaining list, and
[Supported platform](#supported-platform) before claiming any OS is supported.

Do not defer N3 to a later release without amending the V1 plan first. An
earlier revision of this file declared N3 deferred past 1.0 and claimed it did
"not block the current 1.0 scope"; no repository, Notion, or Linear authority
supports that claim, and it is why this section now names its source.

## Retained v2 evidence

Each invocation writes `artifacts/n3/evidence.json` unless an alternate
`--artifact-root` is supplied. The record is versioned and includes:

- the experiment and contract versions, repository commit, exact invocation,
  platform/hardware/runtime versions, and fixture digests;
- the declared result and container contracts, including all configured limits;
- lifecycle observations, restart recovery and cancellation timings, runtime
  observations, publication state, and hashed raw logs;
- explicit acceptance observations, pass/fail criteria, the resulting
  architecture decision, and unresolved limitations.

Required acceptance failures retain the evidence bundle and return non-zero.
Boolean fields in the evidence are observations, not a successful
verification by themselves. A protocol-only record is not OCI runtime proof.

## Run the protocol checks

The fault-injection matrix is independent of Docker and runs on every platform:

```powershell
npm.cmd run test:ivory-n3
npm.cmd run verify:ivory-n3 -- --protocol-only
```

It reopens the durable state store after separate Core and supervisor workers
exit at creation, start, publish, artifact-write, and completion boundaries.
It also checks two clients sharing one intent, cancellation racing
publication, and a late result from an obsolete attempt. The state transitions
are:

```text
queued -> running -> publishing -> succeeded
   |         |           |
cancelled  cancelled   cancelled
```

Only the current attempt may enter `publishing` or commit `succeeded`. A crash
after the artifact rename is recoverable only when its expected digest matches;
a stale or cancelled attempt cannot commit or leave an artifact.

## Run the OCI proof

The image must be supplied as an immutable digest. A tag alone is rejected:

```powershell
$env:IVORY_N3_PYTHON_IMAGE = 'python:3.12-slim@sha256:<64-hex-digest>'
npm.cmd run verify:ivory-n3 -- --interrupt-publication
```

The Python fixture runs once with hostile canaries and once with a valid result.
The container is configured with:

| Control | Enforced setting |
| --- | --- |
| Network | `--network none` |
| Root filesystem | `--read-only` |
| Privileges | numeric unprivileged user, `--cap-drop ALL`, `no-new-privileges` |
| Processes | `--pids-limit 64` |
| Resources | 256 MiB, one CPU, 256 file descriptors, 1 KiB file-size limit |
| Filesystem | `/var/tmp` is the read-only input bind; `/tmp` is the only writable bind; `/dev/shm` is a small `noexec` tmpfs |
| Supervisor output | 64 KiB captured-output ceiling followed by forced container removal |

The hostile fixture attempts a canonical input write, a symlink/path escape,
host-home access, network egress, a process escape, and excessive output. The
valid fixture emits the declared exact result object `{mean,rowCount,sum}`.
The supervisor accepts only a bounded JSON regular file; symlinks, special
files, oversized output, extra keys, and invalid numeric values are rejected.

The evidence records Docker-inspected controls, input hashes before and after,
canary outcomes, child termination, publication recovery, idempotency, attempt
fencing, result validation, and raw stdout/stderr digests. If Docker is
unavailable, the command writes the protocol evidence and an explicit runtime
limitation, then exits with status 2; that is not OCI qualification.

## R language repeat

The protocol is language-neutral only after the same run is repeated with a
small R image containing `Rscript`:

```powershell
$env:IVORY_N3_R_IMAGE = 'r-base:<version>@sha256:<64-hex-digest>'
npm.cmd run verify:ivory-n3 -- --language r --interrupt-publication
```

Use a separate artifact root when retaining Python and R records from the same
qualification session. The R run uses the same captured CSV, read-only input
mount, exact result contract, publication store, cancellation/fencing rules,
and digest evidence. Python success alone does not unlock an R-capable adapter.

## Supported platform

The pilot platform is **not yet decided**. Evidence collected on Windows 11 x64
with Docker Desktop (Linux containers) proves the protocol and the declared
controls on that platform; it does not qualify macOS or Linux.

The canonical V1 plan's default pilot target is macOS on Apple Silicon with a
maintained local container runtime, subject to Phase 0 cohort confirmation, and
it states that other operating systems gain support "through the same evidence,
not assertion".

Until the retained record carries a `supportMatrix` decision, every platform
stays unqualified. Reporting Windows evidence as macOS support, or as a
support-matrix decision, is a release-blocking misstatement.

## Decision boundary

N3 remains open until a retained qualification record contains:

- denied required canaries, unchanged input bytes, terminated children, and
  runtime-inspected controls rather than configuration intent;
- one terminal cancellation/publication outcome, one artifact per attempt, and
  recovery after publication interruption;
- independent Python and R results under the same protocol, with restart and
  cancellation observations retained.

Until those records exist, the supported OS, capability profile, runtime
adapter, and production publication state machine remain decisions unlocked by
N3 rather than decisions made by this prototype.
