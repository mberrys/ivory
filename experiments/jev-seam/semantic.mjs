// Ivory J2/J3/J5/J9 semantic seam: experiment only. No canonical writer or model-provider dependency.
import { createHash } from 'node:crypto';

const KINDS = new Set(['source', 'fragment', 'statement', 'evidenceLink']);
const LABELS = Object.freeze(['supported', 'partial', 'unsupported', 'contradicted', 'abstain']);
const ROLES = new Set(['supports', 'challenges', 'qualifies', 'contextualizes']);
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const obj = (v, n) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new TypeError(n + ' must be object');
  return v;
};
const str = (v, n, max = 256) => {
  if (typeof v !== 'string' || !v.trim() || v.length > max || v === 'latest') {
    throw new TypeError(n + ' must be bounded nonempty exact text');
  }
  return v;
};
const exactKeys = (value, keys, name) => {
  obj(value, name);
  if (Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) {
    throw new TypeError(name + ' contains unexpected or missing fields');
  }
};
export function exactRef(input, projectId) {
  exactKeys(input, ['projectId', 'objectId', 'revisionId'], 'exact ref');
  const result = {
    projectId: str(input.projectId, 'projectId'),
    objectId: str(input.objectId, 'objectId'),
    revisionId: str(input.revisionId, 'revisionId'),
  };
  if (result.projectId !== projectId) throw new TypeError('cross-project reference');
  return result;
}
function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(canonical);
  obj(value, 'canonical input');
  if (Object.values(value).some(x => x === undefined)) throw new TypeError('undefined canonical field');
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
}
export function digest(value) {
  return 'sha256:' + createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
const eq = (a, b) => digest(a) === digest(b);
function freeze(v) {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.values(v).forEach(freeze);
    Object.freeze(v);
  }
  return v;
}
function membership(snapshot, record, projectId) {
  obj(record, 'research record');
  if (!KINDS.has(record.kind)) throw new TypeError('unsupported research record kind');
  const ref = exactRef(record.ref, projectId);
  const matches = snapshot.members.filter(item => eq(exactRef(item.ref, projectId), ref));
  if (matches.length !== 1 || matches[0].revisionDigest !== record.revisionDigest) {
    throw new TypeError('record absent from exact snapshot or revision digest mismatch');
  }
  return ref;
}
function sourceRecord(snapshot, record, projectId) {
  const ref = membership(snapshot, record, projectId);
  if (record.kind !== 'source') throw new TypeError('expected source record');
  str(record.text, 'retained source text', 24000);
  if (record.contentDigest !== digest(record.text)) throw new TypeError('source bytes do not match digest');
  if (!['local-only', 'external-approved'].includes(record.rights)) {
    throw new TypeError('unrecognized source rights');
  }
  return ref;
}
function fragmentProjection(snapshot, fragment, sources, projectId) {
  const ref = membership(snapshot, fragment, projectId);
  if (fragment.kind !== 'fragment') throw new TypeError('expected fragment');
  const sourceRef = exactRef(fragment.sourceRef, projectId);
  const source = sources.find(s => eq(s.ref, sourceRef));
  if (!source) throw new TypeError('fragment source missing from exact basis');
  const { start, end, quote } = obj(fragment.selector, 'selector');
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start ||
      end > source.text.length || typeof quote !== 'string' || !quote) {
    throw new TypeError('invalid exact citation selector');
  }
  if (source.text.slice(start, end) !== quote) throw new TypeError('mechanical citation mismatch');
  if (fragment.representationDigest !== source.contentDigest) {
    throw new TypeError('representation digest mismatch');
  }
  const before = source.text.slice(Math.max(0, start - 160), start);
  const after = source.text.slice(end, Math.min(source.text.length, end + 160));
  return {
    ref, sourceRef, quote, before, after,
    selectorDigest: digest({ start, end, quote }),
    representationDigest: source.contentDigest,
    sourceRights: source.rights,
    revisionDigest: fragment.revisionDigest,
  };
}
/** Only Core-verified snapshots are admissible in production; this experiment checks a supplied manifest. */
export function compileSemanticBasis(input) {
  obj(input, 'basis');
  const snapshot = obj(input.snapshot, 'snapshot');
  const projectId = str(snapshot.projectId, 'snapshot projectId');
  str(snapshot.snapshotId, 'snapshot id');
  str(snapshot.manifestDigest, 'snapshot manifest digest');
  if (!Array.isArray(snapshot.members) || !snapshot.members.length || snapshot.members.length > 256) {
    throw new TypeError('bounded snapshot members required');
  }
  const memberKeys = snapshot.members.map(m => {
    obj(m, 'snapshot member');
    str(m.revisionDigest, 'revision digest');
    return digest(exactRef(m.ref, projectId));
  });
  if (new Set(memberKeys).size !== memberKeys.length) throw new TypeError('duplicate snapshot members');
  if (!Array.isArray(input.sources) || input.sources.length === 0 || input.sources.length > 16) {
    throw new TypeError('bounded source set required');
  }
  const sources = input.sources.map(s => ({ ...s, ref: sourceRecord(snapshot, s, projectId) }));
  if (!Array.isArray(input.fragments) || !input.fragments.length || input.fragments.length > 32) {
    throw new TypeError('bounded fragments required');
  }
  const fragments = input.fragments.map(f => fragmentProjection(snapshot, f, sources, projectId));
  const statement = obj(input.statement, 'statement');
  const statementRef = membership(snapshot, statement, projectId);
  if (statement.kind !== 'statement') throw new TypeError('expected statement');
  str(statement.text, 'exact statement wording', 8000);
  const link = obj(input.link, 'evidence link');
  const linkRef = membership(snapshot, link, projectId);
  if (link.kind !== 'evidenceLink' || !ROLES.has(link.role) ||
      !eq(exactRef(link.claimRef, projectId), statementRef)) {
    throw new TypeError('evidence link does not bind exact statement and legal role');
  }
  if (!Array.isArray(link.fragmentRefs) || !link.fragmentRefs.length ||
      new Set(link.fragmentRefs.map(r => digest(exactRef(r, projectId)))).size !== link.fragmentRefs.length ||
      link.fragmentRefs.some(r => !fragments.some(f => eq(f.ref, r)))) {
    throw new TypeError('link does not bind exact cited fragments');
  }
  const completeness = obj(input.completeness, 'completeness');
  if (typeof completeness.complete !== 'boolean' || !Array.isArray(completeness.omissions) ||
      completeness.omissions.length > 64 || (completeness.complete && completeness.omissions.length) ||
      (!completeness.complete && !completeness.omissions.length)) {
    throw new TypeError('explicit honest completeness required');
  }
  const omissions = completeness.omissions.map(x => str(x, 'omission', 512));
  // The exact model-visible projection has finite quote windows, never the full arbitrary corpus.
  const state = {
    schemaVersion: 'ivory-semantic-state/1',
    snapshot: { projectId, snapshotId: snapshot.snapshotId, manifestDigest: snapshot.manifestDigest },
    statement: { ref: statementRef, wording: statement.text, revisionDigest: statement.revisionDigest },
    link: { ref: linkRef, role: link.role, fragmentRefs: link.fragmentRefs.map(r => exactRef(r, projectId)), revisionDigest: link.revisionDigest },
    fragments: fragments.sort((a, b) => digest(a.ref).localeCompare(digest(b.ref))),
    completeness: { complete: completeness.complete, omissions },
  };
  const stateDigest = digest(state);
  return freeze({ state, stateDigest, mechanical: 'exact', hasLocalOnly: fragments.some(f => f.sourceRights === 'local-only') });
}
export function semanticRequest(compiled, fields) {
  obj(compiled, 'compiled basis');
  obj(fields, 'request fields');
  exactKeys(fields, ['questionSet', 'policy', 'purpose'], 'request fields');
  if (fields.purpose !== 'citation-support') throw new TypeError('out-of-scope semantic purpose');
  const question = obj(fields.questionSet, 'question set');
  if (!Array.isArray(question.options) || JSON.stringify(question.options) !== JSON.stringify(LABELS)) {
    throw new TypeError('immutable legal semantic options required');
  }
  const policy = obj(fields.policy, 'policy');
  const request = {
    schemaVersion: 'ivory-semantic-request/1',
    purpose: fields.purpose, stateDigest: compiled.stateDigest,
    snapshot: compiled.state.snapshot,
    questionSet: { id: str(question.id, 'question id'), version: str(question.version, 'question version'), options: [...LABELS] },
    policy: { id: str(policy.id, 'policy id'), version: str(policy.version, 'policy version') },
  };
  return freeze({ ...request, requestDigest: digest(request) });
}
const resultBase = (request, adapter, outcome, limits) => ({
  schemaVersion: 'ivory-semantic-observation/1',
  requestDigest: request.requestDigest, stateDigest: request.stateDigest,
  adapter: { id: adapter.id, version: adapter.version, mode: adapter.mode },
  outcome, distribution: null, choice: null,
  limits: [...limits, 'not-researcher-endorsement', 'not-a-canonical-write'],
});
export async function evaluateSemantic(compiled, request, adapter, permission = {}) {
  obj(compiled, 'compiled basis');
  obj(request, 'request');
  obj(adapter, 'adapter');
  str(adapter.id, 'adapter id');
  str(adapter.version, 'adapter version');
  if (!['rules', 'simulation', 'live'].includes(adapter.mode)) throw new TypeError('explicit adapter mode required');
  if (request.stateDigest !== compiled.stateDigest || digest(compiled.state) !== compiled.stateDigest ||
      !eq(request.snapshot, compiled.state.snapshot) ||
      request.purpose !== 'citation-support' ||
      JSON.stringify(request.questionSet?.options) !== JSON.stringify(LABELS)) {
    throw new TypeError('stale or forged exact evaluation request');
  }
  const { requestDigest, ...requestBody } = request;
  if (requestDigest !== digest(requestBody) || Object.keys(request).length !== 7) {
    throw new TypeError('request digest mismatch or unexpected fields');
  }
  const limits = ['experimental-only', 'not-calibrated'];
  if (!compiled.state.completeness.complete) {
    return freeze(resultBase(request, adapter, 'abstained', [...limits, 'incomplete-basis']));
  }
  if (adapter.remote && (compiled.hasLocalOnly || permission.approvedBodyDigest !== digest(compiled.state))) {
    return freeze(resultBase(request, adapter, 'abstained', [...limits, 'egress-not-authorized']));
  }
  try {
    if (typeof adapter.evaluate !== 'function') throw new TypeError('adapter function missing');
    // A remote adapter receives only this exact whitelisted state; the caller controls its own transport.
    const output = await adapter.evaluate(compiled.state, request.questionSet);
    exactKeys(output, ['questionId', 'probabilities'], 'evaluator output');
    if (output.questionId !== request.questionSet.id) throw new TypeError('wrong question');
    exactKeys(output.probabilities, LABELS, 'typed distribution');
    const values = Object.values(output.probabilities);
    if (values.some(x => typeof x !== 'number' || !Number.isFinite(x) || x < 0 || x > 1) ||
        Math.abs(values.reduce((sum, x) => sum + x, 0) - 1) > 1e-9) {
      throw new TypeError('invalid probability distribution');
    }
    const choice = LABELS.reduce((best, label) =>
      output.probabilities[label] > output.probabilities[best] ? label : best, 'abstain');
    return freeze({
      ...resultBase(request, adapter, choice === 'abstain' ? 'abstained' : 'answered', limits),
      distribution: { ...output.probabilities }, choice,
    });
  } catch (error) {
    return freeze(resultBase(request, adapter,
      error instanceof TypeError ? 'invalid' : 'unavailable',
      [...limits, 'adapter-failed-closed']));
  }
}
export const semanticLabels = LABELS;
