// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { expect } from 'chai';
import {
    citationResolutionResponseSchema,
    fixtureResetRequestSchema,
    projectEditConflictSchema,
    projectEditRequestSchema,
    projectOpenResponseSchema,
    resolvedRunSpecSchema,
    runSpecResolutionResponseSchema,
} from './research-contracts';

describe('@ivory-tower/contracts research contracts', () => {
    it('project-open accepts an optional revision and resolves to an opened revision', () => {
        const open = projectOpenResponseSchema.parse({
            projectId: 'n5-demo',
            revision: 'rev-1',
            headRevision: 'rev-1',
            openedAt: '2026-09-07T00:00:00.000Z',
            entryPaths: ['research.py'],
        });
        expect(open.revision).to.equal('rev-1');
        expect(open.entryPaths).to.deep.equal(['research.py']);
    });
    it('fixture reset defaults the fixture selector to all', () => {
        expect(fixtureResetRequestSchema.parse({ projectId: 'n5-demo' }).fixture).to.equal('all');
    });
    it('citation anchors require a sha256 content hash', () => {
        expect(() =>
            citationResolutionResponseSchema.parse({
                citationId: 'c1',
                projectId: 'n5-demo',
                resolvedAt: '2026-09-07T00:00:00.000Z',
                anchor: {
                    sourcePath: 'research.py',
                    sourceRevision: 'rev-1',
                    anchorId: 'a1',
                    passage: 'x',
                    startOffset: 0,
                    endOffset: 1,
                    contentHash: 'not-hex',
                },
            }),
        ).to.throw();
    });
    it('a resolved RunSpec carries protocol ref, environment, commands, and the run id', () => {
        const spec = resolvedRunSpecSchema.parse({
            runId: 'run-abc',
            projectId: 'n5-demo',
            revision: 'rev-1',
            sourceSetVersion: 'fixtures-rev-1',
            environment: { node: 'v22' },
            commands: ['python research.py'],
            resolvedAt: '2026-09-07T00:00:00.000Z',
        });
        expect(spec.commands).to.include('python research.py');
    });
    it('run-spec resolution may omit the semantic result', () => {
        const response = runSpecResolutionResponseSchema.parse({
            runId: 'run-abc',
            resolvedRunSpec: {
                runId: 'run-abc',
                projectId: 'n5-demo',
                revision: 'rev-1',
                sourceSetVersion: 'fixtures-rev-1',
                environment: {},
                commands: [],
                resolvedAt: '2026-09-07T00:00:00.000Z',
            },
        });
        expect(response.semanticResult).to.equal(undefined);
    });
    it('project edits require a base revision and validate edit ranges', () => {
        expect(() =>
            projectEditRequestSchema.parse({
                projectId: 'n5-demo',
                baseRevision: '',
                sourcePath: 'research.py',
                edit: { kind: 'replace', startOffset: 0, endOffset: 1, text: 'x' },
            }),
        ).to.throw();
    });
    it('conflict payloads carry authoritative state and an unchanged rejection echo', () => {
        const request = projectEditRequestSchema.parse({
            projectId: 'n5-demo',
            baseRevision: 'rev-1',
            sourcePath: 'research.py',
            edit: { kind: 'replace', startOffset: 0, endOffset: 1, text: 'x' },
        });
        const conflict = projectEditConflictSchema.parse({
            code: 'revision_conflict',
            baseRevision: 'rev-1',
            headRevision: 'rev-2',
            authoritative: {
                sourcePath: 'research.py',
                revision: 'rev-2',
                bytes: 'y',
                contentHash: '4d4823794cbed3c4ee0bbc684c8f66e1dfd5afa6f078d494ce254ec5a4671753',
            },
            rejectedRequest: request,
        });
        expect(conflict.code).to.equal('revision_conflict');
        expect(conflict.rejectedRequest).to.deep.equal(request);
    });
});
