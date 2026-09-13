# N7 — Scoped agent proposal integrity

Question: Can an agent help without losing exact evidence context or gaining
unintended authority?

This spike is the prototype plus a design record: what to steal from
[DeepSeek Harness](https://github.com/mberrys/deepseek-harness) (`dsh`) when
building Ivory’s agent/compute harness, and what not to copy.

Owner: Sol. Terra/Luna implement adapters only after the capability contract
is settled. Related: N3 (shared execution world), N5 (Theia stays a client),
Phase 6 (MCP/CLI as the same catalog). Invariant 10: no UI or agent
dependency enters the kernel.

## Decision

Steal DeepSeek’s **seams and fail-closed habits**, not its product spine.

`dsh` is a coding agent whose loop, tools, filesystem, and model adapter are
plugins. Ivory is a versioned research workspace: Core is the only semantic
writer, Compute is a supervised runtime, Studio is a Theia client, and agents
may only propose. Forking `dsh` into Ivory would violate invariant 10 and the
catalog rule that new operations are a reviewed release, not a live plugin
registration.

What transfers: keep one small driver, put every capability on a named seam,
log every model-visible fact, fail closed, and compose surfaces from the same
spine. Ivory already has a stronger spine than `dsh`. The harness work is to
put the agent on that spine instead of letting Theia AI or a coding-agent
clone become a second one.

See [Where new behavior goes](where-new-behavior-goes.md) before adding
operations. That page is Ivory’s equivalent of `dsh` `docs/architecture.md`.

**Status:** deterministic fixture-provider prototype on this branch. Not a
production MCP write capability. Live-provider qualification remains opt-in
and open. Does not authorize shipping an optional provider adapter until a
reviewed live path records the same gates against a real endpoint.

## Steal from DeepSeek

1. **Capability seams, not “a tool that does the thing.”** Service definition /
   provider / consumer. Ivory wants the same for storage, conversion, and
   execution ports — implemented as catalog operations and host ports, not
   Cordis keys.
2. **Durable facts vs live coordination.** Proposal envelopes and tool results
   are durable Core facts; streaming tokens are live and disposable.
3. **Model-visible means logged.** If it is not in the proposal envelope, it
   did not happen.
4. **Tool pipeline with policy outside the loop.** pre-execute → execute →
   post-execute → frozen result. Approval is fail-closed.
5. **Profiles as composition, one launcher.** Ivory: `studio` / `cli` / `mcp`
   / `compute` over one Core API. No Cordis.
6. **Human collaboration is a plane.** Accept/decline/withdraw skip the model.
7. **Tests that replay the product.** Recorded fixture-provider transcripts,
   not demos.

## Do not copy

| DeepSeek pattern | Why it is wrong for Ivory |
| --- | --- |
| Everything is a plugin, including the kernel | Core is a privileged commit boundary |
| Vendoring Cordis into Theia | Second plugin runtime inside the workbench is N5 surgery |
| Agent loop as the product spine | Spine is identity, snapshots, provenance, and one commit |
| Self-modifying plugins / live mount | Source text must not grant capabilities |
| Default coding tools (bash, workspace write, web) | Unrestricted FS/shell is a Core bypass |
| Session log as the research store | Chat history is activity, not a second registry |
| Growing `@theia/ai-*` into “the Ivory harness” | IDE-coupled; use as Studio chrome only |

## Prototype

Headless in-memory Core catalog + tool pipeline + MCP presenter. Recorded
fixture provider first; one configurable HTTP provider behind the same
interface. Exercise:

- adversarial tool instructions in source text
- revoke a capability mid-task
- alter a claim after a proposal is prepared
- replay an acceptance request

No-model qualitative path (create claim, annotate, link evidence) remains
complete on `studio` / `cli` without any provider.

Reproduce: `npm run test:ivory-n7` and `npm run verify:ivory-n7`. Evidence:
[experiments/n7-scoped-agent-proposals.md](experiments/n7-scoped-agent-proposals.md)
and [experiments/n7-v1-evidence.json](experiments/n7-v1-evidence.json).
