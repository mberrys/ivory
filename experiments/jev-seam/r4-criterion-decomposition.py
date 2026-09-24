"""R4: real historical title/abstract screening: criterion NLI, compound NLI,
rules, cascades, second local model; independent N1 provenance remains external.

TWO fixed 96-record evaluation cohorts, one historical and one newly selected
nonoverlapping; labels are historical consensus decisions, NOT case-level
dual-reviewer exports or semantic entailment labels. No training, fitting,
hard exclusion, remote content egress, automatic research write or N7 effects.
"""
import hashlib
import importlib.util
import json
import platform
import statistics
import time
from collections import Counter
from pathlib import Path

import torch
from huggingface_hub import model_info
from transformers import AutoTokenizer, AutoModelForSequenceClassification

SRC=Path(__file__).with_name("synergy-screening-nli.py")
spec=importlib.util.spec_from_file_location("ivory_synergy_previous",SRC)
old=importlib.util.module_from_spec(spec)
spec.loader.exec_module(old)
MODELS={
 "minilm":("cross-encoder/nli-MiniLM2-L6-H768","b95119ce93d3e065de6214e38cd4a97b0f2f2c6d"),
 "deberta":("cross-encoder/nli-deberta-v3-small",None),
}
# All model arms see IDENTICAL hypothesis and source text. Exactly 4 decomposed
# questions (not an NLI assessment of whether a paper merits inclusion).
HYPOTHESES={
 "nudge":"This study investigates a behavioral nudge, reminder, default, peer feedback, or choice architecture meant to change behavior.",
 "provider":"The study targets physicians, nurses, pharmacists, or other healthcare professionals as people whose work behavior may change.",
 "intervention":"This original empirical study evaluates the implementation or observed effects of an intervention intended to change behavior.",
 "clinical":"The relevant intervention is deployed in a clinical or health-care service setting.",
 "compound":old.SCREEN_QUERY,
}
NEW_SALT="ivory-r4-new-nagtegaal-nonoverlap-v1-20260923"
COHORTS=("prior_seen","new_unseen")
CASE_COUNTS=(24,72)
K=(24,48,72)
ARM_NAMES=("rules_score","compound_entailment","decomp_mean","decomp_min",
           "rules_compound","rules_decomp_mean","rules_decomp_min")
SEMANTIC_CASES=[
 ("S01","The interviewee said the office opened at nine.","The office opened at nine according to the interviewee.","entailment"),
 ("S02","The sample included 42 adults and 8 children.","The sample included 50 people.","entailment"),
 ("S03","The authors report no significant difference between the groups.","The authors reported no statistically significant group difference.","entailment"),
 ("S04","The researcher interviewed three clinicians about prescribing.","The researcher interviewed clinicians.","entailment"),
 ("S05","The review screened 96 abstracts.","The review screened abstracts.","entailment"),
 ("S06","Participants could submit responses on paper or online.","Paper was a permitted response method.","entailment"),
 ("S07","Only five out of twenty patients completed follow-up.","All twenty patients completed follow-up.","contradiction"),
 ("S08","The paper reports an increase in waiting times.","The paper reports a decrease in waiting times.","contradiction"),
 ("S09","None of the children attended the second visit.","All children attended the second visit.","contradiction"),
 ("S10","The study was conducted in one hospital.","The study was conducted in three hospitals.","contradiction"),
 ("S11","The authors found no evidence of benefit.","The authors found clear evidence of benefit.","contradiction"),
 ("S12","Exactly 12 of 15 interviews were transcribed.","None of the interviews were transcribed.","contradiction"),
 ("S13","Twelve interviews were recorded in one town.","Every adult in the country was interviewed.","neutral"),
 ("S14","The report covers survey methods used during March.","The trial proved a causal effect.","neutral"),
 ("S15","The sample contains rural primary-care users.","The intervention lowers mortality nationally.","neutral"),
 ("S16","A respondent described a scheduling barrier.","The hospital uses a proprietary scheduling vendor.","neutral"),
 ("S17","A table lists study counts by publication year.","All studies were funded by one agency.","neutral"),
 ("S18","Two clinicians discuss a shared referral process.","All regional clinics implemented it.","neutral"),
]
assert len(SEMANTIC_CASES)==18
assert Counter(x[3] for x in SEMANTIC_CASES)=={"entailment":6,"contradiction":6,"neutral":6}
def sha(s): return hashlib.sha256(s).hexdigest()
def get_sample():
  data,digest=old.raw_source()
  raw,full,skips,totals=old.parse_data(data)
  prior=old.sample(full)
  prior_ids={x["record_id"] for x in prior}
  new=[]
  for label,n in ((1,24),(0,72)):
    xs=[x for x in full if x["title_abstract_label"]==label and x["record_id"] not in prior_ids]
    xs.sort(key=lambda x:(sha((NEW_SALT+"|"+x["record_id"]+"|"+x["text_digest"]).encode()),x["record_id"]))
    new.extend(xs[:n])
  new.sort(key=lambda x:x["record_id"])
  assert len(new)==96 and not prior_ids.intersection(x["record_id"] for x in new)
  assert sum(x["title_abstract_label"] for x in prior)==24
  assert sum(x["title_abstract_label"] for x in new)==24
  return {"prior_seen":prior,"new_unseen":new},{"source_csv_sha256":digest,
    "source_label_totals":dict(totals),"original_rows":len(raw),
    "deduplicated_rows":len(full),"dedup_notes":dict(skips),
    "source_repo":old.SOURCE_REPO,"source_ref":old.SOURCE_REF,
    "source_url":old.SOURCE_URL,
    "cohort_sha256":{name:sha(json.dumps([(r["record_id"],r["text_digest"],r["title_abstract_label"])
      for r in rows],separators=(",",":")).encode()) for name,rows in
      (("prior_seen",prior),("new_unseen",new))}}
def ap_and_top(rows,key,labelkey):
  order=sorted(rows,key=lambda r:(-r[key],r["record_id"]))
  p=sum(r[labelkey] for r in order)
  hits=0;ap=0.
  for i,r in enumerate(order,1):
    if r[labelkey]:hits+=1;ap+=hits/i
  return {"ap":round(ap/p,6) if p else None,
    "top":{str(k):{"found":sum(r[labelkey] for r in order[:k]),
       "missed":p-sum(r[labelkey] for r in order[:k]),
       "recall":round(sum(r[labelkey] for r in order[:k])/p,6) if p else None,
       "precision":round(sum(r[labelkey] for r in order[:k])/k,6)}
       for k in K}}
def ece_authored_synthetic(rows):
  # Top-class ECE here is ONLY against our authored synthetic 3-way pair labels.
  # It says nothing about calibration on human-reviewed scholarly support or
  # truth of historical abstract screening decisions.
  bins=[[] for _ in range(5)]
  for r in rows:
    conf=max(r["distribution"].values())
    bins[min(4,int(conf*5))].append((conf,int(r["predicted"]==r["authored_label"])))
  return round(sum(len(b)/len(rows)*abs(statistics.mean(t[0] for t in b)-statistics.mean(t[1] for t in b))
     for b in bins if b),6)
def nli_infer(model,tokenizer,labelmap,records):
  assert len(records)>0
  data=[]
  start=time.perf_counter()
  for begin in range(0,len(records),12):
    group=records[begin:begin+12]
    packed=tokenizer([x[0][:6500] for x in group],
                     [x[1] for x in group],padding=True,truncation=True,
                     max_length=384,return_tensors="pt")
    with torch.inference_mode():
      prob=torch.softmax(model(**packed).logits,dim=-1).tolist()
    for p in prob:
      assert len(p)==3 and all(0<=x<=1 for x in p)
      data.append({labelmap[i]:float(x) for i,x in enumerate(p)})
  return data,round(time.perf_counter()-start,3)
def run(arm):
  start=time.perf_counter()
  samples,source=get_sample()
  name,revision=MODELS[arm]
  if revision is None:
    info=model_info(name);revision=info.sha
  assert revision and len(revision)==40
  assert model_info(name,revision=revision).sha==revision
  load_t=time.perf_counter()
  tok=AutoTokenizer.from_pretrained(name,revision=revision)
  model=AutoModelForSequenceClassification.from_pretrained(name,revision=revision)
  model.eval()
  labelmap={int(k):str(v).lower() for k,v in model.config.id2label.items()}
  assert set(labelmap.values())=={"contradiction","entailment","neutral"},labelmap
  load_seconds=round(time.perf_counter()-load_t,3)
  scores={}
  total_model_seconds=0
  for cohort,rows in samples.items():
    # Single inference batch across all hypotheses, exact pairing recorded.
    questions=[(r["title"]+"\n"+r["abstract"],HYPOTHESES[k])
      for r in rows for k in HYPOTHESES]
    predictions,duration=nli_infer(model,tok,labelmap,questions)
    assert len(predictions)==len(rows)*len(HYPOTHESES)
    total_model_seconds+=duration
    for i,r in enumerate(rows):
      count,flags=old.rules(r["title"]+"\n"+r["abstract"])
      r["rules_score"]=count
      r["rules_flags"]=flags
      r["nli"]={k:{"distribution_uncalibrated":{a:round(b,8) for a,b in predictions[i*5+j].items()},
                   "predicted_nli_label":max(predictions[i*5+j],key=predictions[i*5+j].get)}
        for j,k in enumerate(HYPOTHESES)}
      ent={k:r["nli"][k]["distribution_uncalibrated"]["entailment"] for k in HYPOTHESES}
      r["compound_entailment"]=ent["compound"]
      r["decomp_mean"]=sum(ent[k] for k in HYPOTHESES if k!="compound")/4
      r["decomp_min"]=min(ent[k] for k in HYPOTHESES if k!="compound")
      r["rules_compound"]=(count+ent["compound"])/5
      r["rules_decomp_mean"]=(count+r["decomp_mean"])/5
      r["rules_decomp_min"]=(count+r["decomp_min"])/5
      r["all_criteria_over_half"]=all(ent[k]>=0.5 for k in HYPOTHESES if k!="compound")
      r["any_criteria_over_half"]=any(ent[k]>=0.5 for k in HYPOTHESES if k!="compound")
      r["rules_candidate"]=count>=3
      r["compound_candidate"]=ent["compound"]>=0.5
      r["decomp_candidate"]=r["all_criteria_over_half"]
      r["combined_candidate"]=r["rules_candidate"] or r["decomp_candidate"]
    scores[cohort]={
      "primary_historical_title_abstract":{k:ap_and_top(rows,k,"title_abstract_label") for k in ARM_NAMES},
      "secondary_historical_final_inclusion":{k:ap_and_top(rows,k,"final_included") for k in ARM_NAMES},
      "historical_title_abstract_positive_count":sum(r["title_abstract_label"] for r in rows),
      "historical_final_included_count":sum(r["final_included"] for r in rows),
      "candidate_diagnostics":{k:{"count":sum(bool(r[k]) for r in rows),
           "screen_positives_found":sum(r["title_abstract_label"] for r in rows if r[k]),
           "screen_positives_not_prioritized":sum(r["title_abstract_label"] for r in rows if not r[k])}
           for k in ("rules_candidate","compound_candidate","decomp_candidate","combined_candidate",
                     "all_criteria_over_half","any_criteria_over_half")},
      "criterion_distribution":{k:{
         "mean_entailment":round(statistics.mean(r["nli"][k]["distribution_uncalibrated"]["entailment"] for r in rows),6),
         "max_entailment":round(max(r["nli"][k]["distribution_uncalibrated"]["entailment"] for r in rows),6),
         "over_half":sum(r["nli"][k]["distribution_uncalibrated"]["entailment"]>=0.5 for r in rows)}
         for k in HYPOTHESES}}
  synthetic_input=[(p,h) for _,p,h,_ in SEMANTIC_CASES]
  sem_pred,sem_duration=nli_infer(model,tok,labelmap,synthetic_input)
  synthetic=[]
  for (id,p,h,label),pred in zip(SEMANTIC_CASES,sem_pred):
    choice=max(pred,key=pred.get)
    synthetic.append({"id":id,"authored_label":label,"predicted":choice,
        "correct_authored":choice==label,
        "distribution":{k:round(v,8) for k,v in pred.items()}})
  sem_class={k:{"total":sum(s["authored_label"]==k for s in synthetic),
     "matched":sum(s["authored_label"]==k and s["correct_authored"] for s in synthetic)}
     for k in ("entailment","contradiction","neutral")}
  assert all(v["total"]==6 for v in sem_class.values())
  schema_keys=("record_id","text_digest","title_abstract_label","final_included","rules_score",
    "rules_flags","nli","compound_entailment","decomp_mean","decomp_min","rules_compound",
    "rules_decomp_mean","rules_decomp_min","rules_candidate","compound_candidate",
    "decomp_candidate","combined_candidate")
  rows_pub={cohort:[{k:r[k] for k in schema_keys} for r in rs] for cohort,rs in samples.items()}
  # Synthetic gate is independent from actual archived N1 bridge, no fake model
  # confidence or rights bypass; the separate Node tests enforce no dispatch.
  return {"schema":"ivory-r4-empirical-qualification/1",
    "status":"bounded real public review-label metrics + synthetic NLI class diagnostics; NOT full qualification",
    "model":{"arm":arm,"id":name,"revision":revision,"labelmap":labelmap,
       "parameter_class":"82.1M" if arm=="minilm" else "141.9M"},
    "source":source,
    "selection":{"prior":"historical prior-seen 96; previously scored by compound MiniLM",
        "new":"nonoverlapping unseen 96, frozen before this run, still same source review",
        "salt":NEW_SALT,"stratified_positive_negative":[24,72],
        "sample_prevalence_not_population_prevalence":True},
    "questions":HYPOTHESES,
    "questions_sha256":sha(json.dumps(HYPOTHESES,sort_keys=True,separators=(",",":")).encode()),
    "rules_definition":"exact unchanged lexical rules from synergy-screening-nli.py",
    "ranks":scores,"synthetic_nli":{"case_count":18,"case_sha256":sha(json.dumps(SEMANTIC_CASES,ensure_ascii=False,separators=(",",":")).encode()),
       "per_class_authored":sem_class,"matches_authored":sum(x["correct_authored"] for x in synthetic),
       "top_class_ece_authored_only":ece_authored_synthetic(synthetic),
       "rows":synthetic},
    "perf":{"model_loading_seconds":load_seconds,"cohort_inference_seconds":total_model_seconds,
       "synthetic_inference_seconds":sem_duration,
       "total_seconds_including_data_download":round(time.perf_counter()-start,3),
       "total_cohort_pairs":2*96*len(HYPOTHESES)},
    "environment":{"platform":platform.platform(),"python":platform.python_version(),"torch":torch.__version__},
    "per_case_records_no_full_text":rows_pub,
    "limitations":["Historical published title+abstract labels are real, but case-level independent two-reader annotations not verified.",
      "Two cohorts do not represent independent reviews or topic-generalization; selected from same historical study.",
      "Stratified 24/72 prevalence differs from full 391/1627 pool; do not report population accuracy.",
      "The historical prior-seen cohort was observed in an earlier study; novel cohort is a distinct nonoverlapping first-seen sample.",
      "Published historical title+abstract binary labels are not NLI semantic support labels or canonical Ivory research judgments.",
      "Final inclusion after full text is separate secondary outcome, and no text-only predictor may claim to verify it.",
      "Eighteen synthetic NLI pairs and authored expected classes, not scholarly human-reviewed calibration or real disagreements.",
      "Top-class ECE is synthetic authored classification only; cannot be mapped into probabilities of scholarly truth.",
      "No thresholds fitted, no hard paper exclusion, no canonical evidence write, no N7 acceptance.",
      "Original N1 archived context unavailable: actual bridge must abstain; this public-data pipeline is NOT an authenticated N1-to-model composition.",
      "Local GitHub worker CPU timing is not the user's workstation and HF Jobs returned 402 earlier.",
      "DeBERTa and MiniLM both run publicly downloaded locally; private research never transmitted."]}
if __name__=="__main__":
  import argparse
  p=argparse.ArgumentParser()
  p.add_argument("--model",choices=MODELS,required=True)
  args=p.parse_args()
  print("IVORY_R4_QUALIFICATION="+json.dumps(run(args.model),sort_keys=True))
