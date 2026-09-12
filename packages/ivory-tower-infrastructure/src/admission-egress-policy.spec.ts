// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { expect } from 'chai';
import { ContentAwareAllowlistedEgressPolicy } from './content-aware-egress-policy';
import { ContentRightsAdmissionPolicy } from './content-rights-admission-policy';
import { FailClosedEgressPolicy } from './egress-policy';
import { InMemorySourceRecordStore } from './in-memory-source-record-store';

describe('ContentRightsAdmissionPolicy', () => {
    it('permits ingest and transfer for safe-subset open content', async () => {
        const policy = new ContentRightsAdmissionPolicy('vendorHosted');
        const decision = await policy.admit(
            {
                filename: 'paper.pdf',
                contentType: 'application/pdf',
                license: 'CC-BY-4.0',
                authorizationEvidence: 'open license',
                contentClass: 'openLicensed',
                acquisitionRoute: 'openRepository',
            },
            'abc123',
        );
        expect(decision.allowed).to.equal(true);
        expect(decision.ingestPermitted).to.equal(true);
        expect(decision.transferPermitted).to.equal(true);
    });

    it('permits ingest but refuses transfer for arXiv without item licence confirmation', async () => {
        const policy = new ContentRightsAdmissionPolicy('vendorHosted');
        const decision = await policy.admit(
            {
                filename: 'preprint.pdf',
                contentType: 'application/pdf',
                license: 'arXiv',
                authorizationEvidence: 'arXiv deposit',
                contentClass: 'arxivPreprint',
                acquisitionRoute: 'openRepository',
            },
            'abc123',
        );
        expect(decision.allowed).to.equal(true);
        expect(decision.ingestPermitted).to.equal(true);
        expect(decision.transferPermitted).to.equal(false);
        expect(decision.transferReason).to.contain('per-item licence');
    });

    it('refuses shadow-library content at ingest', async () => {
        const policy = new ContentRightsAdmissionPolicy('vendorHosted');
        const decision = await policy.admit(
            {
                filename: 'shadow.pdf',
                contentType: 'application/pdf',
                license: 'unknown',
                authorizationEvidence: 'none',
                contentClass: 'shadowLibrary',
                acquisitionRoute: 'upload',
            },
            'abc123',
        );
        expect(decision.allowed).to.equal(false);
        expect(decision.ingestPermitted).to.equal(false);
        expect(decision.transferPermitted).to.equal(false);
    });
});

describe('ContentAwareAllowlistedEgressPolicy', () => {
    const baseRecord = {
        id: 'source-1',
        contentHash: '4d4823794cbed3c4ee0bbc684c8f66e1dfd5afa6f078d494ce254ec5a4671753',
        objectKey: 'sources/hash',
        contentType: 'application/pdf',
        license: 'CC-BY-4.0',
        authorizationEvidence: 'open license',
        admissionPolicyVersion: 'iv-128-v1',
        admittedAt: '2026-08-02T12:00:00.000Z',
        contentClass: 'openLicensed' as const,
        rightsBasisKind: 'openLicence' as const,
        acquisitionRoute: 'openRepository' as const,
        deploymentTopology: 'vendorHosted' as const,
        ingestPermitted: true,
        ingestReason: 'permitted',
        transferReason: 'permitted',
    };

    it('denies egress when content hash is missing', async () => {
        const store = new InMemorySourceRecordStore();
        const policy = new ContentAwareAllowlistedEgressPolicy(new Set(['api.openai.com']), store);
        const decision = await policy.authorize({ purpose: 'provider', target: 'https://api.openai.com/v1/chat/completions' });
        expect(decision.allowed).to.equal(false);
        expect(decision.reason).to.contain('content hash');
    });

    it('denies egress when transfer is not permitted even on an allowlisted host', async () => {
        const store = new InMemorySourceRecordStore();
        await store.persistSource({
            ...baseRecord,
            transferPermitted: false,
            transferReason: 'the item licence must be confirmed before its text may be transmitted to a third party',
        });
        const policy = new ContentAwareAllowlistedEgressPolicy(new Set(['api.openai.com']), store);
        const decision = await policy.authorize({
            purpose: 'provider',
            target: 'https://api.openai.com/v1/chat/completions',
            contentHash: baseRecord.contentHash,
        });
        expect(decision.allowed).to.equal(false);
        expect(decision.reason).to.contain('third party');
    });

    it('permits egress when transfer is permitted and the host is allowlisted', async () => {
        const store = new InMemorySourceRecordStore();
        await store.persistSource({ ...baseRecord, transferPermitted: true });
        const policy = new ContentAwareAllowlistedEgressPolicy(new Set(['api.openai.com']), store);
        const decision = await policy.authorize({
            purpose: 'provider',
            target: 'https://api.openai.com/v1/chat/completions',
            contentHash: baseRecord.contentHash,
        });
        expect(decision.allowed).to.equal(true);
    });

    it('denies egress for unknown content hashes', async () => {
        const store = new InMemorySourceRecordStore();
        const policy = new ContentAwareAllowlistedEgressPolicy(new Set(['api.openai.com']), store);
        const decision = await policy.authorize({
            purpose: 'provider',
            target: 'https://api.openai.com/v1/chat/completions',
            contentHash: baseRecord.contentHash,
        });
        expect(decision.allowed).to.equal(false);
        expect(decision.reason).to.contain('No admitted source');
    });

    it('fails closed when egress hosts are not configured', async () => {
        const policy = new FailClosedEgressPolicy();
        const decision = await policy.authorize({
            purpose: 'provider',
            target: 'https://api.openai.com/v1/chat/completions',
            contentHash: baseRecord.contentHash,
        });
        expect(decision.allowed).to.equal(false);
    });
});
