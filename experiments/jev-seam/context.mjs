import { createHash } from 'node:crypto';

const KINDS = new Set(['Source', 'Artifact', 'Fragment', 'Codebook', 'Annotation', 'Statement', 'Candidate', 'Assessment', 'Proposal']);
const PURPOSES = new Set(['triage', 'anchor-review', 'challenge-priority']);
const OPTIONS = ['review', 'exclude', 'abstain'];
const MAX_RECORDS = 256;
const MAX_EDGES = 2048;

function requireObject(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(name + ' must be an object');
  }
}
function exactText(value, name) {
  if (typeof value !== 'string' || !value.trim() || value === 'latest' || value.length > 256) {
    throw new TypeError(name + ' must be a bounded exact non-latest identifier');
  }
  return value;
}
export function exactRef(value, projectId) {
  requireObject(value, 'ref');
  const ref = {
    projectId: exactText(value.projectId, 'projectId'),
    objectId: exactText(value.objectId, 'objectId'),
    revisionId: exactText(value.revisionId, 'revisionId')
  };
  if (ref.projectId !== projectId) throw new TypeError('cross-project ref');
  return ref;
}
function ordered(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(ordered);
  requireObject(value, 'canonical value');
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]));
}
export function digest(value) {
  return 'sha256:' + createHash('sha256').update(JSON.stringify(ordered(value))).digest('hex');
}
function deepFreeze(object) {
  if (object && typeof object === 'object') {
    for (const item of Object.values(object)) deepFreeze(item);
    Object.freeze(object);
  }
  return object;
}
function refKey(ref) { return [ref.projectId, ref.objectId, ref.revisionId].join('\u0000'); }
function recordProjection(input, projectId) {
  requireObject(input, 'record');
  if (!KINDS.has(input.kind)) throw new TypeError('unknown research kind');
  const out = { kind: input.kind, ref: exactRef(input.ref, projectId) };
  for (const name of ['representationDigest', 'selectorDigest', 'status', 'rights', 'metadataCategory', 'edition']) {
    if (input[name] !== undefined) out[name] = exactText(input[name], name);
  }
  if (['Source', 'Artifact', 'Fragment'].includes(out.kind) && !out.representationDigest) {
    throw new TypeError('representation digest required for ' + out.kind);
  }
  if (out.kind === 'Fragment' && !out.selectorDigest) throw new TypeError('selector digest required');
  return out; // content, quote text, provider prompts and arbitrary fields are deliberately omitted
}
export function compileContext(snapshot) {
  requireObject(snapshot, 'snapshot');
  const projectId = exactText(snapshot.projectId, 'projectId');
  const snapshotRef = exactRef(snapshot.snapshotRef, projectId);
  if (!Array.isArray(snapshot.records) || snapshot.records.length > MAX_RECORDS) {
    throw new TypeError('bounded records required');
  }
  if (!Array.isArray(snapshot.edges) || snapshot.edges.length > MAX_EDGES) {
    throw new TypeError('bounded edges required');
  }
  if (typeof snapshot.complete !== 'boolean' || !Array.isArray(snapshot.omissions)) {
    throw new TypeError('declared completeness required');
  }
  if (!snapshot.complete && snapshot.omissions.length === 0) throw new TypeError('name omissions');
  const records = snapshot.records.map(x => recordProjection(x, projectId));
  const keys = new Set(records.map(x => refKey(x.ref)));
  if (keys.size !== records.length) throw new TypeError('duplicate exact revision');
  const edges = snapshot.edges.map(edge => {
    requireObject(edge, 'edge');
    if (edge.kind === 'activity') return null; // back-links are NOT closure edges
    if (edge.kind !== 'semantic') throw new TypeError('unrecognized dependency edge');
    const from = exactRef(edge.from, projectId), to = exactRef(edge.to, projectId);
    if (!keys.has(refKey(from)) || !keys.has(refKey(to))) throw new TypeError('dangling semantic ref');
    return { kind: 'semantic', from, to };
  }).filter(Boolean);
  const omissions = snapshot.omissions.map(x => exactText(x, 'omission')).sort();
  const context = {
    schemaVersion: 'j1j2-context.v1', projectId, snapshotRef,
    records: records.sort((a, b) => refKey(a.ref).localeCompare(refKey(b.ref))),
    semanticEdges: edges.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    completeness: { complete: snapshot.complete, omissions }
  };
  return deepFreeze({ context, stateDigest: digest(context) });
}
export function decisionRequest(compiled, { purpose, questionSet, policyRef }) {
  if (!PURPOSES.has(purpose)) throw new TypeError('unknown decision purpose');
  requireObject(compiled, 'compiled context');
  requireObject(questionSet, 'questionSet');
  requireObject(policyRef, 'policyRef');
  exactText(questionSet.version, 'question version');
  exactText(policyRef.id, 'policy id');
  exactText(policyRef.version, 'policy version');
  if (!Array.isArray(questionSet.questions) || questionSet.questions.length !== 1) {
    throw new TypeError('experiment supports one bounded question');
  }
  const q = questionSet.questions[0];
  requireObject(q, 'question');
  exactText(q.id, 'question id');
  if (JSON.stringify(q.options) !== JSON.stringify(OPTIONS)) {
    throw new TypeError('fixed legal options required');
  }
  const request = {
    projectId: compiled.context.projectId,
    researchSnapshot: compiled.context.snapshotRef,
    purpose, stateSchema: compiled.context.schemaVersion,
    stateDigest: compiled.stateDigest,
    questionSet: { version: questionSet.version, questions: [{ id: q.id, options: [...OPTIONS] }] },
    policyRef: { id: policyRef.id, version: policyRef.version }
  };
  return deepFreeze({ ...request, requestDigest: digest(request) });
}
function verifiedOutput(raw, question) {
  requireObject(raw, 'decision output');
  if (Object.keys(raw).sort().join(',') !== 'probabilities,questionId' || raw.questionId !== question.id) {
    throw new TypeError('unexpected model output fields or question');
  }
  requireObject(raw.probabilities, 'probabilities');
  if (Object.keys(raw.probabilities).sort().join(',') !== [...OPTIONS].sort().join(',')) {
    throw new TypeError('out of policy option set');
  }
  const sum = OPTIONS.reduce((acc, option) => {
    const p = raw.probabilities[option];
    if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) {
      throw new TypeError('invalid probability');
    }
    return acc + p;
  }, 0);
  if (Math.abs(sum - 1) > 1e-9) throw new TypeError('probabilities do not normalize');
  return Object.fromEntries(OPTIONS.map(option => [option, raw.probabilities[option]]));
}
export function observeDecision(compiled, request, adapter) {
  requireObject(compiled, 'context');
  requireObject(request, 'request');
  requireObject(adapter, 'adapter');
  const identity = { id: exactText(adapter.id, 'adapter id'), version: exactText(adapter.version, 'adapter version') };
  if (request.stateDigest !== compiled.stateDigest || digest(compiled.context) !== compiled.stateDigest) {
    throw new TypeError('context digest mismatch');
  }
  if (request.projectId !== compiled.context.projectId ||
      digest(request.researchSnapshot) !== digest(compiled.context.snapshotRef) ||
      request.stateSchema !== compiled.context.schemaVersion) {
    throw new TypeError('request is not bound to the exact research snapshot');
  }
  if (!PURPOSES.has(request.purpose)) throw new TypeError('unsupported request purpose');
  requireObject(request.questionSet, 'request question set');
  if (!Array.isArray(request.questionSet.questions) || request.questionSet.questions.length !== 1 ||
      JSON.stringify(request.questionSet.questions[0].options) !== JSON.stringify(OPTIONS)) {
    throw new TypeError('request options are not the fixed legal option set');
  }
  requireObject(request.policyRef, 'request policy');
  const requestPayload = Object.fromEntries(
    Object.entries(request).filter(([key]) => key !== 'requestDigest')
  );
  if (Object.keys(request).length !== 8 || request.requestDigest !== digest(requestPayload)) {
    throw new TypeError('request digest mismatch or unexpected request fields');
  }
  const base = {
    requestDigest: request.requestDigest, stateDigest: compiled.stateDigest,
    modelOrRuleRef: identity, typedDistribution: null,
    outcome: 'abstained',
    measuredLimits: ['synthetic-control-only', 'uncalibrated', 'no-core-acceptance-authority']
  };
  if (!compiled.context.completeness.complete) return deepFreeze({ ...base, measuredLimits: [...base.measuredLimits, 'incomplete-context'] });
  if (adapter.remote && compiled.context.records.some(r => r.rights === 'local-only')) {
    return deepFreeze({ ...base, measuredLimits: [...base.measuredLimits, 'egress-not-authorized'] });
  }
  try {
    if (typeof adapter.evaluate !== 'function') throw new TypeError('missing adapter');
    const probs = verifiedOutput(adapter.evaluate(compiled.context, request.questionSet.questions[0]), request.questionSet.questions[0]);
    const choice = OPTIONS.reduce((best, x) => probs[x] > probs[best] ? x : best, OPTIONS[0]);
    return deepFreeze({ ...base, typedDistribution: probs, outcome: choice === 'abstain' ? 'abstained' : 'answered' });
  } catch (error) {
    return deepFreeze({ ...base, outcome: error instanceof TypeError ? 'invalid' : 'unavailable', measuredLimits: [...base.measuredLimits, 'adapter-failed-closed'] });
  }
}
