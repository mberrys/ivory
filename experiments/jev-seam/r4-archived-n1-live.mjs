// R4 archive *reference-kernel* complete-basis composition, NOT V5 production.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileSemanticBasis, semanticRequest, semanticLabels, digest } from './semantic.mjs';
import { ExperimentalReviewJournal } from './r4-review-receipts.mjs';

const TRUST='trusted-core-test-harness';
const SHA='b95119ce93d3e065de6214e38cd4a97b0f2f2c6d';
const modulePath=join(process.cwd(),'.audit','archive','packages',
  'ivory-tower-research-kernel','lib','node','index.js');
const { ResearchKernel, buildAdvisingAgencyFixture, createResearchClients }=
  await import(pathToFileURL(modulePath).href);
const archivedSourceHead='bfcb283c4fe32b64b67a325f8f55aca08314296f';
const quote='Maya said advising made the next step visible.';

// First, prove the ORIGINAL archive golden fixture remains ineligible.
const historic=buildAdvisingAgencyFixture();
const historicReceipt=historic.kernel.verifyCitation(historic.fragment);
assert.equal(historicReceipt.status,'BLOCKED');
assert.equal(historicReceipt.checks.context,'unavailable');

// Build a DIFFERENT synthetic source inside the real archive N1 reference kernel.
// Full single-line exact source=artifact span permits a mechanically proven
// not-applicable context state; never fake or mutate the original N1 trace.
const kernel=new ResearchKernel('ivory-r4-archive-complete-synthetic');
const source=kernel.admitSource({name:'R4 exact complete public synthetic interview',
  bytes:quote,actor:'Maya'});
const artifact=kernel.admitArtifact({key:'r4-retained-equal-output',
  sourceRefs:[source],output:quote,actor:'Maya'});
const fragment=kernel.createFragment({sourceRef:source,artifactRef:artifact,
  selector:{kind:'text',start:0,end:quote.length,quote},
  context:{state:'not-applicable',basis:'no-material-structure',
    reason:'full-span single-line original identical to retained artifact'},
  actor:'Maya',fragmentKey:'exact-r4-full-span'});
const claim=kernel.createClaim({key:'r4-quote-claim',
  text:'Maya said advising made the next step visible.',author:'Maya',status:'proposed'});
const link=kernel.createEvidenceLink({key:'r4-exact-link',
  claimRef:claim,targets:[fragment],role:'supports',
  rationale:'Citation is mechanically exact, interpretation remains distinct.',
  linkAuthor:'Maya'});
const snapshot=kernel.freezeSnapshot({label:'R4 exact full context synthetic',
  researcher:'Maya',selected:[source,artifact],context:[fragment,claim,link],
  createdAt:'2026-09-23T12:00:00.000Z'});
const receipt=kernel.verifyCitation(fragment);
assert.equal(receipt.status,'EXACT');
assert.equal(receipt.checks.context,'not-applicable');
assert.equal(receipt.checks.selectorBytes,true);
assert.equal(receipt.checks.representationDigest,true);
assert.equal(receipt.semanticSupport,'not-assessed');
const archivedSnapshotBefore=kernel.getSnapshot(snapshot.snapshotId);
const original=kernel.getRevision(fragment);
assert.equal(original.payload.context.state,'not-applicable');
assert.equal(kernel.resolveCitation(fragment,snapshot.snapshotId).quote,quote);
for(const exact of [source,fragment,claim,link]){
  const originalRevision=kernel.getRevision(exact);
  assert.ok(snapshot.manifest.members.some(m=>
    m.ref.projectId===exact.projectId &&m.ref.objectId===exact.objectId&&
    m.ref.revisionId===exact.revisionId&&m.revisionDigest===originalRevision.digest));
}
const sourceObj={kind:'source',ref:source,contentDigest:digest(quote),text:quote,
  rights:'local-only'};
const fragmentObj={kind:'fragment',ref:fragment,sourceRef:source,
  representationDigest:digest(quote),
  selector:{start:0,end:quote.length,quote}};
const statementObj={kind:'statement',ref:claim,
  text:kernel.getRevision(claim).payload.text};
const linkObj={kind:'evidenceLink',ref:link,claimRef:claim,
  fragmentRefs:[fragment],role:'supports'};
const records=[sourceObj,fragmentObj,statementObj,linkObj];
for(const record of records){const {revisionDigest,...body}=record;record.revisionDigest=digest(body)}
const members=records.map(record=>({ref:structuredClone(record.ref),
  revisionDigest:record.revisionDigest}));
const projectedSnapshot={projectId:kernel.projectId,snapshotId:snapshot.snapshotId,
  members,manifestDigest:digest(members)};
const compiled=compileSemanticBasis({snapshot:projectedSnapshot,
  sources:[sourceObj],fragments:[fragmentObj],statement:statementObj,
  link:linkObj,completeness:receipt.status==='EXACT' &&
    ['exact','not-applicable'].includes(receipt.checks.context)?
    {complete:true,omissions:[]}:
    {complete:false,omissions:['archive-mechanical-context-'+receipt.checks.context]}});
assert.equal(compiled.state.completeness.complete,true);
const request=semanticRequest(compiled,{purpose:'citation-support',
  policy:{id:'r4-archive-mechanical-receipt',version:'1'},
  questionSet:{id:'claim-to-exact-archived-quote',version:'1',
    options:[...semanticLabels]}});
function localAdapter(){
  let count=0,metrics=null;
  return {id:'cross-encoder/nli-MiniLM2-L6-H768',version:SHA,
    mode:'live',remote:false,calls:()=>count,metrics:()=>metrics,
    evaluate(state,q){
      count++;
      const input={questionId:q.id,
        premise:state.fragments.map(f=>f.before+f.quote+f.after).join('\n'),
        hypothesis:state.statement.wording};
      const p=spawnSync('python',
        [join(process.cwd(),'experiments/jev-seam/r4-local-nli-adapter.py')],
        {encoding:'utf8',input:JSON.stringify(input),
          timeout:120000,maxBuffer:64000,env:{...process.env,
          HF_HUB_DISABLE_TELEMETRY:'1',TOKENIZERS_PARALLELISM:'false'}});
      if(p.error||p.status!==0)throw new Error('actual_local_model_failed_closed:'+p.status);
      const result=JSON.parse(p.stdout);
      assert.equal(result.metrics.model_revision,SHA);
      assert.equal(result.mapping_limit.startsWith('3-way NLI'),true);
      metrics=result.metrics;
      return {questionId:result.questionId,probabilities:result.probabilities};
    }};
}
const root=mkdtempSync(join(tmpdir(),'ivory-r4-archive-n1-'));
try{
  const path=join(root,'observations.jsonl');
  const j=new ExperimentalReviewJournal(path);
  j.recordTrustedClaimHead(claim,TRUST);
  j.grant({grantId:'n1-archive-exact-synthetic-g1',compiled,
    researcher:'synthetic-reference-kernel-researcher'},TRUST);
  const adapter=localAdapter();
  const observed=await j.assess({compiled,request,adapter,
    grantId:'n1-archive-exact-synthetic-g1'});
  assert.ok(['answered','abstained'].includes(observed.body.observation.outcome));
  assert.equal(adapter.calls(),1);
  assert.equal(observed.body.evaluator.mode,'live');
  assert.equal(observed.body.observation.limits.includes('not-a-canonical-write'),true);
  assert.equal(kernel.getSnapshot(snapshot.snapshotId).digest,archivedSnapshotBefore.digest);
  assert.equal(kernel.verifyCitation(fragment).semanticSupport,'not-assessed');
  const archivedReaders=createResearchClients(kernel);
  assert.deepEqual(archivedReaders.cli.explainClaim(snapshot.snapshotId,claim),
    archivedReaders.studio.explainClaim(snapshot.snapshotId,claim));
  const reopened=new ExperimentalReviewJournal(path);
  assert.deepEqual(reopened.readAssessment(observed.id),observed);
  assert.deepEqual(reopened.readers().cli.readAssessment(observed.id),
    reopened.readers().studio.readAssessment(observed.id));
  const noDuplicate=await reopened.assess({compiled,request,adapter,
    grantId:'n1-archive-exact-synthetic-g1'});
  assert.deepEqual(noDuplicate,observed);
  assert.equal(adapter.calls(),1);
  assert.equal(readFileSync(path,'utf8').includes(quote),false);
  assert.equal(readFileSync(path,'utf8').includes(statementObj.text),false);
  assert.equal(reopened.stats().reviews,0);
  const report={schema:'ivory-r4-real-archived-n1-local-nli/1',
    status:'real archived N1 reference kernel verified NEW synthetic complete context, local real MiniLM evaluation, isolated replay',
    archive_source_head:archivedSourceHead,
    original_gold_citation:{status:historicReceipt.status,
      context:historicReceipt.checks.context,model_dispatched:false},
    distinct_new_synthetic_citation:{status:receipt.status,
      context:receipt.checks.context,receipt_digest:receipt.receiptDigest,
      fragment_revision_digest:original.digest,
      archive_snapshot_digest:archivedSnapshotBefore.digest,
      snapshot_id:snapshot.snapshotId,project_id:kernel.projectId},
    exact_projection_digest:compiled.stateDigest,
    request_digest:request.requestDigest,
    assessment_digest:observed.id,
    assessment_outcome:observed.body.observation.outcome,
    assessment_choice:observed.body.observation.choice,
    raw_uncalibrated_distribution:observed.body.observation.distribution,
    model_metrics:adapter.metrics(),
    model_calls:adapter.calls(),
    archive_snapshot_unchanged:true,model_to_canonical_writes:0,
    human_reviews:0,persisted_experimental_journal_reopened:true,
    independent_archive_cli_studio_parity:true,
    experiment_cli_studio_parity:true,
    caveats:[
      'A different NEW original-archive synthetic full-span source has EXACT mechanical context; the historical archived golden citation remains BLOCKED.',
      'Old archive ResearchKernel is an in-memory reference, NOT V5 production Core or selected N2.',
      'The original N1 revision digests and original snapshot membership were checked, but projected experimental digest is independent and not a replacement for archived snapshot.',
      'Trusted grant actor is only an isolated literal test caller, NOT authenticated production N7 capability or human review.',
      'Append-only fsync JSONL is experimental, not N2 CAS+SQL atomic transaction and not attacker-proof without keyed signatures.',
      'No real-world dual reviewer annotations, research-truth calibration or model acceptance.',
      'No complete Theia V5 product integration or remote egress.']};
  console.log('IVORY_R4_REAL_ARCHIVE_N1='+JSON.stringify(report));
}finally{rmSync(root,{recursive:true,force:true})}
