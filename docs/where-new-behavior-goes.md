# Where new behavior goes

Ivory’s map of **Core operation vs Compute adapter vs Studio widget vs MCP tool**,
not DeepSeek Harness’s. `dsh` attaches new behavior to a live
`ctx.*` plugin registry. Ivory attaches new behavior to a **versioned Core
catalog**. Adding an operation is a reviewed release, not a runtime
registration. If a tool cannot be expressed as Query / Command / Execution /
Proposal, it does not ship.

Invariant 10: no UI or agent dependency enters the kernel. Theia AI, Cordis,
Cursor, Codex, and Claude are clients or chrome. They never become the store.

## Three harnesses

| Harness | Owns | Does not own |
| --- | --- | --- |
| **Core** | Versioned command/query catalog, exact refs, receipts, proposal envelopes, accept/withdraw | Theia widgets, model adapters, OCI, shell |
| **Compute** | One execution world: read-only inputs, staged outputs, capability report, process-group teardown | Canonical DB writes, claim acceptance, host credentials |
| **Agent** | A small driver whose only model-facing tools are catalog operations; fixture LLM first | Research identity, snapshot closure, auto-accept |

Compute is the N3 seam. Studio is an N5 client. MCP/CLI are Phase 6 presenters
of the same catalog (N7). Forking `dsh` into Ivory would replace that spine
with a plugin kernel.

## Surface profiles

One Core API. Named profiles compose presenters, not new writers:

| Profile | Presenter | May invoke |
| --- | --- | --- |
| `studio` | Theia research perspective + adapter | Queries, Commands (including accept/withdraw), Execution previews, Proposals |
| `cli` | Local trusted CLI | Same catalog as Studio |
| `mcp` | Ivory MCP server; Cursor/Codex/Claude are ACP-style clients | **Query + Proposal only.** No accept, revoke, shell, or filesystem |
| `compute` | Supervised runtime adapter | **Execution only.** No proposal accept, no corpus writes |

## Catalog map

Rows point at Core operations, not a live `ctx.tools` registry.

| Goal | Effect class | Mechanism |
| --- | --- | --- |
| Resolve a citation | Query | `ivory.resolveFragment` — exact `projectId` / `objectId` / `revisionId` only; `latest` is forbidden |
| Inspect a claim or snapshot | Query | `ivory.inspectClaim` / `ivory.inspectSnapshot` |
| Search material | Query | `ivory.searchMaterial` — results carry exact fragment refs, never live heads |
| Create or revise a claim without a model | Command | `ivory.createClaim` / `ivory.reviseClaim` — no-model qualitative path |
| Annotate or link evidence without a model | Command | `ivory.annotateFragment` / `ivory.linkEvidence` |
| Freeze / pin a corpus snapshot | Command | `ivory.freezeSnapshot` — capabilities pin this revision |
| Accept, decline, or withdraw a proposal | Command | `ivory.acceptProposal` / `ivory.declineProposal` / `ivory.withdrawProposal` — researcher plane; missing/stale/revoked → deny |
| Revoke an agent capability | Command | `ivory.revokeCapability` — fail closed; in-flight model bytes are discarded, not recalled |
| Preview a governed run | Execution | `ivory.previewRunSpec` — Compute seam; publication is not interpretation |
| Propose a claim, EvidenceLink, annotation, or RunSpec | Proposal | `ivory.proposeClaim` / `ivory.proposeEvidenceLink` / `ivory.proposeAnnotation` / `ivory.proposeRunSpec` — frozen envelope before researcher accept |

## Tool pipeline (around Core, not around chat)

```
pre-execute  →  capability + snapshot pin + egress
execute      →  catalog.call
post-execute →  freeze the proposal envelope
result       →  what the model sees (logged; if it is not in the envelope, it did not happen)
```

Approval is fail-closed: no researcher answerer means deny. Timeout, sandbox,
hooks, and UI cards attach without editing the driver.

## Event map (`dsh` → Ivory)

| `dsh` | Ivory |
| --- | --- |
| `tool/call` before execute | Proposal envelope persisted with exact heads and excerpt refs |
| `ctx.approval` fail-closed | Researcher accept is the only promotion |
| `tools/result` frozen | One model-facing outcome; replayed accept is one idempotent effect |
| `agent/pre-step` waterfall | Egress policy, capability revocation, snapshot pinning before the request |
| ACP / SDK profiles | `mcp` + `cli` as the same catalog; Cursor/Codex are clients, not writers |
| Subagent providers | Fixture LLM first, then one configurable HTTP provider, behind one interface |

## Do not put it here

| Temptation | Put it here instead |
| --- | --- |
| New research write in a Theia AI tool | Core catalog operation + Studio gesture |
| Live `ctx.tools` registration | Reviewed catalog release |
| Cordis inside Theia | Theia contribution points for chrome only |
| Bash / workspace write / web as agent tools | Out of V1 AI lane; Compute if governed, else refuse |
| Agent transcript as the research store | Core revisions, receipts, and proposal log |
| Growing `@theia/ai-*` into the Ivory harness | Studio chrome; backend connector is transport to Core |
