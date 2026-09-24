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
