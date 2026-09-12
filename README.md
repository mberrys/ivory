<br/>

<div id="ivory-tower-header" align="center">
    <h1>🏰 Ivory Tower</h1>
    <h3>An AI research operating system for knowledge work — academia first</h3>
</div>

<div align="center">

Ivory Tower turns a pile of sources into a research dossier whose every claim resolves to the
passage it came from. It is built on the [Eclipse Theia](https://github.com/eclipse-theia/theia)
platform and holds one promise above all others: **a citation stays true**.

</div>

- [Project status](#project-status)
- [What Ivory Tower is](#what-ivory-tower-is)
- [Delivered work](#delivered-work)
- [Roadmap](#roadmap)
- [Repository layout](#repository-layout)
- [Building and running](#building-and-running)
- [Observability (Sentry)](#observability-sentry)
- [Contributing](#contributing)
- [Upstream Theia documentation](#upstream-theia-documentation)
- [License](#license)
- [Trademark](#trademark)

## Project status

**Phase 1 — establishing the product and architecture contract.** Nothing user-facing ships yet.
The work in progress is the set of written contracts that everything else is built against, plus
their reference implementations.

| | |
|---|---|
| Phase | 1 of 7 |
| Milestone | V1 — product and architecture contract |
| Tracked issues | 125 across 7 phases ([Issue Tracker](https://app.notion.com/p/3af9cb079ddb8001b65ed40b0b1ed594)) |
| Closed | IV-8, IV-102 |
| Delivered in this repository | IV-8 — product model; IV-102 — landscape review; IV-17 — identifiers (specification + implementation) |
| Platform baseline | Eclipse Theia v1.74.0 |
| Default branch | `dev` |

Issues are numbered `IV-<n>` and tracked in Notion rather than GitHub. `IV-1` is the issue
template and `IV-2` does not exist.

## What Ivory Tower is

Ivory Tower is an AI research operating system for knowledge work, with academia as its first and
best-supported domain. It is not an academic dashboard, and visual analytics are a capability
inside the research workflow rather than the point of the product.

It models the researcher lifecycle — **discover, validate, organize, analyze, communicate,
publish** — and treats papers, books, archives, events, people, institutions, concepts, claims,
evidence links, contradictions, interpretations, datasets, and notes as first-class objects. A
project can be represented without forcing research material into a spreadsheet or dashboard
schema.

### The two bounded V1 paths

V1 is deliberately finite. It delivers exactly two provenance-first workflows:

1. **Allowlisted open scholarly corpus → research dossier.** PMC OA, arXiv, DOAJ-indexed open-access
   journals, approved preprint repositories, and CC/public-domain full text are ingested immutably,
   extracted, chunked, retrieved, and turned into claims backed by exact passage anchors, with
   contradictions and limitations kept visible. Closed or license-ambiguous material is outside the
   V1 acceptance path.
2. **Authorized, non-restricted survey file → validated descriptive analysis.** A bounded set of
   approved descriptive operators over uploaded survey data, with weighting, missingness, and
   small-cell checks, and enforced boundaries on causal language.

The default result is a researcher-owned dossier: evidence, organization, limitations, and
optional researcher-approved synthesis. Guided and expert paths share one staged, versioned state.

### What V1 is not

Not a paper writer, not a generic dashboard, not an autonomous analyst, not an unrestricted
statistician, and not an unrestricted document-chat system. Closed or license-ambiguous scholarly
material, broad connectors, arbitrary code execution, causal automation, team collaboration,
outbound MCP, restricted microdata, and first-party model adoption are explicit non-goals for V1 —
several are scheduled as post-V1 work in [Phase 7](#phase-7--post-v1--interoperability-and-advanced-capabilities).

## Delivered work

### Specifications in this repository

Documents under [`docs/`](docs) are **normative**. Where an implementation and its specification
disagree, the specification is the contract and the implementation is the defect.

| Document | Issue | Covers |
|---|---|---|
| [`docs/iv-8-product-model.md`](docs/iv-8-product-model.md) | IV-8 | Product definition, canonical object vocabulary, research lifecycle, supported content, non-goals, traceability matrix |
| [`docs/iv-102-landscape-review.md`](docs/iv-102-landscape-review.md) | IV-102 | Landscape review protocol, classified source register, findings, and the decision ledger that binds product claims |
| [`docs/iv-128-content-rights.md`](docs/iv-128-content-rights.md) | IV-128 *(issue pending)* | Content licensing, TDM rights, provider transfer, the content-rights matrix, and the recommended V1 admission policy. **Not legal advice** |
| [`docs/iv-17-identifiers.md`](docs/iv-17-identifiers.md) | IV-17 | Stable source, passage, and derived-artifact identifiers |
| [`docs/iv-21-local-runtime.md`](docs/iv-21-local-runtime.md) | IV-21 | Reproducible local Compose runtime, clean-install bootstrap, and N-1 migration recovery proof |

### Packages in this repository

| Package | Implements |
|---|---|
| [`packages/ivory-identity`](packages/ivory-identity) | IV-17 — minted and derived identifiers, canonical preimages, passage anchors, alias resolution |
| [`packages/ivory-tower-content-policy`](packages/ivory-tower-content-policy) | IV-128 — content classes and the V1 safe subset, recorded rights bases, and the two-gate fail-closed admission decision |

**IV-17 in one paragraph.** Every identifier is either *minted* (`prj_`, `cor_`, `src_`, `exec_` —
allocated once, never re-derivable) or *derived* (`sv_`, `psg_`, `art_`, `fp_` — the hash of a
canonical preimage over identifying inputs). A source version depends on its source and its raw
bytes alone, so re-indexing preserves citations and a corrected author name invalidates nothing. A
passage is bound to the extraction its character offsets were measured in, so a parser upgrade
produces *new* passages instead of silently re-pointing old ones at words the author never quoted.
Chunks reference passages rather than identifying them, which is what makes retrieval tuning safe
to iterate on. Collisions fail closed. Scheme migrations add aliases and never rewrite stored
identifiers. The [identity boundary matrix](docs/iv-17-identifiers.md#11-identity-boundary-matrix)
states, per mutated input, exactly which identifiers must move and which must hold — and the test
suite asserts that partition in both directions:

```bash
npx lerna run test --scope @theia/ivory-identity
```

### Closed tracker issues

| Issue | Outcome |
|---|---|
| **IV-8** — Define Ivory Tower's academic-first Knowledge Intelligence product model | The canonical product model: object vocabulary (16 core objects plus 13 extended families, each with an identity rule and a provenance owner), the six-stage lifecycle, the supported-content matrix, non-goals, and a traceability matrix mapping all 125 phased issues to a lifecycle stage and a release gate or explicit post-V1 deferral. |
| **IV-102** — Conduct a systematic social-science tool, source, and adoption landscape review | A reproducible landscape review with claim-level source classification. Verdicts: visualization need documented at moderate confidence; equity of access supported as a design constraint; literature and OSF opportunities provisional; evidence-clearinghouse and CAQDAS opportunities unresolved; restricted federal microdata integration refuted. No demand evidence was found for multi-agent orchestration or model agnosticism, so both may be justified only as bounded architecture choices — never as user-facing market claims. Declared limitations (peer-reviewed source share below the review's own gate, US-weighted geography) stay visible rather than being treated as completion evidence. |

> [!NOTE]
> IV-8 and IV-102 are both published under [`docs/`](docs), IV-102 across three files — the
> review, its [protocol](docs/iv-102-chapter-plan.md), and its
> [claim/source record](docs/iv-102-phase1-literature-search-report.md). Read the review's
> limitations section before citing any figure from it: its declared peer-reviewed share sits
> below its own stated gate, and its geographic coverage is US-weighted.

## Roadmap

Seven phases. Phases 1–6 constitute V1; Phase 7 is explicitly post-V1. Each phase carries one
milestone, and every issue in the tracker belongs to exactly one.

| Phase | Milestone | Issues | Done |
|---|---|---:|---:|
| [1](#phase-1--v1--product-and-architecture-contract) | V1 — product and architecture contract | 23 | 2 |
| [2](#phase-2--v1--application-shell) | V1 — application shell | 9 | 0 |
| [3](#phase-3--v1--source-ingestion-and-inspection) | V1 — source ingestion and inspection | 11 | 0 |
| [4](#phase-4--v1--corpus-retrieval-and-provenance) | V1 — corpus, retrieval, and provenance | 17 | 0 |
| [5](#phase-5--v1--cited-research-workflow) | V1 — cited research workflow | 30 | 0 |
| [6](#phase-6--v1--visualization-verification-and-release-evidence) | V1 — visualization, verification, and release evidence | 19 | 0 |
| [7](#phase-7--post-v1--interoperability-and-advanced-capabilities) | Post-v1 — interoperability and advanced capabilities | 16 | 0 |

### Phase 1 — V1 — product and architecture contract

The contracts everything else is built against: the product model (IV-8), runtime topology and
repository architecture (IV-14), the canonical research object schema (IV-16), identifiers
(**IV-17, delivered**), typed service and API boundaries (IV-18), the staged research protocol and
claim-posture contract (IV-77), durable asynchronous job contracts (IV-78), immutable pipeline-run
manifests and artifact invalidation (IV-79), the supported-content and restricted-data policy
(IV-20), and the authorship, connection-warrant, critical-history, and bounded-survey contracts
(IV-113, IV-114, IV-117, IV-119, IV-122).

### Phase 2 — V1 — application shell

The workspace users actually see: the LiqUIdify GUI foundation and the Ivory Tower adapter layer
over it, the responsive research workspace shell and navigation, shared loading/empty/failure/retry
states, verified keyboard, focus, contrast, and reduced-motion behaviour, guided first-project
onboarding with a sample corpus, the progressive-disclosure method inspector, and the V1
authentication and project authorization boundary.

### Phase 3 — V1 — source ingestion and inspection

Getting sources in and looking at them honestly: immutable source storage and content hashing, the
ingestion state machine, Docling conversion with OCR fallback and extraction-quality diagnostics,
scholarly metadata resolution via Crossref and OpenAlex, deduplication and version reconciliation,
the PDF.js viewer with **stable passage deep links and highlight overlays** (IV-35), failure
recovery and reprocessing, content admission enforced *before* conversion, and survey dataset,
questionnaire, and codebook ingestion.

### Phase 4 — V1 — corpus, retrieval, and provenance

The substrate: PostgreSQL with pgvector and versioned migrations, provenance-preserving chunking,
embedding generation with model-version tracking, hybrid lexical-vector retrieval with filters and
surrounding-context expansion, claim/evidence/contradiction/interpretation persistence, entity
resolution and temporal relationships, reproducible citation formatting and export, **citation
validation with unsupported-claim rejection** (IV-46), corpus coverage and selection-rationale
reporting, structured extraction of reported data from text, tables, and figures, cross-paper
variable normalization, and survey weighting and data-quality preflight.

### Phase 5 — V1 — cited research workflow

The largest phase, and where the product becomes itself: an interchangeable AI-provider
abstraction with the AI SDK provider registry, capability-based agent contracts, a
provider-independent structured result envelope, the **structured cited-answer capability**
(IV-50), persistent research threads, scope and framing revision controls, uncertainty and
competing-interpretation representation, evidence-gap analysis, bounded literature review,
model/prompt/tool/source audit records, time-cost-source budgets, bounded qualitative annotation
and memo workflows, researcher adjudication of generated claims, provider data-egress enforcement,
the protected human-only notebook boundary, counter-archive and positionality workflows,
sensitive-identity non-inference protections, and researcher-approved descriptive survey analysis.

### Phase 6 — V1 — visualization, verification, and release evidence

Proving it works before shipping: research-native visualization primitives, the interactive
claim-evidence graph, the temporal evidence timeline, visualization-to-source navigation and
selection rationale, the golden benchmark harness, quality/latency/cost/failure telemetry, the
end-to-end **corpus-to-cited-conclusion acceptance suite** (IV-66), the security and privacy threat
model, V1 release gates and the supported-content matrix, verifiable dossier and reproducibility
package export, novice and expert comprehension validation before release, AI-contribution review
and purge manifests, and deterministic plotting from validated provenance-bearing datasets.

### Phase 7 — Post-v1 — interoperability and advanced capabilities

Deferred on purpose: controlled read-only MCP exposure with project-scoped client authorization,
Zotero and OSF connectors, a DuckDB statistical analysis sandbox, geographic and archaeological
map visualizations, multi-user workspace authorization and collaboration, the restricted-data
de-identification workflow, evaluation of Berry LLM as an optional provider, connector-demand
validation for federated literature, evidence clearinghouses, OSF, and CAQDAS interchange, and
domain-specific deliverable profiles.

## Repository layout

This repository is a fork of Eclipse Theia. Ivory Tower code is additive — the platform is used as
a platform, not rewritten.

| Path | Contents |
|---|---|
| [`docs/`](docs) | **Ivory Tower normative specifications**, named `iv-<n>-<slug>.md` |
| [`packages/ivory-*`](packages) | **Ivory Tower packages** (`@theia/ivory-identity` today) |
| [`packages/`](packages) | Theia runtime packages — core, editor, monaco, plugin system, AI extensions |
| [`dev-packages/`](dev-packages) | Theia build tooling — application manager, CLI, ESLint plugin, ext-scripts |
| [`examples/`](examples) | Sample applications — browser, electron, browser-only, playwright |
| [`doc/`](doc) | Upstream Theia developer documentation |
| [`configs/`](configs) | Shared TypeScript, ESLint, Mocha, and NYC configuration |
| [`CLAUDE.md`](CLAUDE.md) | Repository guidance for AI coding agents |
| [`.cursor/environment.json`](.cursor/environment.json) | Cursor Cloud remote development environment |
| [`AGENTS.md`](AGENTS.md) | Cloud-agent setup, verification, and constraints |

Each Ivory Tower package follows Theia's platform layout: `src/common` for code safe to import
anywhere, `src/browser` for frontend, `src/node` for backend. `@theia/ivory-identity` splits along
that line for a reason — grammar, preimages, and anchors are common; digests and minting are `node`
because they use `node:crypto`.

## Building and running

Requires Node.js ≥22. Use `npm`, not `yarn`.

```bash
npm install               # install dependencies and run post-install hooks
npm run compile           # compile TypeScript only
npm run build:browser     # build all packages and bundle the browser example
npm run start:browser     # serve the browser example at localhost:3000
npm run lint              # ESLint across all packages
npm test                  # run all tests
```

`npm run compile` compiles but does not bundle. Run `npm run build:browser` before UI testing, or
the running app will not include your changes.

Scoped to a single package:

```bash
npx lerna run compile --scope @theia/ivory-identity
npx lerna run test --scope @theia/ivory-identity
```

Full build and setup details are in [`doc/Developing.md`](doc/Developing.md).

## Observability (Sentry)

`ivory-api` and `ivory-worker` support optional error reporting through
[Sentry](https://sentry.io/). Sentry is **disabled by default**; set a DSN to
enable it. This is observability only — it does not replace container hosting
for the runtime stack.

| Variable | Default | Purpose |
|---|---|---|
| `SENTRY_DSN` | unset | Enables Sentry when set |
| `SENTRY_ENABLED` | auto | Optional `true`/`false` override |
| `SENTRY_ENVIRONMENT` | `IVORY_TOWER_ENV` | Sentry environment tag |
| `SENTRY_RELEASE` | unset | Optional release identifier |
| `SENTRY_TRACES_SAMPLE_RATE` | `0` | Tracing sample rate (`0`–`1`) |

Example:

```bash
SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project>
IVORY_TOWER_ENV=staging
SENTRY_RELEASE=ivory-tower@0.1.0
```

Events are scrubbed before they leave the process. Authorization headers and
evidence, source upload bodies, database URLs, tokens, and passage/content
fields are redacted. Unexpected API failures and terminal worker execution
failures are reported; retryable worker errors are skipped to avoid noise.

The adapter lives in
[`packages/ivory-tower-infrastructure/src/sentry.ts`](packages/ivory-tower-infrastructure/src/sentry.ts).
Theia browser frontend instrumentation is not wired yet.

## Contributing

- Work is tracked as `IV-<n>` issues in the
  [Issue Tracker](https://app.notion.com/p/3af9cb079ddb8001b65ed40b0b1ed594), not GitHub issues.
- Read the specification before the code. `docs/` is normative; a disagreement between the two is
  a defect in the code.
- Follow [`doc/coding-guidelines.md`](doc/coding-guidelines.md) — 4-space indentation, single
  quotes, `undefined` over `null`, explicit return types, property injection over constructor
  injection, and localized user-facing strings.
- Use Conventional Commit subjects: `type(scope): summary`, e.g.
  `feat(ivory-identity): define stable source, passage, and artifact identifiers`.
- Keep commit messages and pull request descriptions brief. Do not restate the diff.
- **Security:** never disclose a vulnerability in an issue or pull request. Report it per
  [`SECURITY.md`](SECURITY.md).

## Upstream Theia documentation

- [Developing](doc/Developing.md)
- [Testing](doc/Testing.md)
- [Coding Guidelines](doc/coding-guidelines.md)
- [Code Organization](doc/code-organization.md)
- [Plugin and VS Code API](doc/Plugin-API.md)
- [API Integration Testing](doc/api-testing.md)
- [Migration Guide](doc/Migration.md)
- [Theia General Documentation](https://theia-ide.org/docs/)
- [VS Code API Compatibility Report](https://eclipse-theia.github.io/vscode-theia-comparator/status.html)

## SBOM

A Software Bill of Materials is generated for every upstream Theia release and published to the
Eclipse Foundation SBOM registry; access instructions are in the
[Eclipse security handbook](https://eclipse-csi.github.io/security-handbook/sbom/registry.html).

Ivory Tower generates its own governance evidence separately (IV-19):

```sh
npm run dependency:policy   # licences, inventory, quality scope, image pins, adversarial fixtures
npm run secret:scan         # sentinel and credential scan
npm run sbom:generate       # CycloneDX SBOMs for the source tree and each deployable
npm run notices:generate    # deterministic third-party notices
```

The first two are part of the required `npm run verify:ivory-tower` gate; the last two produce
release evidence into the gitignored `artifacts/` directory, uploaded by CI. The policy itself is
[`configs/ivory-dependency-policy.json`](configs/ivory-dependency-policy.json) and is explained in
[`docs/iv-19-dependency-governance.md`](docs/iv-19-dependency-governance.md).

## License

- [Eclipse Public License 2.0](LICENSE-EPL)
- [一 (Secondary) GNU General Public License, version 2 with the GNU Classpath Exception](LICENSE-GPL-2.0-ONLY-CLASSPATH-EXCEPTION)

## Trademark

"Theia" is a **trademark of the Eclipse Foundation**. [Learn More](https://www.eclipse.org/theia)
