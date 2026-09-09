// *****************************************************************************
// Copyright (C) 2026 Berry Studio and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import {
    deriveArtifactId,
    deriveExecutionFingerprint,
    derivePassageId,
    deriveSourceVersionId,
    sourceContentDigest,
} from '@theia/ivory-identity/lib/node/identity';
import { canonicalize, decodeBytes, deterministicId, digestCanonical, encodeBytes } from './canonical';
import {
    ActivityEdge,
    ActivityRecord,
    AdmitArtifactInput,
    AdmitSourceInput,
    AnnotationPayload,
    AnnotateInput,
    ArtifactPayload,
    CarryForwardPreview,
    CitationResolution,
    ClaimExplanation,
    ClaimPayload,
    CodebookPayload,
    CreateClaimInput,
    CreateCodebookInput,
    CreateEvidenceLinkInput,
    CreateFragmentInput,
    EvidenceLinkPayload,
    ExactRef,
    FragmentPayload,
    FragmentSelector,
    FreezeSnapshotInput,
    ReviseClaimInput,
    ReviseCodebookInput,
    RevisionRecord,
    SnapshotManifest,
    SnapshotMember,
    SnapshotRecord,
    SourcePayload,
    TableSelector,
    TextSelector,
} from './types';

const REVISION_SCHEMA = 'n1-revision/1';
const DEFAULT_PROJECT_ID = deterministicId('prj', { study: 'advising-agency', version: 1 });

interface StoredObject {
    readonly objectId: string;
    readonly objectType: RevisionRecord['objectType'];
    head: string;
    readonly revisions: Map<string, RevisionRecord>;
}

export class ResearchKernelError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ResearchKernelError';
    }
}

export class ExpectedHeadConflictError extends ResearchKernelError {
    constructor(
        readonly objectId: string,
        readonly expectedHead: string | undefined,
        readonly actualHead: string | undefined,
    ) {
        super(`expected head for '${objectId}' was '${expectedHead ?? '<absent>'}', actual head is '${actualHead ?? '<absent>'}'`);
        this.name = 'ExpectedHeadConflictError';
    }
}

export class ResearchKernel {
    readonly projectId: string;
    private projectSequence = 0;
    private readonly objects = new Map<string, StoredObject>();
    private readonly activities = new Map<string, ActivityRecord>();
    private readonly snapshots = new Map<string, SnapshotRecord>();

    constructor(projectId: string = DEFAULT_PROJECT_ID) {
        this.projectId = projectId;
    }

    get sequence(): number {
        return this.projectSequence;
    }

    getHead(objectId: string): string | undefined {
        return this.objects.get(objectId)?.head;
    }

    getRevision(ref: ExactRef): RevisionRecord {
        return cloneValue(this.loadRevision(ref));
    }

    getActivity(activityId: string): ActivityRecord {
        return cloneValue(this.loadActivity(activityId));
    }

    getSnapshot(snapshotId: string): SnapshotRecord {
        return cloneValue(this.loadSnapshot(snapshotId));
    }

    admitSource(input: AdmitSourceInput): ExactRef {
        const objectId = input.sourceId ?? deterministicId('src', { projectId: this.projectId, name: input.name });
        const bytes = encodeBytes(input.bytes);
        const contentDigest = sourceContentDigest(decodeBytes(bytes));
        const sourceVersionId = deriveSourceVersionId({ sourceId: objectId, contentDigest }).id;
        return this.append(
            'source',
            objectId,
            { name: input.name, contentBase64: bytes, contentDigest, sourceVersionId } satisfies SourcePayload,
            [],
            input.actor,
            'admitSource',
            input.expectedHead,
        );
    }

    replaceSource(input: AdmitSourceInput & { sourceId: string; expectedHead: string }): ExactRef {
        return this.admitSource(input);
    }

    createFragment(input: CreateFragmentInput): ExactRef {
        const source = this.requireRevision<SourcePayload>(input.sourceRef, 'source').payload;
        const artifact = this.requireRevision<ArtifactPayload>(input.artifactRef, 'artifact').payload;
        this.assertSelectorMatches(input.selector, [this.decodeSourceText(source), artifact.output]);
        let selector: FragmentSelector;
        if (input.selector.kind === 'text') {
            const passage = derivePassageId({
                sourceVersionId: source.sourceVersionId,
                extractionArtifactId: input.artifactRef.objectId,
                spans: [{ start: input.selector.start, end: input.selector.end }],
            });
            selector = {
                ...input.selector,
                passageId: passage.id,
            } satisfies TextSelector;
        } else {
            selector = { ...input.selector } satisfies TableSelector;
        }
        const objectId = deterministicId('frg', {
            projectId: this.projectId,
            key: input.fragmentKey,
            sourceRef: input.sourceRef,
            artifactRef: input.artifactRef,
            selector,
        });
        const payload: FragmentPayload = { sourceRef: input.sourceRef, artifactRef: input.artifactRef, selector };
        return this.append('fragment', objectId, payload, [input.sourceRef, input.artifactRef], input.actor, 'createFragment');
    }

    createCodebook(input: CreateCodebookInput): ExactRef {
        const objectId = deterministicId('cdb', { projectId: this.projectId, key: input.key });
        this.assertUniqueCodeIds(input.codes);
        const payload: CodebookPayload = { name: input.name, edition: 1, codes: input.codes };
        return this.append('codebook', objectId, payload, [], input.actor, 'createCodebook');
    }

    reviseCodebook(input: ReviseCodebookInput): ExactRef {
        const previous = this.requireRevision<CodebookPayload>(input.codebookRef, 'codebook').payload;
        this.assertUniqueCodeIds(input.codes);
        const revisedIds = new Set(input.codes.map(code => code.id));
        for (const code of previous.codes) {
            if (!revisedIds.has(code.id)) {
                throw new ResearchKernelError(`code '${code.id}' cannot disappear from codebook '${input.codebookRef.objectId}'`);
            }
        }
        const payload: CodebookPayload = { name: previous.name, edition: previous.edition + 1, codes: input.codes };
        return this.append('codebook', input.codebookRef.objectId, payload, [], input.actor, 'reviseCodebook', input.expectedHead);
    }

    annotate(input: AnnotateInput): ExactRef {
        this.requireRevision<FragmentPayload>(input.fragmentRef, 'fragment');
        const codebook = this.requireRevision<CodebookPayload>(input.codebookRef, 'codebook').payload;
        if (!codebook.codes.some(code => code.id === input.codeId)) {
            throw new ResearchKernelError(`code '${input.codeId}' is not present in codebook edition ${codebook.edition}`);
        }
        const payload: AnnotationPayload = {
            fragmentRef: input.fragmentRef,
            codebookRef: input.codebookRef,
            codeId: input.codeId,
            actor: input.actor,
            actorType: input.actorType ?? 'human',
            rationale: input.rationale,
        };
        const objectId = deterministicId('ann', { projectId: this.projectId, key: input.key, ...payload });
        return this.append('annotation', objectId, payload, [input.fragmentRef, input.codebookRef], input.actor, 'annotate');
    }

    createClaim(input: CreateClaimInput): ExactRef {
        const payload: ClaimPayload = {
            text: input.text,
            author: input.author,
            authorType: input.authorType ?? 'human',
            status: input.status ?? 'proposed',
        };
        const objectId = deterministicId('clm', { projectId: this.projectId, key: input.key });
        return this.append('claim', objectId, payload, [], input.actor ?? input.author, 'createClaim');
    }

    reviseClaim(input: ReviseClaimInput): ExactRef {
        const previous = this.requireRevision<ClaimPayload>(input.claimRef, 'claim').payload;
        const payload: ClaimPayload = {
            text: input.text,
            author: previous.author,
            authorType: previous.authorType,
            status: input.status ?? previous.status,
        };
        return this.append('claim', input.claimRef.objectId, payload, [], input.actor, 'reviseClaim', input.expectedHead);
    }

    createEvidenceLink(input: CreateEvidenceLinkInput): ExactRef {
        this.assertNoConfidence(input);
        this.requireRevision<ClaimPayload>(input.claimRef, 'claim');
        for (const target of input.targets) {
            this.loadRevision(target);
        }
        const payload: EvidenceLinkPayload = {
            claimRef: input.claimRef,
            targets: input.targets,
            role: input.role,
            rationale: input.rationale,
            linkAuthor: input.linkAuthor,
            linkAuthorType: input.linkAuthorType ?? 'human',
        };
        const objectId = deterministicId('evl', { projectId: this.projectId, key: input.key, ...payload });
        return this.append(
            'evidenceLink',
            objectId,
            payload,
            [input.claimRef, ...input.targets],
            input.actor ?? input.linkAuthor,
            'createEvidenceLink',
        );
    }

    admitArtifact(input: AdmitArtifactInput): ExactRef {
        if (input.sourceRefs.length === 0) {
            throw new ResearchKernelError('an artifact must have at least one source reference');
        }
        const sourceVersionIds = input.sourceRefs.map(ref => {
            const source = this.requireRevision<SourcePayload>(ref, 'source').payload;
            return source.sourceVersionId;
        });
        const executionId = deterministicId('exec', { projectId: this.projectId, key: input.key });
        const fingerprint = deriveExecutionFingerprint({
            transformation: input.transformation ?? 'research.excerpt-matrix',
            transformationVersion: 'n1/1',
            inputIds: sourceVersionIds,
            parameters: { outputRole: 'excerpt-matrix' },
            policyVersion: 'n1/1',
        });
        const artifact = deriveArtifactId({
            fingerprint: fingerprint.id,
            outputRole: 'excerpt-matrix',
            determinism: 'observed',
            outputDigest: sourceContentDigest(new TextEncoder().encode(input.output)),
        });
        const payload: ArtifactPayload = {
            artifactId: artifact.id,
            executionId,
            fingerprintId: fingerprint.id,
            sourceRefs: input.sourceRefs,
            output: input.output,
            outputDigest: sourceContentDigest(new TextEncoder().encode(input.output)),
        };
        return this.append('artifact', artifact.id, payload, [...input.sourceRefs], input.actor, 'admitArtifact');
    }

    previewCarryForward(from: ExactRef, to: ExactRef): CarryForwardPreview {
        this.requireRevision<ClaimPayload>(from, 'claim');
        this.requireRevision<ClaimPayload>(to, 'claim');
        if (sameRef(from, to)) {
            throw new ResearchKernelError('carry-forward requires two distinct revisions of a claim');
        }
        const links: ExactRef[] = [];
        for (const object of this.objects.values()) {
            if (object.objectType !== 'evidenceLink') {
                continue;
            }
            const head = object.revisions.get(object.head);
            const payload = head?.payload as EvidenceLinkPayload | undefined;
            if (payload && sameRef(payload.claimRef, from)) {
                links.push(refFor(head!, this.projectId));
            }
        }
        return { from, to, links };
    }

    carryForwardLinks(from: ExactRef, to: ExactRef, actor: string): ExactRef[] {
        const preview = this.previewCarryForward(from, to);
        return preview.links.map(linkRef => {
            const link = this.getRevision(linkRef).payload as EvidenceLinkPayload;
            return this.createEvidenceLink({
                key: `carry-forward:${linkRef.revisionId}:${to.revisionId}`,
                claimRef: to,
                targets: link.targets,
                role: link.role,
                rationale: link.rationale,
                linkAuthor: link.linkAuthor,
                linkAuthorType: link.linkAuthorType,
                actor,
            });
        });
    }

    freezeSnapshot(input: FreezeSnapshotInput): SnapshotRecord {
        const selected = input.selected.map(item =>
            cloneValue(typeof item === 'string' ? this.headRefAtSequence(item, this.projectSequence) : item),
        );
        const context = cloneValue([...(input.context ?? [])]);
        for (const ref of [...selected, ...context]) {
            this.validateRef(ref);
            if (this.getRevision(ref).projectSequence > this.projectSequence) {
                throw new ResearchKernelError(`snapshot reference '${ref.revisionId}' is newer than its freeze sequence`);
            }
        }
        const roleByKey = new Map<string, SnapshotMember['role']>();
        const queue: ExactRef[] = [];
        const add = (ref: ExactRef, role: SnapshotMember['role']): void => {
            const key = refKey(ref);
            if (!roleByKey.has(key)) {
                roleByKey.set(key, role);
                queue.push(ref);
            }
        };
        selected.forEach(ref => add(ref, 'selected'));
        context.forEach(ref => add(ref, 'context'));
        const visiting = new Set<string>();
        const visited = new Set<string>();
        const ordered: ExactRef[] = [];
        while (queue.length > 0) {
            const ref = queue.shift()!;
            const key = refKey(ref);
            this.walkSemantic(ref, visiting, visited, ordered);
            const revision = this.getRevision(ref);
            for (const dependency of revision.exactRefs) {
                add(dependency, roleByKey.has(refKey(dependency)) ? roleByKey.get(refKey(dependency))! : 'dependency');
            }
            roleByKey.set(key, roleByKey.get(key)!);
        }
        const members = ordered.map(
            ref =>
                ({
                    ref,
                    role: roleByKey.get(refKey(ref)) ?? 'dependency',
                    revisionDigest: this.getRevision(ref).digest,
                }) satisfies SnapshotMember,
        );
        const selectedKeys = new Set(selected.map(refKey));
        const contextKeys = new Set(context.map(refKey));
        const dependencies = members
            .filter(member => !selectedKeys.has(refKey(member.ref)) && !contextKeys.has(refKey(member.ref)))
            .map(member => member.ref);
        const manifest: SnapshotManifest = {
            projectId: this.projectId,
            projectSequence: this.projectSequence,
            selected,
            context,
            dependencies,
            members,
        };
        const digest = digestCanonical(manifest);
        const snapshotId = deterministicId('snp', { projectId: this.projectId, digest });
        const snapshot = freezeValue({
            snapshotId,
            digest,
            manifest: cloneValue(manifest),
            label: input.label,
            researcher: input.researcher,
            createdAt: input.createdAt ?? new Date().toISOString(),
        } satisfies SnapshotRecord);
        this.snapshots.set(snapshotId, snapshot);
        return cloneValue(snapshot);
    }

    resolveCitation(ref: ExactRef, snapshotId?: string): CitationResolution {
        if (snapshotId) {
            this.assertSnapshotContains(snapshotId, ref);
        }
        const fragment = this.requireRevision<FragmentPayload>(ref, 'fragment').payload;
        const sourceRevision = this.requireRevision<SourcePayload>(fragment.sourceRef, 'source').payload;
        const selector = fragment.selector;
        const quote = selector.kind === 'text' ? selector.quote : selector.value;
        return cloneValue({
            ref,
            quote,
            sourceVersionId: sourceRevision.sourceVersionId,
            selector,
            sourceName: sourceRevision.name,
        });
    }

    explainClaim(snapshotId: string, claimRef: ExactRef): ClaimExplanation {
        this.assertSnapshotContains(snapshotId, claimRef);
        const claim = this.getRevision(claimRef).payload as ClaimPayload;
        const snapshot = this.getSnapshot(snapshotId);
        const links = snapshot.manifest.members.flatMap(member => {
            const isExplicit =
                snapshot.manifest.selected.some(ref => refKey(ref) === refKey(member.ref)) ||
                snapshot.manifest.context.some(ref => refKey(ref) === refKey(member.ref));
            if (member.role === 'dependency' && !isExplicit) {
                return [];
            }
            const payload = this.getRevision(member.ref).payload as Partial<EvidenceLinkPayload>;
            if (!payload.claimRef || !sameRef(payload.claimRef, claimRef)) {
                return [];
            }
            const citationRef = payload.targets?.find(target => this.objects.get(target.objectId)?.objectType === 'fragment');
            const annotationRef = payload.targets?.find(target => this.objects.get(target.objectId)?.objectType === 'annotation');
            const codebookEdition = annotationRef ? this.codebookEditionForAnnotation(annotationRef) : undefined;
            return [
                {
                    ref: member.ref,
                    role: payload.role!,
                    linkAuthor: payload.linkAuthor!,
                    authoredByDifferentPerson: payload.linkAuthor !== claim.author,
                    codebookEdition,
                    citation: citationRef ? this.resolveCitation(citationRef, snapshotId) : undefined,
                },
            ];
        });
        const lines = [
            `Claim: ${claim.text}`,
            `Author: ${claim.author} (${claim.authorType}); status: ${claim.status}`,
            ...links.map(link => {
                const authorNote = link.authoredByDifferentPerson
                    ? `link author ${link.linkAuthor} differs from claim author ${claim.author}`
                    : `link author ${link.linkAuthor}`;
                const edition = link.codebookEdition === undefined ? '' : ` codebook edition ${link.codebookEdition};`;
                const citation = link.citation ? ` quote: “${link.citation.quote}” (source ${link.citation.sourceName})` : '';
                return `- ${link.role}; ${authorNote};${edition}${citation}`;
            }),
            'This is attribution, not endorsement.',
        ];
        return {
            claimRef,
            claim,
            links,
            text: lines.join('\n'),
        };
    }

    addActivityEdge(activityId: string, edge: ActivityEdge): void {
        const activity = this.loadActivity(activityId);
        this.validateRef(edge.target);
        activity.edges.push(cloneValue(edge));
    }

    private append<T>(
        objectType: RevisionRecord['objectType'],
        objectId: string,
        payload: T,
        exactRefs: readonly ExactRef[],
        actor: string,
        command: string,
        expectedHead?: string,
    ): ExactRef {
        this.assertNoLatest(payload);
        exactRefs.forEach(ref => this.validateRef(ref));
        const existing = this.objects.get(objectId);
        if (existing && existing.objectType !== objectType) {
            throw new ResearchKernelError(
                `cannot append a '${objectType}' revision onto '${existing.objectType}' object '${objectId}'`,
            );
        }
        if (existing && expectedHead !== existing.head) {
            throw new ExpectedHeadConflictError(objectId, expectedHead, existing.head);
        }
        if (!existing && expectedHead !== undefined) {
            throw new ExpectedHeadConflictError(objectId, expectedHead, undefined);
        }
        const storedPayload = freezeValue(cloneValue(payload));
        const storedRefs = freezeValue(cloneValue([...exactRefs]));
        this.projectSequence += 1;
        const predecessor = existing ? refFor(existing.revisions.get(existing.head)!, this.projectId) : undefined;
        const activityId = deterministicId('act', {
            projectId: this.projectId,
            projectSequence: this.projectSequence,
            command,
            objectId,
            actor,
            payload: storedPayload,
            exactRefs: storedRefs,
        });
        const revisionId = deterministicId('rev', {
            schemaVersion: REVISION_SCHEMA,
            objectId,
            predecessor,
            payload: storedPayload,
            exactRefs: storedRefs,
            activityId,
        });
        const revision = freezeValue({
            revisionId,
            objectId,
            objectType,
            revisionNumber: existing ? existing.revisions.size + 1 : 1,
            predecessor,
            payload: storedPayload,
            exactRefs: storedRefs,
            activityId,
            projectSequence: this.projectSequence,
            schemaVersion: REVISION_SCHEMA,
            digest: digestCanonical({
                schemaVersion: REVISION_SCHEMA,
                objectId,
                predecessor,
                payload: storedPayload,
                exactRefs: storedRefs,
                activityId,
            }),
        } satisfies RevisionRecord<T>);
        const stored = existing ?? { objectId, objectType, head: revisionId, revisions: new Map<string, RevisionRecord>() };
        stored.revisions.set(revisionId, revision);
        stored.head = revisionId;
        this.objects.set(objectId, stored);
        this.activities.set(activityId, {
            activityId,
            command,
            actor,
            projectSequence: this.projectSequence,
            edges: [],
        });
        return refFor(revision, this.projectId);
    }

    private walkSemantic(ref: ExactRef, visiting: Set<string>, visited: Set<string>, ordered: ExactRef[]): void {
        const key = refKey(ref);
        if (visiting.has(key)) {
            throw new ResearchKernelError(`semantic reference cycle detected at '${key}'`);
        }
        if (visited.has(key)) {
            return;
        }
        visiting.add(key);
        const revision = this.getRevision(ref);
        ordered.push(ref);
        for (const dependency of revision.exactRefs) {
            this.walkSemantic(dependency, visiting, visited, ordered);
        }
        visiting.delete(key);
        visited.add(key);
    }

    private headRefAtSequence(objectId: string, sequence: number): ExactRef {
        const object = this.objects.get(objectId);
        if (!object) {
            throw new ResearchKernelError(`unknown object '${objectId}'`);
        }
        const candidates = [...object.revisions.values()]
            .filter(revision => revision.projectSequence <= sequence)
            .sort((left, right) => right.projectSequence - left.projectSequence);
        const headRevision = candidates[0];
        if (!headRevision) {
            throw new ResearchKernelError(`object '${objectId}' did not exist at sequence ${sequence}`);
        }
        return refFor(headRevision, this.projectId);
    }

    private assertSnapshotContains(snapshotId: string, ref: ExactRef): void {
        const snapshot = this.getSnapshot(snapshotId);
        if (!snapshot.manifest.members.some(member => sameRef(member.ref, ref))) {
            throw new ResearchKernelError(`reference '${ref.objectId}@${ref.revisionId}' is not in snapshot '${snapshotId}'`);
        }
    }

    private codebookEditionForAnnotation(annotationRef: ExactRef): number | undefined {
        const annotation = this.requireRevision<AnnotationPayload>(annotationRef, 'annotation').payload;
        return this.requireRevision<CodebookPayload>(annotation.codebookRef, 'codebook').payload.edition;
    }

    private loadRevision(ref: ExactRef): RevisionRecord {
        this.validateRef(ref);
        const record = this.objects.get(ref.objectId)?.revisions.get(ref.revisionId);
        if (!record) {
            throw new ResearchKernelError(`unknown revision '${ref.revisionId}' for '${ref.objectId}'`);
        }
        return record;
    }

    private loadActivity(activityId: string): ActivityRecord {
        const activity = this.activities.get(activityId);
        if (!activity) {
            throw new ResearchKernelError(`unknown activity '${activityId}'`);
        }
        return activity;
    }

    private loadSnapshot(snapshotId: string): SnapshotRecord {
        const snapshot = this.snapshots.get(snapshotId);
        if (!snapshot) {
            throw new ResearchKernelError(`unknown snapshot '${snapshotId}'`);
        }
        return snapshot;
    }

    private requireRevision<T>(ref: ExactRef, objectType: RevisionRecord['objectType']): RevisionRecord<T> {
        const record = this.loadRevision(ref);
        if (record.objectType !== objectType) {
            throw new ResearchKernelError(
                `reference '${ref.objectId}@${ref.revisionId}' is a '${record.objectType}', expected '${objectType}'`,
            );
        }
        return record as RevisionRecord<T>;
    }

    private decodeSourceText(payload: SourcePayload): string {
        return new TextDecoder().decode(decodeBytes(payload.contentBase64));
    }

    private assertSelectorMatches(selector: Omit<TextSelector, 'passageId'> | TableSelector, representations: readonly string[]): void {
        if (selector.kind === 'text') {
            if (!Number.isInteger(selector.start) || !Number.isInteger(selector.end)) {
                throw new ResearchKernelError(`fragment offsets must be integers, got [${selector.start}, ${selector.end})`);
            }
            const matched = representations.some(
                text =>
                    selector.start >= 0 &&
                    selector.end <= text.length &&
                    selector.start < selector.end &&
                    text.slice(selector.start, selector.end) === selector.quote,
            );
            if (!matched) {
                throw new ResearchKernelError('fragment quotation and offsets must match a retained representation');
            }
            return;
        }
        if (!selector.value || !representations.some(text => text.includes(selector.value))) {
            throw new ResearchKernelError('fragment table value must match a retained representation');
        }
    }

    private validateRef(ref: ExactRef): void {
        if (ref.projectId !== this.projectId || !ref.objectId || !ref.revisionId || ref.revisionId === 'latest') {
            throw new ResearchKernelError(`only exact project/object/revision references are accepted: ${canonicalize(ref)}`);
        }
        const object = this.objects.get(ref.objectId);
        if (!object || !object.revisions.has(ref.revisionId)) {
            throw new ResearchKernelError(`unknown revision '${ref.revisionId}' for '${ref.objectId}'`);
        }
    }

    private assertNoLatest(value: unknown): void {
        if (value && typeof value === 'object') {
            for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
                if (key === 'latest' || (key === 'revisionId' && child === 'latest')) {
                    throw new ResearchKernelError("the navigation-only 'latest' pointer cannot enter semantic data");
                }
                this.assertNoLatest(child);
            }
        }
    }

    private assertNoConfidence(input: CreateEvidenceLinkInput): void {
        const scan = (value: unknown): void => {
            if (!value || typeof value !== 'object') {
                return;
            }
            for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
                if (key.toLowerCase() === 'confidence') {
                    throw new ResearchKernelError('EvidenceLink cannot store a confidence score');
                }
                scan(child);
            }
        };
        scan(input);
    }

    private assertUniqueCodeIds(codes: readonly { id: string }[]): void {
        const ids = new Set<string>();
        for (const code of codes) {
            if (!code.id || ids.has(code.id)) {
                throw new ResearchKernelError('code IDs must be non-empty and unique within a codebook');
            }
            ids.add(code.id);
        }
    }
}

function refFor(revision: RevisionRecord, projectId: string): ExactRef {
    return { projectId, objectId: revision.objectId, revisionId: revision.revisionId };
}

function refKey(ref: ExactRef): string {
    return `${ref.projectId}/${ref.objectId}/${ref.revisionId}`;
}

function sameRef(left: ExactRef, right: ExactRef): boolean {
    return left.projectId === right.projectId && left.objectId === right.objectId && left.revisionId === right.revisionId;
}

function cloneValue<T>(value: T): T {
    return structuredClone(value);
}

function freezeValue<T>(value: T): T {
    if (value && typeof value === 'object') {
        Object.freeze(value);
        if (Array.isArray(value)) {
            for (const item of value) {
                freezeValue(item);
            }
        } else {
            for (const child of Object.values(value as Record<string, unknown>)) {
                freezeValue(child);
            }
        }
    }
    return value;
}
