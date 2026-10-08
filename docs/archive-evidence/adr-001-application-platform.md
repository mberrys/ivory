# ADR-001: Application platform and surface strategy

**Status:** Accepted
**Date:** 2026-08-02
**Issue:** [IV-14](https://app.notion.com/p/3b09cb079ddb81089f9cee6413df7b33) — Decide V1 runtime topology and repository architecture
**Scope:** Resolves the application-platform and surface-ordering questions within IV-14. The runtime topology and remaining boundary decisions are completed by [ADR-002](adr-002-runtime-topology.md).
**Affects:** IV-3, IV-15, IV-18, IV-19, IV-22, IV-23, IV-24, IV-25, IV-26, IV-27, IV-30, IV-83, IV-87

---

## 1. Context

Ivory Tower needs an application foundation that serves three requirements at once:

1. **Credibility with technical researchers.** The tool must read as serious infrastructure to methodologists, not as a web toy.
2. **A local-first desktop experience.** Researchers working with authorized material want the option to run without a cloud dependency.
3. **A hosted web option.** The product should reach users who cannot or will not install software, and institutions that prefer to host.

The prior planning baseline left this open, describing a "candidate topology" pending IV-14 without committing to an application platform.

## 2. Decision

### 2.1 Eclipse Theia is the application platform

Ivory Tower is built on Eclipse Theia rather than on a bespoke web application shell.

**Implementation: a literal source fork.** This repository is a fork of Eclipse Theia at upstream v1.74.0, hosted at `mberrys/ivory-tower` with `stable` as the default branch. Ivory Tower is developed inside the fork rather than as a downstream composition over published `@theia/*` packages. See §3.7 for the cost this accepts and §6 for the mitigation.

### 2.2 Web-first, wrapped for desktop

The browser deployment is the primary target. The desktop application is the same product wrapped, not a separate build with its own logic. Surfaces ship in this order:

| Order | Surface | Status |
|---|---|---|
| 1 | Hosted web application | V1 |
| 2 | Desktop wrapper over the same frontend, with a local backend profile | V1 or immediately post-V1 |
| 3 | CLI over the same typed API | Post-V1 |
| 4 | VS Code / Theia extension | Post-V1 |

These two decisions are mutually reinforcing, and that is the substance of the choice. Of the credible IDE-lineage foundations, **Theia is the only one that targets browser and desktop from a single codebase**. Code-OSS and VSCodium are desktop builds; reaching the browser with either means adopting a separate server project. Committing to web-first therefore selects Theia on its own, independent of the other arguments.

### 2.3 Consequent invariant

No surface may contain product logic. Every surface is a client of the typed API defined by IV-18. Retrofitting an API onto a surface-coupled core is expensive; enforcing the boundary from the start is nearly free.

## 3. Consequences

### 3.1 LiqUIdify is rescoped, not dropped

Theia owns the workbench chrome — layout, panels, the command and keybinding system, theming. IV-3, IV-23, and IV-27 currently contract LiqUIdify as *the* UI foundation, and `liquidify-react` is this repository's only real dependency.

The resolution: **Theia owns shell chrome; LiqUIdify is scoped to Ivory Tower's own Theia views** — the research workspace, evidence inspector, adjudication surfaces, and dossier views. The IV-23 adapter boundary survives and becomes more important, since it now also isolates Ivory Tower views from Theia's widget lifecycle.

### 3.2 The extension host must be constrained

Theia's VS Code extension compatibility is a platform feature, not a product feature. IV-83 (pre-conversion admission), IV-87 (provider egress), and IV-121 (fail-closed non-inference) require a chokepoint that arbitrary third-party extension code would defeat. V1 ships with the plugin host disabled or restricted to a first-party allow-list. This is a hard requirement, not a default to revisit casually.

### 3.3 Accessibility multiplies

G14 requires keyboard-only completion of the vertical slice and structured alternatives for every graph — on **every surface shipped**. Theia's own keyboard and screen-reader implementation is an asset here, but IV-26 must now verify each surface independently rather than once.

### 3.4 Licensing changes shape

Theia is EPL-2.0 with a secondary GPL-2.0-with-classpath-exception. This is workable for both hosted and distributed use, but it is a materially different obligation profile from MIT and must be an explicit IV-19 decision rather than an inherited one. The transitive dependency surface also grows substantially, against a release gate requiring SBOM and secret scans to pass.

### 3.5 Local-first is a backend problem, not a shell problem

The desktop wrapper is the easy half. A genuine local profile requires PostgreSQL with pgvector, the durable job queue, and the Python Docling worker all running on the user's machine. **Docling is the material risk** — bundling a Python runtime across platforms is the hardest constraint in the system, and IV-30 must define a degraded path where conversion falls back to a remote port when a local Python environment is unavailable.

### 3.6 Accepted risks

These arguments were raised against an IDE-lineage foundation and are recorded as accepted, not resolved:

- **The kept-surface ratio is low.** Ivory Tower needs layout, a virtualized tree, a command palette, keybindings, theming, and accessibility. It does not need Monaco, LSP, a terminal, debug adapters, a task runner, or SCM. Theia's modularity makes omission cheap, but the retained subsystems are the least differentiated part of the platform.
- **The grain runs toward files.** Theia's nouns are workspace, file, and editor. Ivory Tower's are immutable `SourceVersion`, `Passage` anchors, and typed provenance. Custom views bridge this, but the platform does not reinforce it.
- **The backend shape differs.** Theia's backend is a per-user Node session over a workspace connection. IV-78's durable job contract with leases, idempotency, and fencing, sitting in front of PostgreSQL with independently deployable workers, is a different model that Theia neither provides nor prevents.
- **Ecosystem depth.** Theia's community is materially smaller than VS Code's, which thins the available expertise and documentation surface.

### 3.7 Fork maintenance is an accepted, ongoing cost

Choosing a source fork over composition trades a recurring merge burden for unrestricted access to Theia internals. This was the primary argument against forking Code-OSS or VSCodium, and it applies here in reduced but real form — reduced because Theia's extension model means most Ivory Tower work can live in new packages rather than in upstream files.

The mitigation is a discipline, not a mechanism: **minimize divergence in files upstream owns.** Prefer new packages under `packages/` to edits of existing ones. Every modified upstream file becomes a recurring conflict on each version bump, and the cost compounds with the number of such files rather than with the size of the fork.

Two files diverge from upstream as of this decision: `CLAUDE.md`, which now carries Ivory Tower's project guidance with upstream's version preserved at `doc/THEIA-CLAUDE.md`, and the addition of `docs/` alongside upstream's `doc/`.

## 4. Alternatives considered and rejected

| Alternative | Rejected because |
|---|---|
| **Fork Code-OSS** | Permanent rebase tax against a monthly-shipping upstream, worst precisely where edits are deepest. Desktop-only, so the web surface would require a second project. Marketplace and several debuggers are proprietary. |
| **Fork VSCodium** | Same codebase as Code-OSS with a thin patch layer; inherits every architectural property while adding a *second* upstream to track. VSCodium's own viability depends on keeping its diff microscopic, which is evidence for where the cheap boundary sits, not against it. |
| **Bespoke web application over a component library** | Lowest cost and best persona fit for the non-programmer survey student, but does not deliver the credibility and local-first desktop requirements that motivated this decision. |
| **VS Code extension only** | Zero platform cost and real reach for the technical researcher, but cannot be the primary product: it reaches only users already in an editor, and IV-102 puts coding-agent adoption among social scientists at roughly 20%. Retained as surface 4. |

## 5. Verification

Per IV-14's acceptance criteria, this decision is verified when a request sequence covering upload, conversion, indexing, retrieval, generation, validation, persistence, and streaming can be demonstrated end to end on the selected platform, with every service boundary carrying an owner, protocol, failure model, and local-development strategy.

## 6. Open questions and follow-on work

| Question | Owner |
|---|---|
| ~~Fork or compose?~~ **Resolved 2026-08-02: fork.** The repository is a source fork of Theia v1.74.0 at `mberrys/ivory-tower`. Accepted cost and mitigation discipline in §3.7. | Closed |
| Upstream sync cadence and who owns resolving version-bump conflicts | IV-14, IV-19 |
| **Resolved in ADR-002:** the V1 Ivory Tower applications omit the plugin host; the upstream fork retains its source capability for later first-party allow-list work. | IV-14, IV-83 |
| **Resolved in ADR-002:** reserve Theia's Electron target for the immediately post-V1 local profile. | IV-14, IV-22 |
| Local Docling bundling compatibility proof and packaging | IV-30, immediately post-V1 |
| **Resolved in ADR-002:** queue technology, object storage, migration ownership, and per-boundary failure models. | IV-14 |
