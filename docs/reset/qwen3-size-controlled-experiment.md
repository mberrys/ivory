# Next Jev-like experiment — Qwen3 size-controlled, new screening cases (preregistered)

Date: 2026-09-23 PDT. Branch `experiment/jev-r2-r3-semantic-seam`. Previous negative Qwen3 result: [initial primary protocol](qwen3-choice-experiment.md), [36-case run 35945776462](https://github.com/mberrys/ivory/actions/runs/35945776462), [post-hoc probe 35946254018](https://github.com/mberrys/ivory/actions/runs/35946254018). **Do not overwrite those results.**

## Question and comparator

Test whether stronger **Qwen3-1.7B** and older **Qwen3-0.6B**, both official Hugging Face GGUF **Q8_0** with **identical corrected no-thinking prefill**, distinguish different screening routes on a **NEW** 42-case authored synthetic fixture. Compare both to the fixed existing lexical-rules arm on identical cases. This isolates the model-size arm **within this new test** but does **not** isolate size against the previous run, because this test deliberately changes prompt/prefill and fixture. The models execute on separate identical GitHub-hosted CPU runners; performance comparisons are descriptive, not matched identical physical machines.

## Preregistered dataset and controls

- Immutable test source: [qwen3-size-controlled.py](../../experiments/jev-seam/qwen3-size-controlled.py) at **commit `2e11737698e52407e6800f2b7213c33448dc97fb`**. No independent human review was arranged. **Authored synthetic**, not actual labeled literature, representative held-out corpus, or scholarly evaluation. It has never been used in the previous primary 0.6B/mini-NLI run.
- **42 cases:** 12 authored CANDIDATE (explicit adult first-person qualitative primary-care-access relevance), 12 EXCLUDE (explicit pediatric, staff-only, biomedical, inpatient, emergency, no patient study, or injection), 12 REVIEW (missing age/method/setting or pooled sources), six ABSTAIN with explicit fixture-supplied Core-like reasons. No source text for those six reaches either model. These guard fixtures do **not** demonstrate Core authentication, N7 grant lifecycle or provider authorization.
- Choices: `CANDIDATE | EXCLUDE | REVIEW | ABSTAIN`; candidate is *queue for human full-text review only*; model outputs never accept/reject actual academic sources, never author EvidenceLinks and never mutate an N1 record.
- Models: `Qwen/Qwen3-0.6B-GGUF` + `Qwen/Qwen3-1.7B-GGUF`, both exactly named `Qwen3-{size}-Q8_0.gguf`; resolve and record Hub commit IDs + raw GGUF SHA256. If an exact file is unavailable, fail and record it. Never silently substitute a quantization.
- Runtime: `llama-cpp-python==0.3.16`, GitHub Linux CPU, 2 threads, 2048 context, seed 17, temperature 0, <=12 output tokens; identical single-label GBNF; updated prompt has a **prefilled empty thinking block** `<think>\n</think>\n` before generating label to test a specific possible 0.6B constrained-start issue. Same prompt across size arms, NOT the original negative prompt.
- Baseline: verbatim frozen excluded-word/adult/interview/setting rules from the first experiment; intentionally not modified to fit new cases. Measure its authored-label matches separately from the model.
- Evidence: per-case raw string, type/label, hard-gate reason, model-call boolean, per-call latency, both comparator choices and authored-label matches, confusion matrix, fixture SHA256, Hub+GGUF identities, environment, model load/download duration; GitHub Actions per-model artifacts. **Never make model-prediction accuracy claims about an independently reviewed corpus.**

## Stop / reporting rules

Any dispatch for a forbidden case, model output outside legal choices, model granted canonical acceptance, unknown model identity or absent model evidence is a blocking proof failure. An empty-thinking-block / grammar success is *not* meaningful routing unless model distinguishes classes. Retain wrong cases; do not retune labels/prompt after outcomes inside the frozen test. No provider egress of private Ivory text. No actual N1-to-durable-V5 integration, no model-scored historical N1 citation, no durable receipts, N7 permissions, restart or Theia/CLI parity.

**R4 and research epic remain open**, whatever synthetic outcome; if these results identify a promising model/route, the next study must obtain independent researcher-reviewed, rights-approved cases and a complete authenticated V5 Core basis before production qualification.

## Observed outcome — both model arms completed

**Named [GitHub Actions run 35946966485](https://github.com/mberrys/ivory/actions/runs/35946966485) completed with two SUCCESSFUL execution jobs**, at experiment code/workflow commit `2e11737698e52407e6800f2b7213c33448dc97fb`. This is an **experiment-execution pass but a routing-quality failure**. Full per-case observations, raw output, model bytes identities and timings were uploaded as two artifacts:

- `ivory-qwen3-next-0.6B-evidence`, artifact ID `10786699901`.
- `ivory-qwen3-next-1.7B-evidence`, artifact ID `10786593803`.

**Identical new fixture SHA256:** `2d489a9298fd2116de852da88bfa2769a63f2459a37113b881d612b430872cf3`. 42 authored public synthetic examples, 36 model-dispatched, 6 explicitly blocked by harness-provided context/rights/selector/stale/revoked/inaccessible gates. The six required abstentions were **not autonomously detected by either model**, and do not prove real N1/Core authorization.

| Measurement | Qwen3-0.6B | Qwen3-1.7B | Unmodified old rules arm |
|---|---:|---:|---:|
| Matches authored labels among 36 dispatched | **16/36** | **12/36** | **20/36** |
| Matches authored labels including six harness guards | **22/42** | **18/42** | **26/42** |
| Explicit candidate labels correctly recognized | 12/12 | 12/12 | See per-case artifact |
| Explicit exclusions correctly recognized | **0/12** | **0/12** | See per-case artifact |
| Ambiguous review cases correctly recognized | 4/12 | **0/12** | See per-case artifact |
| Incorrectly suggested CANDIDATE for excluded cases | 6/12 | **12/12** | See per-case artifact |
| Invalid generated answer strings | 0 | 0 | N/A |
| Median per-case model CPU inference | 4,202 ms | 5,401 ms | Not measured |
| Model retrieval/load + full diagnostic | 151.75 s | 205.78 s | Not measured |

**Qwen3-0.6B observed distribution:** all 12 authored CANDIDATE → CANDIDATE; of 12 EXCLUDE → 6 CANDIDATE / 1 REVIEW / 5 ABSTAIN / **zero EXCLUDE**; of 12 REVIEW → 6 CANDIDATE / 4 REVIEW / 2 ABSTAIN. The apparent gain in label diversity relative to the historical 0.6B experiment accompanies a **changed prompt, empty-thinking prefill and changed fixture**; it cannot be credited solely to any one change.

**Qwen3-1.7B observed distribution:** all 36 dispatched → **CANDIDATE**. It did not distinguish even the explicitly excluded pediatric, biomedical, staff-only, inpatient, emergency-care, veterinary or instruction-injection samples. Six non-dispatched fixture guard cases → ABSTAIN, by harness construction.

**Model identity:**
- `Qwen/Qwen3-0.6B-GGUF@23749fefcc72300e3a2ad315e1317431b06b590a`, `Qwen3-0.6B-Q8_0.gguf` SHA256 `9465e63a22add5354d9bb4b99e90117043c7124007664907259bd16d043bb031`.
- `Qwen/Qwen3-1.7B-GGUF@90862c4b9d2787eaed51d12237eafdfe7c5f6077`, `Qwen3-1.7B-Q8_0.gguf` SHA256 `061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a`.

**Interpretation and disposition:** The precise proposed **Qwen3-1.7B Q8_0 / prompt / grammar / empty-thinking-prefill configuration fails the bounded-screening usefulness hypothesis** on the preregistered authored synthetic fixture; it provides no evidence that simply scaling 0.6B to 1.7B resolves label collapse. In this case the larger model collapsed to a different constant choice from the earlier 0.6B `REVIEW` run. The provider-neutral architecture and Core abstention boundary remain candidates, but **do not adopt either measured Qwen recipe**, set probability thresholds, permit autonomous scholarly exclusion or promote them as Ivory research-semantic evaluators. Rules control was stronger on this artificial task, but it too is **not** validated on representative literature or independent reviewer labels.

**Next dependency (not part of this closed run):** investigate a model explicitly instruction-qualified for constrained multi-class classification or a deterministic rubric + small NLI cascade, first on rights-approved actual title/abstracts with two independent human screening annotations and adjudicated inclusion/exclusion rationale. Fix and compare three classes, abstention and false-positive costs separately, then conduct target-hardware/latency proof and actual V5 Core/N7 admission and restart. If probing Qwen further, use a **fresh preregistered** prompt/runtime/model intervention and untouched cases; never overwrite this negative result. R4 and the global Jev-like epic remain **OPEN**.
