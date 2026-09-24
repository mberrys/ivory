// Full R4 isolated *real local model* proof on synthetic complete exact basis.
// This does NOT authenticate an archived N1 complete basis or implement V5 Core/N7.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSemanticBasis, semanticRequest, digest, semanticLabels } from './semantic.mjs';
import { ExperimentalReviewJournal } from './r4-review-receipts.mjs';

const TRUST='trusted-core-test-harness';
const SHA='b95119ce93d3e065de6214e38cd4a97b0f2f2c6d';
const projectId='r4-real-local-model-synthetic';
const ref=(name,rev='r1')=>({projectId,objectId:name,revisionId:rev});
function make({incomplete=false}={}) {
  const quote='An adult interview participant reported that advising made the next step visible.';
  const text='Context: a single local interview, not a national study. '+quote+
    ' The researcher did not measure national graduation rates.';
  const source={kind:'source',ref:ref('source'),text,
    contentDigest:digest(text),rights:'local-only'};
  const fragment={kind:'fragment',ref:ref('fragment'),sourceRef:source.ref,
    representationDigest:source.contentDigest,
    selector:{start:text.indexOf(quote),end:text.indexOf(quote)+quote.length,quote}};
  const statement={kind:'statement',ref:ref('claim'),
    text:'One participant said advising made the next step visible.'};
  const link={kind:'evidenceLink',ref:ref('link'),claimRef:statement.ref,
    role:'supports',fragmentRefs:[fragment.ref]};
  for(const obj of [source,fragment,statement,link]){
    const {revisionDigest,...body}=obj;obj.revisionDigest=digest(body);
  }
  const members=[source,fragment,statement,link].map(x=>({ref:x.ref,revisionDigest:x.revisionDigest}));
  const snapshot={projectId,snapshotId:'exact-synthetic-s1',
    manifestDigest:digest(members),members};
  const compiled=compileSemanticBasis({snapshot,sources:[source],fragments:[fragment],
    statement,link,completeness:incomplete?
    {complete:false,omissions:['archived-n1-context-unavailable-simulated']}:
    {complete:true,omissions:[]}});
  const request=semanticRequest(compiled,{purpose:'citation-support',
    policy:{id:'r4-local-nli-experiment',version:'1'},
    questionSet:{id:'n1-claim-to-quote',version:'1',options:[...semanticLabels]}});
  return {compiled,request,text,quote};
}
function liveAdapter() {
  let called=0,metrics=null,modelLimit=null;
  return {id:'cross-encoder/nli-MiniLM2-L6-H768',version:SHA,mode:'live',remote:false,
    calls:()=>called,metrics:()=>metrics,modelLimit:()=>modelLimit,
    evaluate(state,q) {
      called++;
      const premise=state.fragments.map(f=>f.before+f.quote+f.after).join('\n');
      const input={questionId:q.id,premise,hypothesis:state.statement.wording};
      const result=spawnSync('python',
        [join(process.cwd(),'experiments/jev-seam/r4-local-nli-adapter.py')],
        {encoding:'utf8',input:JSON.stringify(input),timeout:120000,
          maxBuffer:64_000,env:{...process.env,HF_HUB_DISABLE_TELEMETRY:'1',
            TOKENIZERS_PARALLELISM:'false'}});
      if(result.error||result.status!==0)
        throw new Error('local-model-process-failed-closed:'+String(result.status));
      const output=JSON.parse(result.stdout);
      assert.equal(output.metrics.model_revision,SHA);
      assert.equal(output.metrics.model,this.id);
      assert.deepEqual(Object.keys(output.probabilities).sort(),
        [...semanticLabels].sort());
      metrics=output.metrics;modelLimit=output.mapping_limit;
      return {questionId:output.questionId,probabilities:output.probabilities};
    },
  };
}
const work=mkdtempSync(join(tmpdir(),'ivory-r4-local-nli-'));
try{
  const file=join(work,'proposal-receipts.jsonl');
  const j=new ExperimentalReviewJournal(file);
  const good=make(),bad=make({incomplete:true});
  j.recordTrustedClaimHead(good.compiled.state.statement.ref,TRUST);
  assert.throws(()=>j.grant({grantId:'bad',compiled:bad.compiled,
    researcher:'synthetic-researcher'},TRUST),/grant_requires_complete_exact_basis/);
  j.grant({grantId:'local-model-g1',compiled:good.compiled,
    researcher:'synthetic-researcher'},TRUST);
  const model=liveAdapter();
  const observed=await j.assess({compiled:good.compiled,request:good.request,
    adapter:model,grantId:'local-model-g1'});
  assert.equal(model.calls(),1);
  assert.notEqual(observed.body.observation.outcome,'invalid');
  assert.notEqual(observed.body.observation.outcome,'unavailable');
  assert.ok(['answered','abstained'].includes(observed.body.observation.outcome));
  assert.equal(observed.body.evaluator.mode,'live');
  assert.equal(observed.body.evaluator.evidenceClass,'local-live-model');
  assert.equal(observed.body.evaluator.version,SHA);
  assert.equal(observed.body.questionSet.id,'n1-claim-to-quote');
  assert.equal(observed.body.policy.id,'r4-local-nli-experiment');
  assert.equal(model.metrics().input_tokens>0,true);
  assert.equal(model.metrics().input_tokens<=384,true);
  assert.equal(model.modelLimit().startsWith('3-way NLI'),true);
  const recovered=new ExperimentalReviewJournal(file);
  assert.deepEqual(recovered.readAssessment(observed.id),observed);
  assert.deepEqual(recovered.readers().cli.readAssessment(observed.id),
    recovered.readers().studio.readAssessment(observed.id));
  assert.equal(readFileSync(file,'utf8').includes(good.quote),false);
  assert.equal(readFileSync(file,'utf8').includes(good.compiled.state.statement.wording),false);
  const replay=await recovered.assess({compiled:good.compiled,request:good.request,
    adapter:model,grantId:'local-model-g1'});
  assert.deepEqual(replay,observed);
  assert.equal(model.calls(),1);
  assert.equal(recovered.stats().reviews,0); // Real model did NOT impersonate researcher.
  assert.equal(Object.hasOwn(observed.body,'acceptedResearchRevision'),false);
  const report={
    schema:'ivory-r4-local-nli-proof/1',
    evidenceClass:'real local MiniLM inference, wholly synthetic complete basis, no real N1 authorized model call',
    model: model.id,model_revision:SHA,
    source_fixture_digest:digest(good.text),
    state_digest:good.compiled.stateDigest,
    exact_snapshot:good.compiled.state.snapshot,
    request_digest:good.request.requestDigest,
    observation_receipt_id:observed.id,
    observation_outcome:observed.body.observation.outcome,
    observation_choice:observed.body.observation.choice,
    raw_unqualified_semantic_distribution:observed.body.observation.distribution,
    model_metrics:model.metrics(),nli_mapping_limit:model.modelLimit(),
    persistent_replay_equal:true,client_read_parity:true,
    model_inference_calls:1,mandatory_incomplete_basis_pre_dispatch:true,
    human_decisions:0,canonical_research_writes:0,
    caveats:[
      'The complete basis was constructed and checked in an isolated synthetic fixture; not authenticated by V5 Core.',
      'Archived N1 real citation has context unavailable; it was not dispatched to this model.',
      'No N7 real capability or verified human reviewer; synthetic trusted caller does not authenticate identities.',
      'Local Hugging Face model may require PUBLIC weight download; no research bytes transmitted to HF.',
      'Pytorch NLI scores uncalibrated; neutral maps to abstain, supported is a PROPOSAL not academic endorsement.',
      'JSONL fsync and replay are not atomic N2 CAS plus SQL transactional guarantees.',
      'No target user PC GPU or offline installer was measured.'],
  };
  console.log('IVORY_R4_LOCAL_PROOF='+JSON.stringify(report));
}finally{rmSync(work,{recursive:true,force:true})}
