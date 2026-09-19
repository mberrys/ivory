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
    AcceptAgentProposalInput,
    AgentProposalReceipt,
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
    EvidenceFragmentTarget,
    EvidenceLinkPayload,
    ExactRef,
    FragmentAnchorIdentity,
    FragmentContext,
    FragmentContextInput,
    FragmentContextReference,
    FragmentPayload,
    FragmentProfile,
    FragmentRemapReceipt,
    FragmentRepresentationKind,
    FragmentSelector,
    FragmentSelectorInput,
    FreezeSnapshotInput,
    MechanicalCitationReceipt,
    RemapFragmentInput,
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
const DEFAULT_SELECTOR_PROFILE_REVISION = 'selector-v1';
const MAX_FRAGMENT_CONTEXT_REFERENCES = 32;
const MAX_FRAGMENT_SELECTOR_TEXT = 65_536;

interface StoredObject {
    readonly objectId: string;
    readonly objectType: RevisionRecord['objectType'];
    head: string;
    readonly revisions: Map<string, RevisionRecord>;
}

interface RetainedRepresentation {
    readonly kind: FragmentRepresentationKind;
    readonly ref: ExactRef;
    readonly digest: string;
    readonly text: string;
    readonly defaultProfile: FragmentProfile;
}

interface ContextRemapResult {
    readonly status: 'EXACT' | 'AMBIGUOUS' | 'UNRESOLVED';
    readonly context?: FragmentContext;
    readonly reason?: string;
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
    private objects = new Map<string, StoredObject>();
    private activities = new Map<string, ActivityRecord>();
    private readonly snapshots = new Map<string, SnapshotRecord>();
    private proposalReceipts = new Map<string, AgentProposalReceipt>();

    constructor(projectId: string = DEFAULT_PROJECT_ID) {
        this.projectId = projectId;
    }

    get sequence(): number {
        return this.projectSequence;
    }

    /** Stage the complete bounded effect before publishing any state. No await or external I/O. */
    acceptAgentProposal(input: AcceptAgentProposalInput): AgentProposalReceipt {
        const requestDigest = digestCanonical(input);
        const existing = this.proposalReceipts.get(input.idempotencyKey);
        if (existing) {
            if (existing.requestDigest !== requestDigest) {
                throw new ResearchKernelError('idempotency_conflict');
            }
            return cloneValue(existing);
        }
        if (
            !/^[a-f0-9]{64}$/.test(input.proposalDigest) ||
            [input.idempotencyKey, input.researcher, input.provider, input.model, input.text, input.rationale].some(
                value => !value.trim(),
            ) ||
            !['supports', 'challenges'].includes(input.role)
        ) {
            throw new ResearchKernelError('invalid_proposal');
        }
        this.requireRevision<ClaimPayload>(input.expectedClaim, 'claim');
        if (this.getHead(input.expectedClaim.objectId) !== input.expectedClaim.revisionId) {
            throw new ResearchKernelError('stale_proposal');
        }
        this.resolveCitation(input.fragmentRef);
        const staged = new ResearchKernel(this.projectId);
        staged.projectSequence = this.projectSequence;
        staged.objects = new Map([...this.objects].map(([key, value]) => [key, { ...value, revisions: new Map(value.revisions) }]));
        staged.activities = new Map(this.activities);
        const author = `model:${input.provider}:${input.model}`;
        const activityId = deterministicId('act', { projectId: this.projectId, requestDigest });
        const claimRef = staged.append(
            'claim',
            deterministicId('clm', { proposal: input.proposalDigest }),
            {
                text: input.text,
                author,
                authorType: 'model',
                status: 'accepted',
            } satisfies ClaimPayload,
            [input.fragmentRef],
            input.researcher,
            'acceptAgentProposal',
            undefined,
            activityId,
        );
        const linkRef = staged.append(
            'evidenceLink',
            deterministicId('evl', { proposal: input.proposalDigest }),
            {
                claimRef,
                targets: [input.fragmentRef],
                fragmentTargets: [{ ref: input.fragmentRef, role: 'cited' }],
                role: input.role,
                rationale: input.rationale,
                linkAuthor: author,
                linkAuthorType: 'model',
            } satisfies EvidenceLinkPayload,
            [claimRef, input.fragmentRef],
            input.researcher,
            'acceptAgentProposal',
            undefined,
            activityId,
        );
        staged.activities.set(activityId, {
            activityId,
            command: 'acceptAgentProposal',
            actor: input.researcher,
            projectSequence: staged.sequence,
            edges: [
                { kind: 'context', target: input.expectedClaim },
                { kind: 'input', target: input.fragmentRef },
            ],
            proposal: { digest: input.proposalDigest, provider: input.provider, model: input.model },
        });
        const receipt = freezeValue({ requestDigest, claimRef, linkRef, activityId });
        const receipts = new Map(this.proposalReceipts).set(input.idempotencyKey, receipt);
        this.objects = staged.objects;
        this.activities = staged.activities;
        this.projectSequence = staged.projectSequence;
        this.proposalReceipts = receipts;
        return cloneValue(receipt);
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
        if (!artifact.sourceRefs.some(ref => sameRef(ref, input.sourceRef))) {
            throw new ResearchKernelError('Fragment artifact must retain the exact selected source revision');
        }
        const representation = this.selectFragmentRepresentation(
            input.selector,
            input.representation,
            input.sourceRef,
            source,
            input.artifactRef,
            artifact,
        );
        const profile = this.normalizeFragmentProfile(input.profile, representation);
        const selector = this.normalizeFragmentSelector(input.selector, representation, source.sourceVersionId, input.artifactRef);
        const anchor = this.createFragmentAnchor(representation, selector, profile);
        const context = this.normalizeFragmentContext(
            input.context,
            selector,
            anchor,
            input.sourceRef,
            source,
            input.artifactRef,
            artifact,
        );
        const objectId = deterministicId('frg', {
            projectId: this.projectId,
            key: input.fragmentKey,
            sourceRef: input.sourceRef,
            artifactRef: input.artifactRef,
            selector,
        });
        const payload: FragmentPayload = {
            sourceRef: input.sourceRef,
            artifactRef: input.artifactRef,
            selector,
            anchor,
            context,
        };
        return this.append('fragment', objectId, payload, [input.sourceRef, input.artifactRef], input.actor, 'createFragment');
    }

    remapFragment(input: RemapFragmentInput): FragmentRemapReceipt {
        const previousRecord = this.requireRevision<FragmentPayload>(input.fragmentRef, 'fragment');
        if (this.getHead(previousRecord.objectId) !== input.expectedHead) {
            throw new ExpectedHeadConflictError(previousRecord.objectId, input.expectedHead, this.getHead(previousRecord.objectId));
        }
        const previous = previousRecord.payload;
        const source = this.requireRevision<SourcePayload>(previous.sourceRef, 'source').payload;
        const artifact = this.requireRevision<ArtifactPayload>(input.artifactRef, 'artifact').payload;
        if (!artifact.sourceRefs.some(ref => sameRef(ref, previous.sourceRef))) {
            throw new ResearchKernelError('remap artifact must retain the exact Fragment source revision in its source refs');
        }

        const representation = this.getFragmentRepresentation(
            input.representation ?? previous.anchor.representation,
            previous.sourceRef,
            source,
            input.artifactRef,
            artifact,
        );
        const candidates = this.findSelectorCandidates(
            previous.selector,
            representation.text,
            previous.anchor.representationDigest === representation.digest,
        );
        if (candidates.length === 0) {
            return {
                status: 'UNRESOLVED',
                from: input.fragmentRef,
                candidateSelectors: [],
                reason: 'no exact selector candidate exists in the requested retained representation',
            };
        }
        if (candidates.length > 1) {
            return {
                status: 'AMBIGUOUS',
                from: input.fragmentRef,
                candidateSelectors: candidates,
                reason: 'multiple exact selector candidates exist; remap requires an explicit human choice',
            };
        }

        const remappedContext = this.remapFragmentContext(previous.context, previous.sourceRef, source, input.artifactRef, artifact);
        if (remappedContext.status !== 'EXACT' || remappedContext.context === undefined) {
            return {
                status: remappedContext.status,
                from: input.fragmentRef,
                candidateSelectors: candidates,
                reason: remappedContext.reason,
            };
        }

        const selector = this.normalizeFragmentSelector(candidates[0], representation, source.sourceVersionId, input.artifactRef);
        const profile = this.normalizeFragmentProfile(input.profile, representation);
        const anchor = this.createFragmentAnchor(representation, selector, profile);
        const payload: FragmentPayload = {
            sourceRef: previous.sourceRef,
            artifactRef: input.artifactRef,
            selector,
            anchor,
            context: remappedContext.context,
        };
        const to = this.append(
            'fragment',
            previousRecord.objectId,
            payload,
            [previous.sourceRef, input.artifactRef],
            input.actor,
            'remapFragment',
            input.expectedHead,
        );
        return {
            status: 'EXACT',
            from: input.fragmentRef,
            to,
            candidateSelectors: candidates,
        };
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
        const fragmentTargets = this.normalizeEvidenceFragmentTargets(input.targets, input.fragmentTargets);
        const payload: EvidenceLinkPayload = {
            claimRef: input.claimRef,
            targets: input.targets,
            fragmentTargets,
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
                fragmentTargets: link.fragmentTargets,
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
            anchor: fragment.anchor,
            context: fragment.context,
            sourceName: sourceRevision.name,
        });
    }

    verifyCitation(fragmentRef: ExactRef): MechanicalCitationReceipt {
        const revision = this.requireRevision<FragmentPayload>(fragmentRef, 'fragment');
        const fragment = revision.payload;
        const representation = this.loadAnchorRepresentation(fragment.anchor);
        const representationDigest = representation.digest === fragment.anchor.representationDigest;
        const selectorBytes =
            fragment.anchor.brand === 'ivory.fragment-anchor/1' &&
            fragment.anchor.selectorKind === fragment.selector.kind &&
            (fragment.anchor.representation === 'source'
                ? sameRef(fragment.anchor.representationRef, fragment.sourceRef)
                : sameRef(fragment.anchor.representationRef, fragment.artifactRef)) &&
            [fragment.anchor.converter, fragment.anchor.converterRevision, fragment.anchor.selectorProfileRevision].every(
                value => typeof value === 'string' && value.trim().length > 0,
            ) &&
            fragment.anchor.orderedSpanIdentity ===
                deterministicId('spn', {
                    representationDigest: fragment.anchor.representationDigest,
                    selector: fragment.selector,
                }) &&
            this.selectorMatches(fragment.selector, representation.text);
        const context = this.verifyFragmentContext(fragment.context, fragment, representation);
        const status: MechanicalCitationReceipt['status'] =
            !representationDigest || !selectorBytes || context === 'mismatch'
                ? 'MISMATCH'
                : context === 'unavailable'
                  ? 'BLOCKED'
                  : 'EXACT';
        const receiptWithoutDigest = {
            kind: 'mechanical-citation' as const,
            fragmentRef,
            fragmentRevisionDigest: revision.digest,
            representationDigest: fragment.anchor.representationDigest,
            selectorKind: fragment.selector.kind,
            status,
            checks: {
                representationDigest,
                selectorBytes,
                context,
            },
            semanticSupport: 'not-assessed' as const,
        };
        return cloneValue({
            ...receiptWithoutDigest,
            receiptDigest: digestCanonical(receiptWithoutDigest),
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
            const citationRef =
                payload.fragmentTargets?.find(target => target.role === 'cited')?.ref ??
                payload.targets?.find(target => this.objects.get(target.objectId)?.objectType === 'fragment');
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
        sharedActivityId?: string,
    ): ExactRef {
        this.assertNoLatest(payload);
        exactRefs.forEach(ref => this.validateRef(ref));
        const existing = this.objects.get(objectId);
        if (existing && existing.objectType !== objectType) {
            throw new ResearchKernelError(`cannot append a '${objectType}' revision onto '${existing.objectType}' object '${objectId}'`);
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
        const activityId =
            sharedActivityId ??
            deterministicId('act', {
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

    private selectorMatches(selector: FragmentSelectorInput | FragmentSelector, representation: string): boolean {
        if (selector.kind === 'text') {
            const quoteMatches =
                Number.isInteger(selector.start) &&
                Number.isInteger(selector.end) &&
                selector.start >= 0 &&
                selector.end <= representation.length &&
                selector.start < selector.end &&
                representation.slice(selector.start, selector.end) === selector.quote;
            if (!quoteMatches) {
                return false;
            }
            const prefixMatches =
                selector.prefix === undefined ||
                (selector.start >= selector.prefix.length &&
                    representation.slice(selector.start - selector.prefix.length, selector.start) === selector.prefix);
            const suffixMatches =
                selector.suffix === undefined ||
                representation.slice(selector.end, selector.end + selector.suffix.length) === selector.suffix;
            return prefixMatches && suffixMatches;
        }
        return Boolean(selector.value) && representation.includes(selector.value);
    }

    private assertSelectorBounded(selector: FragmentSelectorInput | FragmentSelector): void {
        const text = selector.kind === 'text' ? selector.quote : selector.value;
        if (!text || text.length > MAX_FRAGMENT_SELECTOR_TEXT) {
            throw new ResearchKernelError(`fragment selector text must be between 1 and ${MAX_FRAGMENT_SELECTOR_TEXT} characters`);
        }
        if (selector.kind === 'text' && (!Number.isInteger(selector.start) || !Number.isInteger(selector.end))) {
            throw new ResearchKernelError(`fragment offsets must be integers, got [${selector.start}, ${selector.end})`);
        }
    }

    private getFragmentRepresentation(
        kind: FragmentRepresentationKind,
        sourceRef: ExactRef,
        source: SourcePayload,
        artifactRef: ExactRef,
        artifact: ArtifactPayload,
    ): RetainedRepresentation {
        if (kind === 'source') {
            return {
                kind,
                ref: sourceRef,
                digest: source.contentDigest,
                text: this.decodeSourceText(source),
                defaultProfile: {
                    converter: 'source-bytes',
                    converterRevision: source.sourceVersionId,
                    selectorProfileRevision: DEFAULT_SELECTOR_PROFILE_REVISION,
                },
            };
        }
        return {
            kind,
            ref: artifactRef,
            digest: artifact.outputDigest,
            text: artifact.output,
            defaultProfile: {
                converter: 'artifact-output',
                converterRevision: artifact.fingerprintId,
                selectorProfileRevision: DEFAULT_SELECTOR_PROFILE_REVISION,
            },
        };
    }

    private selectFragmentRepresentation(
        selector: FragmentSelectorInput,
        requested: FragmentRepresentationKind | undefined,
        sourceRef: ExactRef,
        source: SourcePayload,
        artifactRef: ExactRef,
        artifact: ArtifactPayload,
    ): RetainedRepresentation {
        this.assertSelectorBounded(selector);
        const sourceRepresentation = this.getFragmentRepresentation('source', sourceRef, source, artifactRef, artifact);
        const artifactRepresentation = this.getFragmentRepresentation('artifact', sourceRef, source, artifactRef, artifact);
        const representation =
            requested === 'source'
                ? sourceRepresentation
                : requested === 'artifact'
                  ? artifactRepresentation
                  : this.selectorMatches(selector, sourceRepresentation.text)
                    ? sourceRepresentation
                    : artifactRepresentation;
        if (!this.selectorMatches(selector, representation.text)) {
            throw new ResearchKernelError(
                `fragment selector must match the exact retained ${representation.kind} representation selected for the Fragment`,
            );
        }
        return representation;
    }

    private normalizeFragmentProfile(profile: FragmentProfile | undefined, representation: RetainedRepresentation): FragmentProfile {
        const normalized = profile ?? representation.defaultProfile;
        if ([normalized.converter, normalized.converterRevision, normalized.selectorProfileRevision].some(value => !value.trim())) {
            throw new ResearchKernelError('fragment converter and selector profile revisions must be non-empty');
        }
        return cloneValue(normalized);
    }

    private normalizeFragmentSelector(
        selector: FragmentSelectorInput,
        representation: RetainedRepresentation,
        sourceVersionId: string,
        artifactRef: ExactRef,
    ): FragmentSelector {
        this.assertSelectorBounded(selector);
        if (!this.selectorMatches(selector, representation.text)) {
            throw new ResearchKernelError('fragment quotation and offsets must match the selected retained representation');
        }
        if (selector.kind === 'text') {
            const passage = derivePassageId({
                sourceVersionId,
                extractionArtifactId: artifactRef.objectId,
                spans: [{ start: selector.start, end: selector.end }],
            });
            return {
                ...selector,
                passageId: passage.id,
            } satisfies TextSelector;
        }
        return { ...selector } satisfies TableSelector;
    }

    private createFragmentAnchor(
        representation: RetainedRepresentation,
        selector: FragmentSelector,
        profile: FragmentProfile,
    ): FragmentAnchorIdentity {
        return {
            brand: 'ivory.fragment-anchor/1',
            representation: representation.kind,
            representationRef: representation.ref,
            representationDigest: representation.digest,
            selectorKind: selector.kind,
            converter: profile.converter,
            converterRevision: profile.converterRevision,
            selectorProfileRevision: profile.selectorProfileRevision,
            orderedSpanIdentity: deterministicId('spn', {
                representationDigest: representation.digest,
                selector,
            }),
        };
    }

    private normalizeFragmentContext(
        input: FragmentContextInput | undefined,
        citedSelector: FragmentSelector,
        citedAnchor: FragmentAnchorIdentity,
        sourceRef: ExactRef,
        source: SourcePayload,
        artifactRef: ExactRef,
        artifact: ArtifactPayload,
    ): FragmentContext {
        if (input === undefined) {
            return {
                state: 'unavailable',
                reason: 'legacy caller did not supply structural context',
            };
        }
        if (input.state === 'unavailable') {
            if (!input.reason.trim()) {
                throw new ResearchKernelError('unavailable Fragment context requires an explicit reason');
            }
            return cloneValue(input);
        }
        if (input.state === 'not-applicable') {
            if (input.basis !== 'no-material-structure' || !input.reason.trim()) {
                throw new ResearchKernelError('not-applicable Fragment context requires no-material-structure basis and a reason');
            }
            const representation = this.getFragmentRepresentation(citedAnchor.representation, sourceRef, source, artifactRef, artifact);
            if (!this.hasNoMaterialStructure(citedSelector, representation, source, artifact)) {
                throw new ResearchKernelError(
                    'not-applicable Fragment context is unproven: retain structural context or mark it unavailable',
                );
            }
            return cloneValue(input);
        }
        if (input.references.length === 0 || input.references.length > MAX_FRAGMENT_CONTEXT_REFERENCES) {
            throw new ResearchKernelError(`applicable Fragment context requires 1..${MAX_FRAGMENT_CONTEXT_REFERENCES} bounded references`);
        }
        const identities = new Set<string>();
        const references: FragmentContextReference[] = input.references.map(reference => {
            const representation = this.getFragmentRepresentation(
                reference.representation ?? citedAnchor.representation,
                sourceRef,
                source,
                artifactRef,
                artifact,
            );
            const selector = this.normalizeFragmentSelector(reference.selector, representation, source.sourceVersionId, artifactRef);
            const orderedSpanIdentity = deterministicId('spn', {
                representationDigest: representation.digest,
                selector,
            });
            if (orderedSpanIdentity === citedAnchor.orderedSpanIdentity) {
                throw new ResearchKernelError('cited and context boundaries must be separate exact references');
            }
            if (identities.has(orderedSpanIdentity)) {
                throw new ResearchKernelError('duplicate Fragment context references are not permitted');
            }
            identities.add(orderedSpanIdentity);
            return {
                kind: reference.kind,
                representation: representation.kind,
                representationRef: representation.ref,
                representationDigest: representation.digest,
                selector,
                orderedSpanIdentity,
            };
        });
        return { state: 'applicable', references };
    }

    private loadAnchorRepresentation(anchor: FragmentAnchorIdentity): RetainedRepresentation {
        if (anchor.representation === 'source') {
            const source = this.requireRevision<SourcePayload>(anchor.representationRef, 'source').payload;
            return {
                kind: 'source',
                ref: anchor.representationRef,
                digest: source.contentDigest,
                text: this.decodeSourceText(source),
                defaultProfile: {
                    converter: 'source-bytes',
                    converterRevision: source.sourceVersionId,
                    selectorProfileRevision: DEFAULT_SELECTOR_PROFILE_REVISION,
                },
            };
        }
        const artifact = this.requireRevision<ArtifactPayload>(anchor.representationRef, 'artifact').payload;
        return {
            kind: 'artifact',
            ref: anchor.representationRef,
            digest: artifact.outputDigest,
            text: artifact.output,
            defaultProfile: {
                converter: 'artifact-output',
                converterRevision: artifact.fingerprintId,
                selectorProfileRevision: DEFAULT_SELECTOR_PROFILE_REVISION,
            },
        };
    }

    /**
     * Conservative, mechanically checkable absence witness. A full-span single-line quote
     * from identical retained source and artifact bytes has no omitted outside structure.
     * Converted, tabular, multipart, or uncertain material must supply context or remain unavailable.
     */
    private hasNoMaterialStructure(
        selector: FragmentSelector,
        representation: RetainedRepresentation,
        source: SourcePayload,
        artifact: ArtifactPayload,
    ): boolean {
        return (
            selector.kind === 'text' &&
            selector.start === 0 &&
            selector.end === representation.text.length &&
            this.decodeSourceText(source) === representation.text &&
            artifact.output === representation.text &&
            !/[\r\n\t|]/.test(representation.text) &&
            !/\b(?:table|figure|footnote|methods?|limitations?|denominator|legend|units?|headers?|sample size)\b/i.test(
                representation.text,
            )
        );
    }

    private verifyFragmentContext(
        context: FragmentContext,
        fragment: FragmentPayload,
        representation: RetainedRepresentation,
    ): MechanicalCitationReceipt['checks']['context'] {
        if (context.state === 'unavailable') {
            return 'unavailable';
        }
        if (context.state === 'not-applicable') {
            if (context.basis !== 'no-material-structure' || !context.reason.trim()) {
                return 'mismatch';
            }
            const source = this.requireRevision<SourcePayload>(fragment.sourceRef, 'source').payload;
            const artifact = this.requireRevision<ArtifactPayload>(fragment.artifactRef, 'artifact').payload;
            return this.hasNoMaterialStructure(fragment.selector, representation, source, artifact) ? 'not-applicable' : 'mismatch';
        }
        if (context.references.length === 0 || context.references.length > MAX_FRAGMENT_CONTEXT_REFERENCES) {
            return 'mismatch';
        }
        const identities = new Set<string>();
        for (const reference of context.references) {
            let digest: string;
            let text: string;
            if (reference.representation === 'source') {
                const source = this.requireRevision<SourcePayload>(reference.representationRef, 'source').payload;
                digest = source.contentDigest;
                text = this.decodeSourceText(source);
            } else {
                const artifact = this.requireRevision<ArtifactPayload>(reference.representationRef, 'artifact').payload;
                digest = artifact.outputDigest;
                text = artifact.output;
            }
            const spanIdentity = deterministicId('spn', {
                representationDigest: reference.representationDigest,
                selector: reference.selector,
            });
            if (
                digest !== reference.representationDigest ||
                !this.selectorMatches(reference.selector, text) ||
                !sameRef(
                    reference.representationRef,
                    reference.representation === 'source' ? fragment.sourceRef : fragment.artifactRef,
                ) ||
                spanIdentity !== reference.orderedSpanIdentity ||
                spanIdentity === fragment.anchor.orderedSpanIdentity ||
                identities.has(spanIdentity)
            ) {
                return 'mismatch';
            }
            identities.add(spanIdentity);
        }
        return 'exact';
    }

    private findSelectorCandidates(
        selector: FragmentSelector,
        representation: string,
        stableTableRepresentation: boolean,
    ): FragmentSelectorInput[] {
        if (selector.kind === 'table') {
            return stableTableRepresentation && this.selectorMatches(selector, representation) ? [{ ...selector }] : [];
        }
        const candidates: FragmentSelectorInput[] = [];
        let cursor = 0;
        while (cursor <= representation.length - selector.quote.length) {
            const start = representation.indexOf(selector.quote, cursor);
            if (start < 0) {
                break;
            }
            const candidate: FragmentSelectorInput = {
                kind: 'text',
                start,
                end: start + selector.quote.length,
                quote: selector.quote,
                prefix: selector.prefix,
                suffix: selector.suffix,
            };
            if (this.selectorMatches(candidate, representation)) {
                candidates.push(candidate);
            }
            cursor = start + Math.max(1, selector.quote.length);
        }
        return candidates;
    }

    private remapFragmentContext(
        context: FragmentContext,
        sourceRef: ExactRef,
        source: SourcePayload,
        artifactRef: ExactRef,
        artifact: ArtifactPayload,
    ): ContextRemapResult {
        if (context.state !== 'applicable') {
            return { status: 'EXACT', context: cloneValue(context) };
        }
        const references: FragmentContextReference[] = [];
        for (const previous of context.references) {
            const representation = this.getFragmentRepresentation(previous.representation, sourceRef, source, artifactRef, artifact);
            const candidates = this.findSelectorCandidates(
                previous.selector,
                representation.text,
                previous.representationDigest === representation.digest,
            );
            if (candidates.length === 0) {
                return {
                    status: 'UNRESOLVED',
                    reason: `context ${previous.kind} no longer has an exact selector candidate`,
                };
            }
            if (candidates.length > 1) {
                return {
                    status: 'AMBIGUOUS',
                    reason: `context ${previous.kind} has multiple exact selector candidates`,
                };
            }
            const selector = this.normalizeFragmentSelector(candidates[0], representation, source.sourceVersionId, artifactRef);
            references.push({
                kind: previous.kind,
                representation: representation.kind,
                representationRef: representation.ref,
                representationDigest: representation.digest,
                selector,
                orderedSpanIdentity: deterministicId('spn', {
                    representationDigest: representation.digest,
                    selector,
                }),
            });
        }
        return { status: 'EXACT', context: { state: 'applicable', references } };
    }

    private normalizeEvidenceFragmentTargets(
        targets: readonly ExactRef[],
        declared: readonly EvidenceFragmentTarget[] | undefined,
    ): readonly EvidenceFragmentTarget[] {
        const fragments = targets.filter(target => this.objects.get(target.objectId)?.objectType === 'fragment');
        if (declared === undefined) {
            return fragments.map(ref => ({ ref: cloneValue(ref), role: 'cited' as const }));
        }
        const targetKeys = new Set(fragments.map(refKey));
        const seen = new Set<string>();
        for (const target of declared) {
            const key = refKey(target.ref);
            if (!targetKeys.has(key)) {
                throw new ResearchKernelError('EvidenceLink fragmentTargets may reference only Fragment targets on the link');
            }
            if (seen.has(key)) {
                throw new ResearchKernelError('EvidenceLink fragmentTargets cannot duplicate a Fragment target');
            }
            if (target.role !== 'cited' && target.role !== 'context') {
                throw new ResearchKernelError('EvidenceLink Fragment target role must be cited or context');
            }
            seen.add(key);
        }
        if (seen.size !== targetKeys.size) {
            throw new ResearchKernelError('EvidenceLink must assign an explicit cited/context role to every Fragment target');
        }
        return cloneValue([...declared]);
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
