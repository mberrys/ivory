// J4 qualification statistics. This measures a supplied retained dataset; it never calls a model.
const LABELS = ['supported', 'partial', 'unsupported', 'contradicted'];
const OPTIONS = [...LABELS, 'abstain'];
const STATES = ['resolved', 'contested', 'inaccessible'];
const MODES = ['rules', 'simulation', 'live'];
const requireText = (v, n) => {
  if (typeof v !== 'string' || !v.trim()) throw new TypeError(n + ' must be text');
  return v;
};
const requireNumber = (v, n) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1)
    throw new TypeError(n + ' must be a finite probability');
  return v;
};
function validateCase(c) {
  if (!c || typeof c !== 'object') throw new TypeError('case required');
  for (const k of ['id', 'groupId', 'split']) requireText(c[k], k);
  if (!['train', 'validation', 'heldout'].includes(c.split)) throw new TypeError('unknown split');
  const ref = c.reference, obs = c.observation;
  if (!ref || !STATES.includes(ref.status)) throw new TypeError('review status required');
  if (!Number.isInteger(ref.reviewers) || ref.reviewers < 2) {
    throw new TypeError('at least two independently reviewed reference labels required');
  }
  if (ref.status === 'resolved' && !LABELS.includes(ref.label)) {
    throw new TypeError('resolved reference needs legal semantic class');
  }
  if (ref.status !== 'resolved' && ref.label !== null) {
    throw new TypeError('disputed or inaccessible reference has no forced accuracy label');
  }
  if (!obs || !MODES.includes(obs.mode)) throw new TypeError('declared evaluator mode required');
  requireText(obs.adapterId, 'adapter identity');
  requireText(obs.adapterVersion, 'adapter version');
  if (!['answered', 'abstained', 'invalid', 'unavailable'].includes(obs.outcome)) {
    throw new TypeError('typed evaluator outcome required');
  }
  if (obs.outcome === 'answered' && !LABELS.includes(obs.choice)) {
    throw new TypeError('answered outcome requires valid semantic class');
  }
  if (obs.outcome === 'abstained' && obs.choice !== 'abstain') {
    throw new TypeError('abstention must be explicit');
  }
  if ((obs.outcome === 'invalid' || obs.outcome === 'unavailable') && obs.choice !== null) {
    throw new TypeError('failed provider cannot be scored as answered');
  }
  if (obs.distribution !== null) {
    if (!obs.distribution || typeof obs.distribution !== 'object' || Array.isArray(obs.distribution) ||
        Object.keys(obs.distribution).sort().join('|') !== [...OPTIONS].sort().join('|')) {
      throw new TypeError('complete five-class distribution required');
    }
    const sum = OPTIONS.reduce((a, k) => a + requireNumber(obs.distribution[k], k), 0);
    if (Math.abs(sum - 1) > 1e-9) throw new TypeError('distribution not normalized');
  }
}
const ratio = (a, b) => b ? a / b : null;
function scoreArm(records) {
  const held = records.filter(c => c.split === 'heldout');
  const resolved = held.filter(c => c.reference.status === 'resolved');
  const answered = resolved.filter(c => c.observation.outcome === 'answered');
  const classes = Object.fromEntries(LABELS.map(label => {
    const tp = answered.filter(c => c.reference.label === label && c.observation.choice === label).length;
    const predicted = answered.filter(c => c.observation.choice === label).length;
    const actual = resolved.filter(c => c.reference.label === label).length;
    return [label, { tp, predicted, actual, precision: ratio(tp, predicted), recall: ratio(tp, actual) }];
  }));
  const unsupported = resolved.filter(c => ['unsupported', 'contradicted'].includes(c.reference.label));
  const falseSupport = unsupported.filter(c => c.observation.outcome === 'answered' &&
    ['supported', 'partial'].includes(c.observation.choice)).length;
  const probabilistic = answered.filter(c => c.observation.mode === 'live' &&
    c.observation.distribution !== null);
  const brier = probabilistic.length
    ? probabilistic.reduce((acc, c) => acc + OPTIONS.reduce((sum, label) =>
      sum + (c.observation.distribution[label] - Number(c.reference.label === label)) ** 2, 0), 0) / probabilistic.length
    : null;
  return {
    heldout: held.length, independentlyResolved: resolved.length,
    contested: held.filter(c => c.reference.status === 'contested').length,
    inaccessible: held.filter(c => c.reference.status === 'inaccessible').length,
    answered: answered.length,
    abstained: held.filter(c => c.observation.outcome === 'abstained').length,
    invalid: held.filter(c => c.observation.outcome === 'invalid').length,
    unavailable: held.filter(c => c.observation.outcome === 'unavailable').length,
    accuracyOnResolvedAnswered: ratio(
      answered.filter(c => c.reference.label === c.observation.choice).length, answered.length),
    coverageOfResolved: ratio(answered.length, resolved.length),
    falseSupportFlags: falseSupport,
    falseSupportFlagRate: ratio(falseSupport, unsupported.length),
    byClass: classes,
    brierOnLiveAnsweredResolvedOnly: brier,
    liveCalibratableCases: probabilistic.length,
    notes: [
      'Reference disagreements are retained, not coerced into one semantic truth.',
      'False-support flags describe an evaluator suggestion, never a Core acceptance event.',
      'Brier score is conditional on live answered resolved cases; no calibration is inferred for simulation/rules.',
      'These metrics alone do not establish representativeness or a production threshold.',
    ],
  };
}
/** Case array supplies repeatable exact pre-registered review IDs, groups and evaluator observations. */
export function qualifyCases(cases) {
  if (!Array.isArray(cases) || !cases.length) throw new TypeError('nonempty preregistered case set required');
  cases.forEach(validateCase);
  const caseKeys = cases.map(c =>
    [c.id, c.observation.mode, c.observation.adapterId, c.observation.adapterVersion].join('|'));
  if (new Set(caseKeys).size !== caseKeys.length) throw new TypeError('duplicate case observation');
  const splitByGroup = new Map();
  for (const c of cases) {
    if (splitByGroup.has(c.groupId) && splitByGroup.get(c.groupId) !== c.split) {
      throw new TypeError('related research cases leak across splits');
    }
    splitByGroup.set(c.groupId, c.split);
  }
  const arms = new Map();
  for (const c of cases) {
    const key = [c.observation.mode, c.observation.adapterId, c.observation.adapterVersion].join('|');
    if (!arms.has(key)) arms.set(key, []);
    arms.get(key).push(c);
  }
  return Object.fromEntries([...arms.entries()].map(([key, records]) => [key, scoreArm(records)]));
}
