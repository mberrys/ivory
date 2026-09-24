import test from 'node:test';
import assert from 'node:assert/strict';
import { auditIndependentHumanReferences } from './r4-human-reference.mjs';
const HEX='a'.repeat(64),DOI='10.17632/4bgt2p5hrd.1';
const vote=(reviewerId,label,assistance='none')=>({
  reviewerId,label,assistance,sourceDigest:HEX,
  origin:'published-human-review',independenceAttestation:'publisher-recorded-independent'});
const bundle=(a='include',b='exclude',license='CC BY-NC 4.0')=>({
  source:{kind:'published-record-votes',doi:DOI,datasetSha256:HEX,license},
  records:[{recordId:'synthetic-test-only',textSha256:HEX,
    reviewerA:vote('human-A',a),reviewerB:vote('human-B',b),
    adjudication:{label:a===b?a:'unresolved'}}]});
test('R4 human reference cannot be inferred from one consensus duplicated as two',()=>{
  const b=bundle('include','include','CC0');
  b.records[0].reviewerB.reviewerId='human-A';
  assert.throws(()=>auditIndependentHumanReferences(b),/one_reviewer_cannot_count_twice/);
});
test('R4 requires published individual votes, rejects synthetic or model generated stand-ins',()=>{
  const b=bundle('include','exclude','CC0');
  b.records[0].reviewerB.origin='model-authored';
  assert.throws(()=>auditIndependentHumanReferences(b),/synthetic_or_model_vote_not_independent_human/);
  b.records[0].reviewerB.origin='published-human-review';
  b.records[0].reviewerB.independenceAttestation='unknown';
  assert.throws(()=>auditIndependentHumanReferences(b),/no_independence_attestation/);
});
test('R4 preserved unresolved disagreements and does not invent adjudication',()=>{
  const b=bundle('include','exclude','CC0');
  const x=auditIndependentHumanReferences(b);
  assert.equal(x.counts.disagreements,1);
  assert.equal(x.counts.unresolved,1);
  assert.equal(x.rows[0].reviewerA.label,'include');
  assert.equal(x.rows[0].reviewerB.label,'exclude');
  assert.equal(x.rows[0].adjudication.label,'unresolved');
  b.records[0].adjudication={label:'include'};
  assert.throws(()=>auditIndependentHumanReferences(b),/disagreement_without_adjudicator/);
  b.records[0].adjudication={label:'include',resolvedBy:'independent-human-adjudicator'};
  assert.equal(auditIndependentHumanReferences(b).counts.unresolved,0);
});
test('R4 CC BY-NC noncommercial research cannot silently become Ivory product-use rights',()=>{
  const b=bundle();
  assert.throws(()=>auditIndependentHumanReferences(b),/noncommercial_dataset_not_product_authorized/);
  assert.equal(auditIndependentHumanReferences(b,{allowNoncommercialResearch:true}).source.license,'CC BY-NC 4.0');
});
test('R4 actual reviewer agreement class support distinct from authored NLI labels',()=>{
  const b=bundle('include','include','CC0');
  const x=auditIndependentHumanReferences(b);
  assert.equal(x.counts.agreements,1);
  assert.equal(x.counts.disagreements,0);
  assert.equal(x.counts.cohens_kappa,null);
  assert.equal(x.counts.raw_binary_agreement,1);
  assert.equal(x.rows[0].recordId,'synthetic-test-only');
});
test('R4 mismatched source text, unknown reviewer vote and duplicate rows are rejected',()=>{
  const b=bundle('include','exclude','CC0');
  b.records[0].reviewerA.sourceDigest='b'.repeat(64);
  assert.throws(()=>auditIndependentHumanReferences(b),/reviewer_source_digest_mismatch/);
  b.records[0].reviewerA.sourceDigest=HEX;b.records[0].reviewerA.label='probably';
  assert.throws(()=>auditIndependentHumanReferences(b),/invalid_individual_vote/);
  b.records[0].reviewerA.label='include';b.records.push(structuredClone(b.records[0]));
  assert.throws(()=>auditIndependentHumanReferences(b),/duplicate_or_invalid_record/);
});
