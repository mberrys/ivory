# Qwen3 local Choice routing addendum — experiment protocol

Date: 2026-09-23 PDT. Related: [Jev-like local alternatives](jev-like-local-alternatives.md); [J1–J9 protocol](experiment-plan.md); [Notion research epic](https://app.notion.com/p/3e49cb079ddb801db7ddda66ae715eaa). Status: experiment script and named run; outcome must be read from the run, not inferred from registration.

## Question

Can an actual locally executed, small Hugging Face Qwen3 instruct model provide a **bounded, replaceable Choice-like screening route** over authorized minimal research metadata, compared with a simple rules arm, without being granted any authority over accepted research meaning? This tests workflow routing, **not** MiniLM's separate claim-to-fragment entailment test. No Qwen3 or Jev runtime is allowed to write N1/CAS/Activity/EvidenceLink/Assessment/ResearchDecisionReceipt.

## Exact study design (predeclared before observations)

- Model: **official** [Qwen/Qwen3-0.6B-GGUF](https://huggingface.co/Qwen/Qwen3-0.6B-GGUF), **Q8_0** (that repository does not publish Q4_K_M); resolve Hub HEAD to exact commit SHA, download exactly one GGUF, hash file SHA256, execute locally on Linux CPU via pinned `llama-cpp-python==0.3.16`.
- Choice: `CANDIDATE | EXCLUDE | REVIEW | ABSTAIN` forced through llama.cpp GBNF grammar. This only guarantees a legal **surface answer**, not the appropriate outcome or that the source is valid.
- Semantics: Title/abstract *triage* for a synthetic adult-patient, qualitative interview/focus-group, access-to-primary-care research question. `CANDIDATE` means fetch full text for human review, never final inclusion; `EXCLUDE` means explicit disqualification; `REVIEW` means ambiguous eligibility; `ABSTAIN` means Core-supplied incomplete/unauthorized basis or inability to decide.
- Cases: 36 fixed authored PUBLIC synthetic strings in [the script](../../experiments/jev-seam/qwen3-choice-diagnostic.py); 8 candidate, 12 exclude (including two embedded prompt-injection strings), 10 ambiguous review and six hard abstain before model dispatch. Gate cases: archived-N1-context-unavailable, denied rights, citation mismatch, inaccessible basis, stale claim head and revoked capability.
- Comparator: independent deterministic keyword baseline with the **same text** for all 30 allowed calls; 6 unauthorized/incomplete cases abstain before either arm. No training, threshold tuning, or hidden post-hoc relabeling within this run.
- Observation: each authored label, predicted class, baseline label, gate/dispatch, raw output, per-case CPU wall time; aggregate confusion matrix, baseline/modeled matches **on authored synthetic labels**, data/model/GGUF hash, host versions, exact source head and workflow run. Artifact `ivory-qwen3-local-choice-evidence` retains `qwen3-observation.json`.
- Core policy: only gate-approved cases are sent to **local process**. A caller-supplied case gate is a synthetic *control fixture*, not proof that a durable V5 Core actually checked an authenticated snapshot. The original archived N1 golden fixture produces `BLOCKED/context-unavailable`; this run must **not** feed that content to a model pretending it was approved.

## Infrastructure

Hugging Face plugin was invoked to authenticate/inspect the official model and to submit a CPU UV job. The connected non-Pro Hugging Face Jobs account returned **HTTP 402 Payment Required** before execution. Therefore use local CPU inference on a GitHub Actions worker **downloading from the official Hugging Face model repo**; pin both repository revision and actual GGUF SHA. These are two different execution providers; the evidence may not be called a Hugging Face Jobs run.

## Readout / acceptance boundaries

- The run may show technical feasibility even if it does not match the authored labels. Retain failures and abstentions; do **not** change case expectations after seeing output.
- Any accidental dispatch for the six forbidden cases, unknown output choice after parsing, or claimed canonical research write disqualifies the proposed integration interface. This test's constrained output cannot establish that an unrestricted model would never emit an action.
- Results on authored synthetic cases cannot be used as calibrated confidence, independent scholarly accuracy, privacy certification, real N1 integration, a production release bar, or proof that Qwen3 outperforms Jev/MiniLM.
- A proper R4 study needs two human reviewers, representative held-out real *rights-approved* papers, actual Core-authenticated mechanical context, a freeze before model tuning, provenance-consistent N7 authorization, cost/latency on target desktop, and an honest no-model baseline.

**Outcome at protocol creation:** pending named GitHub job. Update this *append-only* with the exact completed run and observed failures; do not overwrite the preregistration.
