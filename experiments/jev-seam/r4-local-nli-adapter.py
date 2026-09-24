"""Real local R4 model adapter for an exact, *synthetic complete* citation basis.

External Hugging Face repo downloads are PUBLIC model bytes only; no user
research data goes to network; source bytes enter local stdin and never logs.
NLI 3-way cannot imply Ivory's 5-way academic-support validity or calibration.
No model-driven Core acceptance, remote provider or researcher impersonation.
"""
import hashlib
import json
import os
import platform
import resource
import sys
import time

import torch
from huggingface_hub import model_info
from transformers import AutoTokenizer, AutoModelForSequenceClassification

MODEL="cross-encoder/nli-MiniLM2-L6-H768"
MODEL_SHA="b95119ce93d3e065de6214e38cd4a97b0f2f2c6d"
MAX_BYTES=64_000
MAX_TOKENS=384

def fail(msg):
    raise ValueError(msg)

def run():
    raw=sys.stdin.buffer.read(MAX_BYTES+1)
    if not raw or len(raw)>MAX_BYTES:fail("invalid_input_size")
    msg=json.loads(raw)
    if set(msg)!= {"questionId","premise","hypothesis"}: fail("unexpected_local_model_fields")
    question=msg["questionId"];premise=msg["premise"];hypothesis=msg["hypothesis"]
    if not all(isinstance(x,str) and x.strip() for x in (question,premise,hypothesis)):fail("missing_model_input")
    if len(premise)>6400 or len(hypothesis)>2000:fail("unbounded_model_input")
    start=time.perf_counter()
    info=model_info(MODEL,revision=MODEL_SHA)
    if info.sha!=MODEL_SHA:fail("model_identity_mismatch")
    tokenizer=AutoTokenizer.from_pretrained(MODEL,revision=MODEL_SHA)
    model=AutoModelForSequenceClassification.from_pretrained(MODEL,revision=MODEL_SHA)
    model.eval()
    ids={int(k):str(v).lower() for k,v in model.config.id2label.items()}
    if set(ids.values())!={"entailment","contradiction","neutral"}:fail("unexpected_nli_labels")
    encoded=tokenizer(premise,hypothesis,return_tensors="pt",truncation=False)
    input_tokens=int(encoded["input_ids"].shape[1])
    if input_tokens>MAX_TOKENS:fail("truncation_would_lose_research_context")
    t=time.perf_counter()
    with torch.inference_mode():
        probs=torch.softmax(model(**encoded).logits[0],dim=-1).tolist()
    distribution={ids[i]:float(x) for i,x in enumerate(probs)}
    total=sum(distribution.values())
    if not (0.99999<=total<=1.00001):fail("invalid_nli_distribution")
    # Sum within strict existing semantic seam tolerance.
    mapped={"supported":distribution["entailment"]/total,
        "partial":0.0,"unsupported":0.0,
        "contradicted":distribution["contradiction"]/total,
        "abstain":distribution["neutral"]/total}
    return {"questionId":question,"probabilities":mapped,
        "metrics":{"model":MODEL,"model_revision":MODEL_SHA,
            "question_digest":"sha256:"+hashlib.sha256(hypothesis.encode()).hexdigest(),
            "input_digest":"sha256:"+hashlib.sha256(raw).hexdigest(),
            "input_tokens":input_tokens,"max_tokens":MAX_TOKENS,
            "runtime_inference_ms":round((time.perf_counter()-t)*1000,3),
            "elapsed_including_model_load_ms":round((time.perf_counter()-start)*1000,3),
            "maxrss_kb_linux":resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
            "torch":torch.__version__,"python":platform.python_version(),
            "privacy_boundary":"local process; public model download; no user-data API egress"},
        "mapping_limit":"3-way NLI surface mapped only to supported/contradicted/abstain, not five-way semantic qualification"}

try:
    print(json.dumps(run(),sort_keys=True),flush=True)
except Exception as exc:
    # No source or exception message containing private bytes to stdout/stderr.
    sys.stderr.write("local_nli_fail_closed:"+exc.__class__.__name__+"\n")
    sys.exit(2)
