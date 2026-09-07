# N3 — Governed computation and publication

N3 is an experimental proof harness for the local Compute boundary. It answers a
narrow question: can one captured table be processed in an OCI container while
the supervisor enforces declared limits and publishes at most one current result
despite cancellation, retries, crashes, and stale attempts?

This is evidence tooling, not a production Compute adapter. It does not change
the existing IV-14 execution API or claim that any operating system is supported.

## Run the protocol checks

The fault-injection matrix is independent of Docker and runs on every platform:

```powershell
npm.cmd run test:ivory-n3
npm.cmd run verify:ivory-n3 -- --protocol-only
```

It recreates the durable state store after Core and supervisor interruptions at
creation, start, publish, artifact-write, and completion boundaries. It also
checks two clients sharing one intent, cancellation racing publication, and a
late result from an obsolete attempt. State transitions use an atomic JSON
replace and a deterministic artifact key:

```text
queued -> running -> publishing -> succeeded
   |         |           |
cancelled  cancelled   cancelled
```

Only the current attempt may enter `publishing` or commit `succeeded`. A crash
after the artifact rename is recoverable by digest; a stale or cancelled attempt
cannot commit and produces no artifact.

## Run the OCI proof

The image must be supplied as an immutable digest. Resolve the digest on the
pilot platform and record the complete reference in the evidence bundle; a tag
alone is rejected:

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
| Supervisor output | 64 KiB captured-output ceiling, followed by forced container removal |

The hostile fixture attempts a canonical input write, a symlink/path escape,
host-home access, network egress, a long-lived child process, and excessive
output. The valid fixture emits the same result shape used by the R probe.
Evidence is written to the ignored path `artifacts/n3/evidence.json` and includes
the resolved image, Docker `inspect` controls, input hashes before/after,
canary outcomes, child termination, publication recovery, idempotency, and
attempt fencing.

To measure image installation and warm launch on a pilot host:

```powershell
npm.cmd run verify:ivory-n3 -- --measure --interrupt-publication
```

`coldInstall` reports the timed `docker pull` and whether the image was already
cached. `warmLaunchMs` is the timed valid container launch after the image is
present. A cached pull is not cold evidence; remove only this explicitly named
pilot image before repeating that measurement if a genuine cold-install number
is needed.

## R language repeat

The protocol is language-neutral only after the same run is repeated with a
small R image containing `Rscript`:

```powershell
$env:IVORY_N3_R_IMAGE = 'r-base:<version>@sha256:<64-hex-digest>'
npm.cmd run verify:ivory-n3 -- --language r --interrupt-publication
```

The R run uses the same captured CSV, read-only input mount, output contract,
publication store, cancellation/fencing rules, and digest evidence. Python
success alone does not unlock an R-capable adapter.

## Pilot gate and decision boundary

N3 remains open until a clean pilot record contains:

- denied required canaries, unchanged input bytes, terminated children, and
  Docker-inspected controls rather than configuration intent;
- one terminal cancellation/publication outcome, one artifact per attempt, and
  recovery after publication interruption;
- Python and small R results under the same protocol;
- cold-install and warm-launch measurements on the proposed macOS Apple Silicon
  target using a maintained local OCI runtime;
- a five-person onboarding exercise in which at least four users enable Compute
  from these instructions within 15 minutes, with any large download reported
  separately.

Until those records exist, the supported OS, capability profile, runtime adapter,
and production publication state machine remain decisions unlocked by N3 rather
than decisions made by this prototype.
