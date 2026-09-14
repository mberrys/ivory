// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { ClockPort, ResearchProtocolIdPort, ResearchProtocolStore } from '@ivory-tower/adapters';
import {
    ClaimPosture,
    ClaimPostureEvaluationRequest,
    ClaimPostureValidationResult,
    ProtocolArtifact,
    ProtocolChange,
    ProtocolExportReference,
    ProtocolRunReference,
    ProtocolVersionRef,
    ResearchProtocolVersion,
    SemanticProtocolDiff,
    SelectionMode,
    SynthesisAdmissionRequest,
    claimPostureEvaluationRequestSchema,
    claimPostureValidationResultSchema,
    researchProtocolVersionSchema,
    synthesisAdmissionRequestSchema,
} from '@ivory-tower/contracts';

export interface CreateResearchProtocolInput {
    readonly purpose: string;
    readonly workingQuestionAim: string;
    readonly scope: string;
    readonly taskIntent?: string;
    readonly sourceSetVersion?: string;
    readonly selectionMode?: SelectionMode;
    readonly selectionRationale?: string;
    readonly inclusionRationale?: string;
    readonly exclusionRationale?: string;
    readonly boundaries?: readonly string[];
    readonly limitations?: readonly string[];
    readonly processingPolicyVersion?: string;
    readonly author?: string;
    readonly posture?: ClaimPosture;
    readonly coverageClaims?: ResearchProtocolVersion['coverageClaims'];
}

export interface ReviseResearchProtocolInput {
    readonly protocolVersionId: string;
    readonly changeRationale: string;
    readonly patch: Partial<
        Pick<
            ResearchProtocolVersion,
            | 'purpose'
            | 'workingQuestionAim'
            | 'taskIntent'
            | 'sourceSetVersion'
            | 'scope'
            | 'selectionMode'
            | 'selectionRationale'
            | 'inclusionRationale'
            | 'exclusionRationale'
            | 'boundaries'
            | 'limitations'
            | 'processingPolicyVersion'
            | 'author'
            | 'posture'
            | 'coverageClaims'
        >
    >;
}

export interface ResearchProtocolRevisionResult {
    readonly version: ResearchProtocolVersion;
    readonly diff: SemanticProtocolDiff;
}

const SEMANTIC_FIELDS = [
    'purpose',
    'workingQuestionAim',
    'taskIntent',
    'sourceSetVersion',
    'scope',
    'selectionMode',
    'selectionRationale',
    'inclusionRationale',
    'exclusionRationale',
    'boundaries',
    'limitations',
    'processingPolicyVersion',
    'author',
    'posture',
    'coverageClaims',
] as const;

const LANGUAGE_RULES: ReadonlyArray<readonly [string, RegExp]> = [
    ['causality', /\b(cause|causes|caused|causal|effect|effects|impact|impacts|lead|leads|led)\b/iu],
    ['association', /\b(associated|association|correlated|correlation|related)\b/iu],
    ['prevalence', /\b(prevalence|most|majority|common|widespread)\b/iu],
    ['conclusion', /\b(conclude|concludes|concluded|demonstrates|demonstrate|proves|prove)\b/iu],
    ['coverage:comprehensive', /\bcomprehensive\b/iu],
    ['coverage:representative', /\brepresentative\b/iu],
    ['coverage:systematic', /\bsystematic\b/iu],
];

export class ResearchProtocolService {
    constructor(
        private readonly store: ResearchProtocolStore,
        private readonly ids: ResearchProtocolIdPort,
        private readonly clock: ClockPort,
    ) {}

    async create(input: CreateResearchProtocolInput): Promise<ResearchProtocolVersion> {
        const now = this.clock.now().toISOString();
        const version = researchProtocolVersionSchema.parse({
            protocolId: this.ids.next(),
            protocolVersionId: this.ids.next(),
            versionNumber: 1,
            stage: 'exploratory',
            branchId: this.ids.next(),
            createdAt: now,
            updatedAt: now,
            purpose: input.purpose,
            workingQuestionAim: input.workingQuestionAim,
            taskIntent: input.taskIntent ?? 'Explore the source set and refine the question.',
            sourceSetVersion: input.sourceSetVersion ?? 'draft-source-set-1',
            scope: input.scope,
            selectionMode: input.selectionMode ?? 'purposive',
            selectionRationale: input.selectionRationale ?? 'An initial exploratory selection; it is not representative.',
            inclusionRationale: input.inclusionRationale ?? 'Include sources that directly illuminate the working question.',
            exclusionRationale: input.exclusionRationale ?? 'Exclude sources outside the stated scope or without reusable rights.',
            boundaries: input.boundaries === undefined ? ['Exploratory scope only.'] : Array.from(input.boundaries),
            limitations:
                input.limitations === undefined
                    ? ['Not representative; findings require later validation.']
                    : Array.from(input.limitations),
            processingPolicyVersion: input.processingPolicyVersion ?? 'ivory-processing-policy-v1',
            author: input.author ?? 'researcher',
            predecessor: undefined,
            changeRationale: 'Initial exploratory protocol.',
            posture: input.posture ?? { kind: 'exploratory' },
            coverageClaims: input.coverageClaims ?? [],
            changes: [],
            affectedArtifactIds: [],
        });
        return this.store.saveVersion(version);
    }

    async revise(input: ReviseResearchProtocolInput): Promise<ResearchProtocolRevisionResult> {
        const current = await this.requireVersion(input.protocolVersionId);
        const versions = await this.store.listVersions(current.protocolId);
        const artifacts = await this.store.listArtifacts(current.protocolVersionId);
        const now = this.clock.now().toISOString();
        const predecessor = this.toRef(current);
        const candidate = researchProtocolVersionSchema.parse({
            ...current,
            ...input.patch,
            protocolVersionId: this.ids.next(),
            versionNumber: Math.max(...versions.map(candidateVersion => candidateVersion.versionNumber), current.versionNumber) + 1,
            stage: 'exploratory',
            createdAt: now,
            updatedAt: now,
            predecessor,
            changeRationale: input.changeRationale,
            changes: Array.from(this.semanticChanges(current, input.patch, input.changeRationale)),
            affectedArtifactIds: artifacts.map(artifact => artifact.artifactId),
        });
        const version = await this.store.saveVersion(candidate);
        return { version, diff: this.makeDiff(predecessor, version, version.changes, artifacts) };
    }

    async branch(protocolVersionId: string, changeRationale: string): Promise<ResearchProtocolRevisionResult> {
        const current = await this.requireVersion(protocolVersionId);
        const artifacts = await this.store.listArtifacts(current.protocolVersionId);
        const now = this.clock.now().toISOString();
        const predecessor = this.toRef(current);
        const version = researchProtocolVersionSchema.parse({
            ...current,
            protocolVersionId: this.ids.next(),
            versionNumber: current.versionNumber + 1,
            stage: 'exploratory',
            branchId: this.ids.next(),
            createdAt: now,
            updatedAt: now,
            predecessor,
            changeRationale,
            changes: [{ field: 'branch', kind: 'changed', previous: current.branchId, next: undefined, rationale: changeRationale }],
            affectedArtifactIds: artifacts.map(artifact => artifact.artifactId),
        });
        const saved = await this.store.saveVersion(version);
        return { version: saved, diff: this.makeDiff(predecessor, saved, saved.changes, artifacts) };
    }

    async promote(protocolVersionId: string): Promise<ResearchProtocolVersion> {
        const current = await this.requireVersion(protocolVersionId);
        if (current.stage !== 'exploratory') {
            throw new Error(`Only exploratory protocols can be promoted; received ${current.stage}.`);
        }
        return this.store.saveVersion(
            researchProtocolVersionSchema.parse({
                ...current,
                stage: 'specified',
                updatedAt: this.clock.now().toISOString(),
                changes: [
                    ...current.changes,
                    {
                        field: 'stage',
                        kind: 'changed',
                        previous: 'exploratory',
                        next: 'specified',
                        rationale: 'Explicit promotion to a specified protocol.',
                    },
                ],
            }),
        );
    }

    async snapshot(protocolVersionId: string): Promise<ResearchProtocolVersion> {
        const current = await this.requireVersion(protocolVersionId);
        if (current.stage !== 'specified') {
            throw new Error(`Only specified protocols can be exported; received ${current.stage}.`);
        }
        return this.store.saveVersion(
            researchProtocolVersionSchema.parse({
                ...current,
                stage: 'export_snapshot',
                updatedAt: this.clock.now().toISOString(),
                changes: [
                    ...current.changes,
                    {
                        field: 'stage',
                        kind: 'changed',
                        previous: 'specified',
                        next: 'export_snapshot',
                        rationale: 'Explicit immutable export snapshot.',
                    },
                ],
            }),
        );
    }

    async exportSnapshot(protocolVersionId: string): Promise<ProtocolExportReference> {
        const version = await this.snapshot(protocolVersionId);
        return this.store.saveExport({ exportId: this.ids.next(), protocolVersionId: version.protocolVersionId });
    }

    async retrieveLineage(protocolVersionId: string): Promise<readonly ResearchProtocolVersion[]> {
        const lineage: ResearchProtocolVersion[] = [];
        let current = await this.requireVersion(protocolVersionId);
        const seen = new Set<string>();
        while (!seen.has(current.protocolVersionId)) {
            seen.add(current.protocolVersionId);
            lineage.unshift(current);
            if (current.predecessor === undefined) {
                break;
            }
            current = await this.requireVersion(current.predecessor.protocolVersionId);
        }
        return lineage;
    }

    async semanticDiff(predecessorId: string, successorId: string): Promise<SemanticProtocolDiff> {
        const successor = await this.requireVersion(successorId);
        const predecessor = await this.requireVersion(predecessorId);
        const artifacts = await this.store.listArtifacts(predecessor.protocolVersionId);
        return this.makeDiff(this.toRef(predecessor), successor, successor.changes, artifacts);
    }

    async attachArtifact(artifact: ProtocolArtifact): Promise<void> {
        await this.requireVersion(artifact.protocolVersionId);
        await this.store.attachArtifact(artifact);
    }

    async evaluateClaimPosture(input: ClaimPostureEvaluationRequest): Promise<ClaimPostureValidationResult> {
        const request = claimPostureEvaluationRequestSchema.parse(input);
        const version = await this.requireVersion(request.protocolVersionId);
        const prohibitedLanguage = this.findProhibitedLanguage(version, request.text, request.causalContractValidated);
        const reasons = [
            ...prohibitedLanguage.map(language => `The claim uses prohibited ${language} language for a ${version.posture.kind} posture.`),
        ];
        if (request.kind === 'substantive_system_claim' && request.evidenceOutcome === undefined) {
            reasons.push('Substantive system claims require a validated evidence outcome.');
        }
        if (request.kind === 'derived_system_observation' && request.auditLineage === undefined) {
            reasons.push('Derived system observations require audit lineage.');
        }
        if (request.kind === 'researcher_authored_assertion') {
            reasons.push('Researcher-authored assertions retain authorship and are not system-supported claims.');
        }
        return claimPostureValidationResultSchema.parse({
            valid: reasons.length === 0 || (request.kind === 'researcher_authored_assertion' && prohibitedLanguage.length === 0),
            posture: version.posture,
            claimKind: request.kind,
            evidenceOutcome: request.evidenceOutcome,
            prohibitedLanguage,
            reasons,
        });
    }

    async admitSynthesisRun(input: SynthesisAdmissionRequest): Promise<ProtocolRunReference> {
        const request = synthesisAdmissionRequestSchema.parse(input);
        const version = await this.requireVersion(request.protocolVersionId);
        if (
            version.purpose !== request.purpose ||
            version.workingQuestionAim !== request.workingQuestionAim ||
            version.sourceSetVersion !== request.sourceSetVersion ||
            version.scope !== request.scope
        ) {
            throw new Error('Synthesis admission must repeat the saved purpose, aim, source-set version, and scope exactly.');
        }
        return this.store.saveRun({ runId: this.ids.next(), protocolVersionId: version.protocolVersionId });
    }

    private async requireVersion(protocolVersionId: string): Promise<ResearchProtocolVersion> {
        const version = await this.store.getVersion(protocolVersionId);
        if (version === undefined) {
            throw new Error(`Unknown research protocol version ${protocolVersionId}.`);
        }
        return researchProtocolVersionSchema.parse(version);
    }

    private toRef(version: ResearchProtocolVersion): ProtocolVersionRef {
        return {
            protocolId: version.protocolId,
            protocolVersionId: version.protocolVersionId,
            stage: version.stage,
            branchId: version.branchId,
        } as const;
    }

    private semanticChanges(
        current: ResearchProtocolVersion,
        patch: ReviseResearchProtocolInput['patch'],
        rationale: string,
    ): readonly ProtocolChange[] {
        const changes: ProtocolChange[] = [];
        for (const field of SEMANTIC_FIELDS) {
            if (!(field in patch)) {
                continue;
            }
            const previous = current[field];
            const next = patch[field];
            if (JSON.stringify(previous) !== JSON.stringify(next)) {
                changes.push({ field, kind: 'changed', previous, next, rationale });
            }
        }
        return changes.length === 0 ? [{ field: 'revision', kind: 'changed', rationale }] : changes;
    }

    private makeDiff(
        predecessor: ReturnType<ResearchProtocolService['toRef']>,
        successor: ResearchProtocolVersion,
        changes: readonly ProtocolChange[],
        artifacts: readonly ProtocolArtifact[],
    ): SemanticProtocolDiff {
        return {
            predecessor,
            successor: this.toRef(successor),
            changes: Array.from(changes),
            affectedArtifactIds: artifacts.map(artifact => artifact.artifactId),
        };
    }

    private findProhibitedLanguage(version: ResearchProtocolVersion, text: string, causalContractValidated: boolean): string[] {
        const posture = version.posture;
        const prohibited = new Set<string>();
        const add = (name: string): void => {
            prohibited.add(name);
        };
        const matches = (name: string): boolean => LANGUAGE_RULES.find(([ruleName, pattern]) => ruleName === name)?.[1].test(text) ?? false;
        if (posture.kind === 'exploratory') {
            if (matches('conclusion')) {
                add('conclusion');
            }
            if (matches('causality')) {
                add('causality');
            }
        }
        if (['interpretive', 'critical/discourse', 'historical/contextual'].includes(posture.kind)) {
            if (matches('prevalence')) {
                add('prevalence');
            }
            if (matches('causality')) {
                add('causality');
            }
        }
        if (posture.kind === 'descriptive') {
            if (matches('association') || matches('causality')) {
                add(matches('association') ? 'association' : 'causality');
            }
        }
        if (posture.kind === 'associational' && matches('causality')) {
            add('causality');
        }
        if (matches('causality') && (posture.kind !== 'causal' || !causalContractValidated)) {
            add('causality');
        }
        for (const term of ['comprehensive', 'representative', 'systematic'] as const) {
            if (text.toLocaleLowerCase().includes(term) && !this.hasCoverageClaim(term, version)) {
                add(`coverage:${term}`);
            }
        }
        return [...prohibited];
    }

    private hasCoverageClaim(term: 'comprehensive' | 'representative' | 'systematic', version: ResearchProtocolVersion): boolean {
        return version.coverageClaims.some(claim => claim.term === term && claim.sourceSelectionEvidence.trim().length > 0);
    }
}
