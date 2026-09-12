# N7 — Scoped agent proposal integrity

Status: **Implemented headless experiment; real-provider qualification remains open.**

This experiment follows Architecture V2's one-Core authority rule. It extends the N1
reference kernel, not the N2 durable store or N5 Theia client. It proves a bounded
read-and-propose path and does not authorize production MCP write capabilities.

## Reproduce

Use Node 24 and the repository's npm lockfile. From the repository root after
`npm ci`:

```powershell
npm.cmd run test:ivory-n7
npm.cmd run verify:ivory-n7
npm.cmd run review:ivory-n7
```

`test` compiles identity, the N1 kernel, and N7, then runs Node's test runner.
`verify` also runs the N1 regression suite and retains the evidence record and raw
logs. `review` starts the synthetic fixture, prints the complete request, requires
its digest to approve replay, then prints the proposal and requires its digest
to accept. Enter `decline` or `revoke` at either prompt to stop that path.
Each invocation starts a fresh, in-memory project. Closing it loses receipts and
proposals; there is no persistence or restart guarantee.

For real-provider qualification, configure `N7_ENDPOINT` as the **complete Chat
Completions URL**, `N7_MODEL` as the model identifier, and `N7_API_KEY` in the process
environment if the endpoint requires it. Do not put credentials in files or URLs.
HTTPS is required except for explicitly configured loopback HTTP endpoints.

```powershell
npm.cmd run verify:ivory-n7 -- --live
```

This runs deterministic gates first, then interactively reviews both exact digests.
The endpoint receives only synthetic material. No environment variable is inferred
from another provider's configuration. Missing endpoint/model, declined approval,
or live-provider failure leaves qualification incomplete and returns nonzero.
Default verification succeeds when deterministic gates pass, while explicitly
recording the real-provider gate as open.

## Contract and authority

The real stdio MCP server exposes only `read_excerpt` and `propose_claim`.
Researcher control uses a separate experiment-only loopback channel with a random
token. It is not advertised through MCP. The local CLI possesses that token; model
arguments cannot supply researcher identity, accept, revoke, execute commands,
read arbitrary files, or choose a provider endpoint. Test-only competing-edit
controls are disabled for live sessions.

A capability binds one task to one project and an explicit set of exact Fragment
revisions. Retrieval returns the retained quote, selector, source digest and
representation digest. Only excerpts actually retrieved by that task can support
a proposal. Unscoped, invented, mismatched and `latest` references fail closed.

A proposal contains version, project/task/capability IDs, expected contextual claim
head, exact excerpt and digest, proposed claim text, one supporting/challenging
EvidenceLink and rationale, provider/model attribution, and a canonical digest.
It lives outside accepted research state. Its content is immutable; changes require
a new proposal and review. The synthetic recorded response is an authored fixture,
explicitly labeled as such, not a claimed recording of a real model.

Core acceptance binds proposal ID/digest, researcher and idempotency key. It
rechecks capability, expected head and evidence, then stages both revisions and
their shared producing Activity before publishing state and the receipt together.
Model authorship remains on the new claim/link; researcher acceptance is recorded
separately on Activity. The original human-authored contextual claim is unchanged.
Failure during staged construction publishes nothing.

Identical retries return the original receipt, including after revocation: this is
a receipt read, not a new semantic effect. Changed-content/key retries fail.
Revocation blocks further reads, dispatches, proposal submission and first
acceptance. Decline does not change accepted records and cannot be undone by
resubmitting identical proposal content. A contextual claim edit makes the proposal
stale; correcting a source does not move historical excerpts to replacement bytes.

## Provider transmission

The trusted dispatcher builds one bounded Chat Completions request and previews
its full serialized body and endpoint. Approval binds their digest to the current
task/capability. Credentials are sent only in the configured Authorization header
and excluded from previews, logs and evidence. Redirects and implicit retries are
disabled. Limits are 64 KiB request, 256 KiB response and 30 seconds total request
time. Only one valid `propose_claim` response is accepted; tool instructions in
source text cannot expand the available tools or grant authority.

Revocation cannot recall already transmitted bytes. An in-flight response is
discarded after revocation; this implementation does not claim immediate provider
cancellation. The declared endpoint is trusted to handle its received data: the
experiment observes local egress, not a provider's internal retention or routing.

## Evidence and release decision

See [retained evidence](n7-v1-evidence.json) and its linked raw logs. Tests observe
actual stdio calls and independently capture HTTP request bodies at a local
provider. They cover adversarial text, undeclared tools, scope, expected-head
conflicts, approval mutation, concurrent/replayed acceptance, staged rollback,
decline, historical citations, revocation at three boundaries, redirects, malformed
responses, bounds, timeouts, and absence of implicit retries.

The record includes repository HEAD, dirty-state indicator, source fingerprints,
fixture digest, runtime/platform, commands, test totals/timings, log digests and
limitations. HEAD identifies the base when qualification runs before commit;
the source fingerprints identify the implementation actually tested (UTF-8 text
with line endings normalized to LF). A fixture
pass never manufactures a real-provider observation.

Local validation uses TypeScript 5.9.3, MCP SDK 1.30.0 and Zod 3.25.76 from the
existing N1 dependency installation, with local identity/kernel package links.
This is focused build/runtime evidence, not a fresh full-monorepo install or hosted
CI result. This N1-derived branch has no `verify:ivory-tower` or
`test:ivory-runtime` scripts; the focused N7 compilation, tests and N1 regressions
are the applicable checks.

Any unauthorized disclosure, execution, accepted change, detached approval, stale
acceptance, duplicate effect or lost attribution is a hard failure. Passing both
deterministic and reviewed live paths qualifies this bounded experiment only.
Production shipping additionally requires durable Core acceptance and the real
researcher review flow. No general workflow object, second writer, production
authentication system, Theia integration or arbitrary-code sandbox is introduced.
