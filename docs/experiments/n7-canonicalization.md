# N7 canonicalization — one implementation, and the disposition of `cursor-n7-proposal-integrity-aeda`

**Status:** decided — `dev`'s implementation is canonical; `origin/cursor-n7-proposal-integrity-aeda`
is not merged, and its two highest-value cases are folded into `scripts/n7/adversarial.test.mjs`.

Two implementations of the N7 spike exist. Recon (2026-09-13, this task) compared them read-only; the
comparison below is the record, and the fold is deliberately narrow: the competing branch contributes
test *cases*, never runtime or evidence.

## Decision

Canonical is the implementation merged on `dev`: `scripts/n7/{build,client,core.test,mcp.test,provider.test,review,review.test,verify}.mjs`
plus the TypeScript package `packages/ivory-tower-agent-experiment/` (a `ProposalCore` and a
`ProviderDispatcher` over `@ivory-tower/research-kernel`, the N1 kernel, and a real stdio MCP server).

The competing branch `origin/cursor-n7-proposal-integrity-aeda` (`0aa03e29f`) is a self-contained
pure-`.mjs` spike under `scripts/ivory/n7-*.mjs` that forks from `69805e329` — **before N1** — and
defines its own in-memory core, its own operation catalog and its own evidence record. It cannot be
canonical: landing it would re-introduce a second parallel spine, which ADR-003's one-Core rule
forbids. It is examined case by case, folded where valuable, and otherwise left unmerged.

| | A — canonical (dev, base `dda5c294b`) | B — `origin/cursor-n7-proposal-integrity-aeda` (`0aa03e29f`) |
|---|---|---|
| Path | `scripts/n7/{build,client,core.test,mcp.test,provider.test,review,review.test,verify}.mjs` + `packages/ivory-tower-agent-experiment/{src,fixtures}` (TypeScript, depends on `@ivory-tower/research-kernel`) | `scripts/ivory/n7-{catalog,mcp,pipeline,retain}.mjs` + 4 `*.spec.mjs`, `scripts/fixtures/n7/recorded-response.json`, `docs/iv-n7-agent.md`, `docs/where-new-behavior-goes.md`, `n7-transcripts/*.json` (pure `.mjs`, no kernel dependency) |
| Base | merged on `dev`; extends the N1 reference kernel | forks from `69805e329`, before N1; defines its own core (`IvoryCatalog`) |
| Coverage | 31 tests + the 12-test N1-kernel regression; real stdio-MCP coverage; provider-transmission suite; six-way fail-closed matrix; interactive two-digest review | 24 tests; declarative catalog taxonomy; one-catalog-four-surfaces table; no-model path; hostile-corpus transcript |
| Evidence | machine-written `docs/experiments/n7-v1-evidence.json` + `docs/experiments/n7-evidence/` via `verify:ivory-n7` | its own `n7-retain.mjs` writing the same evidence path plus `docs/experiments/n7-transcripts/*.json` |
| Verdict | **canonical** | **not merged** — fold the cases below, archive |

## Per-case disposition

| Case in B | Decision | Where it is in A |
|---|---|---|
| **hostile-corpus prompt injection** — adversarial tool instructions embedded in source text, a private canary asserted never transmitted, no capability granted from source content, nothing auto-accepted (`n7-transcripts/hostile-corpus.json`, `n7-catalog.spec.mjs`) | **adopt** | `scripts/n7/adversarial.test.mjs` — cases 1 and 2 (below) |
| **no-model qualitative path** — claim + annotation + EvidenceLink written with no model in the loop (`n7-catalog.spec.mjs` "no-model qualitative path…") | **adopt** | `scripts/n7/adversarial.test.mjs` — case 3 (below) |
| **isolated catalog instances do not share writers** (`n7-catalog.spec.mjs` "isolated catalog instances…") | **adopt** | `scripts/n7/adversarial.test.mjs` — case 4 (two `ResearchKernel`s: sequence isolation, cross-project refs rejected) |
| **four named recorded transcripts** (hostile-corpus, revoked-tool, stale-proposal, duplicate-accept) | **adopt the scenarios; reject-with-reason the transcript-file record** | revoked-tool / stale-proposal / duplicate-accept were already canonical tests (`core.test.mjs`, `mcp.test.mjs`); hostile-corpus is folded now. The retained `n7-transcripts/*.json` format is rejected: the canonical record is machine-written by `verify:ivory-n7` into `docs/experiments/n7-v1-evidence.json` + `n7-evidence/` (owned by the live-provider run, Task 8.2). A second, hand-maintained transcript store would be a parallel evidence record. |
| **`Query \| Command \| Execution \| Proposal` catalog taxonomy** (`OPERATIONS`, `modelFacing`, surface lists) | **reject-with-reason: out of contract** | The canonical core declares no operation catalog: `ProposalCore` exposes named trust boundaries (`readExcerpt`, `propose`, `preview`, `decline`, `accept`, `revoke`) and the MCP server exposes exactly two tools over stdio. Porting a taxonomy would mean adding a new contract module. Its *behavioural* half is asserted today — `mcp.test.mjs` (only `read_excerpt`/`propose_claim` exist; unauthenticated accept → 403) and `core.test.mjs` (strict schemas refuse injected fields) — and the adversarial fold adds the "no capability from source content" binding. |
| **one-catalog-four-surfaces invariant** (`mcp` cannot accept; `compute` cannot propose; a capability cannot grant accept) | **partially adopt** | "mcp cannot accept" is already canonical (`mcp.test.mjs`: tool list is exactly read+propose; `/accept` without the control token is 403). "A capability cannot grant accept" is folded in `adversarial.test.mjs` (injected `capabilities`/`accept` fields refused; the proposal is bound to the application-issued capability; acceptance requires a researcher identity the source text cannot supply). "compute cannot propose" — **reject-with-reason: out of contract**: the canonical N7 experiment has no compute surface (N3 owns governed execution; `previewRunSpec` is B's own Execution seam). |
| **four-stage pipeline record** (pre-execute → execute → post-execute → frozen result digest, logged per operation) | **reject-with-reason: out of contract** | The canonical `ProposalCore`/`ProviderDispatcher` logs no stage record. The safety properties the record exists to prove are already asserted: nothing dispatches before approval, the approved bytes are the transmitted bytes, the proposal digest is frozen at propose time and bound at accept (`provider.test.mjs`, `core.test.mjs`). Adding a stage log would be new implementation, not a port. |
| B's runtime: its own core (`IvoryCatalog`), `scripts/ivory/n7-*` layout, `n7-retain.mjs` evidence writer | **reject-with-reason** | A second in-memory core and a second record writer contradict the one-Core rule; the canonical suite must extend `@ivory-tower/research-kernel`. No file from B's runtime is imported by the fold. |
| B's design docs `docs/iv-n7-agent.md`, `docs/where-new-behavior-goes.md` | **reject-with-reason** | They document B's declarative catalog and surface table, which are not the canonical contract. The canonical N7 document is `docs/experiments/n7-scoped-agent-proposals.md`. |
| B's `Execution` surface: `ivory.previewRunSpec`, "an accepted run-spec preview does not accept an interpretation", egress `extraHosts` refusal | **reject-with-reason: out of contract** | No run-spec/Execution seam exists in the canonical N7 contract; governed execution is N3. Canonical egress control is the preview/approve transmission gate plus endpoint policy, already covered. |
| B's extra Query surface (`searchMaterial`, `inspectClaim`, `inspectSnapshot`) | **reject-with-reason: out of contract** | The canonical MCP surface is deliberately one exact read (`read_excerpt`) plus `propose_claim`; search/inspect would widen the model-facing contract. |
| B's `scripts/fixtures/n7/recorded-response.json` | **reject-with-reason** | The canonical fixture `packages/ivory-tower-agent-experiment/fixtures/recorded-response.json` is digest-pinned and asserted; a second fixture would be dead weight. |

## Folded: the two highest-value cases

Both live in the new file `scripts/n7/adversarial.test.mjs`, written against the canonical contract and
its existing fixture (`fixture()` in `packages/ivory-tower-agent-experiment`, which already embeds the
adversarial source text and keeps the private canary in a different project's kernel).

1. **Hostile-corpus, offline** — `hostile source text is untrusted data: it cannot grant tools, widen
   scope, or accept itself`. Reads the injected excerpt, proves the injection is in-band, then proves it
   is inert: scope is fixed at capability issue (`ungranted` and the private project stay
   `scope_denied`), injected `capabilities`/`accept`/shell/exfiltration fields are refused by the strict
   proposal schema, the resulting proposal is only `pending`, is bound to the application-issued
   capability, and acceptance requires a researcher identity the source text cannot supply.
2. **Hostile-corpus, on the wire** — `hostile-corpus transmission carries only the approved excerpt and
   never the private canary`. A loopback provider proves nothing leaves before approval, the approved
   bytes are the transmitted bytes, the injection is present in the request (in-band attack), and the
   private canary never is; the response is one bounded proposal, `acceptedStateUnchanged`, and the
   private project remains out of scope after the exchange.
3. **No-model qualitative path** — `the no-model qualitative path writes a human claim, annotation and
   evidence link through the same contract`. A researcher creates a codebook, an annotation, a claim and
   an EvidenceLink with no provider in the loop; all attributions are `human`; the EvidenceLink payload
   has the exact same key set as the accepted model-path link and differs only in
   `linkAuthorType`/`linkAuthor`; both resolve to the same exact retained quote.
4. **Isolated catalogs** — `isolated project catalogs do not share writers, sequences or refs`.

## Reproduce

```bash
npm run test:ivory-n7   # build, then 35 tests: the original 31 plus the 4 folded above
```

`verify:ivory-n7` also picks the new file up automatically (it walks `scripts/n7/*.test.mjs`); this fold
does not regenerate `docs/experiments/n7-v1-evidence.json` or `docs/experiments/n7-evidence/` — those
belong to the separate live-provider qualification.
