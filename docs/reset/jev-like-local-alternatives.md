# Addendum — local Jev-like evaluator candidates for Ivory (2026-09-23 PDT)

**Scope:** the [Ivory Jev research epic](https://app.notion.com/p/3e49cb079ddb801db7ddda66ae715eaa) and [existing bounded R2/R3 research branch](https://github.com/mberrys/ivory/tree/experiment/jev-r2-r3-semantic-seam). Research-only; no PR, production Core change, or model-provider credential.

## Corrected hypothesis

The project does **not** need a Jev/TypeSafe subscription or Jev State to test the architectural hypothesis. What it needs is a replaceable, fast, local **typed semantic decision** implementation behind the same Ivory-owned exact-request/observation contract. We should distinguish (a) scholarly entailment over text and (b) more general bounded Choice/routing decisions rather than assume one model fits both.

A model's softmax or constrained-token logprobs are **not** the likelihood that a research claim is true. They require calibration against independent, representative, held-out reviews before any risk threshold could be used, and never confer research authority.

## GitHub/open models reviewed

| Candidate | Repo / model | Exact function | Role and limitation |
|---|---|---|---|
| **MiniLM NLI (first local experiment)** | [sentence-transformers](https://github.com/huggingface/sentence-transformers) / [cross-encoder/nli-MiniLM2-L6-H768](https://huggingface.co/cross-encoder/nli-MiniLM2-L6-H768) | Local 82.1M-parameter 3-class contradiction/entailment/neutral classification, Apache-2.0 | Narrow claim-to-fragment screen; no arbitrary Choice, no `partial`/uncertainty policy and no evidence-rights governance built into model. |
| DeBERTa-v3-small NLI | [sentence-transformers](https://github.com/huggingface/sentence-transformers) / [nli-deberta-v3-small](https://huggingface.co/cross-encoder/nli-deberta-v3-small) | Local 141.9M 3-class NLI, Apache-2.0 | Next semantic comparator under identical exact input basis; not a proven Ivory winner. |
| Qwen3-0.6B-GGUF | [Qwen3](https://github.com/QwenLM/Qwen3) / [Qwen3-0.6B-GGUF](https://huggingface.co/Qwen/Qwen3-0.6B-GGUF) | Small local instruct model, Apache-2.0 | General typed triage/Choice/abstain with an approved JSON schema; do not infer calibrated decision probabilities from constrained decoding. |
| llama.cpp + optional llguidance | [llama.cpp](https://github.com/ggml-org/llama.cpp) / [llguidance](https://github.com/guidance-ai/llguidance) | Local inference + constrained schema/grammar decoding | Production-neutral transport candidate for Qwen-style classification. Grammar validates **shape**, not semantics or truth. |
| Outlines | [dottxt-ai/outlines](https://github.com/dottxt-ai/outlines) | Provider-neutral constrained choice/JSON/grammar generation | Useful test/adapter precedent; avoid importing a Python workflow engine into Ivory domain or confusing framework with underlying model. |
| DeBERTa-v3-base universal zero-shot | [zeroshot-classifier](https://github.com/MoritzLaurer/zeroshot-classifier) / [model](https://huggingface.co/MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33) | Entailment vs **not entailment** | Less directly suitable for contradiction-versus-neutral because the model combines them. |

**Selection:** MiniLM three-class NLI for a low-footprint semantic diagnostic; DeBERTa for a controlled same-task comparison. Use Qwen3 + llama.cpp separately when testing configurable multi-class research routing (e.g., source triage), not as an automatic substitute for NLI. No framework or model is mandated by N1.

## Actual execution and retained status

- Existing real archived-N1 composition: [run 35940936300](https://github.com/mberrys/ivory/actions/runs/35940936300) passed the reference bridge with the **mechanical context unavailable**, therefore **abstention was mandatory**; this is not local NLI accuracy.
- Attempted the first local model run with connected Hugging Face Jobs `cpu-basic`; service returned **HTTP 402 Payment Required before execution**. No job/model output exists from that attempt.
- A separate [Python model diagnostic](https://github.com/mberrys/ivory/blob/experiment/jev-r2-r3-semantic-seam/experiments/jev-seam/local-nli-diagnostic.py) was committed. It loads the unmodified model pinned to its hub SHA, evaluates 12 public **authored synthetic** evidence/claim pairs locally on CPU, captures three-class scores, model revision, fixture hash, timing and limitations. Its source bytes never include private research.
- [Dedicated GitHub Actions run 35942354731](https://github.com/mberrys/ivory/actions/runs/35942354731) executes this diagnostic and uploads `local-nli-evidence.json` as an artifact. Its result must be read from the completed named job; workflow creation or a queued run is **not** a pass.

## Mandatory admission behavior

1. N1/Core verifies exact quote, structural context, representation digest, snapshot membership and source rights **before** considering any model. The historical advising-agency citation with `context: unavailable` **must abstain even if a local NLI model is present**.
2. For a qualified complete/approved basis, MiniLM consumes only a bounded text premise and claim hypothesis; the model has no Core/DB/tool access and no remote egress.
3. Retain the same Ivory request and observation fields across MiniLM, DeBERTa and Qwen; preserve model-specific label mapping and independent `adapterId`/`modelRevision` metadata; do not require every candidate to produce a fabricated full 5-class distribution.
4. Map `entailment`, `contradiction`, `neutral` to a **proposed assessment/reviewer queue**, never directly to `EvidenceLink.role`, `Claim.status`, publication or researcher acceptance. An exact citation can still be semantically insufficient, and the three-way NLI task cannot express all research qualifications.
5. No new provenance graph, shadow Assessment store, alternate ResearchProtocol stage machine, model-authored researcher approval, implicit latest, or automatic link carry-forward.

## Experiment and epic follow-ups

- **Local J1/J5 diagnostic:** collect the named GitHub run's true outputs and model SHA, inspect all wrong cases, document CPU timings as *diagnostic only*. Do not call this a held-out independent research benchmark.
- **Same-input baseline:** run DeBERTa-v3-small and a deterministic rules/no-model arm on the same exact, mechanically complete corpus and compare abstentions and false-support suggestions (not accepted claims).
- **Flexible Choice J1:** Qwen3-0.6B with local llama.cpp JSON-schema / bounded labels on a *separately preregistered* source-triage task; preserve an unconditional abstain path enforced by Core.
- **R4 proper:** two independent human research reviewers, preregistered train/validation/held-out splits and group leakage checks, real provider/model revision, per-class errors, calibration only on valid probability interpretations, cost/latency, disagreements and exposure boundaries.
- **V5 product integration:** remains blocked on selected durable Core, typed Assessment/adjudication owner, real N7 composition, restart/capsule proof and Theia/CLI parity; do not promote the diagnostic or change V5 ADR based on 12 synthetic cases.

**Decision:** local small-NLI **candidate retained for further experiment**; neither Jev nor any local substitute is selected for production. The research epic remains open.
