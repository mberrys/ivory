# Ivory Tower V1: Build vs. Open Source

Status: planning baseline hardened for scholarship trust, field reports, and initial research (2026-08-01); application platform decided (2026-08-02). Notion is the execution tracker; this file is the compact repository map. Individual issue bodies own detailed requirements, attributed callouts, and acceptance criteria.

- Tracker: [Ivory Tower Issue Tracker](https://app.notion.com/p/3af9cb079ddb8001b65ed40b0b1ed594)
- Shape: 130 flat issues, 705 estimate points, 0 parent relationships.
- V1: Phases 1-6, 113 issues, 587 points.
- Post-v1: Phase 7, 17 issues, 118 points.
- Sequencing: `Blocked by` relations only; IV-8 is the sole root; no epic/sub-issue hierarchy.
- Application platform: **Eclipse Theia, web-first, wrapped for desktop** — [ADR-001](adr-001-application-platform.md), 2026-08-02.
- Verified 2026-08-09 from the versioned cutline manifest: acyclic, single-rooted, no phase inversions, no V1-required issue blocked by Experimental or Post-V1 work. One Milestone value per phase.

<!-- BEGIN GENERATED: v1-cutline -->
## Generated V1 cutline reconciliation

- Tracker snapshot: 2026-08-09T19:04:41.219Z
- Repository commit: `0e168a1559cd2fb964424e979c53cbc705f9633f`
- Non-template issues: 130
- V1 phases: 1-6 (113 issues; 587 estimate points)
- Post-V1 phase: 7 (17 issues; 118 estimate points)

### Phase exit inventory

| Phase | Issues | Estimate points |
|---|---:|---:|
| Phase 1 | 24 | 111 |
| Phase 2 | 12 | 47 |
| Phase 3 | 11 | 56 |
| Phase 4 | 17 | 96 |
| Phase 5 | 30 | 173 |
| Phase 6 | 19 | 104 |

### Release-class inventory

| Release class | Issues | Estimate points |
|---|---:|---:|
| Required | 112 | 584 |
| Conditional | 1 | 3 |
| Experimental | 0 | 0 |
| Post-V1 | 17 | 118 |

### Dependency layers

- Layer 1: IV-8, IV-128
- Layer 2: IV-14, IV-77, IV-102, IV-104
- Layer 3: IV-15, IV-16, IV-19, IV-20, IV-103, IV-105, IV-113
- Layer 4: IV-17, IV-18, IV-21, IV-22, IV-27
- Layer 5: IV-4, IV-23, IV-28, IV-37, IV-67, IV-78, IV-79, IV-82, IV-92, IV-114, IV-117, IV-119, IV-129
- Layer 6: IV-5, IV-24, IV-25, IV-29, IV-32, IV-43, IV-48, IV-74, IV-122, IV-131, IV-132
- Layer 7: IV-26, IV-30, IV-33, IV-34, IV-49, IV-75, IV-80, IV-81, IV-83, IV-130
- Layer 8: IV-3, IV-31, IV-35, IV-38, IV-53, IV-56, IV-107
- Layer 9: IV-13, IV-36, IV-39, IV-45, IV-72, IV-87, IV-93, IV-101, IV-111, IV-123
- Layer 10: IV-40, IV-69, IV-94, IV-121
- Layer 11: IV-9, IV-41, IV-42, IV-70
- Layer 12: IV-44, IV-46, IV-47, IV-91
- Layer 13: IV-7, IV-50, IV-59, IV-84, IV-106
- Layer 14: IV-6, IV-51, IV-54, IV-55, IV-60, IV-61, IV-73, IV-96, IV-124
- Layer 15: IV-12, IV-52, IV-57, IV-62, IV-85, IV-86, IV-99
- Layer 16: IV-10, IV-58, IV-63, IV-95, IV-115, IV-118, IV-120
- Layer 17: IV-11, IV-97, IV-100, IV-125
- Layer 18: IV-65, IV-98, IV-126
- Layer 19: IV-64, IV-66, IV-88
- Layer 20: IV-76, IV-90, IV-108, IV-109, IV-110, IV-112, IV-116, IV-127
- Layer 21: IV-71, IV-89
- Layer 22: IV-68

### Issue classification

| Issue | Title | Phase | Release class | Status |
|---|---|---|---|---|
| IV-3 | Establish LiqUIdify GUI foundation | Phase 2 | Required | Backlog |
| IV-4 | Implement an interchangeable AI-provider abstraction layer | Phase 5 | Required | Backlog |
| IV-5 | Define capability-based AI agent contracts | Phase 5 | Required | Backlog |
| IV-6 | Create a cross-provider research-workflow benchmark harness | Phase 6 | Required | Backlog |
| IV-7 | Every conclusion should be inspectable | Phase 5 | Required | Backlog |
| IV-8 | Define Ivory Tower's academic-first Knowledge Intelligence product model | Phase 1 | Required | Done |
| IV-9 | Build a hybrid scholarly corpus and knowledge substrate | Phase 4 | Required | Backlog |
| IV-10 | Create a conversational research workspace with live visual analysis | Phase 6 | Required | Backlog |
| IV-11 | Implement research-native visualization primitives | Phase 6 | Required | Backlog |
| IV-12 | Implement evidence-led research investigation agents | Phase 5 | Required | Backlog |
| IV-13 | Expose controlled research semantic context through MCP | Phase 7 | Post-V1 | Backlog |
| IV-14 | Decide V1 runtime topology and repository architecture | Phase 1 | Required | In Progress |
| IV-15 | Scaffold the TypeScript web application and quality gates | Phase 1 | Required | Blocked |
| IV-16 | Define the canonical research object schema | Phase 1 | Required | Backlog |
| IV-17 | Define stable source, passage, and derived-artifact identifiers | Phase 1 | Required | Backlog |
| IV-18 | Define typed service and API boundaries | Phase 1 | Required | Backlog |
| IV-19 | Establish dependency licensing, SBOM, and version-pinning policy | Phase 1 | Required | Backlog |
| IV-20 | Define V1 supported-content and restricted-data policy | Phase 1 | Required | Backlog |
| IV-21 | Establish local development, migration, and seed workflow | Phase 1 | Required | Backlog |
| IV-22 | Define deployment, configuration, and secret-management contract | Phase 1 | Required | Backlog |
| IV-23 | Implement the Ivory Tower UI adapter layer over LiqUIdify | Phase 2 | Required | Backlog |
| IV-24 | Build the responsive research workspace shell and navigation | Phase 2 | Required | Backlog |
| IV-25 | Implement shared loading, empty, failure, and retry states | Phase 2 | Required | Backlog |
| IV-26 | Verify keyboard, focus, contrast, and reduced-motion behavior | Phase 2 | Required | Backlog |
| IV-27 | Execute a LiqUIdify compatibility and upgrade spike | Phase 2 | Required | Backlog |
| IV-28 | Implement immutable source storage and content hashing | Phase 3 | Required | Backlog |
| IV-29 | Implement the source upload and ingestion state machine | Phase 3 | Required | Backlog |
| IV-30 | Integrate the Docling document-conversion service | Phase 3 | Required | Backlog |
| IV-31 | Implement OCR fallback and extraction-quality diagnostics | Phase 3 | Required | Backlog |
| IV-32 | Implement scholarly metadata resolution using Crossref and OpenAlex | Phase 3 | Required | Backlog |
| IV-33 | Implement source deduplication and version reconciliation | Phase 3 | Required | Backlog |
| IV-34 | Integrate the PDF.js source viewer | Phase 3 | Required | Backlog |
| IV-35 | Implement stable passage deep links and highlight overlays | Phase 3 | Required | Backlog |
| IV-36 | Implement ingestion failure recovery and reprocessing controls | Phase 3 | Required | Backlog |
| IV-37 | Provision PostgreSQL, pgvector, and versioned schema migrations | Phase 4 | Required | Backlog |
| IV-38 | Implement provenance-preserving document chunking | Phase 4 | Required | Backlog |
| IV-39 | Implement embedding generation and model-version tracking | Phase 4 | Required | Backlog |
| IV-40 | Implement hybrid lexical-vector retrieval | Phase 4 | Required | Backlog |
| IV-41 | Implement corpus, source, date, entity, and content-type retrieval filters | Phase 4 | Required | Backlog |
| IV-42 | Implement surrounding-context expansion for retrieved passages | Phase 4 | Required | Backlog |
| IV-43 | Implement claim, evidence, contradiction, and interpretation persistence | Phase 4 | Required | Backlog |
| IV-44 | Implement entity resolution and temporal relationship modeling | Phase 4 | Required | Backlog |
| IV-45 | Implement reproducible citation formatting and export | Phase 4 | Required | Backlog |
| IV-46 | Implement citation validation and unsupported-claim rejection | Phase 4 | Required | Backlog |
| IV-47 | Build the retrieval and passage-anchor evaluation corpus | Phase 4 | Required | Backlog |
| IV-48 | Integrate the AI SDK provider registry and direct provider adapters | Phase 5 | Required | Backlog |
| IV-49 | Implement the provider-independent structured result envelope | Phase 5 | Required | Backlog |
| IV-50 | Implement the structured cited-answer capability | Phase 5 | Required | Backlog |
| IV-51 | Implement persistent conversational research threads | Phase 5 | Required | Backlog |
| IV-52 | Implement research scope and framing revision controls | Phase 5 | Required | Backlog |
| IV-53 | Implement uncertainty and competing-interpretation representation | Phase 5 | Required | Backlog |
| IV-54 | Implement the evidence-gap analysis capability | Phase 5 | Required | Backlog |
| IV-55 | Implement the bounded literature-review capability | Phase 5 | Required | Backlog |
| IV-56 | Implement model, prompt, tool, and source audit records | Phase 5 | Required | Backlog |
| IV-57 | Implement streaming research-response transport and cancellation | Phase 5 | Required | Backlog |
| IV-58 | Enforce capability-level time, cost, and source budgets | Phase 5 | Required | Backlog |
| IV-59 | Define the typed research visualization specification | Phase 5 | Required | Backlog |
| IV-60 | Implement the interactive claim-evidence graph | Phase 6 | Required | Backlog |
| IV-61 | Implement the temporal evidence timeline | Phase 6 | Required | Backlog |
| IV-62 | Implement visualization-to-source navigation | Phase 6 | Required | Backlog |
| IV-63 | Implement visualization selection rationale | Phase 6 | Required | Backlog |
| IV-64 | Implement the V1 golden benchmark harness | Phase 6 | Required | Backlog |
| IV-65 | Instrument quality, latency, cost, and failure telemetry | Phase 6 | Required | Backlog |
| IV-66 | Build the end-to-end corpus-to-cited-conclusion acceptance suite | Phase 6 | Required | Backlog |
| IV-67 | Complete the V1 security and privacy threat model | Phase 6 | Required | Backlog |
| IV-68 | Define V1 release gates and the supported-content matrix | Phase 6 | Required | Ready |
| IV-69 | Integrate the production MCP server SDK for controlled read-only access | Phase 7 | Post-V1 | Backlog |
| IV-70 | Implement project-scoped authorization for MCP clients | Phase 7 | Post-V1 | Backlog |
| IV-71 | Implement Zotero and OSF source connectors | Phase 7 | Post-V1 | Backlog |
| IV-72 | Implement a DuckDB-based statistical analysis sandbox | Phase 7 | Post-V1 | Backlog |
| IV-73 | Implement geographic and archaeological map visualizations | Phase 7 | Post-V1 | Backlog |
| IV-74 | Implement multi-user workspace authorization and collaboration | Phase 7 | Post-V1 | Backlog |
| IV-75 | Implement the restricted-data de-identification workflow | Phase 7 | Post-V1 | Backlog |
| IV-76 | Evaluate Berry LLM as an optional Ivory Tower provider | Phase 7 | Post-V1 | Backlog |
| IV-77 | Define staged research protocol and claim-posture contract | Phase 1 | Required | In Progress |
| IV-78 | Define and implement durable asynchronous job contracts | Phase 1 | Required | Backlog |
| IV-79 | Implement immutable pipeline-run manifests and artifact invalidation | Phase 1 | Required | Backlog |
| IV-80 | Implement guided first-project onboarding with a sample corpus | Phase 2 | Required | Backlog |
| IV-81 | Implement progressive-disclosure method inspector and vocabulary | Phase 2 | Required | Backlog |
| IV-82 | Implement V1 authentication and project authorization boundary | Phase 2 | Required | Backlog |
| IV-83 | Enforce supported-content admission before conversion | Phase 3 | Required | Backlog |
| IV-84 | Implement corpus coverage, selection-rationale, and extraction-quality report | Phase 4 | Required | Backlog |
| IV-85 | Implement bounded qualitative annotation, codebook, and memo workflow | Phase 5 | Required | Backlog |
| IV-86 | Implement researcher adjudication workflow for generated claims | Phase 5 | Required | Backlog |
| IV-87 | Enforce provider data-egress policy | Phase 5 | Required | Backlog |
| IV-88 | Export verifiable research dossier and reproducibility package | Phase 6 | Required | Backlog |
| IV-89 | Validate novice and expert research comprehension before release | Phase 6 | Required | Backlog |
| IV-90 | Implement operational recovery and immutable release evidence bundle | Phase 6 | Required | Backlog |
| IV-91 | Implement literature-candidate relevance adjudication and search refinement | Phase 4 | Required | Backlog |
| IV-92 | Define source-grounded reported-data and experimental-observation schema | Phase 1 | Required | Backlog |
| IV-93 | Extract structured reported data from text, tables, figures, and supplements | Phase 4 | Required | Backlog |
| IV-94 | Normalize cross-paper variables, units, conditions, and uncertainty | Phase 4 | Required | Backlog |
| IV-95 | Validate extracted-dataset completeness and adjudicate reported observations | Phase 5 | Required | Backlog |
| IV-96 | Convert researcher schemas and example plots into reviewable visualization specs | Phase 5 | Required | Backlog |
| IV-97 | Generate deterministic plots from validated provenance-bearing datasets | Phase 6 | Required | Backlog |
| IV-98 | Validate plot completeness, legibility, and dataset reconciliation | Phase 6 | Required | Backlog |
| IV-99 | Implement versioned reusable research workflow recipes and expert-run controls | Phase 5 | Required | Backlog |
| IV-100 | Implement quota-aware execution preflight and resumable checkpoints | Phase 5 | Required | Backlog |
| IV-101 | Implement content-addressed research artifact cache and reuse policy | Phase 5 | Required | Backlog |
| IV-102 | Conduct a systematic social-science tool, source, and adoption landscape review | Phase 1 | Required | Done |
| IV-103 | Validate the connector-and-workflow-layer product thesis against a standalone vertical application | Phase 1 | Required | Ready |
| IV-104 | Define and validate equity-of-access requirements and measurements | Phase 1 | Required | Ready |
| IV-105 | Define applied social-science personas and deliverable contracts | Phase 1 | Required | Ready |
| IV-106 | Validate federated social-science literature connector demand and architecture | Phase 7 | Post-V1 | Backlog |
| IV-107 | Validate evidence-clearinghouse and public social-dataset connector demand | Phase 7 | Post-V1 | Backlog |
| IV-108 | Validate OSF workflow demand and API feasibility | Phase 7 | Post-V1 | Backlog |
| IV-109 | Validate CAQDAS interchange demand and outcome safety | Phase 7 | Post-V1 | Backlog |
| IV-110 | Implement portable quantitative-analysis artifact interchange | Phase 7 | Post-V1 | Backlog |
| IV-111 | Implement authorized survey-platform ingestion connectors | Phase 7 | Post-V1 | Backlog |
| IV-112 | Implement domain-specific research deliverable profiles | Phase 7 | Post-V1 | Backlog |
| IV-113 | Define the researcher-authorship and AI-contribution constitution | Phase 1 | Required | Backlog |
| IV-114 | Extend the canonical schema for protected human records and model contributions | Phase 1 | Required | Backlog |
| IV-115 | Implement the protected human-only notebook and AI-suggestion boundary | Phase 5 | Required | Backlog |
| IV-116 | Implement AI-contribution review, diff, purge, and export manifests | Phase 6 | Required | Backlog |
| IV-117 | Define the typed research-connection proposal and warrant schema | Phase 1 | Required | Backlog |
| IV-118 | Implement inspectable connection surfacing and researcher adjudication | Phase 5 | Required | Backlog |
| IV-119 | Define the critical-history identity, terminology, and archive-context model | Phase 1 | Required | Backlog |
| IV-120 | Implement counter-archive, archival-silence, and positionality workflows | Phase 5 | Required | Backlog |
| IV-121 | Enforce sensitive-identity non-inference and anti-outing protections | Phase 5 | Required | Backlog |
| IV-122 | Define the bounded V1 survey-analysis and statistical-warrant contract | Phase 1 | Required | Backlog |
| IV-123 | Implement survey dataset, questionnaire, and codebook ingestion from authorized uploads | Phase 3 | Required | Backlog |
| IV-124 | Implement survey weighting, missingness, and data-quality preflight | Phase 4 | Required | Backlog |
| IV-125 | Implement researcher-approved descriptive survey analysis specifications | Phase 5 | Required | Backlog |
| IV-126 | Validate survey results, small cells, and causal-language boundaries | Phase 5 | Required | Backlog |
| IV-127 | Generate provenance-linked accessible survey tables, charts, and analysis packages | Phase 6 | Required | Backlog |
| IV-128 | Freeze the V1 cutline and phase-exit gates | Phase 1 | Required | Ready |
| IV-129 | Define Windows Acrylic material roles and fallback contract | Phase 2 | Required | Backlog |
| IV-130 | Implement and verify the Windows Electron Acrylic adapter | Phase 7 | Post-V1 | Backlog |
| IV-131 | Implement the Windows Acrylic V1 fallback (no adapter) | Phase 2 | Required | Backlog |
| IV-132 | Add accent blur window background preference option | Phase 2 | Conditional | Backlog |
<!-- END GENERATED: v1-cutline -->

## V1 contract

V1 is a private, academic-first research-dossier workflow with two bounded paths over one provenance model:

1. Create/select a project; establish purpose, provisional question/aim, research posture, and authorized scope.
2. Choose the allowlisted open scholarly-corpus/critical-history path or an authorized non-restricted survey-file path.
3. Admit immutable documents or survey files through the same fail-closed content, authorization, job, and audit boundary. For the scholarly path, the default corpus is limited to PMC OA, arXiv, DOAJ-indexed open-access journals, approved preprint repositories, and full text with an approved CC/public-domain license.
4. Inspect corpus/archive coverage or survey instrument/sample coverage, extraction/data quality, missingness, and processing destination.
5. Read, annotate, code, and memo in a protected human-only workspace; model suggestions remain separate proposals.
6. Retrieve evidence and surface typed connection proposals with method, exact anchors, counterevidence, alternatives, limitations, and review state.
7. For published reported data, define the extraction schema; extract, normalize, and adjudicate observations.
8. For survey data, review instrument/codebook, weights, denominators, missingness, skip logic, privacy, and design support.
9. Approve an allow-listed descriptive survey specification before deterministic computation; results remain analytical artifacts pending review.
10. Generate typed proposed claims, connections, evidence links, contradictions, interpretations, and method-specific uncertainty.
11. Let the researcher accept, revise, dispute, defer, reject, or request more/counterevidence without erasing the proposal or rationale.
12. Inspect every claim, connection, datum, result, table, or mark back to source passage/record or dataset snapshot, variable, transformation, and specification.
13. Produce a researcher-owned dossier; compile deterministic tables/plots only from adjudicated data and approved specifications.
14. Reconcile every dataset, result, table, and plot; reject incomplete, unsafe, unsupported, or inscrutable outputs.
15. Export evidence and structure without model prose, or explicitly approved synthesis, plus authorship, reproducibility, analysis, visualization, and audit manifests.

V1 excludes closed, paywalled, or license-ambiguous scholarly material outside the safe-open allowlist, restricted microdata, direct-identifier survey files, sensitive interviews, unapproved human-subject data, sensitive-identity inference, outbound MCP, multi-user collaboration, arbitrary statistical execution beyond approved survey operators, automated causal inference, full CAQDAS/NVivo-class analysis, maps, broad research-system connectors, and Berry LLM adoption.

### Safe-open scholarly corpus default

The scholarly path is intentionally large enough to test evidence extraction, provenance,
retrieval, adjudication, and dossier export without making unresolved rights clearance a
critical-path dependency. V1 acceptance uses only:

- PMC Open Access full text, with the article-level license or reuse terms recorded.
- arXiv full text, with the canonical record, version, and repository terms recorded.
- DOAJ-indexed open-access journal full text, with article-level terms verified.
- Full text from an approved preprint repository with explicit reuse terms.
- Other full text carrying an approved CC or public-domain license.

“Publicly reachable,” “indexed,” or “the researcher says they are authorized” is not enough
for the default path. Missing or ambiguous source terms fail closed before conversion.
Broader licensed, paywalled, or researcher-authorized material may be revisited through a
separate policy decision, but does not count toward V1 acceptance or release evidence.

## Review synthesis

The senior engineering review found six unowned delivery contracts: durable jobs, pipeline manifests/invalidation, V1 authorization, pre-conversion admission, provider-egress enforcement, and operational recovery/release evidence. These are now IV-78, IV-79, IV-82, IV-83, IV-87, and IV-90.

The professor/student debate converged on: **no methodological gate before reading; no methodological amnesia afterward**.

| Tension | V1 resolution |
|---|---|
| Expert rigor vs. novice activation | One canonical state with guided and skip-capable expert presentations; plain-language consequences first, technical representations on demand. |
| Fixed protocol vs. inquiry that evolves through reading | Staged commitment: `exploratory -> specified -> export_snapshot`; revisions branch and preserve predecessor, rationale, changed scope, and affected artifacts. |
| Statistical sampling vs. qualitative corpus construction | First-class purposive, theoretical, archival, case-based, convenience, exhaustive, and probability-based selection modes; validity rules follow the declared research posture. |
| Reproducibility vs. competing interpretations | Reconstructable run and branch lineage, not one mandated interpretation or identical model prose. |
| Fast synthesis vs. researcher authority | Generated claims and prose begin as proposals; protected human records cannot be mutated, and evidence/structure remain useful after generated prose is purged. |
| Graphical sophistication vs. communicable scholarship | The researcher-owned dossier is primary; graph/timeline views are optional, justified, source-linked, and paired with structured alternatives. |

Persistent primary-path disclosures: current question/aim, source or sample scope, material extraction/coverage/missingness warnings, external processing destination, budget truncation, authorship, connection warrant, analysis specification, and review state. Hashes, query syntax, ranking weights, model/tool versions, and complete manifests may be collapsed but never omitted from persistence or export.

### Initial Research reconciliation

[Initial Research](https://app.notion.com/p/3af9cb079ddb80cfa227f55449a2199f) is now an explicit tracker source. It contributes four V1 research/requirements issues without expanding the reviewed runtime boundary:

- IV-102 makes the quick software/source scan systematic and distinguishes vendor capability evidence from independent adoption evidence.
- IV-103 tests connector/workflow layer vs. centralized vertical vs. bounded hybrid before breadth becomes architecture.
- IV-104 defines equity-of-access scenarios, dependency disclosures, privacy-preserving measurements, and a minimum useful path.
- IV-105 defines evidence-backed applied personas and deliverable contracts while retaining the researcher-owned dossier as V1 default.

The completed [IV-102 landscape review](iv-102-landscape-review.md) changes the evidence status of those consequences. The safe-open scholarly corpus is the bounded V1 baseline; federated literature connectors (IV-106) and OSF workflows (IV-108) are provisional; evidence-clearinghouse/public-dataset connectors (IV-107) and CAQDAS interchange (IV-109) are unresolved. Those four tracker items are therefore research gates rather than approved implementation work. Quantitative artifact interchange (IV-110) has moderate demand support through documented cross-statistical-software friction. Authorized survey connectors (IV-111) retain an evidence-backed institutional substrate but still require workflow-demand and policy validation. Domain-specific deliverable profiles (IV-112) remain dependent on IV-105.

The same review treats visualization need and equity-of-access as supported constraints, provider/model portability as an architecture and governance concern rather than demonstrated user demand, and restricted-data handling as a fail-closed obligation rather than a differentiator. Census FSRDC data is architecturally out of scope because the enclave permits neither internet access nor downloads. No broad connector or arbitrary-code promise enters V1; every future adapter must reuse the reviewed admission, authorization, durable-job, provenance, egress, and release-evidence contracts.

### Scholarship trust contract

The product promise is: **Ivory Tower does not write the scholarship. It preserves evidence, surfaces inspectable leads, tests research moves, and leaves argument, interpretation, ethical judgment, and final voice to the researcher.**

| Contract | V1 issues | Required behavior |
|---|---|---|
| Researcher authorship | IV-113–IV-116 | Protected human records; scoped model access; proposal/revision lineage; contribution diff, purge, evidence-only export, authorship manifest. |
| Meaningful connections | IV-117–IV-118 | Typed warrant; exact evidence/computation; counterevidence, alternatives, limitations; researcher adjudication before graph/claim/export promotion. |
| Critical histories | IV-119–IV-121 | Temporal and contested identity/term assertions; archive power and silence; counter-archives and positionality; no identity inference or outing. |
| Bounded survey analysis | IV-122–IV-127 | Authorized manual upload; instrument/codebook preservation; preflight; researcher-approved descriptive spec; result/privacy/causal validation; accessible reproducible package. |

The critical-history scholar and non-programmer survey student use different method surfaces but one canonical authorship, evidence, provenance, privacy, adjudication, and export model. Fair representation is never reduced to a score; statistical association is never promoted to causation.

### Claude Science failure pattern to prevent

The supplied biomedical-engineer field report exposed a stage-boundary failure: strong literature discovery, weak reported-data extraction, incomplete/inscrutable plots, improvement only after the user supplied a completed example, and rapid quota exhaustion. V1 therefore treats these as different contracts:

```text
candidate papers
  -> accessible full text
  -> extracted observations
  -> normalized comparable dataset
  -> researcher-adjudicated completeness
  -> approved visualization specification
  -> deterministic plot
  -> plot/dataset reconciliation
```

- IV-91 owns candidate relevance decisions and search refinement.
- IV-92–IV-95 own datum identity, multi-modal extraction, normalization, completeness, and adjudication.
- IV-96–IV-98 own exemplar-to-spec translation, deterministic plots, and plot validation.
- IV-99 owns reusable expert workflow recipes; IV-100–IV-101 own quota-aware planning/resume and policy-safe cache reuse.
- Discovery success never masks a failure in a later stage; benchmarks, telemetry, export, and release gates report each separately.

## Ownership boundary

| Layer | Reuse | Ivory Tower owns |
|---|---|---|
| Runtime | Eclipse Theia platform (browser + desktop targets); React/TypeScript | Topology, module boundaries, failure semantics, configuration, surface boundary |
| Execution | Maintained queue/outbox/worker primitives | Run identity, idempotency, leases, state machine, retry/cancel/fencing semantics |
| UI | Theia workbench chrome; LiqUIdify, Ark UI, Framer Motion, Lucide inside Ivory Tower views | UI adapter, research workspace, evidence UX, accessibility proof on every shipped surface |
| Method UX | Disclosure/help primitives | Research postures, staged protocols, plain/canonical vocabulary mapping |
| Documents | Docling, OCR engine, PDF.js | Source identity, ingestion lifecycle, normalized passages, anchors, quality policy |
| Persistence | PostgreSQL, pgvector, full-text search | Research schema, migrations, retention, provenance invariants |
| AI transport | Vercel AI SDK and provider adapters | Capability contracts, result envelope, budgets, validation, audit |
| Retrieval | pgvector and PostgreSQL ranking primitives | Chunk policy, fusion, filters, context expansion, evaluation |
| Reported data | Table/figure parsers, unit libraries, domain ontologies | Observation schema, exact anchors, normalization, missingness, adjudication, completeness |
| Citations | Crossref/OpenAlex; citation-formatting libraries | Matching, corrections, evidence links, exports, rejection policy |
| Landscape evidence | Bibliographic registries and review-management primitives | Protocol, source classes, claim evidence, confidence, dated product implications |
| Qualitative work | Editor/tagging primitives | Versioned annotations, code definitions/assignments, memos, authorship |
| Authorship | Editor/diff/event primitives | Protected human records, proposal lifecycle, scoped model access, contribution manifest, safe purge |
| Research connections | Retrieval/graph/ranking primitives | Relation and warrant taxonomy, evidence/counterevidence binding, limitations, adjudication |
| Critical histories | Temporal graph and vocabulary primitives | Contested assertions, term context, archive power/silence, positionality privacy, anti-inference |
| Survey analysis | Hardened tabular parser and embedded analytical primitives | Instrument/dataset identity, preflight, allow-listed specs, result validation, disclosure control |
| Visualization | Cytoscape.js; Vega-Lite/D3 | Typed specs, datum binding, deterministic compilation, reconciliation, source navigation |
| Security | Maintained auth/session/policy libraries | Project authorization, content admission, provider-egress policy |
| Export | Serializers, archives, digests, document tooling | Research-dossier contract, reproducibility manifest, redaction, verification |
| Efficiency | Provider usage metadata, cache/storage primitives | Preflight plans, quotas, checkpoints, semantic cache keys, reuse/invalidation policy |
| Verification | Vitest, Playwright, axe-core, Promptfoo, OpenTelemetry | Ground truth, rubrics, release thresholds, privacy/security gates |
| Interoperability | Official MCP SDK | Project authorization, scoped resources, audit, stable references |
| Post-v1 source connectors | Official APIs, public releases, maintained clients | Capability matrices, access policy, identity, provenance, coverage and revision semantics; broad connectors remain outside the safe-open V1 baseline |
| Post-v1 research-tool interchange | REFI-QDA, notebook/environment and open tabular formats | Canonical mappings, loss reports, safe execution boundary, compatibility and lineage |

External packages remain behind owned adapters. Generic RAG or agent frameworks must not own the domain model, canonical persistence, provenance chain, or authorization policy.

## Application platform and topology

**Decided (2026-08-02, [ADR-001](adr-001-application-platform.md)):** Ivory Tower is built on **Eclipse Theia**, deployed **web-first and wrapped for desktop**. Surfaces ship in the order hosted web → desktop wrapper → CLI → editor extension, and no surface may hold product logic: every surface is a client of the IV-18 typed API. Theia owns the workbench chrome; LiqUIdify is scoped to Ivory Tower's own Theia views (see ADR-001 §3.1). The plugin host is disabled or first-party allow-listed in V1, because an arbitrary-extension surface would defeat the IV-83 and IV-87 chokepoints.

Implementation is a **literal source fork** of Theia v1.74.0 at [`mberrys/ivory-tower`](https://github.com/mberrys/ivory-tower), branch `stable` (resolved 2026-08-02). Fork-maintenance discipline: minimize divergence in files upstream owns; prefer new packages under `packages/` to edits of existing ones (ADR-001 §3.7).

The remaining IV-14 questions — queue technology, object storage, migration ownership, per-boundary failure models, local Docling bundling, and upstream sync cadence — are open and tracked in ADR-001 §6.

The supporting stack:

- TypeScript web application and API.
- Durable job contract and queue boundary shared by independently deployable web and workers.
- Python Docling worker behind a versioned conversion port.
- PostgreSQL plus pgvector as canonical store and hybrid-search substrate.
- Immutable filesystem/object storage for source bytes.
- AI SDK provider registry with at least two direct provider adapters; gateway optional.
- PDF.js source viewer; Cytoscape.js claim-evidence graph; conditional timeline renderer.
- Vega-Lite or equivalent adapter for bounded reported-data charts compiled from accepted observations.
- Maintained embedded analytical engine behind a typed, isolated V1 survey-operator allow-list; no ambient files, network, credentials, SQL, or arbitrary code.
- V1 authentication plus project authorization; admission and egress checks fail closed.

## Critical path

Derived from the tracker's `Blocked by` relations, not maintained by hand. Each arrow is one dependency layer: every issue on a line is reachable only after every line above it. Regenerate this block whenever relations change — the previous hand-written version had drifted to the point where 75 of its 83 entries sat at the wrong depth.

```text
IV-8, IV-128
  -> IV-14, IV-77, IV-102, IV-104
  -> IV-15, IV-16, IV-19, IV-20, IV-103, IV-105, IV-113
  -> IV-17, IV-18, IV-21, IV-22, IV-27
  -> IV-4, IV-23, IV-28, IV-37, IV-67, IV-78, IV-79, IV-82, IV-92, IV-114, IV-117, IV-119, IV-129
  -> IV-5, IV-24, IV-25, IV-29, IV-32, IV-43, IV-48, IV-74, IV-122, IV-131, IV-132
  -> IV-26, IV-30, IV-33, IV-34, IV-49, IV-75, IV-80, IV-81, IV-83, IV-130
  -> IV-3, IV-31, IV-35, IV-38, IV-53, IV-56, IV-107
  -> IV-13, IV-36, IV-39, IV-45, IV-72, IV-87, IV-93, IV-101, IV-111, IV-123
  -> IV-40, IV-69, IV-94, IV-121
  -> IV-9, IV-41, IV-42, IV-70
  -> IV-44, IV-46, IV-47, IV-91
  -> IV-7, IV-50, IV-59, IV-84, IV-106
  -> IV-6, IV-51, IV-54, IV-55, IV-60, IV-61, IV-73, IV-96, IV-124
  -> IV-12, IV-52, IV-57, IV-62, IV-85, IV-86, IV-99
  -> IV-10, IV-58, IV-63, IV-95, IV-115, IV-118, IV-120
  -> IV-11, IV-97, IV-100, IV-125
  -> IV-65, IV-98, IV-126
  -> IV-64, IV-66, IV-88
  -> IV-76, IV-90, IV-108, IV-109, IV-110, IV-112, IV-116, IV-127
  -> IV-71, IV-89
  -> IV-68
```

The longest chain is 21 links — V1 is close to serial, and roughly half of the tracker's `Blocked by` edges are transitively redundant, so layer width understates real parallelism until those are pruned:

```text
IV-8 -> IV-77 -> IV-16 -> IV-17 -> IV-28 -> IV-29 -> IV-30 -> IV-38 -> IV-39 -> IV-40
  -> IV-42 -> IV-46 -> IV-50 -> IV-51 -> IV-52 -> IV-63 -> IV-97 -> IV-98 -> IV-88
  -> IV-116 -> IV-89 -> IV-68
```

UI track: `IV-27 -> IV-23 -> IV-24/IV-25 -> IV-80/IV-81 -> IV-26`. IV-113/IV-117/IV-119/IV-122 gate IV-80/IV-81 but no longer sit behind Phase 4-5 implementation work.

## Tracker map

### Phase 1 - Product and architecture contract (24 issues, 111 points)

- IV-8 Define the academic-first Knowledge Intelligence product model.
- IV-14 Decide runtime topology and repository architecture.
- IV-15 Scaffold the TypeScript application and quality gates.
- IV-16 Define the canonical research object schema.
- IV-17 Define stable source, passage, and artifact identifiers.
- IV-18 Define typed service and API boundaries.
- IV-19 Establish licensing, SBOM, and pinning policy.
- IV-20 Define supported-content and restricted-data policy.
- IV-21 Establish local development, migrations, and seed workflow.
- IV-22 Define deployment, configuration, and secret management.
- IV-77 Define staged research protocol and claim-posture contract.
- IV-78 Define and implement durable asynchronous job contracts.
- IV-79 Implement immutable pipeline-run manifests and artifact invalidation.
- IV-92 Define source-grounded reported-data and experimental-observation schema.
- IV-102 Conduct a systematic social-science tool, source, and adoption landscape review.
- IV-103 Validate the connector-and-workflow-layer product thesis against a standalone vertical application.
- IV-104 Define and validate equity-of-access requirements and measurements.
- IV-105 Define applied social-science personas and deliverable contracts.
- IV-113 Define the researcher-authorship and AI-contribution constitution.
- IV-114 Extend the canonical schema for protected human records and model contributions.
- IV-117 Define the typed research-connection proposal and warrant schema.
- IV-119 Define the critical-history identity, terminology, and archive-context model.
- IV-122 Define the bounded V1 survey-analysis and statistical-warrant contract.
- IV-128 Freeze the V1 cutline and phase-exit gates.

### Phase 2 - Application shell (12 issues, 47 points)

- IV-3 Establish the LiqUIdify GUI integration contract.
- IV-23 Implement the Ivory Tower UI adapter over LiqUIdify.
- IV-24 Build responsive research workspace shell and navigation.
- IV-25 Implement shared loading, empty, failure, and retry states.
- IV-26 Verify keyboard, focus, contrast, and reduced motion.
- IV-27 Execute LiqUIdify compatibility and upgrade spike.
- IV-80 Implement guided first-project onboarding with a sample corpus.
- IV-81 Implement progressive-disclosure method inspector and vocabulary.
- IV-82 Implement V1 authentication and project authorization boundary.
- IV-129 Define Windows Acrylic material roles and fallback contract.
- IV-131 Implement the Windows Acrylic V1 fallback (no adapter).
- IV-132 Add accent blur window background preference option (Conditional).

### Phase 3 - Source ingestion and inspection (11 issues, 56 points)

- IV-28 Implement immutable source storage and content hashing.
- IV-29 Implement source upload and ingestion state machine.
- IV-30 Integrate Docling conversion service.
- IV-31 Implement OCR fallback and extraction diagnostics.
- IV-32 Resolve scholarly metadata with Crossref and OpenAlex.
- IV-33 Implement source deduplication and version reconciliation.
- IV-34 Integrate PDF.js source viewer.
- IV-35 Implement stable passage deep links and highlights.
- IV-36 Implement failure recovery and controlled reprocessing.
- IV-83 Enforce supported-content admission before conversion.
- IV-123 Implement survey dataset, questionnaire, and codebook ingestion from authorized uploads.

### Phase 4 - Corpus, retrieval, and provenance (17 issues, 96 points)

- IV-9 Integrate the hybrid scholarly corpus and knowledge substrate.
- IV-37 Provision PostgreSQL, pgvector, and migrations.
- IV-38 Implement provenance-preserving chunking.
- IV-39 Implement embeddings and model-version tracking.
- IV-40 Implement hybrid lexical-vector retrieval.
- IV-41 Implement corpus/source/date/entity/content filters.
- IV-42 Implement surrounding-context expansion.
- IV-43 Persist claims, evidence, contradictions, and interpretations.
- IV-44 Implement entity resolution and temporal relationships.
- IV-45 Implement reproducible citation formatting and export.
- IV-46 Validate citations and reject unsupported claims.
- IV-47 Build retrieval and passage-anchor evaluation corpus.
- IV-84 Implement corpus coverage, selection-rationale, and extraction-quality report.
- IV-91 Implement literature-candidate relevance adjudication and search refinement.
- IV-93 Extract structured reported data from text, tables, figures, and supplements.
- IV-94 Normalize cross-paper variables, units, conditions, and uncertainty.
- IV-124 Implement survey weighting, missingness, and data-quality preflight.

### Phase 5 - Research dossier workflow (30 issues, 173 points)

- IV-4 Integrate the provider abstraction contract.
- IV-5 Define capability-based AI contracts.
- IV-7 Enforce end-to-end inspectable conclusions.
- IV-12 Integrate bounded evidence-led research capabilities.
- IV-59 Define typed research visualization specification.
- IV-48 Integrate AI SDK registry and direct provider adapters.
- IV-49 Implement provider-independent structured result envelope.
- IV-50 Implement structured cited-answer capability.
- IV-51 Implement persistent conversational research threads.
- IV-52 Implement scope and framing revision controls.
- IV-53 Represent uncertainty and competing interpretations.
- IV-54 Implement evidence-gap analysis.
- IV-55 Implement bounded literature review.
- IV-56 Persist model, prompt, tool, and source audit records.
- IV-57 Implement streaming transport and cancellation.
- IV-58 Enforce time, cost, and source budgets.
- IV-85 Implement bounded qualitative annotation, codebook, and memo workflow.
- IV-86 Implement researcher adjudication workflow for generated claims.
- IV-87 Enforce provider data-egress policy.
- IV-95 Validate extracted-dataset completeness and adjudicate reported observations.
- IV-96 Convert researcher schemas and example plots into reviewable visualization specs.
- IV-99 Implement versioned reusable research workflow recipes and expert-run controls.
- IV-100 Implement quota-aware execution preflight and resumable checkpoints.
- IV-101 Implement content-addressed research artifact cache and reuse policy.
- IV-115 Implement the protected human-only notebook and AI-suggestion boundary.
- IV-118 Implement inspectable connection surfacing and researcher adjudication.
- IV-120 Implement counter-archive, archival-silence, and positionality workflows.
- IV-121 Enforce sensitive-identity non-inference and anti-outing protections.
- IV-125 Implement researcher-approved descriptive survey analysis specifications.
- IV-126 Validate survey results, small cells, and causal-language boundaries.

### Phase 6 - Visualization, verification, and release evidence (19 issues, 104 points)

- IV-6 Define the cross-provider benchmark contract.
- IV-10 Integrate the conversational research workspace.
- IV-11 Integrate research-native visualization primitives.
- IV-60 Implement interactive claim-evidence graph.
- IV-61 Implement conditional temporal evidence timeline.
- IV-62 Implement visualization-to-source navigation.
- IV-63 Implement visualization selection rationale.
- IV-64 Implement V1 golden benchmark harness.
- IV-65 Instrument quality, latency, cost, and failures.
- IV-66 Build end-to-end acceptance suite.
- IV-67 Complete security and privacy threat model.
- IV-68 Define release gates and supported-content matrix.
- IV-88 Export verifiable research dossier and reproducibility package.
- IV-89 Validate novice and expert research comprehension before release.
- IV-90 Implement operational recovery and immutable release evidence bundle.
- IV-97 Generate deterministic plots from validated provenance-bearing datasets.
- IV-98 Validate plot completeness, legibility, and dataset reconciliation.
- IV-116 Implement AI-contribution review, diff, purge, and export manifests.
- IV-127 Generate provenance-linked accessible survey tables, charts, and analysis packages.

### Phase 7 - Explicitly post-v1 (17 issues, 118 points)

- IV-13 Define controlled semantic access through MCP.
- IV-69 Integrate production MCP server SDK.
- IV-70 Implement project-scoped MCP authorization.
- IV-71 Implement Zotero and OSF connectors.
- IV-72 Implement DuckDB statistical-analysis sandbox.
- IV-73 Implement geographic and archaeological maps.
- IV-74 Implement multi-user authorization and collaboration.
- IV-75 Implement restricted-data de-identification workflow.
- IV-76 Evaluate Berry LLM as an optional provider.
- IV-106 Validate federated social-science literature connector demand and architecture.
- IV-107 Validate evidence-clearinghouse and public social-dataset connector demand.
- IV-108 Validate OSF workflow demand and API feasibility.
- IV-109 Validate CAQDAS interchange demand and outcome safety.
- IV-110 Implement portable quantitative-analysis artifact interchange.
- IV-111 Implement authorized survey-platform ingestion connectors.
- IV-112 Implement domain-specific research deliverable profiles.
- IV-130 Implement and verify the Windows Electron Acrylic adapter.

## Non-negotiable release gates

- No displayed AI claim lacks validated, authorized passage evidence.
- No plotted or exported datum lacks a reviewed observation/result identity and exact source or dataset/specification anchor.
- No model-proposed claim, connection, prose derivative, or analytical result is represented as researcher-approved without recorded adjudication.
- Protected human notes cannot be read or mutated by a model without a bounded, revocable, operation-specific grant.
- Every retained model contribution is inspectable; generated prose can be purged while preserving evidence, human work, deterministic results, and required audit lineage.
- Every proposed connection states why it was surfaced, its warrant type, exact support, counterevidence, alternatives, limitations, and review state.
- Contested identities and terminology retain speaker/creator, assertion type, time, place, and institutional/archive context; unknown identity remains unknown.
- Sensitive-identity inference, outing, unsafe linkage, and small-group disclosure fail closed across retrieval, models, charts, exports, logs, and caches.
- Survey analysis requires authorized non-restricted inputs, instrument/codebook preservation, resolved preflight, an approved allow-listed specification, deterministic execution, result reconciliation, and association-versus-causation limits.
- Exact passage links survive reload and unchanged-source reprocessing.
- Protocol, source, passage, job, pipeline, model, prompt, tool, retrieval, validation, human decision, and export versions are reconstructable.
- Restricted content is rejected before conversion or external transmission.
- The default scholarly corpus contains only PMC OA, arXiv, DOAJ-indexed open-access journal full text, approved preprint-repository full text, or full text with an approved CC/public-domain license; source/version/terms are persisted and ambiguous terms fail closed.
- External provider dispatch is project-authorized, disclosed, policy-approved, and fail-closed.
- Keyboard-only users can complete the vertical slice; graphs have structured alternatives.
- Dependency policy, SBOM, secret scans, migrations, threat mitigations, and deterministic end-to-end tests pass.
- Benchmark results separate ingestion, retrieval, model, validation, latency, cost, and infrastructure failures.
- Literature-candidate relevance, full-text access, datum extraction, normalization, dataset completeness, and plot reconciliation pass independently; discovery success cannot compensate for downstream failure.
- Every verified plot reconciles accepted observations to rendered, aggregated, or explicitly excluded marks and passes unit, uncertainty, legibility, and accessibility checks.
- High-cost work presents a preflight upper bound; quota exhaustion checkpoints completed work and resumes without repeating compatible stages.
- Critical-history scholars, non-programmer survey students, novice users, and experts complete their applicable workflow and correctly identify scope, extraction/data problems, evidence/warrant type, authorship, privacy, missingness, and unsupported claims; critical comprehension failures block release.
- Backup/restore, worker drain/recovery, migration recovery, and object-store/database reconciliation drills pass for the release artifact.
- Product landscape and adoption claims distinguish vendor capability evidence from independently supported prevalence claims; unresolved evidence remains explicit.
- The minimum useful V1 path is validated under constrained institutional access, provider quota, bandwidth, hardware, and tool literacy, with corpus and cost consequences disclosed.
- Post-v1 capabilities are not represented as V1 completion.
