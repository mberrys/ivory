import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { buildKernel } from './build.mjs';
import { DurableStore } from '../n2-durable-store/src/durable-store.mjs';

export const kernelApi = createRequire(import.meta.url)(await buildKernel());
const { ResearchKernel, digestBytes } = kernelApi;
export const PROJECT_ID = 'prj_n6_synthetic_advising';

export async function createStudy(projectRoot) {
    const existing = await readdir(projectRoot).catch(error => { if (error.code !== 'ENOENT') { throw error; } return []; });
    if (existing.length) { throw new Error('Fixture destination must be absent or empty'); }
    const kernel = new ResearchKernel(PROJECT_ID);
    const retained = [];
    const remember = ref => { retained.push(kernel.getRevision(ref)); return ref; };
    const actor = 'Synthetic researcher Maya';
    const sources = [], fragments = [];
    for (let i = 1; i <= 30; i++) {
        const text = `Fictional participant ${String(i).padStart(2, '0')}: ` + (i % 3
            ? 'Advising helped me choose my next step. I still made the final decision.'
            : 'Advising narrowed my choices. I preferred advice from my peers.');
        const source = remember(kernel.admitSource({ name: `Interview ${i} (synthetic)`, bytes: text, actor }));
        sources.push(source);
        const artifact = remember(kernel.admitArtifact({ key: `transcript-${i}`, sourceRefs: [source], output: text, actor }));
        fragments.push(remember(kernel.createFragment({ sourceRef: source, artifactRef: artifact,
            selector: { kind: 'text', start: 0, end: text.length, quote: text }, actor })));
    }
    const csv = 'participant_id,group,score\n' + Array.from({ length: 30 }, (_, n) =>
        `${n + 1},${n < 15 ? 'advised' : 'peer'},${(n + 1) % 10 === 0 ? '' : n + 1}`).join('\n') + '\n';
    const survey = remember(kernel.admitSource({ name: 'survey.csv (synthetic)', bytes: csv, actor }));
    const codebook = remember(kernel.createCodebook({ key: 'agency', name: 'Agency', actor, codes: [
        { id: 'enabled', label: 'Enabled choice', definition: 'Advice expands perceived options.' },
        { id: 'constrained', label: 'Constrained choice', definition: 'Advice restricts perceived options.' },
    ] }));
    const annotations = fragments.map((fragmentRef, i) => remember(kernel.annotate({ fragmentRef, codebookRef: codebook,
        codeId: (i + 1) % 3 ? 'enabled' : 'constrained', actor })));
    const claim = remember(kernel.createClaim({ key: 'help', text: 'Advising can enable choice.', author: actor, status: 'accepted' }));
    const counterclaim = remember(kernel.createClaim({ key: 'constraint', text: 'Advising can constrain choice.',
        author: 'Synthetic researcher Jordan', status: 'accepted' }));
    const links = [
        remember(kernel.createEvidenceLink({ claimRef: claim, targets: [fragments[0], annotations[0]], role: 'supports',
            rationale: 'The participant describes a clearer next step.', linkAuthor: actor })),
        remember(kernel.createEvidenceLink({ claimRef: claim, targets: [fragments[2], annotations[2]], role: 'challenges',
            rationale: 'Narrowed options challenge the general claim; provenance does not imply endorsement.',
            linkAuthor: 'Synthetic researcher Jordan' })),
        remember(kernel.createEvidenceLink({ claimRef: counterclaim, targets: [fragments[2]], role: 'supports',
            rationale: 'This interpretation foregrounds constrained choice.', linkAuthor: 'Synthetic researcher Jordan' })),
    ];
    const snapshot1 = kernel.freezeSnapshot({ label: 'Before correction', researcher: actor,
        selected: [claim, counterclaim, ...links], context: [...annotations, survey], createdAt: '2026-09-09T00:00:00.000Z' });
    const corrected = remember(kernel.replaceSource({ sourceId: sources[0].objectId, expectedHead: sources[0].revisionId,
        name: 'Interview 1 (corrected synthetic)', bytes: 'Correction: advising sometimes helped me choose my next step.', actor }));
    const correctedText = Buffer.from(kernel.getRevision(corrected).payload.contentBase64, 'base64').toString();
    const correctedArtifact = remember(kernel.admitArtifact({ key: 'corrected', sourceRefs: [corrected], output: correctedText, actor }));
    const correctedFragment = remember(kernel.createFragment({ sourceRef: corrected, artifactRef: correctedArtifact,
        selector: { kind: 'text', start: 0, end: correctedText.length, quote: correctedText }, actor }));
    const snapshot2 = kernel.freezeSnapshot({ label: 'Correction retained alongside original', researcher: actor,
        selected: [claim, counterclaim, ...links], context: [...annotations, survey, correctedFragment], createdAt: '2026-09-09T00:00:01.000Z' });
    const files = { 'analysis/survey.csv': csv };
    for (const name of ['transform.py', 'analyse.R', 'dossier.qmd']) {
        files[`analysis/${name}`] = await readFile(new URL(`fixtures/${name}`, import.meta.url), 'utf8');
    }
    files['environments/runtime-lock.json'] = await readFile(new URL('fixtures/runtime-lock.json', import.meta.url), 'utf8');
    files['README.md'] = '# Synthetic N6 study\nAll interviews and survey responses are fictional. Open does not run code.\n';
    const study = { format: 'ivory-n6-study/1', projectId: PROJECT_ID, synthetic: true,
        snapshots: [snapshot1, snapshot2], citations: [fragments[0], fragments[2], correctedFragment],
        surveyRef: survey, files: {},
        comparisons: { exact: { rowCount: 30, validCount: 27, missingCount: 3, sum: 405 },
            numeric: { mean: 15 }, absoluteTolerance: 1e-12, relativeTolerance: 1e-12 } };
    const store = new DurableStore();
    await store.open(projectRoot);
    try {
        for (const revision of retained) {
            const bytes = revision.objectType === 'source' ? Buffer.from(revision.payload.contentBase64, 'base64') : undefined;
            await store.commit({ idempotencyKey: revision.revisionId,
                activity: { activityId: revision.activityId, actor: kernel.getActivity(revision.activityId).actor,
                    operation: kernel.getActivity(revision.activityId).command },
                expectedHeads: [{ objectId: revision.objectId, headRevisionId: revision.predecessor?.revisionId }],
                revisions: [{ objectId: revision.objectId, objectType: revision.objectType, revisionId: revision.revisionId,
                    predecessorId: revision.predecessor?.revisionId, payload: revision }],
                blobs: bytes ? [{ bytes }] : [] });
        }
        const fileBlobs = Object.entries(files).map(([path, text]) => {
            const bytes = Buffer.from(text); const digest = digestBytes(bytes); study.files[path] = digest;
            return { bytes, digest };
        });
        await store.commit({ idempotencyKey: 'n6-study', blobs: fileBlobs,
            revisions: [{ objectId: 'n6-study', revisionId: 'n6-study-v1', objectType: 'n6-study', payload: study }] });
        await store.freezeUnchanged();
        for (const [path, text] of Object.entries(files)) {
            await mkdir(join(projectRoot, path, '..'), { recursive: true });
            await writeFile(join(projectRoot, path), text);
        }
    } finally { await store.close(); }
    return study;
}
