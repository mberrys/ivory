// R2 archive-to-experimental-seam composition. Never imports historical runtime into V5 product.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileSemanticBasis, semanticRequest, evaluateSemantic, digest, semanticLabels } from './semantic.mjs';

const modulePath = join(process.cwd(), '.audit', 'archive', 'packages',
  'ivory-tower-research-kernel', 'lib', 'node', 'index.js');
const { buildAdvisingAgencyFixture, createResearchClients } = await import(pathToFileURL(modulePath).href);
const sourceRecord = (kernel, exactRef) => {
  const revision = kernel.getRevision(exactRef);
  const text = Buffer.from(revision.payload.contentBase64, 'base64').toString('utf8');
  return {
    kind: 'source', ref: exactRef, contentDigest: digest(text),
    text, rights: 'local-only', archivedRevisionDigest: revision.digest,
  };
};
const wrap = record => {
  const { archivedRevisionDigest, ...basis } = record;
  const preimage = { ...basis };
  return { ...preimage, revisionDigest: digest(preimage) };
};
function compileFromArchive(f, snapshot, exactClaim, exactLink) {
  const kernel = f.kernel;
  const source = wrap(sourceRecord(kernel, f.t1));
  const fragmentRevision = kernel.getRevision(f.fragment);
  const cited = kernel.resolveCitation(f.fragment, snapshot.snapshotId);
  const receipt = kernel.verifyCitation(f.fragment);
  assert.equal(receipt.checks.representationDigest, true);
  assert.equal(receipt.checks.selectorBytes, true);
  assert.notEqual(receipt.status, 'MISMATCH');
  assert.equal(receipt.semanticSupport, 'not-assessed');
  assert.equal(cited.quote, fragmentRevision.payload.selector.quote);
  // Verify every historical record's ORIGINAL N1 digest and membership before projection.
  for (const exact of [f.t1, f.fragment, exactClaim, exactLink]) {
    const original = kernel.getRevision(exact);
    assert.ok(snapshot.manifest.members.some(m =>
      m.ref.projectId === exact.projectId && m.ref.objectId === exact.objectId &&
      m.ref.revisionId === exact.revisionId && m.revisionDigest === original.digest));
  }
  const fragment = wrap({
    kind: 'fragment', ref: f.fragment, sourceRef: f.t1,
    representationDigest: source.contentDigest,
    selector: {
      start: cited.selector.start, end: cited.selector.end, quote: cited.selector.quote,
    },
  });
  const statement = wrap({
    kind: 'statement', ref: exactClaim, text: kernel.getRevision(exactClaim).payload.text,
  });
  const linkPayload = kernel.getRevision(exactLink).payload;
  assert.equal(linkPayload.claimRef.revisionId, exactClaim.revisionId);
  const link = wrap({
    kind: 'evidenceLink', ref: exactLink, claimRef: exactClaim,
    fragmentRefs: [f.fragment], role: linkPayload.role,
  });
  const records = [source, fragment, statement, link];
  const members = records.map(record => ({
    ref: structuredClone(record.ref), revisionDigest: record.revisionDigest,
  }));
  const sourceCorrection = kernel.getRevision(f.t1Replacement);
  return compileSemanticBasis({
    snapshot: {
      projectId: kernel.projectId, snapshotId: snapshot.snapshotId,
      // Experimental projection manifest, not a substitute for the original N1 snapshot digest.
      manifestDigest: digest(members), members,
    },
    sources: [source], fragments: [fragment], statement, link,
    completeness: receipt.status === 'EXACT'
      ? { complete: true, omissions: [] }
      : { complete: false, omissions: ['archived-n1-mechanical-context-' + receipt.checks.context] },
  });
}
function question(compiled) {
  return semanticRequest(compiled, {
    purpose: 'citation-support', policy: { id: 'archived-n1-review', version: 'v1' },
    questionSet: { id: 'archived-n1-support', version: 'v1', options: [...semanticLabels] },
  });
}
const rules = {
  id: 'offline-archive-composition', version: '1', mode: 'rules',
  evaluate: (_state, questions) => ({
    questionId: questions.id,
    probabilities: Object.fromEntries(questions.options.map(x => [x, Number(x === 'abstain')])),
  }),
};
test('R2 real archived N1: exact S1/S2 citations, author disagreement, revision and no-model seam', async () => {
  const f = buildAdvisingAgencyFixture();
  const first = compileFromArchive(f, f.snapshot1, f.claimA1, f.challengeA1);
  const second = compileFromArchive(f, f.snapshot2, f.claimA2, f.carriedLinks[0]);
  assert.notEqual(first.stateDigest, second.stateDigest);
  assert.equal(first.state.statement.ref.revisionId, f.claimA1.revisionId);
  assert.equal(second.state.statement.ref.revisionId, f.claimA2.revisionId);
  assert.equal(first.state.fragments[0].quote, 'Maya said advising made the next step visible.');
  assert.equal(second.state.fragments[0].quote, first.state.fragments[0].quote);
  assert.equal(f.kernel.getRevision(f.t1Replacement).objectId, f.t1.objectId);
  assert.notEqual(f.t1.revisionId, f.t1Replacement.revisionId);
  const original = f.kernel.getRevision(f.challengeA1).payload;
  const carried = f.kernel.getRevision(f.carriedLinks[0]).payload;
  assert.equal(original.linkAuthor, carried.linkAuthor);
  assert.equal(carried.claimRef.revisionId, f.claimA2.revisionId);
  assert.equal(f.kernel.getActivity(f.kernel.getRevision(f.carriedLinks[0]).activityId).actor, 'Maya');
  const before = await evaluateSemantic(first, question(first), rules);
  const after = await evaluateSemantic(second, question(second), rules);
  assert.equal(before.outcome, 'abstained');
  assert.equal(after.outcome, 'abstained');
  assert.ok(before.limits.includes('incomplete-basis'));
  assert.ok(after.limits.includes('incomplete-basis'));
  assert.equal(first.state.completeness.omissions[0], 'archived-n1-mechanical-context-unavailable');
  assert.notEqual(before.requestDigest, after.requestDigest);
  assert.equal(f.kernel.resolveCitation(f.fragment, f.snapshot1.snapshotId).quote, first.state.fragments[0].quote);
  const readers = createResearchClients(f.kernel);
  assert.deepEqual(readers.cli.explainClaim(f.snapshot1.snapshotId, f.claimA1),
    readers.studio.explainClaim(f.snapshot1.snapshotId, f.claimA1));
  assert.deepEqual(readers.cli.explainClaim(f.snapshot2.snapshotId, f.claimA2),
    readers.studio.explainClaim(f.snapshot2.snapshotId, f.claimA2));
  assert.equal(f.snapshot1.digest, f.kernel.getSnapshot(f.snapshot1.snapshotId).digest);
});
