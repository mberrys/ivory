"""Ivory R4 exploratory public-data screening cascade (NOT production).
Historical SYNERGY Nagtegaal_2019 title/abstract screening labels, not user data.
Preregistered fixed sample and scoring; no fitting, label-aware prompt tuning,
automated final exclusion, N1 admission, human reviewer simulation or N7 authority.
"""
import csv
import hashlib
import io
import json
import math
import platform
import re
import statistics
import subprocess
import time
import urllib.request
from collections import Counter

import torch
from huggingface_hub import model_info
from transformers import AutoTokenizer, AutoModelForSequenceClassification

SOURCE_REPO="asreview/systematic-review-datasets"
SOURCE_REF="metadata-v1-final"
SOURCE_PATH="datasets/Nagtegaal_2019/output/Nagtegaal_2019.csv"
SOURCE_URL="https://raw.githubusercontent.com/"+SOURCE_REPO+"/"+SOURCE_REF+"/"+SOURCE_PATH
MODEL="cross-encoder/nli-MiniLM2-L6-H768"
MODEL_SHA="b95119ce93d3e065de6214e38cd4a97b0f2f2c6d"
SCREEN_QUERY=("This original study evaluates a behavioral nudge or choice-architecture "
              "intervention targeting healthcare professionals in clinical settings "
              "to change their professional clinical behavior or evidence-based practice.")
CASE_COUNTS={"title_abstract_positive":24,"title_abstract_negative":72}
SELECTION_VERSION="ivory-synergy-nagtegaal-title-abstract/1"
SELECTION_SALT="ivory-nli-nagtegaal-v1-preregistered-20260923"
TOP_K=(24,48,72)
RULE_NUDGE=re.compile(r"\b(nudg(?:e|es|ing)|choice architecture|default(?:s| option)|peer feedback|peer comparison|social norm|audit and feedback|reminder|clinical decision support|alert system)\b",re.I)
RULE_PROVIDER=re.compile(r"\b(physician|clinician|nurs(?:e|es|ing)|health(?:care| care) (?:personnel|professional|worker)|prescriber|pharmacist|doctor|medical staff)\b",re.I)
RULE_INTERVENTION=re.compile(r"\b(trial|intervention|experiment|randomiz|randomis|quasi-experiment|before.after|controlled stud|implementation|behavior change|behaviour change)\b",re.I)
RULE_CLINICAL=re.compile(r"\b(clinic|hospital|patient|healthcare|health care|medical|prescri|vaccin|handwash|infection|health system)\b",re.I)
PATTERNS={"nudge":RULE_NUDGE,"provider":RULE_PROVIDER,"intervention":RULE_INTERVENTION,"clinical":RULE_CLINICAL}
def sha(value):
    return hashlib.sha256(value).hexdigest()
def raw_source():
    req=urllib.request.Request(SOURCE_URL,headers={"User-Agent":"Ivory-public-screening-research/1"})
    with urllib.request.urlopen(req,timeout=60) as r:
        body=r.read(15*1024*1024+1)
    assert 1000<len(body)<15*1024*1024,("unexpected-source-byte-length",len(body))
    original=sha(body)
    return body,original
def source_sha():
    try:
        proc=subprocess.run(["git","ls-remote","https://github.com/"+SOURCE_REPO+".git","refs/heads/"+SOURCE_REF],
            capture_output=True,text=True,check=True,timeout=45)
        parts=proc.stdout.strip().split()
        return parts[0] if len(parts)==2 and len(parts[0])==40 else None
    except (FileNotFoundError,subprocess.SubprocessError):
        return None
def parse_data(body):
    reader=csv.DictReader(io.StringIO(body.decode("utf-8-sig")))
    needed={"record_id","title","abstract","label_included","label_abstract_screening"}
    assert needed.issubset(set(reader.fieldnames or [])),reader.fieldnames
    raw=list(reader)
    reasons=Counter()
    unique={}
    for item in raw:
        record_id=(item.get("record_id") or "").strip()
        title=(item.get("title") or "").strip()
        abstract=(item.get("abstract") or "").strip()
        label=(item.get("label_abstract_screening") or "").strip()
        final=(item.get("label_included") or "").strip()
        if not record_id or (not title and not abstract):
            reasons["empty-title-and-abstract-or-id"]+=1;continue
        if label not in ("0","1"):
            reasons["unknown-title-abstract-label"]+=1;continue
        if final not in ("0","1"):
            reasons["unknown-final-inclusion-label"]+=1;continue
        # Treat duplicates conservatively; never train, and do not count the
        # same displayed abstract twice. Label conflict => exclude all copies.
        identity=sha(json.dumps([title.casefold(),abstract.casefold()],ensure_ascii=False,separators=(",",":")).encode())
        normalized={"record_id":record_id,"title":title,"abstract":abstract,
          "title_abstract_label":int(label),"final_included":int(final),
          "text_digest":sha((title+"\n"+abstract).encode())}
        unique.setdefault(identity,[]).append(normalized)
    canonical=[]
    for group in unique.values():
        if len({(p["title_abstract_label"],p["final_included"]) for p in group})!=1:
            reasons["conflicting-duplicate-groups"]+=1
            continue
        if len(group)>1:reasons["duplicate-extra-records"]+=len(group)-1
        canonical.append(sorted(group,key=lambda x:x["record_id"])[0])
    canonical.sort(key=lambda p:p["record_id"])
    totals=Counter(x["title_abstract_label"] for x in canonical)
    assert totals[1]>=CASE_COUNTS["title_abstract_positive"],("too-few-screen-positives",totals)
    assert totals[0]>=CASE_COUNTS["title_abstract_negative"],("too-few-screen-negatives",totals)
    return raw,canonical,reasons,totals
def sample(rows):
    chosen=[]
    for label,count in ((1,CASE_COUNTS["title_abstract_positive"]),(0,CASE_COUNTS["title_abstract_negative"])):
        xs=[p for p in rows if p["title_abstract_label"]==label]
        xs.sort(key=lambda p:(sha((SELECTION_SALT+"|"+p["record_id"]+"|"+p["text_digest"]).encode()),p["record_id"]))
        chosen.extend(xs[:count])
    chosen.sort(key=lambda p:p["record_id"])
    assert len(chosen)==96 and sum(x["title_abstract_label"] for x in chosen)==24
    return chosen
def rules(text):
    flags={k:bool(p.search(text)) for k,p in PATTERNS.items()}
    # Pure prioritization, not automated permanent exclusion.
    score=(int(flags["nudge"])+int(flags["provider"])+int(flags["intervention"])+int(flags["clinical"]))
    return score,flags
def ap(rows,scorekey,labelkey):
    order=sorted(rows,key=lambda x:(-x[scorekey],x["record_id"]))
    positives=sum(x[labelkey] for x in rows)
    if not positives:return None
    hits=0;precision_sum=0
    for rank,item in enumerate(order,1):
        if item[labelkey]:
            hits+=1;precision_sum+=hits/rank
    return round(precision_sum/positives,6)
def ranks(rows,name,labelkey):
    ordered=sorted(rows,key=lambda x:(-x[name],x["record_id"]))
    relevant=sum(r[labelkey] for r in rows)
    d={}
    for k in TOP_K:
        tp=sum(r[labelkey] for r in ordered[:k])
        d[str(k)]={"review_queue_size":k,"labeled_relevant_found":tp,
                   "precision_at_k":round(tp/k,5),"recall_at_k":round(tp/relevant,5) if relevant else None,
                   "labeled_relevant_not_yet_seen":relevant-tp}
    return {"average_precision":ap(rows,name,labelkey),"ranking":d}
def infer(sampled):
    start=time.perf_counter()
    info=model_info(MODEL,revision=MODEL_SHA)
    assert info.sha==MODEL_SHA,(info.sha,MODEL_SHA)
    tokenizer=AutoTokenizer.from_pretrained(MODEL,revision=MODEL_SHA)
    model=AutoModelForSequenceClassification.from_pretrained(MODEL,revision=MODEL_SHA)
    model.eval()
    ids={int(k):v.lower() for k,v in model.config.id2label.items()}
    assert set(ids.values())=={"contradiction","entailment","neutral"},ids
    for begin in range(0,len(sampled),8):
        group=sampled[begin:begin+8]
        x=tokenizer([((r["title"]+"\n"+r["abstract"])[:6500]) for r in group],
            [SCREEN_QUERY]*len(group),padding=True,truncation=True,
            max_length=384,return_tensors="pt")
        with torch.inference_mode():
            logits=model(**x).logits
            probabilities=torch.softmax(logits,dim=-1).tolist()
        for r,arr in zip(group,probabilities):
            r["nli_distribution_uncalibrated"]={ids[i]:round(float(v),8) for i,v in enumerate(arr)}
            r["nli_entailment"]=float(arr[next(i for i,label in ids.items() if label=="entailment")])
            r["nli_label"]=ids[max(range(len(arr)),key=lambda i:arr[i])]
    return round(time.perf_counter()-start,3),ids
def run():
    start=time.perf_counter()
    body,source_digest=raw_source()
    source_rev=source_sha()
    raw,allrows,skips,totals=parse_data(body)
    rows=sample(allrows)
    for r in rows:
        score,flags=rules(r["title"]+"\n"+r["abstract"])
        r["rules_score"]=score
        r["rules_flags"]=flags
    model_seconds,label_map=infer(rows)
    for r in rows:
        # Preregistered explicit same-task arms; no score fitting to labels.
        r["nli_score"]=r["nli_entailment"]
        r["cascade_score"]=(r["rules_score"]+r["nli_entailment"])/5.0
        r["rules_candidate"]=r["rules_score"]>=3
        r["nli_candidate"]=r["nli_entailment"]>=0.5
        r["cascade_candidate"]=r["rules_candidate"] or r["nli_candidate"]
    PUBLIC_FIELDS=("record_id","text_digest","title_abstract_label","final_included",
      "rules_score","rules_flags","nli_label","nli_distribution_uncalibrated",
      "nli_entailment","rules_candidate","nli_candidate","cascade_candidate","cascade_score")
    # No source abstracts/titles in the published artifact (dataset pointer + byte digest instead).
    records=[{k:r[k] for k in PUBLIC_FIELDS} for r in rows]
    summaries={}
    for labelkey in ("title_abstract_label","final_included"):
        summaries[labelkey]={"prevalence_in_sample":round(sum(r[labelkey] for r in rows)/len(rows),6),
          "arms":{name:ranks(rows,name,labelkey) for name in ("rules_score","nli_score","cascade_score")}}
    conf={}
    for key in ("rules_candidate","nli_candidate","cascade_candidate"):
        positives=sum(r["title_abstract_label"] for r in rows)
        proposed=[r for r in rows if r[key]]
        conf[key]={"proposed_for_manual_review":len(proposed),
          "among_ta_screen_labeled_positive":sum(x["title_abstract_label"] for x in proposed),
          "among_ta_screen_labeled_negative":sum(1-x["title_abstract_label"] for x in proposed),
          "ta_screen_labeled_positive_not_prioritized":positives-sum(x["title_abstract_label"] for x in proposed),
          "never_auto_exclude":True}
    result={"schema":"ivory-synergy-nli-cascade/1","status":"real public literature and historical title-abstract screening labels",
      "source":{"dataset":"Nagtegaal_2019","title":"Nudging healthcare professionals towards evidence-based medicine: a systematic scoping review",
         "csv_url":SOURCE_URL,"source_branch":SOURCE_REF,"source_head_from_git_lsremote":source_rev,
         "source_csv_sha256":source_digest,
         "license_asreview_dataset_index":"CC0",
         "original_record_count":len(raw),"deduplicated_valid_labeled":len(allrows),
         "deduplicated_screen_positive":totals[1],"deduplicated_screen_negative":totals[0],
         "skipped":dict(skips),"label_columns":["label_abstract_screening","label_included"]},
      "sample":{"strategy":"predeclared SHA256 ordered stratified sampling; not natural prevalence",
        "algorithm_revision":SELECTION_VERSION,"salt":SELECTION_SALT,"sizes":CASE_COUNTS,
        "n":len(rows),"case_membership_sha256":sha(json.dumps([(r["record_id"],r["text_digest"],r["title_abstract_label"]) for r in rows],separators=(",",":")).encode())},
      "model":{"repo":MODEL,"revision":MODEL_SHA,"nli_labels":label_map,
        "question":SCREEN_QUERY,"question_sha256":sha(SCREEN_QUERY.encode()),
        "model_inference_including_load_seconds":model_seconds},
      "configuration":{"max_length_tokens":384,"batch_size":8,"thresholds_diagnostic_not_calibrated":{"rules_candidate":3,"nli_candidate":0.5},
         "no_auto_exclusion":True,"top_k":TOP_K,
         "cascade_rank":"(rules_count_0_to_4 + nli_entailment_0_to_1) / 5.0 (lexical rank primary; model within-tier tie-break)",
         "cascade_candidate":"rules_candidate OR nli_candidate"},
      "environment":{"platform":platform.platform(),"python":platform.python_version(),"torch":torch.__version__},
      "ranking_metrics":summaries,"screening_routing_diagnostics":conf,
      "records":records,"total_elapsed_seconds":round(time.perf_counter()-start,3),
      "limitations":[
        "Historical full review and title-abstract screening labels may not be independent two-reviewer case-level exports. Screening labels are not semantic entailment truth.",
        "The original review topic is nudge interventions targeting healthcare personnel, NOT the previous adult patient qualitative primary-care task. Never transfer old labels.",
        "Final inclusion label can reflect full text not available to model; only secondary outcome, not a title-abstract ground truth.",
        "Stratified 24/72 sample is not population prevalence; original pool counts reported separately. No fitted thresholds or test-set tuning.",
        "No hard exclusion; candidate/priority scores only propose manual review. No auto-accept or accepted EvidenceLink.",
        "NLI softmax uncalibrated; not a probability a scholarly claim is true.",
        "Actual public metadata corpus downloaded from GitHub to CI; no Ivory private research or actual N1/N7/V5 authenticated release gate.",
        "Source metadata has CC0 in ASReview index, but independent dual-review annotations per case are not verified.",
        "No independent model-free realistic reviewer time measured. Rank comparison and title/abstract decisions are preliminary.",
      ]}
    print("IVORY_SYNERGY_SCREEN_RESULT="+json.dumps(result,sort_keys=True))
if __name__=="__main__":run()
