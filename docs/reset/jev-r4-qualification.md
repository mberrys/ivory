# Jev-like R4 empirical qualification ledger — frozen scope and gaps

**Date:** 2026-09-23 PDT. **Status at creation:** empirical two-model jobs submitted, outcome not yet inspected. Parent [Notion Jev epic](https://app.notion.com/p/3e49cb079ddb801db7ddda66ae715eaa). This is the requested R4 *qualification package*, not a presumption of adoption. No PR; no production change.

## R4 definition and acceptance gates

The epic R4 requires (1) semantic-support by class, (2) unsupported acceptance and abstention, (3) probability calibration when appropriate, (4) ambiguity/disagreement, (5) CPU latency/cost/token accounting, (6) local/private feasibility, (7) provider limits, and **human-reviewed reference cases**. Experimental execution may complete while research qualification remains **blocked by unavailable reviewer and V5 Core/N7 evidence**; distinguish them.

The original historical-N1 source/quote-selector bytes match while receipt context is `unavailable`, so N1 must abstain before any model dispatch. Existing [real archived bridge](../../experiments/jev-seam/n1-archive.bridge.mjs) proves *that negative*, not authorized model inference nor durable V5 integration. Existing [isolated seam tests](../../experiments/jev-seam/semantic.spec.mjs) exercise stale refs, quote mismatch, external-wire fail-closed, prompt injection, malformed responses, rights denial and no-model fallback. Both are run on every experiment branch push in [V5 reset evidence workflow](../../.github/workflows/ivory-v5-reset.yml), independently of model ranking.

## Frozen R4 empirical protocol (before observations)

**Implementation:** [r4-criterion-decomposition.py](../../experiments/jev-seam/r4-criterion-decomposition.py) + [two-model workflow](../../.github/workflows/ivory-r4-empirical-qualification.yml), execution commit `60e9378887e4c398a1a8bedda2e3dd3883b765ff`. Models `cross-encoder/nli-MiniLM2-L6-H768` at **previously pinned** `b95119ce93d3e065de6214e38cd4a97b0f2f2c6d` and `cross-encoder/nli-deberta-v3-small` with the precise Hub commit **resolved and retained at run**. Both are local PyTorch CPU on GitHub Actions. A new model cannot retroactively become an independent evaluation of the old `prior_seen` subset.

**Real historical review:** ASReview `Nagtegaal_2019`, CC0 index; initial source 2,019 rows, 2,018 valid deduplicated, 391 title/abstract positive and 1,627 negative, prior source digest `abfbdb973aa125f26ce872a5193c931d0690f7fe2e1fb75551de9c0acecd200f`. Download and verify source again on clean CI. No user's private material.

**Two fixed same-review cohorts:** `prior_seen` = exact 24 screen-positive/72 screen-negative SHA-sampled cohort **already observed in previous compound MiniLM study**; `new_unseen` = SHA-sampled *non-overlapping* 24 positive/72 negative records by new fixed salt `ivory-r4-new-nagtegaal-nonoverlap-v1-20260923`. No training/fitting; no researcher-by-researcher annotation assumption. Both intentionally 25% positive rather than original 19.38%, and are **not independent review domains**. Preserve cohort membership hashes and duplicate policy.

**Fixed five hypotheses:** nudge mechanism, healthcare-professional actor, implemented intervention outcome, clinical setting, and the *exact previous compound question* on the same premise/title+abstract, all models, same max 384 tokens and batch 12. Models return uncalibrated contradiction/entailment/neutral, not Ivory's five human research labels. Prior rule flags are unchanged. Proposed ranking arms (not tuned after outcomes): rules only; compound entailment; decomposition mean entailment; decomposition **min** entailment; lexical-primary + compound; lexical-primary + decomposition mean; lexical-primary + decomposition min. Last four preserve lexicographic `rules_score` as primary where specified. Candidate diagnostic `rules>=3 OR (all four criterion entailment>=0.5)`; **never reject records automatically**. Compute source-specific precision/recall at top 24,48,72 and AP; report historical screen-positive as primary, full-text final inclusion as secondary only. Record individual criterion distributions/score collapse.

**Semantic-support by class:** 18 new *authored public synthetic* premise/hypothesis pairs, six of each entailment/contradiction/neutral. Record per-class matches and raw three-way distributions, top-class 5-bin expected calibration error against **authored synthetic labels only**. This **does not qualify scholarly semantic-support accuracy, genuine academic disagreement or real-world probability calibration**. There are no independent dual reviewers in this package, and user may supply or recruit them only outside this tool run.

**Latency & cost:** exact model identity/SHA, total CPU model load, full 960 forward input-pair count per model, inference seconds, 18-case synthetic latency, GitHub runner environment. Models are locally downloaded from Hugging Face model repos; HF Jobs earlier returned HTTP 402 Payment Required. GitHub Actions worker timing cannot assert pricing or workstation throughput or 3090 GPU optimization; no monetary model inference API charges shown.

## Reporting / failure doctrine

Do NOT score an unverified provider or synthetic hard-gate as a genuine human success. Keep all wrong cases, no silent relabeling, avoid a post-hoc winner claim. A proposed paper is researcher review priority, not an accepted EvidenceLink. Absence of V5 Core/N7 durable Assessment/permission/restart experiments remains explicitly BLOCKED after any CI success. If this same-review public dataset does not yield a generalizable model improvement over no-model rules, R4 should retain the negative outcome without another model-size escalation.

**Actual observed results and final R4 gate ledger will be appended, never overwrite this preregistration.**

## Verified boundary-regression evidence, same R4 code head

At [workflow 35949037916](https://github.com/mberrys/ivory/actions/runs/35949037916), revision `60e9378887e4c398a1a8bedda2e3dd3883b765ff`, **archive-and-boundaries** job `107473357048` succeeded **28/28** isolated tests (N1 exact reference + synthetic J3/J9 permission and fail-closed behaviors). **Archived N1 golden trace** job `107473357319` succeeded **1/1**, but observed receipt context is **unavailable** despite quote/selector/representation digest matching, therefore evaluator refused dispatch as required. This is not a pass for complete-basis real-model qualification. The clean upstream Theia build job is an environmental V5 reset regression, not an evaluator quality measurement; report its completion separately.

## R4 first empirical arm — MiniLM actual local result

[GitHub R4 run 35949038033](https://github.com/mberrys/ivory/actions/runs/35949038033) MiniLM job `107473357565`: **SUCCESS**. Artifact `ivory-r4-minilm-empirical-evidence`, ID `10788335940`. Model pinned `cross-encoder/nli-MiniLM2-L6-H768@b95119ce93d3e065de6214e38cd4a97b0f2f2c6d`. Source CSV SHA256 matched the earlier `abfbdb973aa125f26ce872a5193c931d0690f7fe2e1fb75551de9c0acecd200f`; prior cohort identity `7cdc3e30527041b6751947f3deb9fe5dc9d23a86a6568a7d096410db5dd741a7`, new nonoverlapping cohort `b6ac2fd480dcf4aec78699325ad61d9c7b78aa84504bf18fde9440ce6a8d7e47`. All 960 title/abstract–hypothesis pairs and 18 synthetic three-way NLI probes ran on CPU. Model loading 3.337 s, cohort inference 215.161 s, full script 219.423 s on GitHub runner; 960 pairs at <=384 tokens each (actual tokenizer total not logged). No private corpus egress.

**NEW unseen public 96-record cohort, primary historical title/abstract label (24 positive):**
| Fixed rank | Top 24 | Top 48 | Top 72 | AP |
|---|---:|---:|---:|---:|
| Original lexical rules | 12 | 18 | 22 | .494682 |
| Original compound NLI | 5 | 11 | 17 | .236812 |
| Decomposed NLI mean | 6 | 11 | 18 | .246895 |
| Decomposed NLI minimum | 4 | 14 | 19 | .268930 |
| Lexical + original compound | 12 | 18 | 23 | .511318 |
| Lexical + decomposed mean | 12 | **20** | 22 | .526621 |
| Lexical + decomposed minimum | 12 | 19 | 23 | .516122 |

**PREVIOUSLY SEEN cohort, primary historical title/abstract label (24 positive):**
| Fixed rank | Top 24 | Top 48 | Top 72 | AP |
|---|---:|---:|---:|---:|
| Original lexical rules | 9 | 15 | 23 | .331841 |
| Original compound NLI | 8 | 15 | 18 | .316534 |
| Decomposed NLI mean | 8 | 11 | 16 | .266087 |
| Decomposed NLI minimum | 11 | 15 | 20 | .441243 |
| Lexical + original compound | 7 | 17 | 23 | .375446 |
| Lexical + decomposed mean | 7 | **17** | 23 | .350536 |
| Lexical + decomposed minimum | 8 | **17** | **24** | .444943 |

**Secondary full-text final-inclusion counterexample:** on the unseen cohort 10 records were ultimately included. At top 48 original rules found **8**, lexical+decomposed mean **7**, lexical+decomposed min **6**, compound alone **5**. The lexical+mean gain at 48 comes from replacing eight documents sharing lexical rule score=2: three screen-positive records gained, one screen-positive final-included record (ID 1210) lost, yielding +2 abstract-screen positives but -1 final inclusion. This explicitly refutes claiming monotonic workload improvement. On seen cohort 7 ultimately included: rules top48 **7**, lexical+decomposed mean **5**.

**Candidate route no gain:** On new cohort `all four entailment>=0.5` = 0/96; combined OR rules candidate = unchanged 23 records (12 historical screen-positive, 11 negative); prior cohort likewise 0/96 new model candidates and unchanged 33 rule candidates (11 positive). Not qualified as a binary screening or exclusion gate.

**Synthetic semantic support by class:** **14/18** authored synthetic NLI predictions: entailment 5/6, contradiction 6/6, neutral 3/6. The entailment error S02 was the total-count statement 42 adults + 8 children ⇒ 50 people misclassified as contradiction. Three neutrals S13/S14/S18 were called contradiction. Synthetic-only 5-bin top-class ECE .131043; this **does not constitute calibrated scholarly evidence or a basis for confidence in EvidenceLinks**. The historical binary screening labels cannot be used as ground truth for NLI semantic-support probabilities.

**Arm disposition:** true local inference and bounded task demonstration, **not a candidate-route success**; the ranking gain is mixed and at the cost of previously included studies at fixed review budget. DeBERTa same-basis comparator must be read before final R4 report.

## DeBERTa result and controlled side-by-side readout

**Both model jobs SUCCESS** in the [named R4 workflow 35949038033](https://github.com/mberrys/ivory/actions/runs/35949038033) at experiment commit `60e9378887e4c398a1a8bedda2e3dd3883b765ff`; resulting documented branch head will be newer, so always identify the **execution head separately**. Model-specific inspectable artifacts:
- MiniLM `ivory-r4-minilm-empirical-evidence`, ID `10788335940`, sha `b95119ce93d3e065de6214e38cd4a97b0f2f2c6d`, 82.1M params.
- DeBERTa `ivory-r4-deberta-empirical-evidence`, ID `10788715332`, actual official `cross-encoder/nli-deberta-v3-small@fa2804872c3b4bd748f38c0185cc85775361e735`, 141.9M params.

**Exact same source byte digest, cohort membership hashes, hypotheses, paired input record IDs, 960 model title/abstract–hypothesis pairs each, 18 authored synthetic cases and 384 maximum pair tokens**. DeBERTa model loading **6.986 s**, cohort inference **407.465 s**, total program including public source download **415.537 s** on GitHub Ubuntu CPU versus MiniLM 3.337 s load / 215.161 s cohort inference / 219.423 s total. Difference is host CPU measurement, not target-user hardware cost. No recorded paid model API usage or verified GitHub runner bill, so do not claim total execution was cost-free. Actual total tokenizer tokens **not logged**; 960 pairs each with at most 384 tokens is a bounded upper limit, not measured token usage. Both official Hugging Face models ran inside GitHub worker after public downloads, with no private Ivory source egress.

### Full R4 ranking comparison — independent NEW 96-record cohort

Primary historic title/abstract-screen positives = 24; all figures are **records found in the top 24 / 48 / 72 and average precision**, not exact three-way semantic support truth.

| Arm | Top 24 | Top 48 | Top 72 | AP |
|---|---:|---:|---:|---:|
| No-model lexical rules | 12 | 18 | 22 | .494682 |
| MiniLM compound only | 5 | 11 | 17 | .236812 |
| MiniLM decomposed mean only | 6 | 11 | 18 | .246895 |
| MiniLM decomposed minimum only | 4 | 14 | 19 | .268930 |
| MiniLM lexical+compound | 12 | 18 | 23 | .511318 |
| MiniLM lexical+decomposed mean | 12 | **20** | 22 | .526621 |
| MiniLM lexical+decomposed minimum | 12 | 19 | 23 | .516122 |
| DeBERTa compound only | 5 | 12 | 20 | .276837 |
| DeBERTa decomposed mean only | 7 | 16 | 21 | .375701 |
| DeBERTa decomposed minimum only | 8 | 14 | 20 | .301523 |
| DeBERTa lexical+compound | 12 | 18 | 23 | .549444 |
| DeBERTa lexical+decomposed mean | 12 | **20** | 23 | .508021 |
| DeBERTa lexical+decomposed minimum | 12 | **20** | 23 | .555473 |

This is a *single stratified 96-record sample*; don't use AP ranking as a model's general truthfulness, independent scholarly accuracy or final adoption verdict. The unchanged rules were already competitive, and model-only ranking remained poorer on this cohort at budgets 24 and 48. The hypothesized criterion decomposition sometimes changes tie-order advantage, **not** a demonstrated new class of eligible papers or authority to exclude.

### Previously seen 96-record cohort (already used in older compound MiniLM run)

| Arm | Top 24 | Top 48 | Top 72 | AP |
|---|---:|---:|---:|---:|
| Lexical rules | 9 | 15 | 23 | .331841 |
| MiniLM lexical+compound | 7 | 17 | 23 | .375446 |
| MiniLM lexical+decomp mean | 7 | 17 | 23 | .350536 |
| MiniLM lexical+decomp min | 8 | 17 | 24 | .444943 |
| DeBERTa lexical+compound | 9 | **18** | 24 | .354955 |
| DeBERTa lexical+decomp mean | 9 | 16 | 23 | .351945 |
| DeBERTa lexical+decomp min | 7 | 15 | 24 | .389379 |

Do not call this cohort held-out. Same review, historic inclusion policy and label-production process for both cohorts; no cross-topic or publication-period generalization proof.

### Secondary historical *final full-text* inclusion

On NEW cohort **10/96** ultimately included:
| Fixed rank | Included top 24 | Included top 48 | Included top 72 |
|---|---:|---:|---:|
| Rules | 4 | **8** | 9 |
| MiniLM lexical+decomp mean | 4 | 7 | 9 |
| MiniLM lexical+decomp min | 4 | 6 | 10 |
| DeBERTa lexical+decomp mean | 4 | **8** | 10 |
| DeBERTa lexical+decomp min | 4 | **8** | 10 |

On SEEN cohort **7/96** ultimately included at top 48: rules **7**, MiniLM lexical+decomp mean **5**, DeBERTa lexical+decomp mean **6**, DeBERTa lexical+decomp min **5**. The new-cohort DeBERTa gain of two title/abstract positives at top 48 was four gained vs two removed; it *exchanged* one ultimately included record (1210) for another (958) at that budget. MiniLM mean displaced 1210 but added no ultimately included records. Historical final inclusion is a separate post-full-text outcome not fully answerable from model-visible abstracts; these are secondary counterchecks, not a demand to predict unseen text.

### Binary threshold & abstention: FAIL for model-added candidates

The proposed decomposed candidate rule `ALL four entailment scores >=0.5` is true for **zero of 96** on either cohort for either model. In DeBERTa's NEW sample *nudging mechanism* entailment never exceeded **.095**, provider never **.029**; SEEN sample nudging never **.129**, provider max **.518** (one >0.5). Compound DeBERTa only exceeded .5 on **three SEEN records, none historically screen-positive**, and zero NEW. MiniLM compound had zero over .5 across both. Thus no model-added candidates under *predeclared union with rules*:
- NEW: rules and union both propose **23/96**, of which **12/24** historical screen positives are included; **12/24 remain unprioritized**, never automatically excluded.
- SEEN: rules and union both propose **33/96**, of which **11/24** screen positives are included; **13/24 remain unprioritized**.

**A binary "not candidate" must never be interpreted as scholarly exclusion.** Neither model is calibrated for domain-specific review membership. These NLI softmax values are about classifying a textual premise/hypothesis and cannot become research truth, EvidenceLink confidence or reviewer endorsement.

### Synthetic textual entailment diagnostic, not peer review

On **same 18 authored synthetic premise–hypothesis cases**, 6/class:
- MiniLM **14/18**: entailment 5/6, contradiction 6/6, neutral 3/6; authored-only 5-bin top-class ECE `0.131043`.
- DeBERTa **16/18**: entailment 5/6, contradiction 6/6, neutral 5/6; authored-only top-class ECE `0.101498`.
- Both incorrectly treated numeric S02 “42 adults and eight children” ⇒ “50 people” as contradiction. MiniLM also mislabeled neutral S13/S14/S18 as contradiction; DeBERTa neutral S13. These are observable failure cases, not meaningful statistical proof across scholarly genres.
- **Actual scholarly probability calibration: BLOCKED** (18 authored synthetics insufficient; historic review inclusion is not three-way semantic entailment truth; no dual annotated class-level real evidence). No model may be promoted to Ivory five-label `supported/partial/unsupported/contradicted/abstain` mapping from three-way NLI labels without explicit separate evaluation.

### Exploratory (post-hoc) small-sample instability check — no significance claim

As a sensitivity check *after seeing results*, 2,000 seeded stratified paired bootstrap replicates on each 24-positive/72-negative cohort (resample both historic screen classes and keep paired model/rules rows) estimated 95% percentile ranges for **recall@48 difference** between lexical+decomp mean and rules: NEW MiniLM `[-0.0417,+0.25]`, NEW DeBERTa `[-0.125,+0.25]`; SEEN MiniLM `[-0.125,+0.25]`, SEEN DeBERTa `[-0.125,+0.2083]`. They **all include zero**. This is NOT a preregistered significance test, not a confidence interval for the original review population or for another topic; it reinforces that a two-record improvement is insufficient for qualification.

## R4 gate-by-gate disposition (do not convert partial proof into epic closure)

| R4 criterion | Actual evidence | Status |
|---|---|---|
| Same-basis deterministic baseline vs two scoped local model evaluators | Two SUCCESS named model jobs, real source SHA and both cohort SHAs, unchanged rules and 5 frozen hypotheses | **EXECUTED** |
| Human-reviewed real title/abstract references | Historical review authors' screening outcomes, **but not independent per-reviewer case-level votes** | **PARTIAL — cannot establish independent dual-review** |
| Semantic support by class | 18 authored synthetic, per-class 3-way confusion and hard negative cases; 3-way does not equal Ivory's 5-way schema | **PARTIAL — scholarly accuracy unresolved** |
| Calibration where applicable | Synthetic top-class ECE only; NLI class softmax not review inclusion or truth probability | **BLOCKED** |
| Ambiguity, contradictory evidence, genuine researcher disagreement | Synthetic J3 contradictions and incomplete basis; **no independent real disputed interpretations adjudicated by multiple researchers** | **PARTIAL** |
| Unsupported acceptance, rights and abstention | 28/28 isolated tests + real archived N1 1/1 mandatory `unavailable` abstention at workflow 35949037916 | **PASS for tested experimental boundary, not V5 live integration** |
| Runtime cost / latency | MiniLM cohort 215.161s, DeBERTa 407.465s, CPU/GitHub; both 960 pairs at <=384 tokens | **MEASURED CPU, not target hardware; token totals/billing unavailable** |
| Local/private feasibility | No private Ivory corpus; two HF public model downloads and local PyTorch inference on Actions; HF Jobs HTTP 402 | **TECHNICALLY SHOWN for public inputs, not user workstation/offline installation** |
| Real V5 Core/N7/Receipt + restart + two-client parity | Fork reset has isolated experiment, not imported durable Core + N7 authority; original archived context unavailable | **BLOCKED; no product qualification** |

**R4 result:** Execute-and-document phase **COMPLETED**: both scoped model benchmarks, actual public review-label data, synthetic class diagnostics, and isolated N1/security regressions. The stronger hypothesis “criterion decomposition creates a reliable optional Jev-like researcher decision helper qualified for adoption” **NOT ESTABLISHED**. The old compound and new decomposed model threshold must not be adopted for paper exclusion, and the observed ranking gains are mixed and small. Full R4 human/production qualification is **BLOCKED**, not falsely marked as finished. The Jev research epic remains **OPEN**.

**Smallest remaining acceptance path before R5 final ADR:** (1) obtain *rights-approved* real claims/fragments or abstract-screen cases with two independent researcher annotations + preserved disagreements; (2) restore/import actual V5 Core and N7 owning gates, demonstrate exact complete N1 snapshot→local evaluator→typed Assessment→human proposal/adjudication→durable Receipt→restart→CLI/Studio parity and a no-model path; (3) measure token counts, workstation CPU/GPU, offline installer/privacy and costs under a frozen benchmark. Avoid additional Qwen3 size tests or post-hoc calibration on the same held-out records. None of those missing capabilities can be manufactured from existing archived `context-unavailable` data or author-supplied labels.

**R5 implication (provisional only):** retain replaceable local-evaluator **architecture pattern**, do not select a *particular tested model/prompt/threshold* for production screening, and do not write a positive adoption ADR from this limited experiment.
