// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// Experimental R4 journal and human-review projection, NOT a V5 production Core.
// The application trusted caller is responsible for authenticating researcher
// identities and N7 grants; caller strings here are NOT a security principal.
import { appendFileSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { digest, evaluateSemantic, semanticLabels } from './semantic.mjs';

const copy = value => structuredClone(value);
const fail = reason => { throw new Error(reason); };
const requireText = (x, name) => {
  if (typeof x !== 'string' || !x.trim() || x.length > 256 || x === 'latest') fail('invalid_' + name);
  return x;
};
const equal = (a, b) => digest(a) === digest(b);
function ref(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).sort().join(',') !== 'objectId,projectId,revisionId') fail('invalid_exact_ref');
  return { projectId: requireText(input.projectId, 'project'),
    objectId: requireText(input.objectId, 'object'), revisionId: requireText(input.revisionId, 'revision') };
}
function ensureSameRef(a, b) {
  if (!equal(ref(a), ref(b))) fail('stale_or_foreign_exact_ref');
}
function evidenceClass(adapter) {
  if (adapter.mode === 'rules') return 'deterministic-rule';
  if (adapter.mode === 'simulation') return 'simulation-not-live-model';
  if (adapter.mode === 'live' && adapter.remote !== true) return 'local-live-model';
  fail('unsupported_evaluator_mode');
}
const publicReceipt = x => copy(x);

/**
 * Isolated app-owned journal: immutable observations, trusted-caller capability
 * events and *human review statements*, NEVER canonical research acceptance.
 * File append+fsync is a test implementation, not N2 CAS+SQL atomicity.
 */
export class ExperimentalReviewJournal {
  #path; #last = 'genesis'; #seq = 0; #grants = new Map();
  #heads = new Map(); #assessments = new Map(); #reviews = new Map();
  #pending = new Map(); #poisoned = false;
  constructor(path) {
    this.#path = requireText(path, 'journal_path');
    if (!existsSync(path)) return;
    const raw = readFileSync(path, 'utf8');
    if (raw && !raw.endsWith('\n')) fail('truncated_journal_fail_closed');
    if (Buffer.byteLength(raw) > 10_000_000) fail('journal_size_limit');
    for (const line of raw.split('\n').filter(Boolean)) {
      let item;
      try { item = JSON.parse(line); } catch { fail('corrupt_journal_json'); }
      if (Object.keys(item).sort().join(',') !== 'event,hash,prev,seq' ||
          item.prev !== this.#last || item.seq !== this.#seq + 1 ||
          digest({seq:item.seq, prev:item.prev, event:item.event}) !== item.hash) {
        fail('corrupt_journal_chain');
      }
      this.#apply(item.event);
      this.#last = item.hash; this.#seq = item.seq;
    }
  }
  #apply(event) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) fail('invalid_event');
    if (event.kind === 'head') {
      const r = ref(event.ref);
      this.#heads.set(r.objectId, r);
    } else if (event.kind === 'grant') {
      if (this.#grants.has(event.id)) fail('duplicate_grant');
      this.#grants.set(event.id, {...copy(event),revoked:false});
    } else if (event.kind === 'revoke') {
      const grant = this.#grants.get(event.id);
      if (!grant || grant.revoked) fail('invalid_revoke');
      grant.revoked = true;
    } else if (event.kind === 'assessment') {
      if (this.#assessments.has(event.record.id)) fail('duplicate_assessment');
      if (digest(event.record.body) !== event.record.id ||
          event.record.body.schema !== 'ivory-r4-proposed-assessment/1' ||
          !this.#grants.has(event.record.body.grantId)) fail('invalid_assessment_record');
      this.#assessments.set(event.record.id, copy(event.record));
    } else if (event.kind === 'review') {
      if (this.#reviews.has(event.key)) fail('duplicate_human_decision');
      const review = event.record;
      if (digest(review.body) !== review.id ||
          review.body.schema !== 'ivory-r4-human-review/1' ||
          !this.#assessments.has(review.body.assessmentId)) fail('invalid_review_record');
      this.#reviews.set(event.key, copy(review));
    } else fail('unknown_event_kind');
  }
  #append(event) {
    if (this.#poisoned) fail('journal_requires_reopen_after_io_failure');
    const item = {seq:this.#seq+1,prev:this.#last,event};
    item.hash = digest(item);
    const line = JSON.stringify(item)+'\n';
    if (Buffer.byteLength(line) > 64_000) fail('journal_event_too_large');
    mkdirSync(dirname(this.#path), {recursive:true});
    let fd;
    try {
      fd = openSync(this.#path,'a');
      appendFileSync(fd,line,'utf8');
      fsyncSync(fd);
      closeSync(fd);fd=undefined;
    } catch {
      this.#poisoned=true;
      if (fd !== undefined) {try{closeSync(fd)}catch{}}
      fail('journal_io_fail_closed');
    }
    this.#apply(event);
    this.#last = item.hash;
    this.#seq = item.seq;
    return copy(event);
  }
  /** Head events must originate from the trusted research caller, NOT a model. */
  recordTrustedClaimHead(exactClaimRef, trustedCaller) {
    if (trustedCaller !== 'trusted-core-test-harness') fail('trusted_caller_required');
    const r = ref(exactClaimRef);
    if (this.#heads.get(r.objectId) && equal(this.#heads.get(r.objectId),r)) return copy(r);
    this.#append({kind:'head',ref:r});
    return copy(r);
  }
  /** Capability is externally authorized in production N7, never minted by a model. */
  grant({grantId, compiled, researcher}, trustedCaller) {
    if (trustedCaller !== 'trusted-core-test-harness') fail('trusted_caller_required');
    const id=requireText(grantId,'grant_id');
    const actor=requireText(researcher,'researcher');
    if (!compiled?.state?.completeness?.complete || compiled.mechanical !== 'exact' ||
        digest(compiled.state) !== compiled.stateDigest) fail('grant_requires_complete_exact_basis');
    const claim=ref(compiled.state.statement.ref);
    const head=this.#heads.get(claim.objectId);
    if (!head) fail('missing_trusted_claim_head');
    ensureSameRef(head,claim);
    if (this.#grants.has(id)) fail('duplicate_grant');
    this.#append({kind:'grant',id,researcher:actor,projectId:claim.projectId,
      exactClaim:claim,snapshot:copy(compiled.state.snapshot),stateDigest:compiled.stateDigest});
    return id;
  }
  revoke(grantId, trustedCaller) {
    if (trustedCaller !== 'trusted-core-test-harness') fail('trusted_caller_required');
    const id=requireText(grantId,'grant_id');
    const g=this.#grants.get(id);
    if (!g || g.revoked) fail('grant_missing_or_revoked');
    this.#append({kind:'revoke',id});
  }
  #eligible(compiled, request, grantId) {
    const grant=this.#grants.get(requireText(grantId,'grant_id'));
    if (!grant || grant.revoked) fail('capability_revoked_or_missing');
    if (!compiled || compiled.mechanical !== 'exact' ||
        digest(compiled.state) !== compiled.stateDigest) fail('basis_invalid');
    if (!equal(grant.snapshot,compiled.state.snapshot) ||
        grant.stateDigest !== compiled.stateDigest ||
        !equal(request.snapshot,compiled.state.snapshot) ||
        request.stateDigest !== compiled.stateDigest) fail('scope_or_basis_mismatch');
    ensureSameRef(grant.exactClaim,compiled.state.statement.ref);
    const head=this.#heads.get(grant.exactClaim.objectId);
    if (!head) fail('missing_trusted_claim_head');
    ensureSameRef(head,grant.exactClaim);
    return grant;
  }
  async assess({compiled,request,adapter,grantId}) {
    const grant=this.#eligible(compiled,request,grantId);
    const mode=evidenceClass(adapter);
    if (adapter.remote === true) fail('real_network_adapter_not_approved');
    if (!['rules','simulation','live'].includes(adapter.mode)) fail('illegal_adapter_mode');
    requireText(adapter.id,'adapter_id');requireText(adapter.version,'adapter_version');
    const callId=digest({grantId,requestDigest:request.requestDigest,
      adapter:{id:adapter.id,version:adapter.version,mode:adapter.mode}});
    // Idempotency before inference across restart; no repeated paid evaluation.
    const already=[...this.#assessments.values()].find(x=>x.body.callId===callId);
    if (already) return publicReceipt(already);
    if (this.#pending.has(callId)) return publicReceipt(await this.#pending.get(callId));
    const pending=(async()=>{
      // Same seam checks exact refs, completeness, allowed local rights and output.
      const observation=await evaluateSemantic(compiled,request,adapter);
      this.#eligible(compiled,request,grantId); // revoke/head change during inference
      const body={schema:'ivory-r4-proposed-assessment/1',grantId,
        callId,requestDigest:request.requestDigest,stateDigest:compiled.stateDigest,
        snapshot:copy(compiled.state.snapshot),claimRef:copy(compiled.state.statement.ref),
        fragmentRefs:copy(compiled.state.fragments.map(x=>x.ref)),
        questionSet:copy(request.questionSet),policy:copy(request.policy),
        evaluator:{id:adapter.id,version:adapter.version,mode:adapter.mode, evidenceClass:mode},
        observation:copy(observation),
        limits:['experimental-review-only','not-canonical-acceptance',
          'not-production-n7-authentication','not-durable-v5-core']};
      const record={id:digest(body),body};
      this.#append({kind:'assessment',record});
      return publicReceipt(record);
    })();
    this.#pending.set(callId,pending);
    try{return await pending}finally{this.#pending.delete(callId)}
  }
  recordHumanReview({assessmentId,decision,reviewer,idempotencyKey},trustedCaller) {
    if (trustedCaller !== 'trusted-core-test-harness') fail('trusted_caller_required');
    const key=requireText(idempotencyKey,'idempotency_key');
    const actor=requireText(reviewer,'reviewer');
    const id=requireText(assessmentId,'assessment_id');
    if (actor.startsWith('model:') || actor==='auto' || actor==='model') fail('human_reviewer_required');
    if (!['agree','disagree','defer'].includes(decision)) fail('invalid_reviewer_decision');
    const assessment=this.#assessments.get(id);
    if (!assessment) fail('unreviewable_missing_assessment');
    const g=this.#grants.get(assessment.body.grantId);
    if (!g || g.revoked) fail('capability_revoked_or_missing');
    const head=this.#heads.get(assessment.body.claimRef.objectId);
    ensureSameRef(head,assessment.body.claimRef);
    const body={schema:'ivory-r4-human-review/1',assessmentId:id,
      requestDigest:assessment.body.requestDigest,stateDigest:assessment.body.stateDigest,
      reviewer:actor,decision,grantId:assessment.body.grantId,
      label:'reviewer-statement-not-core-acceptance'};
    const record={id:digest(body),body};
    const existing=this.#reviews.get(key);
    if (existing) {
      if (!equal(existing,record)) fail('review_idempotency_conflict');
      return publicReceipt(existing);
    }
    this.#append({kind:'review',key,record});
    return publicReceipt(record);
  }
  readAssessment(id) {const a=this.#assessments.get(requireText(id,'assessment_id'));return a?publicReceipt(a):null}
  readReview(key) {const a=this.#reviews.get(requireText(key,'review_key'));return a?publicReceipt(a):null}
  readers() {const fetch=id=>this.readAssessment(id);return {cli:{readAssessment:fetch},studio:{readAssessment:fetch}}}
  stats() {return {events:this.#seq,assessments:this.#assessments.size,reviews:this.#reviews.size,head:this.#last}}
}
