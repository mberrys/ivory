// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { expect } from 'chai';
import { ClockPort, ResearchProtocolIdPort, ResearchProtocolStore } from '@ivory-tower/adapters';
import {
    ClaimPosture,
    ProtocolArtifact,
    ProtocolExportReference,
    ProtocolRunReference,
    ResearchProtocolVersion,
    SelectionMode,
    SynthesisAdmissionRequest,
} from '@ivory-tower/contracts';
import { ResearchProtocolService } from './research-protocol-service';

class TestIds implements ResearchProtocolIdPort {
    private sequence = 0;

    next(): string {
        this.sequence += 1;
        return `id-${this.sequence}`;
    }
}

const clock: ClockPort = { now: () => new Date('2026-08-03T12:00:00.000Z') };

class TestStore implements ResearchProtocolStore {
    private readonly versions = new Map<string, ResearchProtocolVersion>();
    private readonly artifacts = new Map<string, ProtocolArtifact[]>();

    async saveVersion(version: ResearchProtocolVersion): Promise<ResearchProtocolVersion> {
        if (this.versions.get(version.protocolVersionId)?.stage === 'export_snapshot') {
            throw new Error('snapshot immutable');
        }
        this.versions.set(version.protocolVersionId, structuredClone(version));
        return structuredClone(version);
    }

    async getVersion(protocolVersionId: string): Promise<ResearchProtocolVersion | undefined> {
        const version = this.versions.get(protocolVersionId);
        return version === undefined ? undefined : structuredClone(version);
    }

    async listVersions(protocolId: string): Promise<readonly ResearchProtocolVersion[]> {
        return [...this.versions.values()].filter(version => version.protocolId === protocolId).map(version => structuredClone(version));
    }

    async attachArtifact(artifact: ProtocolArtifact): Promise<void> {
        const list = this.artifacts.get(artifact.protocolVersionId) ?? [];
        list.push(structuredClone(artifact));
        this.artifacts.set(artifact.protocolVersionId, list);
    }

    async listArtifacts(protocolVersionId: string): Promise<readonly ProtocolArtifact[]> {
        return (this.artifacts.get(protocolVersionId) ?? []).map(artifact => structuredClone(artifact));
    }

    async saveRun(reference: ProtocolRunReference): Promise<ProtocolRunReference> {
        return structuredClone(reference);
    }

    async saveExport(reference: ProtocolExportReference): Promise<ProtocolExportReference> {
        return structuredClone(reference);
    }
}

function posture(kind: ClaimPosture['kind']): ClaimPosture {
    switch (kind) {
        case 'interpretive':
            return { kind, interpretiveFrame: 'Frame', alternatives: ['Alternative'] };
        case 'critical/discourse':
            return { kind, discoursePowerContext: 'Institutional power', positionalityContext: 'Researcher position' };
        case 'historical/contextual':
            return { kind, historicalPeriod: '1900-1910', sourceContext: 'Published during a period of change' };
        case 'descriptive':
            return { kind, observationScope: 'The bounded source set' };
        case 'associational':
            return { kind, variables: ['x', 'y'], adjustmentDefinitions: ['None'] };
        case 'causal':
            return {
                kind,
                estimand: 'Average treatment effect',
                design: 'Quasi-experimental design',
                identificationAssumptions: ['Consistency'],
                confounderStrategy: 'Measure and adjust for pre-treatment confounders',
            };
        case 'exploratory':
            return { kind };
    }
}

describe('ResearchProtocolService', () => {
    it('creates a novice exploratory protocol with explicit non-representativeness defaults in under one minute', async () => {
        const service = new ResearchProtocolService(new TestStore(), new TestIds(), clock);
        const started = performance.now();
        const version = await service.create({
            purpose: 'Learn what the source set can illuminate.',
            workingQuestionAim: 'What themes should be investigated next?',
            scope: 'The selected open publications.',
        });

        expect(performance.now() - started).to.be.lessThan(60_000);
        expect(version.stage).to.equal('exploratory');
        expect(version.selectionMode).to.equal('purposive');
        expect(version.selectionRationale).to.contain('not representative');
        expect(version.taskIntent).to.be.a('string');
    });

    it('lets an expert inspect and override every novice default', async () => {
        const service = new ResearchProtocolService(new TestStore(), new TestIds(), clock);
        const version = await service.create({
            purpose: 'Estimate a bounded effect with a documented design.',
            workingQuestionAim: 'What is the causal effect under the stated assumptions?',
            taskIntent: 'Estimate and export a validated causal claim.',
            sourceSetVersion: 'sources-expert-2',
            scope: 'The pre-registered treatment and comparison cohorts.',
            selectionMode: 'probability_based',
            selectionRationale: 'The sampling frame and selection probabilities are recorded.',
            inclusionRationale: 'Include eligible cohort records with complete provenance.',
            exclusionRationale: 'Exclude records outside the pre-registered frame.',
            boundaries: ['No claims beyond the defined estimand.'],
            limitations: ['Residual confounding may remain.'],
            processingPolicyVersion: 'policy-expert-2',
            author: 'expert-researcher',
            posture: posture('causal'),
            coverageClaims: [{ term: 'systematic', sourceSelectionEvidence: 'Pre-registered search and screening log.' }],
        });

        expect(version.taskIntent).to.equal('Estimate and export a validated causal claim.');
        expect(version.sourceSetVersion).to.equal('sources-expert-2');
        expect(version.selectionMode).to.equal('probability_based');
        expect(version.processingPolicyVersion).to.equal('policy-expert-2');
        expect(version.author).to.equal('expert-researcher');
        expect(version.posture.kind).to.equal('causal');
        expect(version.coverageClaims[0]?.term).to.equal('systematic');
    });

    it('accepts every declared posture and selection mode without statistical fields for qualitative postures', async () => {
        const service = new ResearchProtocolService(new TestStore(), new TestIds(), clock);
        const postures: ClaimPosture['kind'][] = [
            'exploratory',
            'interpretive',
            'critical/discourse',
            'historical/contextual',
            'descriptive',
            'associational',
            'causal',
        ];
        const selectionModes: SelectionMode[] = [
            'purposive',
            'theoretical',
            'archival',
            'case_based',
            'convenience',
            'exhaustive_within_source',
            'probability_based',
        ];

        for (const postureKind of postures) {
            for (const selectionMode of selectionModes) {
                const version = await service.create({
                    purpose: 'Test purpose',
                    workingQuestionAim: 'Test aim',
                    scope: 'Bounded test scope',
                    taskIntent: 'Test intent',
                    sourceSetVersion: 'sources-1',
                    selectionMode,
                    selectionRationale: 'The selection is bounded and documented.',
                    inclusionRationale: 'Direct relevance.',
                    exclusionRationale: 'Outside scope.',
                    boundaries: ['No prevalence claim.'],
                    limitations: ['Selection is bounded.'],
                    processingPolicyVersion: 'policy-1',
                    author: 'expert',
                    posture: posture(postureKind),
                });
                expect(version.posture.kind).to.equal(postureKind);
                expect(version.selectionMode).to.equal(selectionMode);
            }
        }
    });

    it('creates typed revisions, reports affected artifacts, preserves snapshots, and supports branching', async () => {
        const store = new TestStore();
        const service = new ResearchProtocolService(store, new TestIds(), clock);
        const draft = await service.create({ purpose: 'Purpose', workingQuestionAim: 'Aim', scope: 'Scope' });
        await service.attachArtifact({ artifactId: 'report-1', protocolVersionId: draft.protocolVersionId, kind: 'report' });
        const revision = await service.revise({
            protocolVersionId: draft.protocolVersionId,
            changeRationale: 'Narrow the scope after an initial reading.',
            patch: { scope: 'Narrowed scope' },
        });
        expect(revision.diff.affectedArtifactIds).to.deep.equal(['report-1']);
        expect(revision.version.predecessor?.protocolVersionId).to.equal(draft.protocolVersionId);
        expect(revision.version.changes[0]?.field).to.equal('scope');

        const specified = await service.promote(revision.version.protocolVersionId);
        const snapshot = await service.snapshot(specified.protocolVersionId);
        let exportError: unknown;
        try {
            await service.exportSnapshot(snapshot.protocolVersionId);
        } catch (error) {
            exportError = error;
        }
        expect(exportError).to.be.instanceOf(Error);
        expect(snapshot.stage).to.equal('export_snapshot');

        const branch = await service.branch(snapshot.protocolVersionId, 'Explore an alternative reading path.');
        expect(branch.version.stage).to.equal('exploratory');
        expect(branch.version.predecessor?.protocolVersionId).to.equal(snapshot.protocolVersionId);
        expect((await store.getVersion(snapshot.protocolVersionId))?.stage).to.equal('export_snapshot');
    });

    it('separates claim evidence and posture permissions', async () => {
        const service = new ResearchProtocolService(new TestStore(), new TestIds(), clock);
        const exploratory = await service.create({ purpose: 'Purpose', workingQuestionAim: 'Aim', scope: 'Scope' });
        const unsupported = await service.evaluateClaimPosture({
            protocolVersionId: exploratory.protocolVersionId,
            text: 'The source proves the intervention causes change.',
            kind: 'substantive_system_claim',
            evidenceOutcome: 'supported',
        });
        expect(unsupported.valid).to.equal(false);
        expect(unsupported.prohibitedLanguage).to.include('conclusion');
        expect(unsupported.prohibitedLanguage).to.include('causality');

        const descriptive = await service.create({
            purpose: 'Describe bounded observations',
            workingQuestionAim: 'What is observed?',
            scope: 'Scope',
            posture: posture('descriptive'),
        });
        const observation = await service.evaluateClaimPosture({
            protocolVersionId: descriptive.protocolVersionId,
            text: 'The two variables are associated.',
            kind: 'derived_system_observation',
            auditLineage: 'audit:source-1:passage-2',
            evidenceOutcome: 'supported',
        });
        expect(observation.valid).to.equal(false);
        expect(observation.prohibitedLanguage).to.include('association');

        const causal = await service.create({
            purpose: 'Estimate an effect',
            workingQuestionAim: 'What is the effect?',
            scope: 'Scope',
            posture: posture('causal'),
        });
        const causalClaim = await service.evaluateClaimPosture({
            protocolVersionId: causal.protocolVersionId,
            text: 'The design estimates a causal effect.',
            kind: 'substantive_system_claim',
            evidenceOutcome: 'supported',
            causalContractValidated: true,
        });
        expect(causalClaim.valid).to.equal(true);
    });

    it('admits a synthesis run only with the saved protocol fields and one immutable version reference', async () => {
        const service = new ResearchProtocolService(new TestStore(), new TestIds(), clock);
        const version = await service.create({
            purpose: 'Purpose',
            workingQuestionAim: 'Aim',
            scope: 'Scope',
            sourceSetVersion: 'sources-1',
        });
        const request: SynthesisAdmissionRequest = {
            protocolVersionId: version.protocolVersionId,
            purpose: version.purpose,
            workingQuestionAim: version.workingQuestionAim,
            sourceSetVersion: version.sourceSetVersion,
            scope: version.scope,
        };
        const run = await service.admitSynthesisRun(request);
        expect(run.protocolVersionId).to.equal(version.protocolVersionId);
        let admissionError: unknown;
        try {
            await service.admitSynthesisRun({ ...request, scope: 'Different scope' });
        } catch (error) {
            admissionError = error;
        }
        expect(admissionError).to.be.instanceOf(Error);
    });
});
