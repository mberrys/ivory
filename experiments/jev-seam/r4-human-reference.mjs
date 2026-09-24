// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// R4 human reference evidence adapter: NEVER manufactures an annotator, fills
// missing decisions, equates model labels with reviewers or infers blinding.
// Source terms/consent and independent vote provenance require external proof.
import { digest } from './semantic.mjs';

const bad = reason => {throw new Error(reason)};
const str=(value,name)=>{
  if(typeof value!=='string'||!value.trim()||value.length>256)bad('invalid_'+name);
  return value;
};
const clone=structuredClone;
const LABELS=new Set(['include','exclude','uncertain']);
function vote(row,side,sourceDigest){
  const r=row[side];
  if(!r||typeof r!=='object'||Array.isArray(r))bad('missing_individual_vote_'+side);
  const actor=str(r.reviewerId,side+'_reviewer');
  const choice=str(r.label,side+'_label');
  if(!LABELS.has(choice))bad('invalid_individual_vote');
  if(r.sourceDigest!==sourceDigest)bad('reviewer_source_digest_mismatch');
  const provenance=str(r.origin,side+'_origin');
  if(!['published-human-review','documented-independent-human-review'].includes(provenance))
    bad('synthetic_or_model_vote_not_independent_human');
  if(r.assistance!=='none'&&r.assistance!=='llm-assisted')
    bad('review_assistance_must_be_disclosed');
  if(!r.independenceAttestation||r.independenceAttestation!=='publisher-recorded-independent')
    bad('no_independence_attestation');
  return {reviewerId:actor,label:choice,origin:provenance,
    assistance:r.assistance,sourceDigest:r.sourceDigest,
    independenceAttestation:r.independenceAttestation};
}
/** Audit schema, not an independent external verification of publishers' claims. */
export function auditIndependentHumanReferences(bundle,{allowNoncommercialResearch=false}={}){
  if(!bundle||typeof bundle!=='object')bad('missing_bundle');
  const src=bundle.source;
  if(!src||src.kind!=='published-record-votes')bad('must_be_published_per_reviewer_votes');
  const publication=str(src.doi,'doi'),datasetSha=str(src.datasetSha256,'dataset_sha');
  if(!/^[a-f0-9]{64}$/.test(datasetSha))bad('invalid_source_digest');
  if(!['CC0','CC BY 4.0','CC BY-NC 4.0'].includes(src.license))bad('review_license_not_established');
  if(src.license==='CC BY-NC 4.0'&&!allowNoncommercialResearch)
    bad('noncommercial_dataset_not_product_authorized');
  if(!Array.isArray(bundle.records)||!bundle.records.length||bundle.records.length>10000)
    bad('records_missing_or_unbounded');
  const seen=new Set(),out=[];
  for(const item of bundle.records){
    const id=str(item.recordId,'record_id'),textSha=str(item.textSha256,'text_sha');
    if(!/^[a-f0-9]{64}$/.test(textSha)||seen.has(id))bad('duplicate_or_invalid_record');
    seen.add(id);
    const a=vote(item,'reviewerA',textSha),b=vote(item,'reviewerB',textSha);
    if(a.reviewerId===b.reviewerId)bad('one_reviewer_cannot_count_twice');
    const consensus=item.adjudication;
    if(!consensus||!['include','exclude','uncertain','unresolved'].includes(consensus.label))
      bad('missing_explicit_adjudication');
    if(a.label!==b.label&&consensus.label!=='unresolved'&&!consensus.resolvedBy)
      bad('disagreement_without_adjudicator');
    if(consensus.label==='unresolved'&&a.label===b.label)bad('unresolved_without_disagreement');
    out.push({recordId:id,textSha256:textSha,
      reviewerA:a,reviewerB:b,
      disagreement:a.label!==b.label,
      adjudication:{label:consensus.label,
        resolvedBy:consensus.resolvedBy?str(consensus.resolvedBy,'adjudicator'):null}});
  }
  const agreements=out.filter(r=>!r.disagreement);
  const used=out.filter(r=>r.reviewerA.label!=='uncertain'&&r.reviewerB.label!=='uncertain');
  const choices=['include','exclude'];
  const observed=used.length?used.filter(r=>r.reviewerA.label===r.reviewerB.label).length/used.length:null;
  const chance=used.length?choices.reduce((sum,key)=>sum+
    used.filter(r=>r.reviewerA.label===key).length/used.length*
    used.filter(r=>r.reviewerB.label===key).length/used.length,0):null;
  const kappa=used.length&&1-chance>0?(observed-chance)/(1-chance):null;
  const evidence={schema:'ivory-r4-human-reference-audit/1',
    source:{kind:src.kind,doi:publication,datasetSha256:datasetSha,license:src.license},
    counts:{records:out.length,agreements:agreements.length,disagreements:out.length-agreements.length,
      binary_votes_used_for_kappa:used.length,raw_binary_agreement:observed,cohens_kappa:kappa,
      unresolved:out.filter(r=>r.adjudication.label==='unresolved').length},
    rows:out,limitations:[
      'This validates the structure and retained distinct reviewer identities, not external authentication or actual blinding.',
      'Agreement is about screening votes, not NLI entailment or claim-to-fragment support.',
      'Assisted and traditional reviewers are separately labeled, not pooled silently.',
      'CC BY-NC data remain research-only; no product license is inferred.']};
  return {...evidence,evidenceDigest:digest(evidence)};
}
