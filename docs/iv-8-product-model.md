# IV-8 — Ivory Tower product model

**Status:** delivered · **Phase** 1 · **Milestone:** V1 — product and architecture contract
**Issue:** [IV-8](https://app.notion.com/p/3b09cb079ddb81559d77ff7dc817b3a1)

This document is the canonical product model. It names what Ivory Tower is, what it
refuses to be, the objects it manipulates, the lifecycle it supports, the content it
admits, and the mapping from every planned issue to that model.

It is **normative for product scope**. Where a downstream issue and this document
disagree about what the product is, this document governs and the issue is
reconciled. It is **not** normative for schema field sets (IV-16), enforcement
mechanics (IV-20, IV-83, IV-87), or release criteria (IV-68); it fixes the contract
those issues implement.

**How to read it.** §1–§5 are the model. §6 states what evidence supports it and,
just as importantly, what does not. §7 maps all 125 phased issues onto it. §8 states
the finite workflow that makes V1 falsifiable. §9 records how the checkable claims in
this document were verified.

---

## 1. Product definition

### 1.1 What Ivory Tower is

**Ivory Tower is an AI research operating system for knowledge work, with academia as
the first and best-supported domain.**

The load-bearing word is *operating system*. Ivory Tower is not a feature bolted onto
reading, nor a chat window pointed at a folder of PDFs. It is the environment in which
a piece of research is conducted end to end: sources are admitted, evidence is
extracted, claims are made and contested, interpretations are authored and revised,
and a deliverable is produced — with every step inspectable and every conclusion
traceable to the bytes that support it.

The governing principle, which §6 grounds in evidence, is **accountable
augmentation**: the system may do work, but the researcher retains authorship of the
analysis and responsibility for the claims. Every capability in this document is
constrained by that principle. Where a capability would move interpretive
responsibility from the researcher to the system, it is out of scope — not because it
is technically infeasible, but because it destroys the product's reason to exist.

### 1.2 The two bounded V1 paths

V1 is deliberately narrow. It supports exactly two workflows, both provenance-first,
both ending in a researcher-owned deliverable.

**Path A — allowlisted open scholarly corpus → research dossier.**
A researcher assembles a corpus from V1's allowlisted open sources, and Ivory Tower
produces a dossier: claims with cited evidence, surfaced contradictions, explicit gaps,
stated limitations, and — only where the researcher approves it — synthesis. Every
claim in the dossier resolves to a passage in a source version. Researcher authorization
alone does not admit a source outside the V1 allowlist.

**Path B — authorized, non-restricted survey file → validated descriptive analysis.**
A researcher uploads a survey dataset with its instrument and codebook, and Ivory
Tower produces descriptive analysis: weighted estimates within approved operators,
data-quality preflight, small-cell suppression, and provenance-linked tables and
charts. Every number resolves to an analysis specification the researcher approved and
a dataset whose lineage is recorded.

The two paths share one staged, versioned state. A guided user and an expert user
travel the same object graph at different levels of disclosure; they do not use
different products.

### 1.3 What Ivory Tower is not

These are boundaries, not backlog items. Each names a product that Ivory Tower could
plausibly be mistaken for, and rejects it.

| Not | Why not |
|---|---|
| **A paper writer** | The deliverable is a dossier of defensible research moves, not prose for submission. Generating manuscript text transfers authorship to the system, which §1.1 forbids. |
| **A generic dashboard** | Visualizations are analytical views over evidence, subordinate to the research workflow. A chart that cannot navigate to its source passage is not a product feature here. |
| **An autonomous analyst** | The system proposes; the researcher adjudicates. No claim reaches a deliverable without a researcher decision recorded against it. |
| **An unrestricted statistician** | V1 executes only approved descriptive operators over admitted survey data. Arbitrary statistical execution and causal inference are excluded (§5). |
| **An unrestricted document-chat system** | Conversation is a control surface over an evidence graph, not an end in itself. An answer that cannot be resolved to passages is a failure, not a degraded success. |

### 1.4 Category boundary

Ivory Tower is differentiated from adjacent categories not by having more features but
by holding a property none of them holds: **an unbroken, inspectable chain from
deliverable back to source bytes.**

| Category | What it does well | What it cannot do |
|---|---|---|
| Reference managers | Collect, cite, organize bibliography | No evidence layer beneath the citation; a citation is an entry, not a claim about a passage |
| Note-taking and PKM tools | Capture and link a researcher's own thinking | Notes are unanchored; nothing ties a note to the bytes that justify it |
| Document chat | Answer questions over a document set | Answers are ephemeral and unversioned; no persistent claim, evidence, or contradiction object survives the session |
| Network visualization | Show structure in a graph | The graph is the output; there is no path from a node back to the evidence that placed it there |
| BI dashboards | Aggregate and display metrics | Presumes a tabular fact model that research material does not have (§2.4) |

### 1.5 The default V1 result

A **researcher-owned research dossier** containing: the sources admitted and why, the
evidence extracted, the claims made and their support, the contradictions found, the
gaps identified, the limitations retained, and — at the researcher's explicit
approval — synthesis. Visualizations are optional analytical views over that dossier,
never a substitute for it.

---

## 2. The canonical object vocabulary

### 2.1 Provenance ownership is the spine

Every object in Ivory Tower carries a **provenance owner**, and the whole model rests
on keeping these four apart:

| Owner | Meaning | Example |
|---|---|---|
| `source` | Asserted by the source material itself | A passage; the bytes of a source version |
| `human` | Authored or decided by the researcher | An interpretation; an adjudication; a corpus selection |
| `model` | Proposed by an AI capability | A candidate claim; a proposed connection |
| `derived` | Computed deterministically from other objects | An artifact; an entity resolution; a citation string |

Collapsing these is the central failure mode of research tooling. A system that cannot
distinguish "the paper says X," "the model inferred X," and "I concluded X" cannot
support a defensible research claim, and cannot let a researcher retract a machine
inference without also retracting their own thinking. Every table below states the
owner, and the separation is preserved through export (IV-116) and audit (IV-56).

### 2.2 Core objects

Sixteen objects. Identity and versioning rules are governed by
[`docs/iv-17-identifiers.md`](iv-17-identifiers.md); the columns below state which
rule applies, not a second definition of it.

| Object | Definition | Identity | Versioning | Owner | Owning issues |
|---|---|---|---|---|---|
| **Project** | A bounded research context: purpose, scope, and everything selected into it | Minted `prj_` | Mutable metadata; not versioned | `human` | IV-16, IV-82 |
| **Corpus** | A named selection of sources within a project, with a recorded selection rationale | Minted `cor_` | Membership versioned by selection revision | `human` | IV-16, IV-84 |
| **Source** | A document as a *research object* — stable across metadata correction and byte replacement | Minted `src_` | Not versioned; its versions are | `human` | IV-16, IV-17 |
| **SourceVersion** | One exact byte-state of a source | Derived from source + content digest | Immutable | `source` | IV-17, IV-28, IV-33 |
| **Passage** | An exact character span in the extracted text of one extraction | Derived from source version + extraction + spans | Immutable | `source` | IV-17, IV-35, IV-38 |
| **Entity** | A person, institution, place, or instrument referred to across sources | Minted | Versioned by resolution revision | `derived` | IV-44, IV-119 |
| **Event** | A dated occurrence referred to across sources | Minted | Versioned by resolution revision | `derived` | IV-44, IV-61 |
| **Concept** | A term or construct whose meaning is tracked, and may be contested | Minted | Versioned; contested readings via ContestedAssertion | `human` / `derived` | IV-16, IV-119 |
| **Claim** | An assertion under evaluation, carrying a posture that bounds what it may assert | Minted | Versioned by revision; prior revisions retained | `model` / `human` | IV-43, IV-77 |
| **EvidenceLink** | A typed relation from a claim to a passage: supporting, contradicting, qualifying, or contextual | Minted | Immutable once adjudicated; superseded, never edited | `model` / `human` | IV-43, IV-46 |
| **Contradiction** | A recorded disagreement between claims or between evidence and a claim | Minted | Versioned | `model` / `human` | IV-43, IV-53 |
| **Interpretation** | The researcher's reading of the evidence; may branch into competing readings | Minted | Versioned and branchable; branches coexist | `human` | IV-43, IV-113, IV-115 |
| **Citation** | A normalized bibliographic record and its formatted renderings | Derived from source metadata revision + formatter version | Re-derived per metadata revision; prior exports stay auditable | `derived` | IV-32, IV-45 |
| **Execution** | One run of one computation, at a time, by an actor | Minted `exec_` | Immutable | `derived` | IV-17, IV-78, IV-79 |
| **Artifact** | A derived output of an execution: extracted text, chunks, embeddings, plots, packages | Derived from execution fingerprint + output role | Immutable | `derived` | IV-17, IV-79, IV-101 |
| **VisualizationSpec** | A typed, reviewable declaration of a visualization and the data it binds | Minted | Versioned | `human` / `model` | IV-59, IV-96 |

### 2.3 Extended object families

Thirteen families, contributing sixteen further object names. These are typed
additions to the model — never metadata blobs, and never a generic agent-memory layer.

| # | Family | Objects | Purpose | Owner | Owning issues |
|---|---|---|---|---|---|
| 1 | Research protocol and posture | `Protocol`, `Posture` | Stages an inquiry and bounds what a claim may assert (exploratory, interpretive, critical, historical, descriptive, associational, causal) | `human` | IV-77 |
| 2 | Observation | `Observation` | A source-grounded reported datum or experimental result, extracted with its span | `source` | IV-92, IV-93, IV-94 |
| 3 | Protected human record and model contribution | `ProtectedRecord`, `ModelContribution` | Separates researcher-authored material from machine contribution, so authorship is provable and machine work is purgeable | `human` / `model` | IV-113, IV-114, IV-116 |
| 4 | Connection and warrant | `Connection`, `Warrant` | A proposed relationship plus the stated grounds for believing it — a connection without a warrant is not presentable | `model` / `human` | IV-117, IV-118 |
| 5 | Contested identity, terminology, and archive assertion | `ContestedAssertion` | Records that an identity, term, or archival context is disputed, and by whom, without resolving it by fiat | `human` | IV-119, IV-120, IV-121 |
| 6 | Survey instrument | `SurveyInstrument` | The questionnaire as administered | `source` | IV-122, IV-123 |
| 7 | Codebook | `Codebook` | Variable definitions and coding schemes, quantitative or qualitative | `source` / `human` | IV-85, IV-123 |
| 8 | Dataset | `Dataset` | A tabular body of records with recorded lineage — uploaded or extracted | `source` / `derived` | IV-92, IV-123, IV-124 |
| 9 | Analysis specification | `AnalysisSpec` | A researcher-approved declaration of an analysis before it runs | `human` | IV-122, IV-125 |
| 10 | Analysis result | `AnalysisResult` | The output of an approved specification, bound to it and to its dataset | `derived` | IV-122, IV-126 |
| 11 | Annotation, code, and memo | `Annotation` | Bounded qualitative marking of passages, with codes and analytic memos | `human` | IV-85 |
| 12 | Adjudication record | `Adjudication` | A researcher decision on a machine proposal, with rationale and timestamp | `human` | IV-86, IV-91, IV-95 |
| 13 | Export snapshot and manifest | `ExportSnapshot` | An immutable, verifiable package of a research state | `derived` | IV-88, IV-90, IV-116 |

### 2.4 Why this is not a spreadsheet or dashboard schema

A project must be representable without forcing research material into a tabular fact
model. Four properties of this vocabulary make that true, and each is a property a BI
schema lacks:

1. **Disagreement is first-class, not an error state.** `Contradiction` and competing
   `Interpretation` branches coexist by design. A dashboard schema resolves conflicts
   before display; research often *is* the conflict, and flattening it destroys the
   finding.
2. **Evidence is a typed relation, not a cell value.** An `EvidenceLink` carries
   polarity — supporting, contradicting, qualifying, contextual. A spreadsheet can
   record that a number came from a paper; it cannot record that the paper *qualifies*
   a claim under stated conditions.
3. **Provenance is per-object, not per-table.** Every object states whether a human,
   a model, a source, or a computation is responsible for it (§2.1). Tabular models
   attach provenance to a load job, if at all.
4. **Identity survives reprocessing.** A source version and a passage are content-
   derived (IV-17), so a citation written today still resolves after the corpus is
   re-indexed and the parser is upgraded. Row identifiers do not have this property,
   which is exactly why §4 of IV-17 forbids them as references.

A dashboard can be *produced from* this model. The model cannot be produced from a
dashboard.

---

## 3. The research lifecycle

### 3.1 Stages

Six researcher-facing stages, plus one cross-cutting engineering stage used by §7.

| Stage | The researcher's question |
|---|---|
| **Discover** | What material exists, and which of it belongs in this inquiry? |
| **Validate** | Is this material what it claims to be, and does the evidence actually support the claim? |
| **Organize** | How is this material structured so it can be reasoned over? |
| **Analyze** | What does the evidence mean, and where does it disagree? |
| **Communicate** | How is this made legible to someone else? |
| **Publish** | How does this leave the system in a form that survives scrutiny? |
| *Foundation* | *(not researcher-facing)* Platform, contracts, and infrastructure the six stages require |

`Validate` is deliberately a first-class stage rather than a step inside the others.
In a system whose entire value proposition is defensibility, verification is not a
quality gate applied at the end — it is a thing the researcher does continuously, and
it owns 19 of the 125 planned issues.

### 3.2 Path A — corpus to research dossier

| Stage | What happens | Key issues |
|---|---|---|
| Discover | Project created; sources uploaded or resolved; supported-content admission enforced before any conversion; literature candidates adjudicated for relevance | IV-80, IV-29, IV-83, IV-32, IV-91, IV-55 |
| Validate | Source viewer and passage deep links let the researcher confirm what a source actually says; extraction quality is reported, not assumed | IV-34, IV-35, IV-84, IV-42 |
| Organize | Bytes stored immutably and hashed; converted; chunked with provenance preserved; embedded; entities and events resolved; passages annotated and coded | IV-28, IV-30, IV-38, IV-39, IV-44, IV-85 |
| Analyze | Hybrid retrieval surfaces passages; cited answers are produced; claims, evidence links, contradictions, and interpretations persist; connections are proposed with warrants and adjudicated; uncertainty and competing readings are represented | IV-40, IV-50, IV-43, IV-118, IV-53, IV-54 |
| Communicate | Typed visualization specs; claim-evidence graph; evidence timeline; every mark navigates back to its passage | IV-59, IV-60, IV-61, IV-62, IV-63 |
| Publish | Citations formatted reproducibly; unsupported claims rejected; dossier and reproducibility package exported with an AI-contribution manifest | IV-45, IV-46, IV-88, IV-116 |

### 3.3 Path B — survey file to validated descriptive analysis

| Stage | What happens | Key issues |
|---|---|---|
| Discover | Authorized survey dataset, questionnaire, and codebook ingested; restricted material refused at admission | IV-123, IV-83, IV-20 |
| Validate | Weighting, missingness, and data-quality preflight run before any estimate is produced | IV-124 |
| Organize | Dataset lineage recorded; variables and codes bound to the codebook | IV-124, IV-123 |
| Analyze | Researcher approves an analysis specification; only approved descriptive operators execute | IV-125, IV-122 |
| Validate (again) | Results validated against small-cell suppression and causal-language boundaries | IV-126 |
| Communicate | Provenance-linked, accessible tables and charts generated | IV-127 |
| Publish | Analysis package exported with its specification and dataset lineage | IV-88, IV-110 |

Path B validates twice, before and after execution. That is not redundancy: preflight
protects the estimate from bad data, and post-validation protects the *reader* from an
estimate that is technically correct but rhetorically overclaiming.

### 3.4 Researcher vocabulary versus internal vocabulary

Internal terms are not prerequisites for using the product. The interface speaks the
researcher's language and reveals the model progressively (IV-81).

| Researcher sees | Model calls it |
|---|---|
| "What am I working on" | Project, Protocol |
| "My sources" | Source, SourceVersion, Corpus |
| "What this source says here" | Passage, Observation |
| "What I think, and why" | Interpretation, Claim, EvidenceLink |
| "Where the sources disagree" | Contradiction, ContestedAssertion |
| "What I decided about the machine's suggestion" | Adjudication, ModelContribution |
| "My write-up" | ExportSnapshot |

---

## 4. Supported content and exclusions

### 4.0 The V1 default corpus is the safe subset

**Normative.** V1 defaults to content whose rights position is established by the class of
the content itself, needing no institutional agreement and no statutory exception:

> open-licensed works (CC-BY, CC0 and equivalents), the PubMed Central Open Access
> subset, arXiv, DOAJ-listed open-access journals, preprint servers, public-domain and
> openly licensed archival material, and researcher-authored notes.

Publisher-licensed subscription content is **admitted only on a stated rights basis**, and
is refused where none exists. See [`iv-128-content-rights.md`](iv-128-content-rights.md)
§7 and §9.

This is a scope decision, not a limitation to apologize for. The safe subset is large
enough to prove that provenance-bearing evidence synthesis works, and choosing it removes
the largest unresolved legal question from the V1 critical path.

Two consequences bind the rest of this document:

- **Ingestion and third-party transfer are distinct rights.** A licence permitting an
  institution to mine content does not imply permission to forward that content to an
  unrelated commercial processor. IV-83 and IV-87 therefore enforce **two separate gates**,
  not one authorization flag — a source may be lawfully ingestable and un-transmittable,
  and the model must be able to say so.
- **A rights basis is recorded, not asserted.** "The researcher confirmed authorization" is
  not a basis. `Source` carries *which* basis — licence, agreement, or exception — so the
  position is auditable later. This is a schema obligation on IV-16, not a policy
  aspiration.

Implemented in [`packages/ivory-tower-content-policy`](../packages/ivory-tower-content-policy).

### 4.1 Product-level matrix

This is the **product** boundary. Enforcement is owned elsewhere (§4.3).

| Content class | V1 | Conditions |
|---|---|---|
| PMC Open Access full text | **V1 default admitted** | Article is in the PMC OA subset; source version and article-level license or reuse terms are recorded; text-extractable or OCR-able |
| arXiv full text | **V1 default admitted** | Canonical arXiv record and version are recorded; repository terms are retained |
| DOAJ-indexed open-access journal full text | **V1 default admitted** | DOAJ journal record plus article-level license or reuse terms are recorded |
| Approved preprint-repository full text | **V1 default admitted** | Repository is on the V1 allowlist and its explicit reuse terms are retained |
| Other full text with an approved CC or public-domain license | **V1 default admitted** | Exact license, source version, and retrieval record are retained |
| Closed, paywalled, or license-ambiguous scholarly material | **Excluded from default V1** | Researcher authorization or public reachability alone is insufficient; requires a later policy decision |
| Books, monographs, reports, working papers, or archival documents outside the open allowlist | **Excluded from default V1** | Admitted only if they meet the approved license rule or a later policy explicitly permits them |
| Public, non-restricted survey microdata | Admitted | Instrument and codebook required; preflight required (IV-124) |
| Researcher-authored notes and memos | Admitted | Protected human record (IV-113) |
| Restricted federal or enclave-held microdata | **Excluded** | Refuted by enclave architecture (§6.1); deferred to IV-75 |
| Sensitive interview material and transcripts | **Excluded** | Human-subject protections not in V1 scope |
| Unapproved human-subject data | **Excluded** | No IRB workflow in V1 |
| Personally identifying material not already public | **Excluded** | Anti-outing protections apply (IV-121) |
| Material the researcher is not authorized to use | **Excluded** | Authorization is asserted at admission and is a precondition, not a warning |

The V1 scholarly corpus is safe by default, not merely public by default. A source must
match an allowlisted endpoint or carry a machine-recorded CC/public-domain reuse basis;
repository membership, public reachability, or a researcher assertion cannot substitute
for source-level terms. Missing or ambiguous terms fail closed before conversion. This is
the release baseline for proving the research-dossier thesis; broader licensed or
researcher-authorized material is not part of V1 acceptance.

### 4.2 Exclusions are refusals, not warnings

An excluded class is refused **before conversion** (IV-83), not flagged after
processing. The distinction matters: once restricted material has been converted,
chunked, and embedded, it has already been copied into artifacts and possibly sent to
a provider. Admission is therefore the enforcement point, and the failure mode is
fail-closed.

### 4.3 Where enforcement lives

This document defines the boundary. It does not implement it.

| Concern | Owner |
|---|---|
| Restricted-data policy definition | IV-20 |
| Admission enforcement before conversion | IV-83 |
| Provider egress enforcement | IV-87 |
| Release-gate form of this matrix | IV-68 |
| De-identification workflow (post-v1) | IV-75 |

---

## 5. Non-goals

Explicit, with the reason each is excluded. A non-goal is not a "later" — it is a
commitment that V1 does not do this and does not claim to.

| Non-goal | Reason |
|---|---|
| **Broad connectors and unrestricted scholarly intake** | Every connector is an admission surface and an egress surface. V1 resolves metadata for the allowlisted open corpus and accepts only sources that pass the safe-open rule; broad literature, OSF, and other research-system connectors remain gated behind IV-103 and IV-106–IV-111. |
| **Arbitrary statistical execution** | V1 executes only approved descriptive operators over admitted survey data. Arbitrary execution cannot be bounded by a warrant, so its results cannot be defended. Sandbox deferred to IV-72. |
| **Causal automation** | Causal claims require design assumptions a tool cannot verify. Posture (IV-77) permits a causal posture only where the researcher asserts the design; the system never infers causality. |
| **Team collaboration** | V1 is single-researcher. Multi-user authorization is deferred to IV-74. Shared editing without a resolved authorship model would defeat IV-113. |
| **Outbound MCP** | V1 exposes no outbound MCP surface. Controlled read-only access is deferred to IV-69/IV-70, behind project-scoped authorization. |
| **Berry LLM adoption** | Not adopted in V1. Evaluated only as an optional provider under IV-76. |
| **Manuscript generation** | See §1.3. The deliverable is a dossier, not prose for submission. |

---

## 6. Evidence base and its limits

§1–§5 are product commitments. This section states what evidence supports them, at
what confidence, and — deliberately — where the evidence does not reach. It is bound
to [`docs/iv-102-landscape-review.md`](iv-102-landscape-review.md), the landscape review
delivered under [IV-102](https://app.notion.com/p/3b09cb079ddb814d8075cc666a7320aa).

The ledger below reproduces the review's adjudicated verdicts. The review's own
opportunity adjudication and its limitations section govern; read them before citing any
figure from this table.

### 6.1 Decision ledger

| Finding | Verdict | Consequence for this model |
|---|---|---|
| Safe-open scholarly corpus (PMC OA, arXiv, DOAJ, approved preprints, and approved CC/public-domain full text) | **Supported, bounded** | Becomes the V1 default corpus and acceptance baseline; source-level terms are persisted and ambiguous material is refused |
| Visualization need | **Moderate confidence** | Visualization is included, subordinate to the workflow (§1.3), never as the product thesis |
| Equity of access as a design constraint | **Supported** | Retained as a constraint; measured under IV-104 |
| Literature and OSF connector opportunities | **Provisional** | Deferred to post-v1 validation (IV-106, IV-108); not a V1 commitment |
| Evidence-clearinghouse and CAQDAS opportunities | **Unresolved** | No V1 commitment; validation issues only (IV-107, IV-109) |
| IRB-aware de-identification | **Required, not a differentiator** | Excluded from V1 scope; deferred to IV-75; never marketed as differentiation |
| Restricted federal microdata integration | **Refuted** — enclave architecture forecloses it | Excluded in §4.1, permanently for V1 |
| Multi-agent orchestration | **No demand evidence** | Permitted only as a bounded internal architecture choice; may not be a user-facing claim |
| Model agnosticism | **No demand evidence** | Justified as resilience, procurement, and provider governance (IV-4, IV-48); may not be a user-facing differentiator |

### 6.2 Limitations retained

These are carried forward deliberately. They are not defects to be resolved before
this document is valid; they are the honest boundary of what is known.

- **13 of 48 core sources** in the IV-102 review are peer-reviewed or archival
  preprints — below the review's own declared 70% gate.
- **79% of geographically identifiable sources are US-based.** Conclusions about
  researcher behaviour should not be assumed to generalize.
- **Census-tier tool prevalence and citation-loop closure remain unresolved.**
- **Reddit researcher-sentiment input is provisional and hypothesis-generating only.**
  It supports the accountable-augmentation principle (§1.1) directionally; it does not
  establish prevalence, willingness to pay, or priority.

### 6.3 Rules binding product claims to evidence

1. A verdict of **refuted** cannot be reopened by a feature request. It is reopened
   only by new evidence recorded in IV-102's ledger.
2. A finding with **no demand evidence** may justify an internal architecture choice
   but may never appear as a user-facing product claim.
3. **Provisional** and **unresolved** findings may fund a validation issue, never a V1
   capability commitment.
4. IV-103 tests §1.1 as a hypothesis. It may revise this model through change control
   (§10); it may not silently supersede it.

---

## 7. Traceability matrix

All **125 phased issues**, each mapped to a lifecycle stage, its primary objects, and
a release gate or an explicit post-v1 deferral. `IV-1` is the issue template and is
excluded; `IV-2` does not exist. §9 records how this coverage was verified.

**Distribution.** By stage: Foundation 41, Validate 19, Discover 18, Organize 14,
Analyze 13, Publish 11, Communicate 9. By gate: G1 23, G2 9, G3 11, G4 17, G5 30,
G6 19, deferred post-v1 16. **109 issues are committed to V1; 16 are deferred.**

<!-- BEGIN GENERATED: traceability -->

| Issue | Title | Stage | Primary objects | Gate |
|---|---|---|---|---|
| IV-3 | Establish LiqUIdify GUI foundation | Foundation | Project | G2 — application shell |
| IV-4 | Implement an interchangeable AI-provider abstraction layer | Foundation | Execution, Artifact | G5 — cited research workflow |
| IV-5 | Define capability-based AI agent contracts | Foundation | Execution, Artifact | G5 — cited research workflow |
| IV-6 | Create a cross-provider research-workflow benchmark harness | Validate | Execution, Artifact | G6 — visualization, verification & release evidence |
| IV-7 | Every conclusion should be inspectable | Validate | Claim, EvidenceLink, Execution | G5 — cited research workflow |
| IV-8 | Define Ivory Tower's academic-first Knowledge Intelligence product model | Foundation | *all* | G1 — product & architecture contract |
| IV-9 | Build a hybrid scholarly corpus and knowledge substrate | Organize | Corpus, Source, Entity | G4 — corpus, retrieval & provenance |
| IV-10 | Create a conversational research workspace with live visual analysis | Analyze | Claim, EvidenceLink, VisualizationSpec | G6 — visualization, verification & release evidence |
| IV-11 | Implement research-native visualization primitives | Communicate | VisualizationSpec | G6 — visualization, verification & release evidence |
| IV-12 | Implement evidence-led research investigation agents | Analyze | Claim, EvidenceLink, Interpretation | G5 — cited research workflow |
| IV-13 | Expose controlled research semantic context through MCP | Publish | Project, Passage, Claim | Deferred — post-v1 |
| IV-14 | Decide V1 runtime topology and repository architecture | Foundation | Execution | G1 — product & architecture contract |
| IV-15 | Scaffold the TypeScript web application and quality gates | Foundation | — | G1 — product & architecture contract |
| IV-16 | Define the canonical research object schema | Foundation | *all* | G1 — product & architecture contract |
| IV-17 | Define stable source, passage, and derived-artifact identifiers | Foundation | Source, SourceVersion, Passage, Artifact, Execution | G1 — product & architecture contract |
| IV-18 | Define typed service and API boundaries | Foundation | *all* | G1 — product & architecture contract |
| IV-19 | Establish dependency licensing, SBOM, and version-pinning policy | Foundation | — | G1 — product & architecture contract |
| IV-20 | Define V1 supported-content and restricted-data policy | Foundation | Source, Dataset | G1 — product & architecture contract |
| IV-21 | Establish local development, migration, and seed workflow | Foundation | — | G1 — product & architecture contract |
| IV-22 | Define deployment, configuration, and secret-management contract | Foundation | — | G1 — product & architecture contract |
| IV-23 | Implement the Ivory Tower UI adapter layer over LiqUIdify | Foundation | — | G2 — application shell |
| IV-24 | Build the responsive research workspace shell and navigation | Foundation | Project, Corpus | G2 — application shell |
| IV-25 | Implement shared loading, empty, failure, and retry states | Foundation | Execution | G2 — application shell |
| IV-26 | Verify keyboard, focus, contrast, and reduced-motion behavior | Foundation | — | G2 — application shell |
| IV-27 | Execute a LiqUIdify compatibility and upgrade spike | Foundation | — | G2 — application shell |
| IV-28 | Implement immutable source storage and content hashing | Organize | Source, SourceVersion | G3 — source ingestion & inspection |
| IV-29 | Implement the source upload and ingestion state machine | Discover | Source, SourceVersion, Execution | G3 — source ingestion & inspection |
| IV-30 | Integrate the Docling document-conversion service | Organize | SourceVersion, Artifact | G3 — source ingestion & inspection |
| IV-31 | Implement OCR fallback and extraction-quality diagnostics | Organize | Artifact, Passage | G3 — source ingestion & inspection |
| IV-32 | Implement scholarly metadata resolution using Crossref and OpenAlex | Discover | Source, Citation | G3 — source ingestion & inspection |
| IV-33 | Implement source deduplication and version reconciliation | Organize | Source, SourceVersion | G3 — source ingestion & inspection |
| IV-34 | Integrate the PDF.js source viewer | Validate | SourceVersion, Passage | G3 — source ingestion & inspection |
| IV-35 | Implement stable passage deep links and highlight overlays | Validate | Passage, SourceVersion, Artifact | G3 — source ingestion & inspection |
| IV-36 | Implement ingestion failure recovery and reprocessing controls | Organize | Execution, Artifact | G3 — source ingestion & inspection |
| IV-37 | Provision PostgreSQL, pgvector, and versioned schema migrations | Foundation | *all* | G4 — corpus, retrieval & provenance |
| IV-38 | Implement provenance-preserving document chunking | Organize | Passage, Artifact | G4 — corpus, retrieval & provenance |
| IV-39 | Implement embedding generation and model-version tracking | Organize | Artifact, Execution | G4 — corpus, retrieval & provenance |
| IV-40 | Implement hybrid lexical-vector retrieval | Discover | Passage, Artifact | G4 — corpus, retrieval & provenance |
| IV-41 | Implement corpus, source, date, entity, and content-type retrieval filters | Discover | Corpus, Source, Entity, Passage | G4 — corpus, retrieval & provenance |
| IV-42 | Implement surrounding-context expansion for retrieved passages | Validate | Passage | G4 — corpus, retrieval & provenance |
| IV-43 | Implement claim, evidence, contradiction, and interpretation persistence | Analyze | Claim, EvidenceLink, Contradiction, Interpretation | G4 — corpus, retrieval & provenance |
| IV-44 | Implement entity resolution and temporal relationship modeling | Organize | Entity, Event | G4 — corpus, retrieval & provenance |
| IV-45 | Implement reproducible citation formatting and export | Publish | Citation, Source, SourceVersion, Passage | G4 — corpus, retrieval & provenance |
| IV-46 | Implement citation validation and unsupported-claim rejection | Validate | Claim, EvidenceLink, Citation | G4 — corpus, retrieval & provenance |
| IV-47 | Build the retrieval and passage-anchor evaluation corpus | Validate | Passage, Artifact | G4 — corpus, retrieval & provenance |
| IV-48 | Integrate the AI SDK provider registry and direct provider adapters | Foundation | Execution | G5 — cited research workflow |
| IV-49 | Implement the provider-independent structured result envelope | Foundation | Execution, Artifact | G5 — cited research workflow |
| IV-50 | Implement the structured cited-answer capability | Analyze | Claim, EvidenceLink, Citation | G5 — cited research workflow |
| IV-51 | Implement persistent conversational research threads | Analyze | Project, Interpretation | G5 — cited research workflow |
| IV-52 | Implement research scope and framing revision controls | Discover | Protocol, Posture, Project | G5 — cited research workflow |
| IV-53 | Implement uncertainty and competing-interpretation representation | Analyze | Interpretation, Contradiction, Posture | G5 — cited research workflow |
| IV-54 | Implement the evidence-gap analysis capability | Analyze | Claim, EvidenceLink, Corpus | G5 — cited research workflow |
| IV-55 | Implement the bounded literature-review capability | Discover | Corpus, Source, Claim | G5 — cited research workflow |
| IV-56 | Implement model, prompt, tool, and source audit records | Validate | Execution, Artifact, ModelContribution | G5 — cited research workflow |
| IV-57 | Implement streaming research-response transport and cancellation | Foundation | Execution | G5 — cited research workflow |
| IV-58 | Enforce capability-level time, cost, and source budgets | Foundation | Execution | G5 — cited research workflow |
| IV-59 | Define the typed research visualization specification | Communicate | VisualizationSpec | G5 — cited research workflow |
| IV-60 | Implement the interactive claim-evidence graph | Communicate | Claim, EvidenceLink, VisualizationSpec | G6 — visualization, verification & release evidence |
| IV-61 | Implement the temporal evidence timeline | Communicate | Event, VisualizationSpec | G6 — visualization, verification & release evidence |
| IV-62 | Implement visualization-to-source navigation | Validate | VisualizationSpec, Passage, SourceVersion | G6 — visualization, verification & release evidence |
| IV-63 | Implement visualization selection rationale | Communicate | VisualizationSpec, Interpretation | G6 — visualization, verification & release evidence |
| IV-64 | Implement the V1 golden benchmark harness | Validate | Execution, Artifact | G6 — visualization, verification & release evidence |
| IV-65 | Instrument quality, latency, cost, and failure telemetry | Foundation | Execution | G6 — visualization, verification & release evidence |
| IV-66 | Build the end-to-end corpus-to-cited-conclusion acceptance suite | Validate | *all* | G6 — visualization, verification & release evidence |
| IV-67 | Complete the V1 security and privacy threat model | Foundation | ProtectedRecord, Dataset | G6 — visualization, verification & release evidence |
| IV-68 | Define V1 release gates and the supported-content matrix | Publish | *all* | G6 — visualization, verification & release evidence |
| IV-69 | Integrate the production MCP server SDK for controlled read-only access | Publish | Project, Passage, Claim | Deferred — post-v1 |
| IV-70 | Implement project-scoped authorization for MCP clients | Publish | Project | Deferred — post-v1 |
| IV-71 | Implement Zotero and OSF source connectors | Discover | Source, Citation | Deferred — post-v1 |
| IV-72 | Implement a DuckDB-based statistical analysis sandbox | Analyze | Dataset, AnalysisSpec, AnalysisResult | Deferred — post-v1 |
| IV-73 | Implement geographic and archaeological map visualizations | Communicate | Entity, Event, VisualizationSpec | Deferred — post-v1 |
| IV-74 | Implement multi-user workspace authorization and collaboration | Foundation | Project | Deferred — post-v1 |
| IV-75 | Implement the restricted-data de-identification workflow | Organize | Dataset, ProtectedRecord | Deferred — post-v1 |
| IV-76 | Evaluate Berry LLM as an optional Ivory Tower provider | Foundation | Execution | Deferred — post-v1 |
| IV-77 | Define staged research protocol and claim-posture contract | Foundation | Protocol, Posture, Claim | G1 — product & architecture contract |
| IV-78 | Define and implement durable asynchronous job contracts | Foundation | Execution | G1 — product & architecture contract |
| IV-79 | Implement immutable pipeline-run manifests and artifact invalidation | Foundation | Execution, Artifact, SourceVersion | G1 — product & architecture contract |
| IV-80 | Implement guided first-project onboarding with a sample corpus | Discover | Project, Corpus, Source | G2 — application shell |
| IV-81 | Implement progressive-disclosure method inspector and vocabulary | Validate | Execution, Interpretation | G2 — application shell |
| IV-82 | Implement V1 authentication and project authorization boundary | Foundation | Project | G2 — application shell |
| IV-83 | Enforce supported-content admission before conversion | Discover | Source, SourceVersion | G3 — source ingestion & inspection |
| IV-84 | Implement corpus coverage, selection-rationale, and extraction-quality report | Validate | Corpus, Source, Artifact | G4 — corpus, retrieval & provenance |
| IV-85 | Implement bounded qualitative annotation, codebook, and memo workflow | Organize | Annotation, Codebook, Passage | G5 — cited research workflow |
| IV-86 | Implement researcher adjudication workflow for generated claims | Validate | Claim, Adjudication, Interpretation | G5 — cited research workflow |
| IV-87 | Enforce provider data-egress policy | Foundation | Execution, ProtectedRecord | G5 — cited research workflow |
| IV-88 | Export verifiable research dossier and reproducibility package | Publish | ExportSnapshot, Citation, Claim, EvidenceLink | G6 — visualization, verification & release evidence |
| IV-89 | Validate novice and expert research comprehension before release | Validate | Interpretation, Claim | G6 — visualization, verification & release evidence |
| IV-90 | Implement operational recovery and immutable release evidence bundle | Publish | ExportSnapshot, Execution | G6 — visualization, verification & release evidence |
| IV-91 | Implement literature-candidate relevance adjudication and search refinement | Discover | Source, Corpus, Adjudication | G4 — corpus, retrieval & provenance |
| IV-92 | Define source-grounded reported-data and experimental-observation schema | Foundation | Observation, Dataset | G1 — product & architecture contract |
| IV-93 | Extract structured reported data from text, tables, figures, and supplements | Organize | Observation, Passage, Artifact | G4 — corpus, retrieval & provenance |
| IV-94 | Normalize cross-paper variables, units, conditions, and uncertainty | Organize | Observation, Dataset | G4 — corpus, retrieval & provenance |
| IV-95 | Validate extracted-dataset completeness and adjudicate reported observations | Validate | Observation, Dataset, Adjudication | G5 — cited research workflow |
| IV-96 | Convert researcher schemas and example plots into reviewable visualization specs | Communicate | VisualizationSpec, AnalysisSpec | G5 — cited research workflow |
| IV-97 | Generate deterministic plots from validated provenance-bearing datasets | Communicate | VisualizationSpec, Dataset, Artifact | G6 — visualization, verification & release evidence |
| IV-98 | Validate plot completeness, legibility, and dataset reconciliation | Validate | VisualizationSpec, Dataset | G6 — visualization, verification & release evidence |
| IV-99 | Implement versioned reusable research workflow recipes and expert-run controls | Analyze | Protocol, Execution, Artifact | G5 — cited research workflow |
| IV-100 | Implement quota-aware execution preflight and resumable checkpoints | Foundation | Execution | G5 — cited research workflow |
| IV-101 | Implement content-addressed research artifact cache and reuse policy | Foundation | Artifact, Execution | G5 — cited research workflow |
| IV-102 | Conduct a systematic social-science tool, source, and adoption landscape review | Discover | — | G1 — product & architecture contract |
| IV-103 | Validate the connector-and-workflow-layer product thesis against a standalone vertical application | Discover | — | G1 — product & architecture contract |
| IV-104 | Define and validate equity-of-access requirements and measurements | Foundation | — | G1 — product & architecture contract |
| IV-105 | Define applied social-science personas and deliverable contracts | Discover | — | G1 — product & architecture contract |
| IV-106 | Validate federated social-science literature connector demand and architecture | Discover | Source, Corpus | Deferred — post-v1 |
| IV-107 | Validate evidence-clearinghouse and public social-dataset connector demand | Discover | Dataset, Source | Deferred — post-v1 |
| IV-108 | Validate OSF workflow demand and API feasibility | Discover | Project, ExportSnapshot | Deferred — post-v1 |
| IV-109 | Validate CAQDAS interchange demand and outcome safety | Publish | Annotation, Codebook, ExportSnapshot | Deferred — post-v1 |
| IV-110 | Implement portable quantitative-analysis artifact interchange | Publish | Dataset, AnalysisSpec, AnalysisResult | Deferred — post-v1 |
| IV-111 | Implement authorized survey-platform ingestion connectors | Discover | SurveyInstrument, Dataset | Deferred — post-v1 |
| IV-112 | Implement domain-specific research deliverable profiles | Publish | ExportSnapshot | Deferred — post-v1 |
| IV-113 | Define the researcher-authorship and AI-contribution constitution | Foundation | ProtectedRecord, ModelContribution | G1 — product & architecture contract |
| IV-114 | Extend the canonical schema for protected human records and model contributions | Foundation | ProtectedRecord, ModelContribution | G1 — product & architecture contract |
| IV-115 | Implement the protected human-only notebook and AI-suggestion boundary | Analyze | ProtectedRecord, Interpretation | G5 — cited research workflow |
| IV-116 | Implement AI-contribution review, diff, purge, and export manifests | Publish | ModelContribution, ExportSnapshot | G6 — visualization, verification & release evidence |
| IV-117 | Define the typed research-connection proposal and warrant schema | Foundation | Connection, Warrant | G1 — product & architecture contract |
| IV-118 | Implement inspectable connection surfacing and researcher adjudication | Analyze | Connection, Warrant, Adjudication | G5 — cited research workflow |
| IV-119 | Define the critical-history identity, terminology, and archive-context model | Foundation | ContestedAssertion, Entity, Concept | G1 — product & architecture contract |
| IV-120 | Implement counter-archive, archival-silence, and positionality workflows | Analyze | ContestedAssertion, Interpretation, Corpus | G5 — cited research workflow |
| IV-121 | Enforce sensitive-identity non-inference and anti-outing protections | Validate | ContestedAssertion, ProtectedRecord | G5 — cited research workflow |
| IV-122 | Define the bounded V1 survey-analysis and statistical-warrant contract | Foundation | AnalysisSpec, AnalysisResult, Warrant | G1 — product & architecture contract |
| IV-123 | Implement survey dataset, questionnaire, and codebook ingestion from authorized uploads | Discover | SurveyInstrument, Codebook, Dataset | G3 — source ingestion & inspection |
| IV-124 | Implement survey weighting, missingness, and data-quality preflight | Organize | Dataset, AnalysisSpec | G4 — corpus, retrieval & provenance |
| IV-125 | Implement researcher-approved descriptive survey analysis specifications | Analyze | AnalysisSpec, Dataset | G5 — cited research workflow |
| IV-126 | Validate survey results, small cells, and causal-language boundaries | Validate | AnalysisResult, Warrant, Posture | G5 — cited research workflow |
| IV-127 | Generate provenance-linked accessible survey tables, charts, and analysis packages | Communicate | AnalysisResult, VisualizationSpec, ExportSnapshot | G6 — visualization, verification & release evidence |

<!-- END GENERATED: traceability -->

---

## 8. The finite end-to-end workflow

### 8.1 The workflow statement

V1 is complete when this sentence is executable, end to end, without a human patching
an intermediate step:

> A researcher creates a project, admits an allowlisted open corpus, inspects what the
> sources say at exact passages, obtains claims that carry cited evidence and stated
> uncertainty, adjudicates the machine's proposals, records their own interpretation,
> and exports a dossier in which every claim resolves to a source version and every
> machine contribution is disclosed.

Path B's equivalent:

> A researcher uploads an authorized survey dataset with its instrument and codebook,
> passes data-quality preflight, approves an analysis specification, obtains
> descriptive results within approved operators, passes small-cell and causal-language
> validation, and exports provenance-linked tables and charts.

Both are finite. Neither contains an open-ended step. That is what makes V1 a scope
rather than a direction, and it is what IV-66's acceptance suite exercises.

### 8.2 Acceptance criteria

| Criterion | Satisfied by | How it is checked |
|---|---|---|
| The default scholarly path has a bounded, auditable legal surface | §4.1 | Acceptance corpus uses only the V1 source allowlist or an approved CC/public-domain license; source, version, terms, and rejection reason are persisted, and ambiguous terms fail closed |
| A canonical product-model document names the objects, lifecycle, and non-goals | §2, §3, §5 | Vocabulary is closed: §9 verifies §7 references no object absent from §2 |
| A project can be represented without forcing research material into a spreadsheet or dashboard schema | §2.4 | Four structural properties, each contrasted with the tabular model that lacks it |
| The MVP roadmap maps each planned capability to a research-lifecycle stage | §7 | §9 verifies 125/125 coverage against the tracker, mechanically |

---

## 9. Verification record

The claims in this document that can be checked were checked. This section states the
method, so the check is reproducible rather than asserted.

### 9.1 Method

The Notion issue tracker was queried directly as the authoritative source. The §7
matrix is not hand-maintained prose: it is generated from a data file and validated by
`scripts/verify-product-model.js`, which fails the build rather than emitting an
unverified table.

### 9.2 Tracker facts established

| Fact | Value | Method |
|---|---|---|
| Total rows in the tracker | 126 | `COUNT(*)` |
| Distinct issue ids | 126 | `COUNT(DISTINCT id)` — equal to row count, so no duplicates |
| Id range | 1 – 127 | `MIN`/`MAX` |
| Rows with no phase | 1 (`IV-1`, type `Template`) | `GROUP BY Phase` |
| Phased issues | 125 | Phase counts summed: 23 + 9 + 11 + 17 + 30 + 19 + 16 |
| Absent id | `IV-2` | 126 distinct ids across a 127-wide range leaves exactly one gap |

### 9.3 Checks enforced on §7

Eighteen assertions, all of which must pass:

- Row count equals the tracker's phased-issue count (125)
- No duplicate issue ids
- The template row is excluded; `IV-2` is absent
- No gaps and no ids outside the tracker's range
- Per-phase counts match the tracker for all seven phases
- Every issue carries a stage and primary objects; no assignment lacks an issue
- Every stage is one of the seven defined in §3.1
- Every object named in §7 exists in the §2 vocabulary
- The core vocabulary contains exactly 16 objects

### 9.4 Scope of this verification

What is verified: the **completeness and internal consistency** of the traceability
matrix, and the closure of the object vocabulary.

What is **not** verified, and cannot be by these means: whether each stage assignment
is the *best* one. Stage and object assignments are editorial judgments about what an
issue is chiefly about. They are reviewable, and several issues could defensibly sit in
a neighbouring stage. The checks guarantee that every issue is placed, placed once, and
placed somewhere real — not that every placement is the only reasonable one.

---

## 10. Change control and downstream obligations

### 10.1 Amending this document

§1–§5 change only through an issue that states what evidence or decision forces the
change. §6 changes only when IV-102's ledger changes. §7 is regenerated, never
hand-edited.

### 10.2 Downstream obligations

| Issue | Obligation |
|---|---|
| IV-16 | Adopts §2 as its object list, including `Artifact` and all thirteen extended families |
| IV-17 | Supplies the identity and versioning rules referenced by §2.2 — **delivered** |
| IV-20 | Owns the enforcement form of §4 |
| IV-68 | Owns the release-gate form of §4 |
| IV-102 | Owns §6; its ledger is the only route to changing a verdict |
| IV-103 | Tests §1.1 as a hypothesis; may revise via §10.1, may not silently supersede |
| IV-113 | Implements the authorship boundary that §2.1's `human`/`model` split presumes |

### 10.3 Reconciliation status

Three issue bodies contradicted this model and require a `Product-model
reconciliation` note: **IV-9** (interviews and field notes listed as substrate content
classes, excluded by §4.1), **IV-10** (live visualization generated as the question
evolves, subordinated by §1.3), and **IV-12** (statistical-analysis and visualization
agents, bounded by §5). IV-3, IV-4, IV-5, IV-6, IV-13, IV-20, and IV-68 reconcile as
written.

### 10.4 Known gap in the repository record

`docs/v1-build-vs-open-source.md` is referenced throughout the issue tracker as the
canonical delivery map and does not exist in this repository. Until it is committed,
those references do not resolve. The same applies to `docs/adr-001-application-platform.md`
(IV-14) and the three IV-102 deliverables. This document does not depend on any of
them.
