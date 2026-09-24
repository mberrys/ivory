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
