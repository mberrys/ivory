# IV-102 Chapter Plan: Systematic Social-Science Tool, Source, and Adoption Landscape Review

Status: plan-mode output, 2026-08-01. Produced by Socratic chapter planning; no searching or drafting has occurred. Notion issue [IV-102](https://app.notion.com/p/3b09cb079ddb814d8075cc666a7320aa) owns acceptance criteria; this file is the writing plan.

- Issue: IV-102, Phase 1, P1 High, 5 points, `Blocked by` IV-8.
- Predecessor: [Initial Research](https://app.notion.com/p/3af9cb079ddb80cfa227f55449a2199f) — quick-mode synthesis this review supersedes.
- Type: scoping review (PRISMA-ScR reporting spine), literature-review structure.
- Deliverable: internal decision review. No venue, no bilingual abstract, no submission apparatus.
- Target: ~9,300 words.
- Coverage: two-tier — deep triangulated review of decision-critical categories, honest shallow census elsewhere.
- Comparator: the life-science vertical, with structural asymmetry treated as a finding rather than a caveat.

## Thesis

> The post-AI social-science research landscape is fragmented across tools, sources, and access regimes in ways that are structurally different from the centralized life-science environment. The review characterizes that fragmentation, grades the evidence for each claim about it, and adjudicates which proposed interventions the evidence currently supports.

Argument type: descriptive-evaluative. Scope: English-language academic and applied social science; tools and sources in active use as of the review date.

Product implications are a **downstream consumer** of this review, not its conclusion. An initial framing — that the review would argue Ivory Tower fixes the landscape's defects — was withdrawn during planning because it conflicts with IV-102's own acceptance criterion barring automatic conversion of evidence gaps into roadmap commitments. Nothing in the source corpus is about Ivory Tower, so no review of that corpus can conclude anything about it.

## Evaluative dimensions

Three properties surfaced while stress-testing the withdrawn framing, converted from product claims into review dimensions:

| Dimension | Question the review answers |
|---|---|
| Generative/visual interpretation layer | Absent from current tooling? Documented as a researcher need by independent sources? |
| Multi-agent orchestration | Same two-part test. |
| Model agnosticism / vendor lock-in | Same two-part test. |

Each is scored **twice** — *absent from the landscape* and *documented as a researcher need* are separate findings. The gap between the two scores is the result: a property absent from the landscape but undocumented as a need is a builder's assumption, not a market gap.

## Chapter plan

### §1 Introduction — 700 words

- **Purpose:** Establish why a reproducible review is needed now and why the predecessor memo cannot serve.
- **Core argument:** The existing quick-mode synthesis reached plausible conclusions from sources that cannot bear their weight; the decisions it feeds require a higher evidentiary standard.
- **Evidence:** The predecessor's own declared limitations — one to two sources per claim, no triangulation, whole categories unsearched. IV-102's acceptance criteria as the adopted standard.
- **Risk:** Reads as self-flagellation. One paragraph; the point is the standard, not the apology.
- **Strength:** Strong (self-documenting).

### §2 Review Protocol — 1,400 words

- **Purpose:** Register the protocol *before* results so the review is reproducible and its boundaries inspectable.
- **Core argument:** The method section is a contract — reporting standard, search boundaries, inclusion/exclusion logic, source taxonomy, triangulation rule, confidence grading, and declared omissions.
- **Risk:** Writing the protocol after doing the search. Version and date it; log deviations as deviations.
- **Strength:** Strong if registered first; worthless if retrofitted.

#### Reporting spine

**PRISMA-ScR** (Tricco et al., 2018) — 20 essential reporting items plus 2 optional. Chosen because a scoping review's stated purpose is to identify what exists and where the gaps are, which is exactly IV-102's objective; it supplies the flow diagram and item checklist that make "explicit search boundaries and inclusion/exclusion logic" auditable rather than asserted.

Required artifacts: the PRISMA-ScR flow diagram (identification → screening → eligibility → inclusion, with counts and exclusion reasons at each stage) and a completed item checklist filed alongside the review.

Registration: PROSPERO does not accept scoping reviews. For an internal deliverable, version the protocol in this repository with a date and commit reference; if the review is later rendered for external publication, register on OSF Registries before any re-run.

#### Claim-level extension

PRISMA-ScR charts data at **source** level. IV-102 requires claim-level records, so the protocol adds a layer the standard does not provide:

- **Source taxonomy:** vendor-authored / independent empirical / institutional documentation / practitioner report / commentary.
- **Triangulation rule:** vendor statements may establish **product capability** but never **adoption prevalence**.
- **Per-claim record:** claim text, supporting source(s), source class, publication date, access state, geographic and institutional scope, methodology, conflicts of interest, triangulation status, confidence.

Declare this as an **addition to** the standard, not a substitution for any of its items.

#### Declared omissions

An unexplained missing item looks like sloppiness; a justified one looks like method. The omissions fall into two classes, and conflating them would itself be an error.

**Class A — PRISMA-ScR optional items, declined.** The standard already marks these optional for scoping reviews, so declining them is conformance, not deviation.

| Item | Omission | Justification |
|---|---|---|
| 12 (Methods) | Critical appraisal of individual sources of evidence | Scoping reviews map what exists rather than adjudicate study quality. The source-class and confidence layer records *provenance and corroboration*, and is explicitly **not** claimed as a substitute for critical appraisal. |
| 19 (Results) | Critical appraisal within sources of evidence | Same rationale; reporting it would imply an appraisal that was not performed. |

**Class B — systematic-review apparatus never in scope.** These are not PRISMA-ScR items at all; they belong to a different method family and are declined as a family.

| Omission | Justification |
|---|---|
| Meta-analysis and effect synthesis | The units of analysis are tools, sources, and access regimes — not studies reporting comparable effect estimates. There is nothing to pool. |
| Risk-of-bias assessment of included studies | Presupposes a body of primary studies with comparable designs. The corpus is dominated by vendor documentation, institutional policy, and practitioner reports, for which study-level RoB instruments are not defined. |
| GRADE certainty-of-evidence grading | Designed for outcome-level certainty across intervention studies. This review has no intervention outcomes; applying GRADE would manufacture false precision. |

#### Temporal boundary

"Post-AI" opens at the **public availability of GPT-3**, per the project's stated marker. Precise anchors: the model was described 28 May 2020 and the API opened in private beta 11 June 2020, with the waitlist removed 18 November 2021.

One tension to note in the protocol rather than paper over: the stated rationale — *the beginning of AI in the public sphere* — points at ChatGPT (30 November 2022) more accurately than at GPT-3, whose release was a developer API beta, not a public product. The protocol resolves this with a **two-point boundary** rather than choosing:

- **Corpus window opens 1 June 2020.** Captures the pre-ChatGPT baseline, so the review can observe change rather than only the current state.
- **30 November 2022 is an internal stratification marker.** Adoption and tooling evidence is split before/after, which is what makes the "post-AI" claim testable instead of assumed.
- **Sources predating June 2020** are admitted only as background establishing the pre-AI baseline, and are flagged as such in the charting table.

### §3 Tool Landscape — 1,400 words

- **Purpose:** Characterize what social scientists actually use.
- **Deep tier:** quantitative stack (SPSS, Stata, R, SAS); CAQDAS (NVivo, ATLAS.ti, MAXQDA) plus AI-native entrants; survey platforms (Qualtrics, REDCap).
- **Census tier:** experimental economics (oTree, z-Tree), text-as-data (quanteda, topic modeling), network analysis, agent-based modeling, GIS. Coverage acknowledged as shallow; unknowns recorded as unknowns rather than omitted.
- **Risk:** Institutional site licensing inflates apparent dominance. Distinguish *installed* from *used* — most available sources conflate them.
- **Strength:** Moderate. Well documented, but prevalence claims are largely vendor- or blog-sourced and will need independent triangulation or demotion.

### §4 Source and Access Landscape — 1,200 words

- **Purpose:** Map where literature and data live, and what gates them.
- **Core argument:** Access regime, not tool choice, is the binding constraint. Preprints and journals are balkanized by discipline; restricted microdata is legally gated in ways no connector can dissolve.
- **Evidence:** Discipline-specific repositories (SSRN, RePEc/NBER, PsyArXiv, SocArXiv); OSF and REDCap as partial system-of-record analogs; Census RDC and ICPSR restricted files; IRB guidance on AI access and de-identification (HHS SACHRP, institutional IRB manuals).
- **Risk:** Treating legal gating as a technical problem. This is the section most likely to refute an attractive opportunity — protect it from optimism.
- **Strength:** Strong. Institutional documentation is high-quality, primary, and independent of vendors.

### §5 Adoption Evidence — 1,200 words

- **Purpose:** Establish what is actually adopted, by whom, and how unevenly.
- **Core argument:** Adoption is real, early, uneven, and concentrated — and most public claims about it are untriangulated.
- **Evidence:** Anthropic's coding-agents-in-social-science survey (86% Claude Code share, 97% code-generation use, gender and institutional-prestige adoption gaps). **Vendor-authored about its own product** — classify accordingly and seek independent corroboration.
- **Risk:** This is the single most load-bearing source in the corpus and it fails the review's own vendor rule. Either corroborate it or downgrade every conclusion resting on it.
- **Strength:** **Weak as currently sourced.** Highest-priority triangulation target in the review.

### §6 Comparative Case: The Life-Science Vertical — 1,000 words

- **Purpose:** Use the vertical as a structured comparator, not a template.
- **Core argument:** Three preconditions made it work — centralized authoritative databases with real APIs, lab platforms already functioning as system-of-record, and a converging regulatory end-state. Social science has none of the three.
- **Evidence:** Connector inventory; Claude Science (June 2026); IRB heterogeneity versus HIPAA-readiness; terminal-artifact diversity (journal article, policy brief, corporate deck, litigation-support report).
- **Risk:** Letting the analogy do the arguing. The asymmetry is a finding and needs its own evidence, not rhetorical contrast.
- **Strength:** Moderate. Mechanism is clear; sources are largely tech press and vendor announcements.

### §7 Cross-Cutting Synthesis — 1,200 words

- **Purpose:** Produce the dated capability/source matrix IV-102 requires.
- **Core argument:** Convergent findings, live debates, and explicit unknowns in one inspectable artifact.
- **Evidence:** Matrix rows carry confidence and source class per cell. The three evaluative dimensions appear as columns, each scored on the two-part test above.
- **Risk:** The matrix silently hides that most cells rest on a single source. Show source count per cell.
- **Strength:** Moderate.

### §8 Opportunity Adjudication — 1,000 words

- **Purpose:** Label every proposed connector or workflow opportunity **supported / provisional / refuted / unresolved**.
- **Core argument:** Each label is earned by the evidence behind it, and unresolved stays unresolved.
- **Evidence:** The six candidate opportunities carried over from the predecessor memo, re-adjudicated — literature connector spanning discipline repositories; OSF-native skills; IRB-aware redaction; equity-of-access design; evidence-clearinghouse connectors; CAQDAS-integrating skills.
- **Risk:** This is where IV-102's "missing evidence cannot become a roadmap commitment" is tested. Expect at least one favored opportunity to land on *unresolved*. If none do, the adjudication is not working.
- **Strength:** Strong as a mechanism; conclusions depend entirely on §3–§6.

### §9 Limitations and Update Procedure — 600 words

- **Purpose:** Bound the review and make it re-runnable.
- **Evidence:** Search boundaries; language and geographic limits; categories covered only at census depth; claims that could not be triangulated; absence-of-evidence problems (a missing competitor product may reflect deliberate non-pursuit rather than a market gap); dated re-run procedure.
- **Note:** Method omissions are declared in §2 and are not repeated here. This section covers what the *executed* review could not establish, not what the method deliberately excludes.
- **Strength:** Strong.

### §10 Conclusion — 600 words

Three to five takeaways; an explicit statement of what the evidence licenses and what it does not; handoff to whichever downstream issue consumes the findings.

## INSIGHT collection

```text
[INSIGHT: thesis_statement]
Descriptive-evaluative characterization of post-AI social-science research
fragmentation, with graded evidence per claim. Scope: EN-language academic and
applied social science, tools/sources in active use at review date. Revised from
an initial product-justification framing after that framing was found to conflict
with IV-102's acceptance criterion barring automatic conversion of evidence gaps
into roadmap commitments.

[INSIGHT: evaluative_dimensions]
Generative/visual interpretation layer, multi-agent orchestration, and model
agnosticism converted from product claims into review dimensions. Each scored
twice: absent from landscape? documented as researcher need? The gap between
those two scores is the finding.

[INSIGHT: load_bearing_source_risk]
The strongest adoption evidence in the corpus is vendor-authored about its own
product. Under the review's own triangulation rule it cannot solely support
prevalence claims. Corroborate or downgrade — the review's largest single point
of failure.

[INSIGHT: predecessor_demotion]
IV-102 must be able to demote conclusions of the memo that motivated it. The
review's credibility depends on at least one prior conclusion changing status
under the stricter standard.
```

## Open items

Recorded, not resolved. These do not block drafting.

| Item | State |
|---|---|
| Falsifier threshold — "earned trust and gatekeeping" in observable terms | Undefined by choice. §8 adjudication proceeds without it; competitive-displacement risk cannot be scored. |
| Commitment to the claim that landscape defects are tooling-fixable | Low. §7's two-part scoring is designed so this is tested rather than assumed. |
| Temporal boundary of "post-AI" | **Resolved.** Two-point boundary specified in §2 — corpus opens 1 June 2020, ChatGPT (30 November 2022) as internal stratification marker. |

## Method sources

- Tricco, A. C., Lillie, E., Zarin, W., O'Brien, K. K., Colquhoun, H., Levac, D., … Straus, S. E. (2018). PRISMA extension for scoping reviews (PRISMA-ScR): Checklist and explanation. *Annals of Internal Medicine, 169*(7), 467–473. https://doi.org/10.7326/M18-0850

Verified against [PubMed 30178033](https://pubmed.ncbi.nlm.nih.gov/30178033/) on 2026-08-01.

## Convergence status

| Signal | State |
|---|---|
| C1 thesis clarity | Yes — thesis is stateable in one sentence and reviewable. |
| C2 chapter coherence | Yes — protocol precedes findings; findings precede adjudication. |
| C3 evidence mapping | Partial — evidence mapped by *type*, not yet to specific sources. Resolves during the literature phase. |
| C4 limitation honesty | Yes — the load-bearing source risk and the predecessor-demotion requirement were volunteered, not extracted. |

## Next step

`full` mode picks up from this plan. §2's protocol must be registered before any searching begins; a protocol written after the search cannot satisfy IV-102's reproducibility criterion.
