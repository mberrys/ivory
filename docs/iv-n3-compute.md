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

**V1 gate — runtime qualified on the recorded platform.** N3 is one of the V1
architectural spikes and its runtime qualification is what unlocks the Compute
runtime adapter, the supported pilot OS, the capability profile, and the
production publication state machine. The canonical V1 plan records the
requirement as the *"Semantic execution protocol pass"* plus a runtime
qualification that was still open when this experiment was written, lists the
isolation runtime/platform as **OPEN—GATED N3**, and states the consequence
plainly: *"Core ResultEnvelope acceptance can proceed; production runtime
shipping cannot."*

Authority:

- `Ivory Tower V1 High-Level Architecture and Implementation Plan`
  (Notion, 4 September 2026, Architecture V2 update 8 September 2026),
  mirrored as the Linear document `Architectural spikes N1–N7` (project
  *Ivory*).

What is proven today is the semantic execution protocol — the fault-injection
matrix and `npm.cmd run verify:ivory-n3 -- --protocol-only` — **and** the OCI
runtime gate, recorded in
[`docs/experiments/n3-evidence.json`](experiments/n3-evidence.json)
(`status: runtime-qualified`, Python and R, no failed acceptance checks,
cold-install and warm-launch measurements retained).

An implementation detail worth recording: the document must *stop* claiming the
runtime qualification is still open in the same commit that adds the retained
record. `scripts/ivory/n3-retained.spec.mjs` enforces that the two never
disagree — with no retained record it requires the document to state the gate is
open, and with one it validates the record's contents.

Do not defer N3 to a later release without amending the V1 plan first. An
earlier revision of this file declared N3 deferred past 1.0 and claimed it did
"not block the current 1.0 scope"; no repository, Notion, or Linear authority
supports that claim, and it is why this section now names its source.

## Retained v2 evidence

Each invocation writes `artifacts/n3/evidence.json` unless an alternate
`--artifact-root` is supplied. Generated output is gitignored; the retained,
sanitized copy of a qualification session lives in
[`docs/experiments/n3-evidence.json`](experiments/n3-evidence.json). The record
is versioned and includes:

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

Two observations exist because a canary that passes is not by itself evidence.
Each canary records a `basis` derived from the failing `errno`: an enforcement
basis (`read-only-filesystem`, `permission-denied`, `network-unreachable`, …) or
`absence`, meaning the resource was simply not reachable. The required canaries
— `canonical-file-write`, `path-symlink-escape`, `network-egress` — are accepted
only with an enforcement basis. A resolver failure
(`name-resolution-unavailable`) is recorded but **not** accepted, because "no
route" is the stronger claim.

`host-home-read` and `process-escape` are recorded escape probes: their basis may
be enforcement (on the Python image, `/root/.ssh/id_rsa` exists and is refused
with `permission-denied`) or `absence`. Neither is treated as proof on its own.
The enforcement claim for those threats is carried by `mountSurfaceMinimal`
(exactly two mounts, at the declared destinations, with the input read-only and
the output writable) and `noPrivilegedEscalation` (unprivileged user,
`--cap-drop ALL`, `no-new-privileges`, and no container socket mounted), both
read from `docker inspect` on the live container.

`childProcessesTerminated` is observed by inspecting the container **before**
removal and requires `State.Running === false` and `State.Pid === 0` after the
supervisor's kill. A container that disappears before it can be inspected fails
the check.

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

N3 is closed for **protocol semantics** and for the **OCI runtime proof on the
recorded platform**. What remains open, and what each item unlocks:

| Item | State | Unlocks |
| --- | --- | --- |
| Semantic execution protocol (fencing, cancellation, recovery, idempotency, publication) | **closed** | Core publication contract; N6a cross-boundary gate |
| OCI runtime controls observed as enforced (canaries, mount surface, privilege, termination) | **closed** on Windows 11 x64 + Docker Desktop (Linux containers) | runtime adapter choice: a replaceable OCI adapter |
| Python and R under one protocol | **closed**, language-neutral result verified in the retained record | language-neutral execution semantics |
| Cold-install and warm-launch measurements | **closed** on the recorded platform | provisioning cost for that platform |
| Supported pilot OS / support matrix | **open** — `supportMatrix: open-pending-onboarding` | which operating systems may ship as "supported" |
| Onboarding observation (provisional target: four of five users within 15 minutes) | **open** — protocol and record defined, no participants recorded yet | input to the support-matrix decision only |

`Open` items are not "failed". They are the reason every platform remains
unqualified and why the support matrix cannot be declared. Other operating
systems gain support through the same evidence, not assertion.

The onboarding step is executable as soon as five users are available: the
protocol is
[`docs/experiments/n3-onboarding-protocol.md`](experiments/n3-onboarding-protocol.md),
the record is
[`docs/experiments/n3-onboarding-record.json`](experiments/n3-onboarding-record.json),
and `npm.cmd run verify:ivory-n3-onboarding` reports `not-applicable` while the
record is empty. Filling the record and re-running
`npm.cmd run retain:ivory-n3 -- --python … --r … --onboarding <record>` is the
only thing that can move `supportMatrix` to `pilot-decided`, and
`scripts/ivory/n3-retained.spec.mjs` fails if the two files disagree.

### If Compute has genuinely moved out of V1

The alternative resolution is that Compute left V1 scope. That is a product
decision, not an experiment result, and it must be recorded **before** it is
reflected here:

1. Amend the V1 plan of record — the Notion page `Ivory Tower V1 High-Level
   Architecture and Implementation Plan` and the mirrored Linear document
   `Architectural spikes N1–N7` — so N3 and the isolation runtime/platform row
   no longer gate V1.
2. Only then change this document's status, citing that amendment by revision
   and date.

Until step 1 exists, this branch operates against the V1 requirement above. A
lower requirement recorded only in this repository file is not a decision.
