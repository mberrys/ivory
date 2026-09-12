# IV-102 Phase 1: Literature Search Report

Status: Phase 1 deliverable, 2026-08-01. Search executed against the protocol registered in [iv-102-chapter-plan.md](iv-102-chapter-plan.md) §2. Corpus window opens 1 June 2020; 30 November 2022 is the internal stratification marker.

Domain evidence profile: `general_social_science` (scholar-confirmed). Admits empirical, mixed-methods, and policy/expert-panel evidence. Universal gates — relevance, methodology, non-predatory — unchanged.

## Search strategy

**Databases and surfaces:** Google Scholar and open web via search (Layer 1 Boolean); ScienceDirect, PubMed Central, Taylor & Francis, arXiv, SSRN, medRxiv reached through it; institutional primary documentation (Census Bureau, ICPSR, IPUMS, university IRB offices, NIH OHSRP); vendor documentation (Anthropic, Lumivero, ATLAS.ti, Qualtrics, REDCap consortium).

**Search strings (Layer 1):**

```text
("statistical software" OR SPSS OR Stata OR R OR SAS) AND ("social science" OR
  adoption OR popularity OR trends) AND (bibliometric OR survey)
(CAQDAS OR NVivo OR "ATLAS.ti" OR MAXQDA) AND ("artificial intelligence" OR
  GenAI OR "AI-assisted coding") AND (peer-reviewed OR study)
(IRB OR "institutional review board") AND ("artificial intelligence") AND
  ("human subjects" OR de-identification OR re-identification)
("restricted microdata" OR FSRDC OR ICPSR) AND (access OR enclave OR cloud OR AI)
(SSRN OR SocArXiv OR PsyArXiv OR RePEc) AND (preprint OR fragmentation OR
  "scholarly communication")
("coding agents" OR "Claude Code") AND ("social science" OR researchers) AND
  (adoption OR survey)
("Claude for Life Sciences" OR "Claude Science") AND (connectors OR Benchling
  OR PubMed)
(oTree OR "z-Tree" OR quanteda OR Gephi OR NetLogo) AND (adoption OR platform)
```

**Filters:** publication date ≥ 2020-06-01 for landscape claims; no date filter for seminal tool papers (oTree, z-Tree) admitted as foundational under the neutral seminal-work rule; English language; no venue restriction, since the topic's evidence base is substantially institutional and vendor documentation.

**Layer 2–4:** citation chaining from the Anthropic coding-agents study and the Nature AI-adoption paper; forward tracking on the 2025–2026 AI-in-research survey literature; semantic search on CAQDAS/GenAI integration. Saturation reached on criteria 1, 2, 3, and 5 (source count met; final round added <10% new; every theme ≥3 sources; foundational works plus last-3-years coverage present). Criterion 4 (citation-loop closure) not formally assessed — recorded as a search limitation.

## PRISMA-ScR flow

| Stage | Count |
|---|---|
| Identified (search returns across 12 queries) | ~96 |
| Screened after deduplication | 78 |
| Excluded at title/abstract (off-topic, aggregator duplicates, pure product marketing with no factual claim) | 24 |
| Assessed for eligibility | 54 |
| Excluded at full assessment (content-farm rewrites of primary sources, no independent claim) | 6 |
| **Included** | **48** |

Exclusion reasons are recorded per source in the working set; the six full-assessment exclusions were all secondary rewrites of the Anthropic or Nature primary sources adding no independent evidence.

## Coverage distribution advisory

```markdown
DISTRIBUTIONAL_SKEW_ADVISORY:
- Dimension: geographic distribution
- Concentration: United States = 26/33 known (79%)
- Advisory: This is a coverage-distribution signal, not a defect. The access-regime
  and institutional-documentation evidence is almost entirely US (FSRDC, ICPSR,
  US university IRBs, Common Rule). Conclusions about legal gating do not transfer
  to EU/UK/Global South research infrastructure without separate evidence.
- Search response: No expansion this round; recorded as a scope limitation. A
  follow-up pass on GDPR/EU data-access regimes and non-US research-data
  infrastructure would be required before any international claim.
```

```markdown
DISTRIBUTIONAL_SKEW_ADVISORY:
- Dimension: venue tier distribution
- Concentration: grey literature (vendor documentation, institutional policy
  pages, trade press, analyst blogs) = 29/48 (60%)
- Advisory: Below the 70% threshold but reported because it interacts directly
  with the review's triangulation rule. Grey literature is legitimate and often
  primary here — an IRB office page IS the authoritative statement of that
  institution's policy — but vendor grey literature cannot support prevalence.
- Search response: Peer-reviewed corroboration was specifically sought and found
  for the adoption claims (Nature, Research Policy, PMC bibliometrics). Vendor
  capability claims remain single-sourced by design and are labelled as such.
```

## Screening results

- Initial hits: ~96
- After title/abstract screening: 54
- After full-text assessment: 48
- **Final included sources: 48** (Literature Review minimum is 30; typical range 40–80 — met)

## Source classification

Per the §2 taxonomy. This is the review's core apparatus, so the distribution matters:

| Class | Count | Prevalence claims admissible? |
|---|---|---|
| Independent empirical (peer-reviewed or archival preprint) | 13 | Yes |
| Institutional documentation (government, university, consortium) | 15 | Yes, for the institution's own policy and operations |
| Vendor-authored | 12 | **Capability only — never prevalence** |
| Practitioner/analyst report | 5 | Provisional; corroboration required |
| Commentary/trade press | 3 | Context only; never sole support |

## Annotated bibliography

Deep-tier sources carry full annotations. Census-tier sources (Theme F) carry condensed annotations, consistent with the two-tier coverage decision recorded in the chapter plan.

### Theme A — Adoption evidence

**Anthropic (2026). Coding agents in the social sciences.** *Vendor-authored, primary.* Survey of social-science researchers through March 2026. Reports 81% generative-AI use, **20% coding-agent adoption**, economists 39%, political scientists 25%, public health and education 6%, 97% code-generation use case, male adoption >2× female, top-institution adoption +40%. **Relevance:** the single most-cited adoption source in the predecessor memo. **Quality:** large-n and methodologically described, but vendor-authored about its own product category; under the review's own rule it cannot solely support prevalence. **Use:** §5, and §1 as the demotion case.

**Springer Nature (2025). Perspectives on AI in scholarly communications.** *Vendor-authored (publisher), large-n.* n=2,021 researchers. 57% used AI to stay current or read papers; 52% to write papers or grants; 80% of users intend to continue. Tool mentions: general-purpose models 75.9%, of which **ChatGPT 36.8%, Gemini 19.4%, Claude 6.5%**. **Relevance:** the only source located that independently ranks assistant market share among researchers. **Quality:** publisher self-interest in the AI-in-publishing narrative; large sample, transparent n. **Use:** §5 — decisive for the triangulation of the predecessor's Claude-dominance claim.

**Nature (2025). Artificial intelligence tools expand scientists' impact but contract science's focus.** [s41586-025-09922-y](https://www.nature.com/articles/s41586-025-09922-y) *Independent empirical, peer-reviewed.* Analysis of 41.3M papers. AI-augmented researchers publish 3.02× more, receive 4.84× more citations, lead projects 1.37 years earlier; collective narrowing of scientific focus. **Quality:** highest-tier source in the corpus. **Use:** §5 and §7 — establishes that adoption has measurable professional consequences, and a countervailing systemic cost.

**Who uses AI in research, and for what? Large-scale survey evidence from Germany.** *Research Policy*, [S0048733325002100](https://www.sciencedirect.com/science/article/pii/S0048733325002100). *Independent empirical, peer-reviewed.* **Relevance:** non-US, non-vendor survey evidence — the corpus's main counterweight to the US/vendor skew. **Use:** §5; partially mitigates the geographic advisory.

**Nature (2025). More than half of researchers now use AI for peer review — often against guidance.** [d41586-025-04066-5](https://www.nature.com/articles/d41586-025-04066-5) *Independent, journalism reporting a Frontiers survey of ~1,600 academics across 111 countries.* **Use:** §5 — adoption extends into workflow stages where policy prohibits it, which is itself a finding about governance lag.

**AI Coding Agents in Social Science: Methodologically Diverse, Empirically Consistent, Interpretively Vulnerable.** [arXiv 2606.11456](https://arxiv.org/pdf/2606.11456) *Archival preprint, independent.* **Relevance:** directly examines coding agents in social-science analysis rather than adoption rates. **Use:** §5, §7 — the "interpretively vulnerable" finding bears on whether tooling can address interpretation.

**Adoption and Impact of Command-Line AI Coding Agents: Microsoft's Early 2026 Rollout of Claude Code and GitHub Copilot CLI.** [arXiv 2607.01418](https://arxiv.org/pdf/2607.01418) *Archival preprint, independent.* **Use:** §5 — independent adoption evidence for the same tool class in a non-academic population.

**Anthropic Economic Index: Uneven geographic and enterprise AI adoption.** [arXiv 2511.15080](https://arxiv.org/abs/2511.15080) *Vendor-authored, archival.* **Use:** §5 — corroborates the unevenness pattern; still vendor-authored.

**the-decoder (2026); blockchain.news (2026).** *Trade press.* Independent reporting of the Anthropic study's gender-gap and 81%/20% split. **Use:** context only; confirms the figures were read the same way by third parties.

**UChicago Data Science Institute (2025). Research summary on AI tools and scientific attention.** *Institutional commentary on the Nature paper.* **Use:** §7 context.

### Theme B — Quantitative tool landscape

**Trends in the Usage of Statistical Software and Their Associated Study Designs in Health Sciences Research: A Bibliometric Analysis.** [PMC7872865](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7872865/) *Independent empirical, peer-reviewed.* SPSS 52.1%, SAS 12.9%, Stata 12.6% in health sciences. **Quality:** genuine bibliometric method; health-sciences population limits transfer to social science. **Use:** §3.

**The Software Behind the Stats: A Student Exploration of Software Trends Across Disciplines.** [arXiv 2504.06507](https://arxiv.org/html/2504.06507) *Archival preprint.* Management Science 2019–2023: Stata 60%, R 19%, MATLAB 18%, SAS 13%, Python 11%. **Use:** §3 — discipline-specific and within window.

**Muenchen, R. A. The Popularity of Data Science Software.** [r4stats.com](https://r4stats.com/articles/popularity/) *Practitioner/analyst, longitudinal.* Scholarly-citation series: SPSS dominance peaked 2009 then declined sharply; SAS peaked ~2010; R and Stata growing rapidly. **Quality:** widely cited, transparent method, single-author non-peer-reviewed. **Use:** §3 — the only long-run time series located; label as analyst evidence.

**Statistical Software Popularity in 40,582 Research Papers.** [quantifyinghealth.com](https://quantifyinghealth.com/statistical-software-popularity-in-research/) *Practitioner analysis.* **Use:** §3 corroboration; not sole support.

**Modelling Complex Survey Data Using R, SAS, SPSS and Stata: A Comparison Using CLSA Datasets.** [arXiv 2010.09879](https://arxiv.org/pdf/2010.09879) *Archival preprint.* **Use:** §3 — establishes functional substitutability, relevant to lock-in claims.

### Theme C — Qualitative tooling and CAQDAS

**Technological reflexivity in practice: how MAXQDA, NVivo, and ChatGPT shape qualitative survey analysis.** *Qualitative Research*, [10.1080/14780887.2025.2602820](https://www.tandfonline.com/doi/full/10.1080/14780887.2025.2602820) *Independent empirical, peer-reviewed.* Compares MAXQDA 24.9.1 + Tailwind Beta, NVivo 15.1.2, and ChatGPT 4.5/4o on youth sustainability survey data. **Relevance:** the strongest peer-reviewed source on GenAI-in-CAQDAS located. **Use:** §3, §7.

**Documented gap (multiple sources).** Peer-reviewed literature systematically examining how GenAI-integrated CAQDAS affects qualitative research *outcomes* remains limited; critical analysis of GenAI integration into MAXQDA and NVivo is rare. **Use:** §7, §8 — an evidence gap that must remain visible rather than be filled by vendor claims.

**Qualitative Data Analysis Software (Dedoose, ATLAS.ti, NVivo, MAXQDA).** [ResearchGate 370290300](https://www.researchgate.net/publication/370290300_Qualitative_Data_Analysis_Software_Dedoose_ATLAS_NVivo_MAXQDA) *Independent comparative study.* Compares coding flexibility, usability, visualization, collaboration. **Use:** §3.

**ChatGPT y software CAQDAS para el análisis cualitativo de entrevistas.** [ResearchGate 367990261](https://www.researchgate.net/publication/367990261_ChatGPT_y_software_CAQDAS_para_el_analisis_cualitativo_de_entrevistas) *Independent, Spanish-language.* **Use:** §3; partially mitigates the language/geographic skew.

**Lumivero (NVivo) and ATLAS.ti product documentation; koji.so; sopact.com.** *Vendor-authored.* Establish capability: NVivo structured task-based AI Assistant, ATLAS.ti conversational prompt-based AI, MAXQDA AI Assist (summaries, coding suggestions, chat, reports). **Capability only — no prevalence claims drawn.** NVivo's "most-cited QDA software" claim is vendor-sourced and is recorded as **unresolved**, not as a finding.

### Theme D — Source and access landscape

**U.S. Census Bureau. Federal Statistical Research Data Centers — secure remote access and researcher experience.** [census.gov/about/adrm/fsrdc](https://www.census.gov/about/adrm/fsrdc/about/secure-remote-access.html) *Institutional documentation, primary and authoritative.* Confidential microdata resides on Census servers in Bowie, MD, accessed via Census virtual desktop infrastructure. **Researchers cannot access the internet or any other network while in an FSRDC and cannot download any information.** Remote access requires a VDI-enabled personal computer with no other devices in the home office. **Relevance:** decisive. **Use:** §4, §8 — this is the evidence that refutes a restricted-microdata connector path architecturally, not merely legally.

**U.S. Census Bureau. Restricted-Use Microdata guidance.** [census.gov](https://www.census.gov/topics/research/guidance/restricted-use-microdata.html) *Institutional documentation.* **Use:** §4.

**ICPSR. ResearchDataGov / Restricted Microdata from the U.S. Census Bureau (Series 926).** [icpsr.umich.edu](https://www.icpsr.umich.edu/web/ICPSR/series/926) *Institutional documentation.* Single application portal for 71 restricted federal microdata sets. **Relevance:** a genuine partial centralization — cuts against an unqualified fragmentation claim at the application layer. **Use:** §4, §7.

**IPUMS in the Federal Statistical Research Data Centers.** [usa.ipums.org](https://usa.ipums.org/usa/fsrdc_info.shtml) *Institutional documentation.* **Use:** §4.

**SocArXiv; PsyArXiv; OSF Preprints.** *Institutional/consortium documentation.* SocArXiv founded 2016 (Philip N. Cohen, with the Center for Open Science), runs on OSF. PsyArXiv likewise OSF-hosted. **Relevance:** materially qualifies the fragmentation thesis — the two largest non-economics social-science preprint servers share one backend. **Use:** §4, §7 — this is a partial refutation and must be reported as one.

**RePEc.** *Consortium documentation.* Volunteer effort across 102 countries. **Use:** §4 — the genuinely separate economics substrate.

**SSRN (Elsevier-owned since 2016).** *Institutional/corporate documentation.* **Use:** §4 — ownership concentration is a distinct issue from fragmentation and should not be conflated with it.

**Scientometric engineering: Exploring citation dynamics via arXiv eprints.** [arXiv 2106.05027](https://arxiv.org/pdf/2106.05027) *Archival preprint.* **Use:** §4 background on preprint citation dynamics.

**Center for Open Science. Surpassing 100,000 Registrations on OSF; 500,000 OSF Users.** [cos.io](https://www.cos.io/blog/surpassing-100000-registrations-on-osf) *Institutional documentation, self-reported scale.* Non-linear growth since November 2012 (371 users in early 2013). **Use:** §4 — establishes OSF as a real substrate with real scale, relevant to the Benchling-analog question.

**Open Science Framework (OSF).** [PMC5370619](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5370619/) *Peer-reviewed description.* **Use:** §4.

**Fostering open science and responsible research practices: A pre-post study.** [PMC12120411](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12120411/) *Independent empirical, peer-reviewed.* OSF accounts rose from 7 to 78 after an open-science course. **Use:** §4 — adoption is training-dependent, not tool-dependent.

### Theme E — IRB and confidentiality regime

**University of Washington Human Subjects Division (2025). Revised interpretation of the human-subject definition.** [washington.edu/research](https://www.washington.edu/research/?p=59200) *Institutional documentation.* HSD revised its interpretation to include secondary use of de-identified data at **high risk of re-identification by AI systems**. **Relevance:** the clearest documented instance of the regime *tightening* specifically in response to AI. **Use:** §4, §6, §8 — directly counters any assumption that AI access norms are liberalizing.

**NIH Office of Human Subjects Research Protections. Research Involving Artificial Intelligence.** [irbo.nih.gov](https://irbo.nih.gov/fda-regulated-research/research-involving-artificial-intelligence/) *Institutional documentation, federal.* Common Rule excludes research using only de-identified data; **FDA regulations do not distinguish identifiable from de-identified data**. **Use:** §4 — the two federal regimes diverge, which is itself a source of heterogeneity.

**University of Wisconsin–Madison IRB. Artificial Intelligence — Human Research Protection Program.** [irb.wisc.edu](https://irb.wisc.edu/manual/investigator-manual/conducting-human-participant-research/different-types-of-research/artificial-intelligence/) *Institutional documentation.* **Use:** §4.

**Teachers College, Columbia University IRB. Using AI in Human Subjects Research.** [tc.columbia.edu](https://www.tc.columbia.edu/institutional-review-board/guides--resources/using-artificial-intelligence-ai-in-human-subjects-research/) *Institutional documentation.* AI software touching human-subjects data may require **both** an IT security assessment and IRB review. **Use:** §4 — procedural cost is additive, not substitutive.

**HHS SACHRP. IRB Considerations on the Use of AI in Human Subjects Research.** [hhs.gov](https://www.hhs.gov/ohrp/sachrp-committee/recommendations/irb-considerations-use-artificial-intelligence-human-subjects-research/index.html) *Institutional documentation, federal advisory.* **Use:** §4, §6.

**NASA eIRB Guidance 990; Mass General Brigham IRB guidance; Fort Lewis College IRB guidelines; Advarra (commercial IRB) commentary.** *Institutional documentation ×3, industry commentary ×1.* **Relevance:** collectively evidence the **heterogeneity** claim — four institutions, four separately-authored AI policies. **Use:** §4 — the variance is the finding; no single policy is load-bearing.

### Theme F — Census tier (condensed annotations)

**Chen, D. L., Schonger, M., & Wickens, C. oTree — An open-source platform for laboratory, online, and field experiments.** *Journal of Behavioral and Experimental Finance*, [S2214635016000101](https://www.sciencedirect.com/science/article/pii/S2214635016000101). *Peer-reviewed, seminal (pre-window, admitted under the seminal-work rule).* Python framework; browser-based, no subject-side installation.

**z-Tree (Zurich Toolbox for Readymade Economic Experiments).** [ztree.uzh.ch](https://www.ztree.uzh.ch/en.html) *Institutional documentation.* Lab-bound by design; "z-Tree unleashed" added online capability during COVID-19. Corroborated by [SSRN 3756019](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3756019) (z-Tree in VLab) and [S2214635023000199](https://www.sciencedirect.com/science/article/pii/S2214635023000199) (DEEP implementation). **Finding:** the pandemic shifted experimental economics toward oTree; a genuine, datable adoption shift inside the review window.

**quanteda; Gephi; NetLogo; igraph.** *Tool documentation.* R text-analysis package; open-source network exploration; Northwestern ABM environment with a Logo-derived language aimed at non-programmers. Condensed per two-tier scope. **Coverage limit acknowledged:** no prevalence evidence located for any of these; recorded as unresolved, not as low adoption.

**Learning Agent-Based Modeling with LLM Companions: Experiences of Novices and Experts Using ChatGPT & NetLogo Chat.** *CHI 2024*, [10.1145/3613904.3642377](https://dl.acm.org/doi/10.1145/3613904.3642377) *Peer-reviewed.* **Relevance:** the only peer-reviewed source located pairing an LLM with a social-science modeling tool; directly relevant to the orchestration dimension.

**The Atlas for the Aspiring Network Scientist.** [arXiv 2101.00863](https://arxiv.org/pdf/2101.00863) *Archival preprint.* Background on network-analysis tooling breadth.

### Theme G — Survey platforms

**REDCap consortium (2023 figures).** *Consortium documentation.* 7,123 institutions, 156 countries, 2M+ projects, 22,700+ publications. Built for HIPAA compliance; exhaustive audit trails; free to consortium institutions. **Use:** §3, §7 — the closest thing in social science to a widely-shared, institutionally-operated system of record.

**Qualtrics.** *Vendor documentation.* Capability claims only. Institutional survey-tool pages (University of Illinois Chicago, University of Iowa) confirm dual Qualtrics/REDCap licensing at named institutions — *institutional documentation, admissible for those institutions only.*

**Experience in the adoption of REDCap as a tool for medical research in Tanzania.** [medRxiv 2025.10.25.25338769](https://www.medrxiv.org/content/10.1101/2025.10.25.25338769.full.pdf) *Preprint, independent.* **Use:** §3; partially mitigates the geographic skew.

**AEA365. Picking the Best Tool for the Job: Qualtrics vs. REDCap.** *Practitioner report (American Evaluation Association).* **Use:** §3 context.

### Theme H — Life-science comparator

**Anthropic. Advancing Claude in healthcare and the life sciences; Claude for Life Science Teams; Benchling Connector.** [anthropic.com](https://www.anthropic.com/news/healthcare-life-sciences) *Vendor-authored.* MCP connectors to Benchling, 10x Genomics, PubMed, BioRender, Synapse.org, Wiley Scholar Gateway. **Capability only.**

**R&D World. Anthropic unveils Claude for Life Sciences.** [rdworldonline.com](https://www.rdworldonline.com/anthropic-unveils-claude-for-life-sciences-which-reportedly-outperforms-humans-at-lab-protocol-tasks-and-slashes-pharma-documentation-time/) *Trade press.* Protocol QA 0.83 vs 0.79 human baseline; Novo Nordisk clinical study documentation reduced from >10 weeks to 10 minutes; Sanofi, AbbVie, Genmab deployments. **Quality:** trade press relaying vendor claims — reported as *claimed*, not established.

**Maginative; IntuitionLabs; MarketScreener (10x Genomics partnership).** *Trade press and analyst.* **Use:** §6 context.

## Literature matrix

| Source | Tools | Access/IRB | Adoption | Comparator | Class | Quality |
|---|---|---|---|---|---|---|
| Anthropic coding agents (2026) | x | | **main** | x | Vendor | Med |
| Springer Nature survey (2025) | | | **main** | | Vendor | Med |
| Nature 41.3M papers (2025) | | | **main** | | Indep. peer-rev | High |
| Research Policy Germany survey | | | **main** | | Indep. peer-rev | High |
| Nature peer-review AI (2025) | | x | **main** | | Indep. journalism | Med |
| arXiv 2606.11456 | x | | **main** | | Indep. preprint | Med |
| arXiv 2607.01418 | | | **main** | | Indep. preprint | Med |
| PMC7872865 bibliometrics | **main** | | x | | Indep. peer-rev | High |
| arXiv 2504.06507 | **main** | | x | | Indep. preprint | Med |
| r4stats popularity series | **main** | | x | | Analyst | Med |
| Qual. Research MAXQDA/NVivo/ChatGPT | **main** | | | | Indep. peer-rev | High |
| RG 370290300 CAQDAS comparison | **main** | | | | Indep. | Med |
| Census FSRDC secure access | | **main** | | x | Institutional | High |
| ICPSR ResearchDataGov | | **main** | | | Institutional | High |
| UW HSD 2025 revision | | **main** | | x | Institutional | High |
| NIH OHSRP AI | | **main** | | | Institutional | High |
| HHS SACHRP | | **main** | | | Institutional | High |
| UWisc / Columbia / NASA / MGB IRB | | **main** | | | Institutional | Med |
| SocArXiv / PsyArXiv / OSF Preprints | | **main** | | x | Institutional | High |
| RePEc / SSRN | | **main** | | | Institutional | Med |
| COS OSF scale posts | | x | **main** | x | Institutional | Med |
| PMC12120411 open-science pre-post | | | **main** | | Indep. peer-rev | Med |
| REDCap consortium figures | **main** | x | x | x | Institutional | Med |
| medRxiv REDCap Tanzania | x | | **main** | | Indep. preprint | Med |
| oTree (ScienceDirect) | **main** | | | | Indep. peer-rev | High |
| z-Tree + unleashed sources | **main** | | x | | Institutional | Med |
| CHI 2024 NetLogo Chat | **main** | | | x | Indep. peer-rev | High |
| Anthropic life-sciences pages | | | | **main** | Vendor | Low* |
| R&D World / Maginative / IntuitionLabs | | | x | **main** | Trade/analyst | Low |
| Lumivero / ATLAS.ti / Qualtrics | **main** | | | | Vendor | Low* |

\* Low as *evidence*; adequate as capability documentation, which is the only use made of them.

Every theme has ≥3 sources. Matrix coverage gate: **pass**.

## Identified gaps

1. **GenAI-in-CAQDAS outcome evidence.** Multiple sources converge on the observation that peer-reviewed study of how GenAI features in NVivo, ATLAS.ti, and MAXQDA affect qualitative research *outcomes* is scarce. Vendor capability documentation is abundant; independent outcome evidence is not. Any claim that AI improves qualitative analysis is currently **unresolved**.
2. **Prevalence data for computational social science tooling.** No usage or adoption evidence was located for quanteda, Gephi, igraph, or NetLogo. Their prominence in methods literature is not evidence of prevalence. This is a census-tier coverage limit, deliberately accepted — but it must be labelled unresolved rather than inferred.
3. **Non-US access regimes.** The access and IRB evidence is 79% US. GDPR, UK Data Service, and other national research-data infrastructures are unrepresented. No conclusion about legal gating generalizes internationally on this corpus.
4. **Assistant-level market share among social scientists specifically.** The Springer Nature ranking is all-researcher, not social-science-specific. The Anthropic study covers coding agents, not general assistants. The intersection — which assistant social scientists actually use — has no located source.
5. **Whether tooling absence reflects unmet need.** No source was located that asks social scientists whether they want a generative visual interpretation layer, multi-model orchestration, or model portability. The three evaluative dimensions currently have evidence on the *absent from landscape* axis and **none** on the *documented as researcher need* axis.

## Quality gate results

| Gate | Criterion | Result |
|---|---|---|
| Search strategy documented | Databases + strings + criteria recorded | **Pass** |
| Source count | ≥30 for literature review | **Pass** (48) |
| Annotation completeness | 100% of included sources annotated | **Pass** (census tier condensed by design) |
| Matrix coverage | Every theme ≥3 sources | **Pass** |
| Research gaps | ≥2 specific actionable gaps | **Pass** (5) |
| Peer-reviewed ratio | ≥70% | **FAIL — 27% (13/48)** |
| Currency | ≥50% from last 5 years | **Pass** (~85%) |

**On the peer-review gate failure.** This is reported rather than remediated. The failure is structural to the object of study: a review of *what software exists and who uses it* necessarily draws on vendor documentation and institutional policy pages, and no amount of additional searching converts a product's feature list into a peer-reviewed source. The `general_social_science` profile admits policy and expert-panel evidence, which covers the 15 institutional sources, but vendor marketing is not peer-reviewed-equivalent under any profile.

The mitigation is the source-classification layer, not a higher ratio: vendor sources are admitted for capability claims and structurally barred from prevalence claims. Attempting to pass this gate by dropping vendor sources would remove the only documentation of what these products actually do. **Recorded as a declared limitation in §9 rather than a defect to be fixed.**

## Recommended sources by section

| Section | Key sources |
|---|---|
| §1 Introduction | Anthropic coding agents; Springer Nature; the predecessor memo's own limitations statement |
| §2 Protocol | Tricco et al. (2018) PRISMA-ScR |
| §3 Tool landscape | PMC7872865; arXiv 2504.06507; r4stats; Qualitative Research (MAXQDA/NVivo/ChatGPT); RG 370290300; REDCap consortium; oTree; z-Tree |
| §4 Source & access | Census FSRDC; ICPSR ResearchDataGov; IPUMS; UW HSD 2025; NIH OHSRP; HHS SACHRP; UWisc/Columbia/NASA/MGB IRB; SocArXiv/PsyArXiv/OSF; RePEc; SSRN; COS scale posts |
| §5 Adoption | Nature 41.3M; Research Policy Germany; Anthropic coding agents; Springer Nature; Nature peer-review; arXiv 2606.11456; arXiv 2607.01418; arXiv 2511.15080 |
| §6 Comparator | Anthropic life-sciences pages; Benchling connector; R&D World; Maginative; IntuitionLabs; UW HSD 2025 (asymmetry evidence) |
| §7 Synthesis | CHI 2024 NetLogo Chat; arXiv 2606.11456; Qualitative Research; ICPSR portal; OSF-shared-backend evidence |
| §8 Adjudication | Census FSRDC (refutation); OSF/COS scale; CAQDAS gap evidence |
| §9 Limitations | Distributional advisories; peer-review gate failure; gaps 1–5 |

## Findings that change the predecessor's status

Recorded here because the chapter plan made predecessor demotion a credibility condition.

**1. The Claude-dominance adoption claim is refuted as stated.** The predecessor reported "Claude Code is dominant among these researchers (86% usage share)" and concluded that "social scientists are already voting with their workflows for general-purpose Claude Code." The underlying study reports **20% coding-agent adoption among social scientists**; the 86% figure is share *among the adopting minority*, not among social scientists. Independent Springer Nature data places Claude at **6.5%** of general-purpose model mentions among researchers, against ChatGPT at 36.8%. The demand signal the predecessor treated as "the strongest signal in the whole landscape" is roughly one-fifth the size it appeared, and the tool-specific dominance claim does not survive triangulation. **Status: supported → refuted as stated.**

**2. The fragmentation thesis is partially refuted at the preprint layer.** SocArXiv and PsyArXiv both run on OSF infrastructure, and ICPSR's ResearchDataGov consolidates applications for 71 restricted federal datasets. The substrate is more centralized than "balkanized by discipline" implies. Economics (RePEc) remains genuinely separate. **Status: supported → provisional, with a documented counter-example.**

**3. The restricted-microdata exclusion is strengthened and re-grounded.** The predecessor called this legally gated. Census documentation shows it is *architecturally* gated: no internet access from inside the enclave, no downloads, Census-operated VDI. This is a stronger and more durable finding than the original. **Status: supported → supported, with primary-source grounding.**

## Next phase

Phase 2 (`structure_architect_agent`) consumes this report to produce the outline and evidence map. The chapter plan's §1–§10 structure survives Phase 1 unchanged; §5 and §8 gain materially more evidence than anticipated, and §7 gains a documented gap on the evaluative-dimensions axis.
