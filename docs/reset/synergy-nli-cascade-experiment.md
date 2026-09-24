# Jev-like R4 next experiment — historical title/abstract screen + local NLI cascade

**Preregistration:** 2026-09-23 PDT, before inspecting any model observations. Branch `experiment/jev-r2-r3-semantic-seam`. Execution commit `8e902e1ef29af4c1905547bb5fedeabd1931c8ed`; [named GitHub Actions run 35947960101](https://github.com/mberrys/ivory/actions/runs/35947960101). Research-only. Does not open a PR, ship a model or close R4.

## Why this experiment differs from the failed Qwen3 series

Previous Qwen3-0.6B/1.7B four-way classification on **authored synthetics** failed explicit exclusion triage, despite legal JSON/choice syntax. Next test a **small task-specific NLI cross-encoder + lexical rules** on **real historical systematic-review title/abstract screening records**, without treating model scores as accepted scholarship or automatically discarding any record.

## Provenance, source and label semantics

- Upstream [ASReview SYNERGY dataset index](https://github.com/asreview/synergy-dataset/blob/master/index.csv) lists `Nagtegaal_2019`, **CC0**, and `title_abstract_inclusions=True`: nudging healthcare professionals towards evidence-based medicine (public administration / clinical behavioral interventions), 2,019 indexed records. Actual source [historical published CSV](https://raw.githubusercontent.com/asreview/systematic-review-datasets/metadata-v1-final/datasets/Nagtegaal_2019/output/Nagtegaal_2019.csv), columns `record_id,title,abstract,label_included,label_abstract_screening,duplicate_record_id`. Download from GitHub in a clean Actions runner; record raw SHA256, branch SHA where resolvable, original counts, duplicate conflicts and nonempty/valid labels. No private Ivory data.
- Primary historical outcome: `label_abstract_screening` (binary prior review screening decision); secondary only: `label_included` (can depend on unobserved full text). These are **review-specific binary outcomes**, *not* an NLI entailment label or a transferable eligibility judgment about adult patient qualitative interviews. The public data does not by itself prove the identities and independence of two annotators per record; do **not** assert dual-review qualification.
- Frozen sample algorithm: deduplicate exact normalized title+abstract and drop conflicting-label duplicate groups; sort separately by SHA256(`ivory-nli-nagtegaal-v1-preregistered-20260923|record_id|text_sha256`); choose first **24 title/abstract-screen-positive and 72 negative** records. Never change selection or criterion after inspecting outcomes. Stratification **does not** preserve dataset's natural prevalence; report full source counts separately. No training set or prompt tuning.
- Log record IDs, source and text SHA256, model revision, question SHA256, rules flags, NLI uncalibrated three-way distribution, score, class and ranking. Do not upload entire abstracts to project artifact.

## Frozen arms and task

**Task:** propose which abstracts the *researcher* reviews first for possible nudge/behavior-change interventions targeting clinicians/healthcare personnel in clinical settings. No autonomous exclusion and no factual claim verification; the reviewed abstracts themselves never authorize evaluator tools or publication.

1. **Rules-only priority:** four binary lexical flags (nudge/choice architecture, healthcare-professional actor, intervention design, clinical domain), sum `0..4`. The flags are in [source code](../../experiments/jev-seam/synergy-screening-nli.py); not tuned to the observed cohort.
2. **Local MiniLM NLI:** pinned `cross-encoder/nli-MiniLM2-L6-H768@b95119ce93d3e065de6214e38cd4a97b0f2f2c6d`, text premise title+abstract, fixed hypothesis “This original study evaluates a behavioral nudge or choice-architecture intervention targeting healthcare professionals in clinical settings to change their professional clinical behavior or evidence-based practice.” 384 max tokens, 8 batch, CPU. Extract entailment softmax as **uncalibrated ranking signal** (not research-truth probability).
3. **Cascade:** lexical score primary + model entailment tie-break `(rules_score + entailment)/5`; separately report diagnostic candidate union `rules_score>=3 OR entailment>=0.5`, **never auto-exclude even if neither fires**.

## Primary measurements and falsifiability

- Fixed ranking budget top 24, 48, 72 out of 96; for each arm count actual historical abstract-screen positives retrieved, recall@k, precision@k and average precision. Include all per-case errors and secondary *final* inclusion outcome separately.
- Report candidate union's screen-label false negatives **only as not prioritized**, not excluded; no threshold tuned or retrospective chosen winner.
- If cascade does not improve primary screening recall at fixed cost over rules alone, or only improves via a label not observable from title/abstract, record a **negative** finding. An NLI neutrality/contradiction output is not equivalent to the study authors' final inclusion decision. Benchmark cannot establish independent dual-review or prospective scholarly quality.

## Existing immutable safety boundaries

- Historical N1 citation's mechanical context-unavailable case must still abstain **before inference**. The original [N1 bridge run 35940936300](https://github.com/mberrys/ivory/actions/runs/35940936300) and synthetic J3 safety suite are separate; this new public dataset analysis **does not run a real N1 authenticated snapshot**.
- No accepts/rejects, EvidenceLink confidence field, external rights-protected corpus, duplicate provenance store, workflow-machine authority, or product model dependency.
- Production gates: human reviewer study, complete Core mechanical basis, durable Assessment/Receipt and actual N7 rights/approval, restart, two-client parity, per-domain qualification. Even a large improvement on public binary screening labels does **not** close the Jev research epic.

**Status at preregistration:** executable code and workflow submitted, empirical outcomes not yet read.

## Observed empirical result — exact completed run 35947960101

**Execution:** [GitHub Actions run 35947960101](https://github.com/mberrys/ivory/actions/runs/35947960101), code/workflow commit `8e902e1ef29af4c1905547bb5fedeabd1931c8ed`, named job `Public SYNERGY historical abstract labels / local MiniLM NLI / rules cascade` **SUCCESS**. This asserts the pipeline executed; it does **not** pass the candidate routing/qualification bar. Artifact `ivory-synergy-real-labels-nli-cascade` ID `10787522638` retains **all 96 per-record responses and score vectors** (record IDs and text SHA256, not full texts).

**Corpus evidence:** Historical published `Nagtegaal_2019` CSV SHA256 `abfbdb973aa125f26ce872a5193c931d0690f7fe2e1fb75551de9c0acecd200f`; source version `metadata-v1-final`, Git `ls-remote` branch head **unresolved** (the historical GitHub repository redirects; do not invent a 40-character source commit). The content digest fixes exact downloaded bytes independently of branch movement. Source rows **2,019**, valid deduplicated **2,018** (one extra duplicate), historical title/abstract screen-positive **391**, screen-negative **1,627**. This source set has ~19.38% screen-positive prevalence; stratified sample intentionally has **24/96 = 25%**, thus no population extrapolation. Sample membership SHA256 `7cdc3e30527041b6751947f3deb9fe5dc9d23a86a6568a7d096410db5dd741a7`.

**Model:** actual CPU local `cross-encoder/nli-MiniLM2-L6-H768@b95119ce93d3e065de6214e38cd4a97b0f2f2c6d`; fixed question digest `b3077dde4f22addc6789ba6812bd7c0198fef086d5eed7035d23f77c5c838604`. NLI including model load: **24.365 seconds**, total experiment after source fetch **25.203 seconds** on named Linux/Python 3.11.16/torch 2.14.0+cpu runner. CPU timing is not target desktop qualification.

### Primary outcome: historical title+abstract screen-positive label (24 of 96)

| Frozen ranking arm | Top 24 positives / recall | Top 48 positives / recall | Top 72 positives / recall | Average precision |
|---|---:|---:|---:|---:|
| Lexical rules | **9 / 37.5%** | 15 / 62.5% | 23 / 95.83% | 0.331841 |
| MiniLM entailment rank | 8 / 33.33% | 15 / 62.5% | 18 / 75% | 0.316534 |
| Lexical-primary + MiniLM within-tier cascade | 7 / 29.17% | **17 / 70.83%** | 23 / 95.83% | **0.375446** |

**Mixed, budget-dependent.** At 48 abstracts cascade found two extra historical screen-positive records versus rules alone. At 24, rules retrieved two more; at 72 they tie. Cascade AP is higher on *this* frozen stratified sample, but it is not consistently better at every review budget, not measured in a representative prevalence cohort, and does not prove causality or model calibration.

### Secondary outcome: historical final full-text inclusion (7 of 96)

| Ranking | Top 24 included | Top 48 included | Top 72 included | AP |
|---|---:|---:|---:|---:|
| Rules | **4** | **7** | 7 | 0.162590 |
| NLI | 1 | 3 | 4 | 0.089950 |
| Cascade | 3 | 5 | 7 | 0.226168 |

**Important counterevidence:** cascade's mean average precision on the seven final-included papers is higher in this limited stratum, but its **fixed-budget recall at 24 and 48 was worse** than rules. Because final-included was determined by historical full-text screening that the title/abstract-only model cannot see, this is **secondary and not title-abstract classification truth**. Do not cherry-pick AP to declare the cascade qualified.

### Preregistered diagnostic threshold failed to route additional papers

`nli_entailment>=0.5` was true for **zero of 96**; `nli_candidate=0`, `rules_candidate=33`, `cascade_candidate=33`. The OR cascade proposes exactly the **same 33** as rules (11 historical screen-positive, 22 screen-negative), so **NLI adds ZERO candidate records** under the declared candidate policy. Of the 24 screen positives, **13 remain unprioritized** by that binary candidate route—not *excluded* because no hard exclusion is permitted. Any use of the 0.5 softmax threshold as “confidence of research truth” is invalid; do not optimize it on this evaluation sample and then present the resulting count as held-out evidence.

### R5 disposition / exact next dependency

**Close this experimental slice as completed with mixed ranking and negative binary candidate-route evidence**; **do not adopt** the composite NLI hypothesis and hard 0.5 threshold for Ivory production. The model is real and local, and source labels are real historical screening decisions, a material progression from Qwen synthetic-only experiments. Yet no post-hoc score tuning, case-level independent dual-review verification, real accepted research snapshots, N7 grants or full-text eligibility adjudication exists.

The smallest next *new preregistered* experiment should evaluate **criterion-decomposed** nudge / HCP actor / intervention design / clinical-setting questions, versus fixed rules and this compound-NLI baseline, with data split by original work/review, independently reviewed real-paper labels where possible, explicit incomplete-context abstention, **zero autonomous exclusion**, and separate prediction vs researcher decision provenance. If no accessible per-reviewer annotations can be verified, call the references *published consensus screening outcomes* and qualify reviewer count as unknown.

No PR opened, no production Ivory Core, N1, N7 or researcher acceptance changed. **Global Jev-like R4/epic remains open.**

## Completed next R4 experiment — 2026-09-23 (later)

The follow-up criterion-decomposed NLI comparator proposed above **ran and is complete as empirical public-data execution**; see [full R4 ledger](jev-r4-qualification.md) and [both local-model jobs 35949038033](https://github.com/mberrys/ivory/actions/runs/35949038033). MiniLM and DeBERTa each scored 960 pairs from two distinct nonoverlapping 96-record **same-review** historical screening cohorts and 18 authored synthetic NLI pairs, including explicit rules/compound/decomposed comparisons and per-record evidence. On the NEW cohort at top48, rules found **18/24** historically screen-positive records; both models' lexical+decomp mean found **20/24**, but no model added a candidate at the hard four-way `>=0.5` gate. Full scholarly reviewer-by-reviewer independence, actual Core/N7/Receipt integration and user-machine performance are still **BLOCKED**. The previous public-data findings and negative hard-threshold result remain intact.
