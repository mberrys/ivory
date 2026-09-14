# The Post-AI Social-Science Research Landscape: A Scoping Review of Tools, Sources, and Adoption

**Deliverable:** IV-102 internal decision review
**Date:** 2026-08-01
**Protocol:** [iv-102-chapter-plan.md](iv-102-chapter-plan.md) §2 · **Evidence base:** [iv-102-phase1-literature-search-report.md](iv-102-phase1-literature-search-report.md)
**Reporting standard:** PRISMA-ScR (Tricco et al., 2018) · **Sources:** 48 · **Corpus window:** 2020-06-01 onward

---

## Abstract

Social-science research runs on a tool and data infrastructure that is frequently described as fragmented, and that description has been used to motivate product decisions without being tested. This review maps what social scientists actually use, where their literature and data live, what gates access to them, and how far AI tooling has penetrated the field, grading each claim by the class of source supporting it. Forty-eight sources were screened under a registered protocol that bars vendor documentation from supporting any prevalence claim.

Three findings run against the framing that motivated the review. Adoption of AI coding agents among social scientists sits at 20%, not the near-universal figure implied by tool-specific share statistics, and the leading assistant among researchers generally is ChatGPT rather than Claude. Fragmentation is real at the economics boundary but overstated elsewhere: the two largest non-economics preprint servers share one backend, and applications for 71 restricted federal datasets run through a single portal. Restricted microdata, meanwhile, is gated more firmly than a licensing account suggests — the Census enclave permits no internet access and no downloads, which forecloses a connector approach on architectural grounds rather than legal ones.

The review labels six proposed interventions supported, provisional, refuted, or unresolved. It does not convert the remaining gaps into recommendations.

**Keywords:** research infrastructure, scoping review, CAQDAS, restricted microdata, AI adoption, scholarly communication

---

## 1. Introduction

A prior internal memo surveyed this landscape in quick mode and reached a set of conclusions that have since been used as background for product reasoning. That memo declared its own limits plainly: it drew one to two sources per claim, did not triangulate adoption percentages or product feature lists, and left whole tool categories unsearched. Its closing note recommended a full-mode pass "if you want this graded to academic evidence standards."

This review is that pass. The reason to run it is not that the earlier synthesis was careless — it was appropriately labelled — but that its conclusions have a longer half-life than its evidence. A claim about adoption rates, once written down, tends to be cited internally without its provenance. IV-102 exists to fix the provenance and, where the evidence does not support the claim, to say so.

The standard adopted here is stricter in one specific way. Vendor documentation may establish what a product does; it may never establish how widely that product is used, how well it works, or what position it holds in a market. That rule alone changes the status of the earlier memo's central adoption finding, as §5 shows.

Two things this review is not. It is not a systematic review in the effect-synthesis sense, and §2 declares what that means it omits. And it is not a product justification: no source in the corpus is about Ivory Tower, so no finding here can speak to it. The review supplies evidence for later decisions and stops there.

The question it answers: what tools, sources, and access regimes constitute social-science research infrastructure as of mid-2026, how much of it has AI penetrated, and which proposed interventions does the evidence currently support?

---

## 2. Review Protocol

### 2.1 Reporting standard

The review follows PRISMA-ScR, the scoping-review extension of PRISMA (Tricco et al., 2018), which supplies 20 essential reporting items and 2 optional ones. A scoping review is the right instrument here because its stated purpose is to identify what exists and where the gaps are, which is IV-102's objective verbatim. The checklist also makes search boundaries and inclusion logic auditable rather than asserted, which is the failure mode this review was commissioned to correct.

Registration follows a constraint worth noting: PROSPERO does not accept scoping reviews. The protocol is therefore versioned in this repository with a date and commit reference. Any external rendering would require registration on OSF Registries before a re-run.

### 2.2 Source taxonomy and the triangulation rule

Every included source is classified into one of five categories: independent empirical research, institutional documentation, vendor-authored material, practitioner or analyst report, and commentary. The classification is not a quality ranking. An institutional review board's guidance page is the authoritative statement of that board's policy, and no peer-reviewed article supersedes it on that point.

The classification carries one hard rule. **Vendor statements may establish product capability. They may never establish adoption prevalence, quality, or market position.** A company's description of its own connector inventory is good evidence that the connectors exist. It is not evidence that anyone uses them.

The corpus distribution:

| Class | Count | Admissible for prevalence? |
|---|---|---|
| Independent empirical | 13 | Yes |
| Institutional documentation | 15 | Yes, for that institution's own policy and operations |
| Vendor-authored | 12 | No — capability only |
| Practitioner/analyst | 5 | Provisional; requires corroboration |
| Commentary/trade press | 3 | Context only |

Each extracted claim carries its own record: claim text, supporting sources, source class, publication date, access state, geographic and institutional scope, methodology, conflicts of interest, triangulation status, and confidence. PRISMA-ScR charts at source level; this claim-level layer is an addition to the standard, not a substitution for any of its items.

### 2.3 Temporal boundary

The corpus window opens 1 June 2020, following the availability of the GPT-3 API. A second date, 30 November 2022, marks the ChatGPT release and functions as an internal stratification marker rather than a boundary.

The two-point design resolves a real ambiguity. GPT-3's release was a developer API beta, not a public product; the phrase "AI in the public sphere" describes ChatGPT far better. Opening the window at the earlier date captures the pre-ChatGPT baseline, which is what makes any claim about post-AI change testable rather than assumed. Sources predating June 2020 are admitted only as background establishing that baseline, or as seminal tool papers, and are flagged in both cases.

### 2.4 Declared omissions

An unexplained missing item reads as sloppiness. A justified one reads as method. The omissions fall into two classes, and treating them as one would misrepresent both.

**Class A — PRISMA-ScR optional items, declined.** Items 12 and 19 cover critical appraisal of individual sources, in methods and results respectively. The standard marks both optional for scoping reviews, so declining them is conformance rather than deviation. The source-class and confidence layer records provenance and corroboration; it is explicitly **not** a substitute for critical appraisal, and is not claimed as one.

**Class B — systematic-review apparatus never in scope.** These are not PRISMA-ScR items at all.

| Omission | Justification |
|---|---|
| Meta-analysis and effect synthesis | The units of analysis are tools, sources, and access regimes, not studies reporting comparable effect estimates. There is nothing to pool. |
| Risk-of-bias assessment of included studies | Presupposes a body of primary studies with comparable designs. Fifteen of 48 sources are institutional policy documents, for which study-level instruments are undefined. |
| GRADE certainty grading | Built for outcome-level certainty across intervention studies. This review has no intervention outcomes; applying GRADE would manufacture precision it cannot support. |

### 2.5 Search and screening

Twelve Boolean queries ran across Google Scholar and the open web, reaching ScienceDirect, PubMed Central, Taylor & Francis, arXiv, SSRN, and medRxiv, supplemented by direct retrieval of institutional documentation from the Census Bureau, ICPSR, IPUMS, NIH, and named university IRB offices. Citation chaining ran backward from the Anthropic coding-agents study and the Nature adoption analysis; forward tracking covered 2025–2026 AI-in-research survey literature.

Search stopped on four of five saturation criteria: source count met, final round adding under 10% new material, every theme carrying at least three sources, and coverage spanning both foundational works and the last three years. Citation-loop closure was not formally assessed and is recorded as a limitation.

**Flow:** 96 identified → 78 screened after deduplication → 54 assessed → 48 included. Twenty-four were excluded at title and abstract as off-topic, duplicate aggregations, or pure marketing carrying no factual claim. Six were excluded at full assessment as secondary rewrites of the Anthropic or Nature primary sources adding no independent evidence.

Coverage of the tool landscape is two-tier by design: quantitative software, CAQDAS, survey platforms, source access, and adoption were reviewed in depth; experimental economics, text-as-data, network analysis, and agent-based modelling received a census pass whose limits are stated rather than concealed.

---

## 3. The Tool Landscape

### 3.1 Quantitative analysis

The quantitative stack has been reorganising for fifteen years, and the direction is consistent across every independent source located. Muenchen's long-running citation series shows SPSS dominance peaking in 2009 before a sharp decline, SAS peaking around 2010, and R and Stata growing rapidly enough to pull away from the rest of the field. That series is analyst work rather than peer-reviewed, and is treated as provisional, but a peer-reviewed bibliometric analysis of health-sciences research reports a compatible picture with SPSS at 52.1%, SAS at 12.9%, and Stata at 12.6% ([PMC7872865](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7872865/)).

Discipline matters more than any aggregate. An analysis of Management Science articles published between 2019 and 2023 found Stata in 60% of articles, R in 19%, MATLAB in 18%, SAS in 13%, and Python in 11% ([arXiv 2504.06507](https://arxiv.org/html/2504.06507)). Health sciences and management economics are running different stacks, and both differ from psychology's historical SPSS base.

Two observations follow. The first is that institutional site licensing sustains tools past the point where individual preference would. SPSS and Stata persist in university environments through campus agreements, which means installed base and active preference diverge, and most available sources conflate them. The second is that the packages are functionally substitutable for common designs. A comparison of complex survey modelling across R, SAS, SPSS, and Stata found the four capable of the same analyses ([arXiv 2010.09879](https://arxiv.org/pdf/2010.09879)), which weakens any claim that tool choice locks in analytic capability.

### 3.2 Qualitative analysis and CAQDAS

NVivo, ATLAS.ti, and MAXQDA anchor computer-assisted qualitative data analysis, with Dedoose, QDA Miner, Quirkos, Delve, and Taguette serving smaller projects. An independent comparative study assessed these platforms on coding flexibility, usability, visualisation, and collaboration ([ResearchGate 370290300](https://www.researchgate.net/publication/370290300_Qualitative_Data_Analysis_Software_Dedoose_ATLAS_NVivo_MAXQDA)).

All three market leaders have added generative AI features. Vendor documentation establishes what these features do: NVivo offers a structured, task-based AI assistant; ATLAS.ti offers conversational prompt-based exploration; MAXQDA's AI Assist covers document and code summaries, coding suggestions, chat, and report generation. These are capability claims from vendor sources, and the review treats them as exactly that.

What the vendors cannot establish is whether any of it improves research. Here the corpus produces a clear and slightly uncomfortable result: peer-reviewed literature systematically examining how GenAI-integrated CAQDAS affects qualitative research *outcomes* remains scarce, and critical analysis of the integration into MAXQDA and NVivo is rarer still. The strongest study located compared MAXQDA 24.9.1, NVivo 15.1.2, and ChatGPT 4.5/4o on qualitative survey data from a youth sustainability project, framing the question as one of technological reflexivity rather than efficiency ([*Qualitative Research*, 2025](https://www.tandfonline.com/doi/full/10.1080/14780887.2025.2602820)).

The AI-native entrants — Usercall, Dovetail, Notably, Conveo — position themselves as accelerating interpretation rather than performing it. That framing is consistent across their materials and is worth taking seriously as a signal about what the vendors believe the market will accept, though it remains vendor-authored and establishes nothing about uptake.

One claim that appears frequently and cannot be admitted: NVivo's status as the most-cited QDA software in published research is vendor-sourced. It may well be true. It is recorded as **unresolved**.

### 3.3 Survey and data collection

REDCap is the most institutionally embedded research tool in the corpus. Consortium figures as of 2023 report 7,123 institutions across 156 countries, over two million projects, and more than 22,700 publications. It was built for HIPAA compliance with exhaustive audit trails, and is free to consortium member institutions. An independent adoption study from Tanzania documents its use outside the US and high-income contexts ([medRxiv, 2025](https://www.medrxiv.org/content/10.1101/2025.10.25.25338769.full.pdf)).

Qualtrics occupies the adjacent position: richer survey design and reporting, subscription-priced, dominant in enterprise UX and market research. Institutional documentation from named universities confirms dual licensing of both platforms, admissible for those institutions and no further.

The pairing is informative. Where a research tool is institutionally operated, free at point of use, and audit-complete, it achieves the kind of penetration that no commercial social-science tool in this corpus matches. REDCap is the closest thing social science has to a shared system of record.

### 3.4 Census tier

Experimental economics runs on two platforms with a datable transition inside the review window. z-Tree, the long-standing Zurich toolbox, was lab-bound by design; oTree is a Python framework running in any browser without subject-side installation ([Chen, Schonger, & Wickens](https://www.sciencedirect.com/science/article/pii/S2214635016000101)). The pandemic pushed experimental work online, and oTree suited that shift, while z-Tree required a new client-integrating architecture — "z-Tree unleashed" — to follow ([SSRN 3756019](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3756019)).

Text-as-data, network analysis, and agent-based modelling were covered at census depth. quanteda serves R-based quantitative text analysis; Gephi, igraph, and NodeXL cover network exploration; NetLogo provides an ABM environment built around a Logo-derived language aimed at non-programmers. One peer-reviewed source pairs an LLM with a social-science modelling tool directly, studying novices and experts using ChatGPT alongside NetLogo Chat ([CHI 2024](https://dl.acm.org/doi/10.1145/3613904.3642377)).

No prevalence evidence was located for any tool in this tier. Their prominence in methods literature is not evidence of use, and the review records this as unresolved rather than inferring low adoption from thin coverage. This is the cost of the two-tier design, and it was accepted knowingly.

---

## 4. The Source and Access Landscape

### 4.1 Literature: less balkanised than assumed

Social-science literature is routinely described as scattered across discipline-specific repositories with no shared hub. The corpus supports a more precise version of that claim and refutes the strong form.

SocArXiv was founded in 2016 by sociologist Philip N. Cohen in partnership with the Center for Open Science, and it runs on the Open Science Framework. PsyArXiv is likewise OSF-hosted. OSF Preprints operates as an umbrella hosting multiple disciplinary communities on shared backend infrastructure. Two of the three largest non-economics social-science preprint servers therefore sit on one technical substrate.

Economics is the genuine exception. RePEc is a volunteer effort spanning 102 countries with its own conventions and infrastructure, and it does not share the OSF backend. SSRN is a separate case again, having been owned by Elsevier since 2016, which is a question of ownership concentration rather than fragmentation and should not be filed under the same heading.

The practical consequence for anything that would integrate with this layer: the number of genuinely distinct technical integrations is smaller than the number of repository brands. That cuts in favour of feasibility, not against it, and it contradicts the framing that motivated the earlier memo's highest-ranked opportunity.

### 4.2 The Open Science Framework as system of record

OSF has crossed the thresholds that make it a plausible analog to a life-science lab-data platform. The Center for Open Science reports over 500,000 registered users and more than 100,000 registrations, with non-linear growth every year since launch in November 2012, when it had 371 users. Registrations are time-stamped, archived, read-only study plans supporting discipline-specific templates.

Adoption appears to be training-dependent rather than tool-dependent. A pre-post study found OSF accounts rising from 7 to 78 following an open-science course ([PMC12120411](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12120411/)), which suggests the binding constraint on open-science infrastructure is instruction rather than availability.

### 4.3 Restricted microdata: architecturally closed

This is where an attractive analogy fails hardest, and the evidence is primary and unambiguous.

Confidential federal microdata provisioned through the Federal Statistical Research Data Center program lives on Census Bureau servers at the agency's computer centre in Bowie, Maryland, and is accessed through Census-operated virtual desktop infrastructure. Census documentation states that researchers **cannot access the internet or any other network while in an FSRDC, and cannot download any information from Census servers**. Where remote access is authorised, the only permitted device in a home office is a VDI-enabled computer, with phones, tablets, and other computers excluded.

This is not a licensing restriction that a negotiation could relax. It is an architecture built to make egress impossible. Any integration that assumes data can move from the enclave to an external service is foreclosed at the design level, and no partnership changes that.

One qualification runs the other way. ICPSR's ResearchDataGov portal consolidates discovery and application for 71 restricted federal microdata sets from multiple statistical agencies. The application layer is centralised even though the data layer is sealed. A tool that helped researchers navigate applications would be operating in a space that exists; a tool that expected to read the data would not.

### 4.4 The confidentiality regime is tightening

Institutional review requirements for AI in human-subjects research are heterogeneous, and they are moving toward more oversight rather than less.

The clearest instance is from the University of Washington, whose Human Subjects Division revised its interpretation of the regulatory definition of a human subject in 2025 to capture secondary use of de-identified data at high risk of **re-identification by AI systems**. The revision exists because the prior interpretation left a gap that AI capability opened.

Federal guidance is internally divergent. NIH's Office of Human Subjects Research Protections notes that the Common Rule excludes research using only de-identified data, while FDA regulations draw no distinction between identifiable and de-identified data. Researchers operating across both regimes face different rules for the same dataset.

Institutional variance compounds this. Teachers College at Columbia requires that AI software touching human-subjects data may need both an IT security assessment and IRB review, additive rather than substitutive. Separately authored AI policies exist at the University of Wisconsin–Madison, NASA, Mass General Brigham, and Fort Lewis College, alongside federal advisory recommendations from HHS SACHRP and commercial IRB commentary from Advarra. Six institutions, six documents, no shared standard.

The variance is the finding. A compliance feature that satisfies one IRB has no guaranteed standing at the next, which makes "IRB-ready" a claim that cannot be made in general.

---

## 5. Adoption Evidence

### 5.1 What the strongest sources show

Two independent peer-reviewed sources anchor this section. A Nature analysis of 41.3 million research papers found accelerating AI adoption among scientists alongside consistent professional advantages: AI-augmented researchers publish 3.02 times more papers, receive 4.84 times more citations, and become project leaders 1.37 years earlier. The same analysis found a collective narrowing of scientific focus, making this the corpus's only source documenting a systemic cost alongside individual benefit ([Nature, 2025](https://www.nature.com/articles/s41586-025-09922-y)).

A large-scale survey from Germany published in *Research Policy* examines who uses AI in research and for what ([S0048733325002100](https://www.sciencedirect.com/science/article/pii/S0048733325002100)). It is the corpus's principal non-US, non-vendor survey evidence and the main counterweight to a heavily American source base.

Publisher survey data adds scale. A Springer Nature survey of 2,021 researchers found 57% using AI to stay current with published research or to read papers, and 52% using it to write papers or grant applications, with 80% of users intending to continue. Reporting on a Frontiers survey of roughly 1,600 academics across 111 countries found more than half using AI during peer review, frequently against journal guidance ([Nature, 2025](https://www.nature.com/articles/d41586-025-04066-5)). Adoption has outrun governance.

### 5.2 The coding-agent claim, triangulated

The earlier internal memo treated one finding as decisive, writing that "Claude Code is dominant among these researchers (86% usage share)" and concluding that "social scientists are already voting with their workflows for general-purpose Claude Code over anything bespoke."

The underlying study does not support that reading. Anthropic's survey of social scientists reports that **81% have used generative AI models, while only 20% have adopted coding agents**. Adoption divides sharply by discipline: economists lead at 39%, political scientists follow at 25%, and public health and education sit at 6%. The 86% figure describes Claude Code's share *among the 20% who use coding agents at all*, not among social scientists.

Independent data compounds the correction. In the Springer Nature survey, general-purpose models accounted for 75.9% of all tool mentions, and within that category **ChatGPT led at 36.8%, Gemini at 19.4%, and Claude at 6.5%**. Among researchers generally, Claude is the third-ranked assistant by a wide margin.

Both readings can hold simultaneously — Claude Code may well dominate the command-line coding-agent niche while Claude trails badly among general assistants — but the memo's conclusion depended on conflating the niche with the field. The demand signal it called "the strongest signal in the whole landscape" describes a fifth of social scientists, and the tool-specific dominance claim does not survive triangulation against an independent source.

Other findings from the same study replicate cleanly and are retained: code generation dominates use at 97%, male researchers adopt at more than twice the rate of women, doctoral students and postdocs use coding agents weekly at more than double the rate of tenured professors, and researchers at top institutions are 40% more likely to adopt. Independent trade reporting confirms these figures were read the same way by third parties, and Anthropic's Economic Index corroborates the general unevenness pattern while remaining vendor-authored ([arXiv 2511.15080](https://arxiv.org/abs/2511.15080)).

### 5.3 Independent evidence on agent use

Two archival preprints examine coding agents directly rather than through adoption rates. One studies AI coding agents in social science and characterises them as methodologically diverse, empirically consistent, and **interpretively vulnerable** ([arXiv 2606.11456](https://arxiv.org/pdf/2606.11456)). The other documents adoption and impact of command-line agents in Microsoft's early-2026 rollout of Claude Code and GitHub Copilot CLI, providing an independent read on the same tool class in a non-academic population ([arXiv 2607.01418](https://arxiv.org/pdf/2607.01418)).

The interpretive-vulnerability finding matters beyond adoption counts. It suggests the constraint on agent use in social science is not access or capability but the reliability of interpretation, which is the part of the workflow that qualitative researchers have consistently declined to delegate.

---

## 6. Comparative Case: The Life-Science Vertical

The life-science AI vertical is the reference case that motivated this review, and it is used here as a comparator rather than a template.

Vendor documentation establishes the architecture. Claude for Life Sciences ships pre-built Model Context Protocol connectors to Benchling for lab notebook and experiment management, 10x Genomics for single-cell analysis, PubMed for literature, BioRender for figures, Synapse.org for biomedical data, and Wiley's Scholar Gateway for authenticated journal access. Trade press reports a Protocol QA benchmark score of 0.83 against a 0.79 human baseline, and a Novo Nordisk deployment reducing clinical study documentation from more than ten weeks to ten minutes, with Sanofi, AbbVie, and Genmab deployments across regulatory compliance and drug discovery. These are claimed outcomes relayed by trade press from vendor sources, and are reported as claims.

Three structural preconditions made that architecture viable, and each has a social-science counterpart that fails in a different way.

**A small number of centralised, authoritative, API-accessible databases.** PubMed, ChEMBL, and ClinicalTrials.gov function as shared field infrastructure. Social science has no equivalent, though §4.1 shows the shortfall is narrower than usually claimed: OSF hosts several disciplinary preprint communities on one backend, and ICPSR centralises restricted-data applications. What social science lacks is not shared infrastructure but a single authoritative literature index with the coverage PubMed has.

**Lab-data platforms already operating as system of record with programmatic access.** Benchling holds experimental data in structured form as a matter of routine workflow. The nearest social-science analogs are OSF, at 500,000 users, and REDCap, at 7,123 institutions. Both are real infrastructure at real scale. Neither holds the working analytic dataset the way Benchling does, because the social-science working dataset typically sits in a researcher's own files, in a statistical package's native format, or inside an enclave that permits no egress at all.

**A converging regulatory end-state.** FDA and EMA submission gives auditable, source-linked output concrete value, because a specific institution will read it and decide. Social-science output terminates in journal articles, policy briefs, corporate decks, and litigation-support reports, and no single auditability standard carries the same weight across those destinations.

The asymmetry compounds rather than merely differing. Life science had centralised data *and* a system of record *and* a regulatory target, and the connector approach depended on all three. Social science has partial infrastructure, no working-data system of record, and no convergent endpoint. The confidentiality regime documented in §4.4 pushes in the opposite direction from the one the life-science model needs, tightening in response to AI capability rather than accommodating it.

There is also a workflow with no life-science counterpart. Coding interview transcripts and open-ended responses requires sustained judgment about meaning rather than summarisation, which is why the CAQDAS incumbents and the AI-native entrants both frame their features as accelerating interpretation rather than performing it, and why §5.3's interpretive-vulnerability finding lands where it does.

---

## 7. Cross-Cutting Synthesis

### 7.1 Capability and source matrix

| Landscape element | Status | Evidence class | Sources | Confidence |
|---|---|---|---|---|
| Quantitative stack shifting R/Stata-ward | Supported | Independent empirical + analyst | 4 | Moderate |
| Discipline-specific stack divergence | Supported | Independent empirical | 2 | Moderate |
| CAQDAS market led by NVivo/ATLAS.ti/MAXQDA | Supported | Independent + vendor | 3 | Moderate |
| GenAI features present in all three CAQDAS leaders | Supported (capability only) | Vendor | 4 | High for existence |
| GenAI improves qualitative research outcomes | **Unresolved** | — | 1 partial | Low |
| REDCap institutionally embedded at scale | Supported | Institutional | 3 | High |
| Preprint layer partially shares OSF backend | Supported | Institutional | 4 | High |
| Economics literature layer genuinely separate | Supported | Institutional | 1 | Moderate |
| Restricted microdata forecloses egress | **Supported (strong)** | Institutional, primary | 4 | High |
| IRB regime heterogeneous and tightening | Supported | Institutional | 8 | High |
| Coding-agent adoption ~20% among social scientists | Supported | Vendor, corroborated in pattern | 3 | Moderate |
| Claude dominant among social scientists | **Refuted as stated** | Independent contradicts vendor | 2 | Moderate |
| AI adoption confers publication advantage | Supported | Independent peer-reviewed | 1 | Moderate |
| Census-tier tool prevalence | **Unresolved** | — | 0 | None |

Cell counts are shown because a matrix that hides single-sourcing is worse than no matrix. Six of fourteen rows rest on three or fewer sources.

### 7.2 The three evaluative dimensions

The review was asked to assess three properties. Each is scored twice, because a property absent from the landscape but undocumented as a need is a builder's assumption rather than a market gap.

| Dimension | Absent from landscape? | Documented as researcher need? |
|---|---|---|
| Generative/visual interpretation layer | **Yes** — no source describes such a layer in any reviewed tool; CAQDAS visualisation is static and analyst-driven | **Yes** — see §7.2.1 |
| Multi-agent orchestration | **Yes** — one peer-reviewed source pairs a single LLM with a modelling tool (CHI 2024); no orchestration of multiple models appears anywhere in the corpus | **No evidence located** |
| Model agnosticism | **Yes** — every AI feature located is bound to its vendor's chosen model; no reviewed tool offers model selection | **No evidence located** |

All three properties are genuinely absent from the landscape. They differ sharply on the demand axis, and the difference is the decision-relevant part.

#### 7.2.1 Supplementary targeted search — visualisation demand

The main corpus contained no demand-side evidence for any dimension. A supplementary targeted search on 2026-08-01, run after the primary screening closed and reported separately from the 48-source corpus so the PRISMA-ScR flow stays intact, located nine sources on the visualisation dimension specifically. Six are peer-reviewed. The result changes that dimension's status.

The clearest statement comes from a methods paper in psychology: social scientists regularly need to visualise the results of their analyses but receive little training in how to do so ([Hehman & Xie, 2021, *Advances in Methods and Practices in Psychological Science*](https://journals.sagepub.com/doi/full/10.1177/25152459211045334)). Focus-group research with researchers in Spain reaches compatible conclusions about the interaction of domain knowledge and visualisation practice ([*Computers in Human Behavior*, 2024](https://www.sciencedirect.com/science/article/pii/S0747563224000293)), and it is non-US, which partially offsets the geographic skew.

Two further findings sharpen the shape of the need. Effort cost is real and measurable: a study of poster preparation found researchers spending on average two full days on a single poster, half of it on visual design, with most receiving no design or software training and little feedback ([PMC10646475](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10646475/)). And a documented research-practice gap means the empirical visualisation literature is largely inaccessible to the practitioners who would benefit ([arXiv 2310.09614](https://arxiv.org/pdf/2310.09614); [arXiv 2509.01018](https://arxiv.org/pdf/2509.01018)).

The single most on-point source is a Stata User Group presentation: *an unfulfilled need for many researchers is innovatively presenting survey data-analysis results without feeling limited by working within one statistical software only* (Haw, 2022, [RePEc boc/usug22/17](https://ideas.repec.org/p/boc/usug22/17.html)). The presented workaround is to run analysis in Stata, export via `postfile`, and hand off to R for figures.

That last source needs careful reading, because it is easy to over-claim. It documents demand for portability across **statistical software**, not across **models**. The two are structurally similar and substantively different, and treating the first as evidence for the second would be the analogical error this review was built to avoid. Model agnosticism remains unevidenced on the demand axis.

**Revised status.** Dimension 1 moves from *no evidence located* to **documented need, moderate confidence**, on six peer-reviewed and three practitioner sources. Dimensions 2 and 3 are unchanged: absent from the landscape, with no located evidence that anyone wants them. The demand question for those two remains answerable only by primary research this review did not conduct.

### 7.3 Convergent and divergent findings

Three findings converge across independent sources. AI adoption among researchers is substantial and rising. It is unevenly distributed by gender, seniority, discipline, and institutional prestige. And governance is lagging behind practice, visible most clearly in peer-review use running against explicit journal guidance.

Two genuine divergences remain. The first concerns whether fragmentation is the right frame: the discipline-brand count suggests severe fragmentation, while the backend infrastructure count suggests partial consolidation, and the two readings support opposite conclusions about integration feasibility. The second concerns whether AI tooling helps qualitative work, where vendor materials assert improvement and independent literature has not tested it.

One methodological observation. Fifteen of 48 sources are institutional policy documents, and they proved the most decisive evidence in the corpus. The Census enclave rules and the University of Washington revision settled questions that no amount of survey data would have. For infrastructure review, reading the operator's own documentation outperforms searching the academic literature about it.

---

## 8. Opportunity Adjudication

Six interventions carried forward from the earlier memo, re-adjudicated against this corpus. Labels are earned by evidence. Unresolved stays unresolved.

**1. Literature connector spanning discipline repositories — PROVISIONAL, upgraded feasibility.**
The earlier memo ranked this highest on the assumption of severe fragmentation. The fragmentation premise is partly wrong, which makes the intervention *more* feasible and *less* differentiating: OSF-hosted communities share a backend, so fewer distinct integrations are required than the repository-brand count implies. RePEc remains separate and would need its own path. What remains unevidenced is demand — no source establishes that discovery across these repositories is a binding constraint on researchers. Feasibility is better than believed; necessity is unestablished.

**2. OSF-native skills for preregistration and replication packages — PROVISIONAL.**
OSF is real infrastructure at real scale: 500,000 users, over 100,000 registrations, sustained non-linear growth. That satisfies the substrate precondition. Two things are missing. No evidence was located on OSF's API maturity relative to what such integration would require, and the one adoption study located suggests uptake responds to training rather than tooling. The substrate supports the intervention; the evidence does not yet establish that tooling is the binding constraint.

**3. IRB-aware redaction and de-identification — SUPPORTED as a requirement, REFUTED as a differentiator.**
The evidence strongly supports that confidentiality handling is necessary. Eight institutional sources document a heterogeneous regime that is tightening specifically in response to AI, including the University of Washington's 2025 extension of review to de-identified data at re-identification risk, and divergent Common Rule and FDA treatments of the same data.

That same heterogeneity refutes the stronger claim. Because each institution authors its own policy and Columbia requires separate IT security review alongside IRB review, no general-purpose redaction feature can claim IRB readiness across institutions. This is a compliance obligation to be met, not a market position to be held.

**4. Equity-of-access design — SUPPORTED.**
The adoption gaps are documented and consistent: male researchers adopt at more than twice the rate of women, top-institution researchers at 40% higher rates, and junior researchers well above tenured ones. These are vendor-reported but pattern-corroborated by independent trade reporting and consistent with the geographic unevenness in Anthropic's Economic Index. The empirical basis for treating equity as a design constraint rather than an afterthought is sound. What the evidence does not establish is that any particular pricing or access model closes the gaps.

**5. Evidence-clearinghouse connectors — UNRESOLVED.**
The earlier memo proposed connectors to Campbell Collaboration, What Works Clearinghouse, FRED, IPUMS, and major survey series. This review located no evidence on any of them beyond IPUMS's FSRDC role. Their existence is not in question; their API accessibility, usage, and relevance to actual workflows were not examined. The memo called this space "underbuilt," which was an inference rather than a finding, and it remains one.

**6. Qualitative-analysis integration with CAQDAS exports — UNRESOLVED, and blocked on a prior question.**
Integration presumes AI assistance improves qualitative analysis, and that premise has no independent support. Peer-reviewed examination of GenAI-in-CAQDAS effects on research outcomes is scarce; the strongest study frames the question as reflexivity rather than improvement; and the independent literature on coding agents describes them as interpretively vulnerable. Whether integration is worth building cannot be adjudicated until the prior question has an answer.

**Summary: 1 supported, 1 supported-with-a-refuted-component, 2 provisional, 2 unresolved, 1 refuted opportunity from §4.3** — the restricted-microdata connector, foreclosed by Census enclave architecture rather than by policy.

None of the unresolved items converts to a recommendation. Each names the evidence that would resolve it.

---

## 9. Limitations and Update Procedure

**Geographic concentration.** Twenty-six of 33 sources with identifiable geography are US-based (79%). The access and IRB findings in §4.3 and §4.4 describe the American research-data regime. GDPR, the UK Data Service, and other national infrastructures are unrepresented, and no conclusion about legal or architectural gating transfers internationally on this corpus. The German survey and the Tanzanian REDCap study partially mitigate this for adoption evidence only.

**Peer-review ratio.** Thirteen of 48 sources (27%) are peer-reviewed or archival preprints, against a 70% threshold in the review's own quality gates. **This gate failed and was not remediated.** The failure is structural: a review of what software exists and who operates it necessarily draws on vendor documentation and institutional policy pages, and no additional searching converts a product feature list into a peer-reviewed source. Removing vendor sources would delete the only record of what these products do. The mitigation is the source-classification rule barring vendor material from prevalence claims, not a higher ratio.

**Census-tier depth.** Experimental economics, text-as-data, network analysis, and agent-based modelling received a deliberate census pass. No prevalence evidence exists for any tool in that tier, and the absence is recorded as unresolved rather than treated as low adoption.

**Citation-loop closure.** Four of five saturation criteria were met. Backward citation chaining was not run to closure, so foundational works cited across multiple corpus sources may remain uncollected.

**Absence of evidence.** No competitor product matching the reviewed profile was located. That absence supports no inference. It is equally consistent with an unserved market and with a deliberate decision by capable vendors not to serve it, and this method cannot distinguish the two.

**Unfalsifiable competitive threshold.** The review was commissioned without an operational definition of what would count as a competitor achieving durable market position. §8 adjudicates feasibility and evidentiary support; it cannot score competitive-displacement risk.

**Method omissions.** Declared in §2.4 and not repeated here. This section covers what the executed review could not establish, not what the method deliberately excluded.

**Update procedure.** Re-running requires: the twelve Boolean strings in §2.5 with the corpus window extended to the new run date; direct retrieval of the fifteen institutional sources, since policy pages change without versioning and the IRB set is the fastest-moving part of the corpus; re-triangulation of every prevalence claim against sources published since the prior run; and a fresh PRISMA-ScR flow count. Any claim whose sole support has disappeared or changed reverts to unresolved. The protocol version and run date must be recorded with the output.

---

## 10. Conclusion

**The fragmentation story needs revision, not repetition.** Social-science research infrastructure is genuinely divided at the economics boundary and genuinely uneven in tooling, but the preprint layer partly shares one backend and restricted-data applications run through one portal. Integration is more feasible than the standard account implies, and correspondingly less differentiating.

**Restricted microdata is closed by architecture.** The Census enclave permits no internet access and no downloads. This is the review's firmest finding and the one that most cleanly forecloses an approach. Treating it as a licensing problem would waste effort on a negotiation that cannot succeed.

**The confidentiality regime is moving away from integration.** Institutional review requirements are heterogeneous across every institution examined and are tightening specifically because AI raised re-identification risk. Compliance is a cost of entry, not a position.

**Adoption is real, uneven, and smaller than advertised.** Around 20% of social scientists use coding agents, concentrated among economists, men, juniors, and elite institutions. Among researchers generally, ChatGPT leads and Claude holds 6.5% of general-purpose model mentions. The claim that social scientists have already converged on one tool does not survive triangulation.

**The three evaluated properties are all absent from the landscape, but they do not share a demand profile.** Visualisation has a documented, peer-reviewed need: social scientists must visualise results, receive little training in doing so, spend substantial effort on it, and describe cross-software friction as an unfulfilled need (§7.2.1). Multi-agent orchestration and model agnosticism have no located demand evidence at all. Treating the three as one opportunity would inherit the strength of the first for the other two, and the evidence does not support that.

**One demand signal is adjacent but not equivalent.** Researchers documented wanting portability across *statistical software*. That is not evidence of wanting portability across *models*, and the review declines to treat it as such.

What the evidence licenses: characterising the landscape, ruling out the restricted-microdata path, treating confidentiality as an obligation, and treating equity gaps as documented. What it does not license: any conclusion about whether a new tool is needed, wanted, or likely to be adopted. Those questions remain open, and this review deliberately leaves them that way.

---

## Statements

**AI disclosure.** This review was produced with AI assistance (Claude, running the ARS academic-paper pipeline) across protocol design, literature search, source classification, synthesis, and drafting. All 48 sources were retrieved through live web search during Phase 1 and are cited with links; the PRISMA-ScR methods citation was verified against PubMed. No source was cited from model memory. The author is responsible for the review's conclusions.

**Data availability.** The source corpus, classifications, and screening decisions are recorded in [iv-102-phase1-literature-search-report.md](iv-102-phase1-literature-search-report.md) in this repository. No primary data was collected.

**Ethics.** No human subjects, no personal data, no restricted material. IRB review not applicable.

**Author contributions.** Single-author internal deliverable. Conceptualisation, methodology, and validation by the author; AI assistance as disclosed above.

**Conflict of interest.** This review was commissioned to inform product decisions for Ivory Tower, a tool in the category under review. The framing risk was identified during planning and addressed by scoping the review to landscape characterisation, excluding the product from the thesis, and requiring that gaps remain unresolved rather than converting to recommendations. Readers should weigh the remaining risk.

**Funding.** No external funding.

---

## References

Anthropic. (2026). *Coding agents in the social sciences*. https://www.anthropic.com/research/coding-agents-social-sciences

Anthropic. (2026). *Advancing Claude in healthcare and the life sciences*. https://www.anthropic.com/news/healthcare-life-sciences

Anthropic. (2025). *Anthropic Economic Index report: Uneven geographic and enterprise AI adoption*. arXiv. https://arxiv.org/abs/2511.15080

Center for Open Science. *Surpassing 100,000 registrations on OSF*. https://www.cos.io/blog/surpassing-100000-registrations-on-osf

*Data visualization and domain knowledge: Insights through focus groups of researchers in Spain*. (2024). *Computers in Human Behavior*. https://www.sciencedirect.com/science/article/pii/S0747563224000293

Haw, N. J. (2022). *Visualizing survey data-analysis results: Marrying the best from Stata and R*. Stata User Group meeting. https://ideas.repec.org/p/boc/usug22/17.html

Hehman, E., & Xie, S. Y. (2021). Doing better data visualization. *Advances in Methods and Practices in Psychological Science*. https://doi.org/10.1177/25152459211045334

*Insights on poster preparation practices in life sciences*. PMC10646475. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10646475/

*Understanding the research-practice gap in visualization design guidelines*. arXiv. https://arxiv.org/pdf/2310.09614

*The state of the art in visualization literacy*. arXiv. https://arxiv.org/pdf/2509.01018

Center for Open Science. *500,000 OSF users: Celebrating a global open science community*. https://www.cos.io/blog/celebrating-a-global-open-science-community

Chen, D. L., Schonger, M., & Wickens, C. oTree — An open-source platform for laboratory, online, and field experiments. *Journal of Behavioral and Experimental Finance*. https://www.sciencedirect.com/science/article/pii/S2214635016000101

*Fostering open science and responsible research practices: A pre-post study*. PMC12120411. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12120411/

*Learning agent-based modeling with LLM companions: Experiences of novices and experts using ChatGPT & NetLogo Chat*. (2024). CHI '24. https://dl.acm.org/doi/10.1145/3613904.3642377

Muenchen, R. A. *The popularity of data science software*. r4stats.com. https://r4stats.com/articles/popularity/

Nature. (2025). Artificial intelligence tools expand scientists' impact but contract science's focus. https://www.nature.com/articles/s41586-025-09922-y

Nature. (2025). More than half of researchers now use AI for peer review — often against guidance. https://www.nature.com/articles/d41586-025-04066-5

NIH Office of Human Subjects Research Protections. *Research involving artificial intelligence*. https://irbo.nih.gov/fda-regulated-research/research-involving-artificial-intelligence/

Springer Nature. *Perspectives on AI in scholarly communications*. https://stories.springernature.com/AI-perspectives/

*Technological reflexivity in practice: How MAXQDA, NVivo, and ChatGPT shape qualitative survey analysis*. (2025). *Qualitative Research*. https://doi.org/10.1080/14780887.2025.2602820

*The software behind the stats: A student exploration of software trends across disciplines*. arXiv. https://arxiv.org/html/2504.06507

Tricco, A. C., Lillie, E., Zarin, W., O'Brien, K. K., Colquhoun, H., Levac, D., … Straus, S. E. (2018). PRISMA extension for scoping reviews (PRISMA-ScR): Checklist and explanation. *Annals of Internal Medicine, 169*(7), 467–473. https://doi.org/10.7326/M18-0850

*Trends in the usage of statistical software and their associated study designs in health sciences research: A bibliometric analysis*. PMC7872865. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7872865/

U.S. Census Bureau. *Secure remote access for FSRDC research*. https://www.census.gov/about/adrm/fsrdc/about/secure-remote-access.html

U.S. Census Bureau. *Restricted-use microdata*. https://www.census.gov/topics/research/guidance/restricted-use-microdata.html

University of Washington Office of Research. (2025). *Human Subjects Division guidance update*. https://www.washington.edu/research/?p=59200

*Who uses AI in research, and for what? Large-scale survey evidence from Germany*. *Research Policy*. https://www.sciencedirect.com/science/article/pii/S0048733325002100

*AI coding agents in social science: Methodologically diverse, empirically consistent, interpretively vulnerable*. arXiv. https://arxiv.org/pdf/2606.11456

*Adoption and impact of command-line AI coding agents: A study of Microsoft's early 2026 rollout of Claude Code and GitHub Copilot CLI*. arXiv. https://arxiv.org/pdf/2607.01418

Full 48-source corpus with classifications, annotations, and screening decisions: [iv-102-phase1-literature-search-report.md](iv-102-phase1-literature-search-report.md).
