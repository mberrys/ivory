"""Produce one genuinely blinded R4 human-review packet from real public records.

Selection deliberately avoids both previously model-observed 96-case cohorts.
The source's historical decisions remain in the original, hashed upstream CSV,
NOT in either reviewer CSV. This makes a packet, not two human annotations.
No title/abstract text is redistributed; reviewers access authorized originals.
"""
import csv
import hashlib
import io
import json
import os
from pathlib import Path
import urllib.request

SOURCE="https://raw.githubusercontent.com/asreview/systematic-review-datasets/metadata-v1-final/datasets/Nagtegaal_2019/output/Nagtegaal_2019.csv"
SOURCE_SHA="abfbdb973aa125f26ce872a5193c931d0690f7fe2e1fb75551de9c0acecd200f"
OLD_SALT="ivory-nli-nagtegaal-v1-preregistered-20260923"
NEW_SALT="ivory-r4-new-nagtegaal-nonoverlap-v1-20260923"
HUMAN_SALT="ivory-r4-independent-human-holdout-v1-20260923"
PACKET_N=120
def sha(raw):return hashlib.sha256(raw).hexdigest()
def pull():
    with urllib.request.urlopen(urllib.request.Request(SOURCE,headers={
      "User-Agent":"Ivory-public-human-reference-packet/1"}),timeout=60) as reply:
      data=reply.read(15_000_001)
    if sha(data)!=SOURCE_SHA:raise RuntimeError("published_source_bytes_changed_stop")
    reader=csv.DictReader(io.StringIO(data.decode("utf-8-sig")))
    required={"record_id","title","abstract","label_abstract_screening","label_included"}
    if not required.issubset(reader.fieldnames or []):raise RuntimeError("unexpected_source_schema")
    groups={}
    for r in reader:
      title=r["title"].strip()
      abstract=r["abstract"].strip()
      id=r["record_id"].strip()
      labels=(r["label_abstract_screening"].strip(),r["label_included"].strip())
      if not id or not (title or abstract) or not set(labels).issubset({"0","1"}):continue
      groupkey=sha(json.dumps([title.casefold(),abstract.casefold()],
                    ensure_ascii=False,separators=(",",":")).encode())
      row={"id":id,"textsha":sha((title+"\n"+abstract).encode()),"labels":labels}
      groups.setdefault(groupkey,[]).append(row)
    result=[]
    for group in groups.values():
      if len(set(x["labels"] for x in group))==1:
        result.append(sorted(group,key=lambda r:r["id"])[0])
    return result
def already_seen(rows):
  bylabel={label:[r for r in rows if r["labels"][0]==label] for label in ("1","0")}
  def sort_key(salt,r):return (sha((salt+"|"+r["id"]+"|"+r["textsha"]).encode()),r["id"])
  previous=[r for label,n in [("1",24),("0",72)] for r in
    sorted(bylabel[label],key=lambda x:sort_key(OLD_SALT,x))[:n]]
  seen={r["id"] for r in previous}
  nxt=[r for label,n in [("1",24),("0",72)] for r in
    sorted([x for x in bylabel[label] if x["id"] not in seen],
      key=lambda x:sort_key(NEW_SALT,x))[:n]]
  seen.update(x["id"] for x in nxt)
  if len(seen)!=192:raise RuntimeError("prior_cohort_identity_changed")
  return seen
def main():
  allrows=pull()
  seen=already_seen(allrows)
  rest=[r for r in allrows if r["id"] not in seen]
  rest.sort(key=lambda r:(sha((HUMAN_SALT+"|"+r["id"]+"|"+r["textsha"]).encode()),r["id"]))
  chosen=rest[:PACKET_N]
  if len(chosen)!=PACKET_N:raise RuntimeError("too_few_holdout_records")
  dest=Path(os.environ.get("IVORY_R4_REVIEW_PACKET_DIR","r4-human-worklist"))
  dest.mkdir(parents=True,exist_ok=True)
  columns=["record_id","text_sha256","screen_decision","reason",
           "context_adequate","reviewer_id","reviewer_role","annotated_at"]
  for name in ("A","B"):
    with (dest/("reviewer_"+name+".csv")).open("w",newline="",encoding="utf8") as fp:
      writer=csv.DictWriter(fp,fieldnames=columns);writer.writeheader()
      writer.writerows([{"record_id":r["id"],"text_sha256":r["textsha"]} for r in chosen])
  with (dest/"instructions.md").open("w",encoding="utf8") as fp:
    fp.write("# R4 independent human review packet — not yet annotated\n\n"
     "Independent researcher A and B must each use ONLY their own file; do not share answers.\n"
     "Look up the exact record_id in the cited public source if usage rights permit.\n"
     "Task: historical review's title/abstract eligibility for an original intervention "
     "nudging healthcare professionals toward evidence-based practice; mark "
     "screen_decision include/exclude/uncertain; state reason and context_adequate.\n"
     "Each reviewer must enter their own reviewer_id/role/time. Do not populate them with model identities.\n"
     "A third qualified researcher adjudicates disagreements only AFTER both sealed decisions.\n"
     "Do NOT equate author historical final inclusion after full-text with title/abstract verdict.\n"
     "No text or source label is bundled. Record-level published source votes are NOT exported.\n"
     "This packet has no human reviews or adjudication until real researchers provide them.\n")
  output={"schema":"ivory-r4-blinded-human-review-worklist/1",
      "status":"packets prepared, no reviewers have supplied decisions",
      "source":SOURCE,"source_sha256":SOURCE_SHA,"new_salt":HUMAN_SALT,
      "previous_model_observed_excluded":len(seen),"holdout_records":len(chosen),
      "membership_digest":sha(json.dumps(sorted((r["id"],r["textsha"]) for r in chosen),
            separators=(",",":")).encode()),
      "source_text_copied":False,"source_labels_exported":False,
      "actual_independent_reviewers":0,"adjudications":0,
      "limitations":[
        "This is a frozen blind reviewer WORKLIST, not yet a content-complete review packet or an independent review.",
        "A rights-authorized curator must present label-free title/abstract text separately; the upstream source URL exposes historic labels and must NEVER be shown to reviewers.",
        "Two reviewers must genuinely annotate; historical consensus labels or model decisions cannot fill their columns."]}
  (dest/"manifest.json").write_text(json.dumps(output,indent=2,sort_keys=True),encoding="utf8")
  assert all("label_included" not in (dest/("reviewer_"+name+".csv")).read_text()
      and "label_abstract_screening" not in (dest/("reviewer_"+name+".csv")).read_text()
      and SOURCE not in (dest/("reviewer_"+name+".csv")).read_text()
      and "source_url" not in (dest/("reviewer_"+name+".csv")).read_text()
      for name in ("A","B"))
  print("IVORY_R4_REVIEW_PACKET="+json.dumps(output,sort_keys=True))
if __name__=="__main__":main()
