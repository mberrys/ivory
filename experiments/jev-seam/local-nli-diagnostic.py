"""Jev-like NLI candidate: local, public-synthetic diagnostic only.

Never transmit any Ivory source bytes or call this from the governed semantic
seam. This script assesses whether a small local NLI model merits further study.
No scores here constitute scholarly accuracy, calibrated truth, or endorsement.
"""
import hashlib
import json
import platform
import time

import torch
from huggingface_hub import model_info
from transformers import AutoModelForSequenceClassification, AutoTokenizer

MODEL = "cross-encoder/nli-MiniLM2-L6-H768"
# Synthetic independent textual pairs; not real researcher-reviewed labels.
# The archived N1 fixture's mechanical context is unavailable, so do NOT
# dispatch that exact historical snapshot to an evaluator through Ivory.
CASES = [
    ("P01", "Maya said advising made the next step visible.", "Advising made the next step visible to Maya.", "entailment"),
    ("P02", "Maya said advising made the next step visible.", "Advising made the next step impossible to see for Maya.", "contradiction"),
    ("P03", "Maya said advising made the next step visible.", "Advising caused a rise in national graduation rates.", "neutral"),
    ("P04", "Among 30 respondents in June, 18 favored remote appointments.", "All 30 respondents favored remote appointments.", "contradiction"),
    ("P05", "Among 30 respondents in June, 18 favored remote appointments.", "More than half of the respondents favored remote appointments.", "entailment"),
    ("P06", "Among 30 respondents in June, 18 favored remote appointments.", "Remote appointments remained preferred through December.", "neutral"),
    ("P07", "The study sampled 12 adults at one clinic without a control group.", "The study demonstrated causality across all clinics.", "neutral"),
    ("P08", "The authors report that no table of adverse events was provided.", "The authors provided a table of adverse events.", "contradiction"),
    ("P09", "Thirty percent of the surveyed households owned a bicycle.", "Some of the surveyed households owned a bicycle.", "entailment"),
    ("P10", "The interviewee said the schedule reduced waiting time.", "The interviewee said the schedule increased waiting time.", "contradiction"),
    ("P11", "The manuscript says 40 of 50 respondents completed the survey.", "All 50 respondents completed the survey.", "contradiction"),
    ("P12", "Interview participant A says a nurse answered the phone.", "The hospital implemented an automated phone system.", "neutral"),
]
EXPECTED_LABELS = {"contradiction", "entailment", "neutral"}
assert len({c[0] for c in CASES}) == len(CASES)
case_digest = hashlib.sha256(json.dumps(CASES, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()
model_sha = model_info(MODEL).sha
assert model_sha and len(model_sha) == 40
t0 = time.perf_counter()
tokenizer = AutoTokenizer.from_pretrained(MODEL, revision=model_sha)
model = AutoModelForSequenceClassification.from_pretrained(MODEL, revision=model_sha)
model.eval()
label_map = {int(k): v.lower() for k, v in model.config.id2label.items()}
assert set(label_map.values()) == EXPECTED_LABELS, label_map
observations = []
for case_id, premise, hypothesis, authored_label in CASES:
    encoded = tokenizer(premise, hypothesis, return_tensors="pt", truncation=False)
    assert encoded["input_ids"].shape[1] <= model.config.max_position_embeddings
    t1 = time.perf_counter()
    with torch.inference_mode():
        logits = model(**encoded).logits[0]
        probs = torch.softmax(logits, dim=-1)
    prediction = label_map[int(torch.argmax(logits).item())]
    distribution = {label_map[i]: round(float(value), 8) for i, value in enumerate(probs)}
    observations.append({
        "id": case_id,
        "authored_synthetic_label": authored_label,
        "prediction": prediction,
        "distribution_uncalibrated": distribution,
        "matches_authored_label": prediction == authored_label,
        "latency_ms_cpu": round((time.perf_counter() - t1) * 1000, 2),
    })
result = {
    "experiment": "ivory-jevlike-local-nli/1",
    "evidence_class": "real local model execution on 12 authored synthetic pairs only",
    "model": MODEL,
    "model_revision": model_sha,
    "fixture_sha256": case_digest,
    "environment": {"platform": platform.platform(), "python": platform.python_version(), "torch": torch.__version__},
    "adapter_kind": "local-pytorch-nli",
    "external_source_payloads_sent": False,
    "no_n1_dispatch_reason": "archived N1 mechanical context unavailable; mandatory abstention",
    "authored_synthetic_count": len(observations),
    "matches_authored_synthetic_labels": sum(x["matches_authored_label"] for x in observations),
    "elapsed_seconds_including_model_load": round(time.perf_counter() - t0, 2),
    "observations": observations,
    "limitations": [
        "Not a human-reviewed scholarly benchmark and not a Jev/TypeSafe run.",
        "Class scores are uncalibrated NLI softmax, not probability a scholarly claim is true.",
        "No N1-to-V5 durable Core admission, model wire approval, N7 governance, or user-source inference.",
        "NLI three-way scores do not imply Ivory supported/partial/unsupported/contradicted mapping.",
        "No model-selected action, human acceptance, or external effect.",
    ],
}
print(json.dumps(result, sort_keys=True))
