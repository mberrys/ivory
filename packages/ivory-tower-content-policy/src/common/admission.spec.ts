// *****************************************************************************
// Copyright (C) 2026 Berry Studio and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from 'chai';
import { AdmissionRequest, decideAdmission } from './admission';
import { CONTENT_CLASSES, SAFE_SUBSET } from './content-class';
import { DeploymentTopology } from './rights-basis';

function request(overrides: Partial<AdmissionRequest> = {}): AdmissionRequest {
    return {
        contentClass: 'publisherLicensed',
        topology: 'vendorHosted',
        route: 'upload',
        ...overrides,
    };
}

describe('the V1 safe subset', () => {
    it('admits every safe-subset class for ingest without an agreement', () => {
        for (const contentClass of SAFE_SUBSET) {
            const decision = decideAdmission(request({ contentClass, route: 'openRepository' }));
            expect(decision.ingest.outcome, contentClass).to.equal('permitted');
        }
    });

    it('permits transfer for open classes whose licence is settled by the class', () => {
        for (const contentClass of SAFE_SUBSET.filter(c => c !== 'arxivPreprint')) {
            const decision = decideAdmission(request({ contentClass, route: 'openRepository' }));
            expect(decision.transfer.outcome, contentClass).to.equal('permitted');
        }
    });

    it('holds regardless of deployment topology', () => {
        for (const topology of ['vendorHosted', 'selfHostedAtResearchOrganization'] as DeploymentTopology[]) {
            const decision = decideAdmission(request({ contentClass: 'pmcOpenAccess', route: 'openRepository', topology }));
            expect(decision.ingest.outcome, topology).to.equal('permitted');
            expect(decision.transfer.outcome, topology).to.equal('permitted');
        }
    });

    it('records a real basis rather than an assertion', () => {
        expect(decideAdmission(request({ contentClass: 'pmcOpenAccess', route: 'openRepository' })).ingest.basis).to.equal('openLicence');
        expect(decideAdmission(request({ contentClass: 'researcherAuthored', route: 'upload' })).ingest.basis).to.equal(
            'researcherAuthored',
        );
        expect(decideAdmission(request({ contentClass: 'publicDomainArchive', route: 'openRepository' })).ingest.basis).to.equal(
            'publicDomain',
        );
    });
});

describe('per-item licence checks', () => {
    it('ingests an arXiv item but withholds transfer until its licence is confirmed', () => {
        const decision = decideAdmission(request({ contentClass: 'arxivPreprint', route: 'openRepository' }));
        expect(decision.ingest.outcome).to.equal('permitted');
        expect(decision.transfer.outcome).to.equal('refused');
        expect(decision.transfer.reason).to.contain('per-item licence');
    });

    it('permits transfer once the item licence is confirmed', () => {
        const decision = decideAdmission(request({ contentClass: 'arxivPreprint', route: 'openRepository', itemLicenceConfirmed: true }));
        expect(decision.transfer.outcome).to.equal('permitted');
    });

    it('treats an unset confirmation as unconfirmed', () => {
        const decision = decideAdmission(
            request({ contentClass: 'arxivPreprint', route: 'openRepository', itemLicenceConfirmed: undefined }),
        );
        expect(decision.transfer.outcome).to.equal('refused');
    });
});

describe('licensed content requires a stated basis', () => {
    it('refuses both gates when no basis is recorded', () => {
        const decision = decideAdmission(request());
        expect(decision.ingest.outcome).to.equal('refused');
        expect(decision.transfer.outcome).to.equal('refused');
    });

    it('refuses an assertion of authorization that names no basis', () => {
        const decision = decideAdmission(request({ basis: { kind: 'none' } }));
        expect(decision.ingest.outcome).to.equal('refused');
        expect(decision.ingest.reason).to.contain('not itself a basis');
    });

    it('applies the same rule to licensed books', () => {
        expect(decideAdmission(request({ contentClass: 'institutionallyLicensedBook' })).ingest.outcome).to.equal('refused');
    });
});

describe('publisher TDM agreements are API-mediated', () => {
    const agreement = { kind: 'publisherTdmAgreement' as const, publisher: 'Elsevier', apiMediated: true };

    it('refuses an upload even where an agreement exists, because the grant runs through the API', () => {
        const decision = decideAdmission(request({ basis: agreement, route: 'upload' }));
        expect(decision.ingest.outcome).to.equal('refused');
        expect(decision.ingest.reason).to.contain('API');
    });

    it('admits the same content when it arrives through the publisher API', () => {
        const decision = decideAdmission(request({ basis: agreement, route: 'publisherApi' }));
        expect(decision.ingest.outcome).to.equal('permitted');
        expect(decision.ingest.basis).to.equal('publisherTdmAgreement');
    });

    it('admits an upload where the agreement is not API-mediated', () => {
        const decision = decideAdmission(request({ basis: { ...agreement, apiMediated: false }, route: 'upload' }));
        expect(decision.ingest.outcome).to.equal('permitted');
    });
});

describe('transfer is a separate right from ingestion', () => {
    it('permits ingest and refuses transfer under a mining agreement that is silent on disclosure', () => {
        const decision = decideAdmission(
            request({
                basis: { kind: 'publisherTdmAgreement', publisher: 'Springer Nature', apiMediated: true },
                route: 'publisherApi',
            }),
        );
        expect(decision.ingest.outcome).to.equal('permitted');
        expect(decision.transfer.outcome).to.equal('refused');
    });

    it('treats silence as refusal rather than consent', () => {
        const decision = decideAdmission(
            request({
                basis: { kind: 'publisherTdmAgreement', publisher: 'Wiley', apiMediated: false, permitsThirdPartyDisclosure: undefined },
            }),
        );
        expect(decision.transfer.outcome).to.equal('refused');
        expect(decision.transfer.reason).to.contain('not implied');
    });

    it('permits transfer only on express permission', () => {
        const decision = decideAdmission(
            request({
                basis: { kind: 'publisherTdmAgreement', publisher: 'Wiley', apiMediated: false, permitsThirdPartyDisclosure: true },
            }),
        );
        expect(decision.transfer.outcome).to.equal('permitted');
    });

    it('never permits transfer where ingest was refused', () => {
        for (const contentClass of CONTENT_CLASSES) {
            for (const route of ['publisherApi', 'upload', 'openRepository'] as const) {
                const decision = decideAdmission(request({ contentClass, route }));
                if (decision.ingest.outcome === 'refused') {
                    expect(decision.transfer.outcome, `${contentClass}/${route}`).to.equal('refused');
                }
            }
        }
    });
});

describe('deployment topology governs the research exception', () => {
    const exception = { kind: 'researchOrganizationException' as const, jurisdiction: 'eu' as const };

    it('refuses the exception under vendor hosting, because the operator is commercial', () => {
        const decision = decideAdmission(request({ basis: exception, topology: 'vendorHosted' }));
        expect(decision.ingest.outcome).to.equal('refused');
        expect(decision.ingest.reason).to.contain('research organization');
    });

    it('admits the exception when a research organization performs the act', () => {
        const decision = decideAdmission(request({ basis: exception, topology: 'selfHostedAtResearchOrganization' }));
        expect(decision.ingest.outcome).to.equal('permitted');
        expect(decision.ingest.basis).to.equal('researchOrganizationException');
    });

    it('still refuses transfer, because the exception covers reproduction and not disclosure', () => {
        const decision = decideAdmission(request({ basis: exception, topology: 'selfHostedAtResearchOrganization' }));
        expect(decision.transfer.outcome).to.equal('refused');
    });

    it('is the only rule whose outcome depends on topology', () => {
        // Every other combination must decide identically under both topologies, so that a
        // deployment change cannot silently alter an unrelated decision.
        for (const contentClass of CONTENT_CLASSES) {
            for (const route of ['publisherApi', 'upload', 'openRepository'] as const) {
                const vendor = decideAdmission(request({ contentClass, route, topology: 'vendorHosted' }));
                const selfHosted = decideAdmission(request({ contentClass, route, topology: 'selfHostedAtResearchOrganization' }));
                expect(vendor, `${contentClass}/${route}`).to.deep.equal(selfHosted);
            }
        }
    });
});

describe('fail-closed behaviour', () => {
    it('refuses shadow-library content on every route and topology', () => {
        for (const route of ['publisherApi', 'upload', 'openRepository'] as const) {
            const decision = decideAdmission(request({ contentClass: 'shadowLibrary', route }));
            expect(decision.ingest.outcome, route).to.equal('refused');
            expect(decision.ingest.reason).to.contain('Bartz');
        }
    });

    it('refuses content whose provenance cannot be evidenced', () => {
        expect(decideAdmission(request({ contentClass: 'unknownProvenance' })).ingest.outcome).to.equal('refused');
    });

    it('cannot be overridden by asserting a basis', () => {
        const decision = decideAdmission(
            request({
                contentClass: 'shadowLibrary',
                basis: { kind: 'publisherTdmAgreement', publisher: 'Elsevier', apiMediated: false, permitsThirdPartyDisclosure: true },
                route: 'publisherApi',
            }),
        );
        expect(decision.ingest.outcome).to.equal('refused');
    });

    it('reaches a decision for every content class, and never leaves one undecided', () => {
        for (const contentClass of CONTENT_CLASSES) {
            const decision = decideAdmission(request({ contentClass }));
            expect(decision.ingest.outcome, contentClass).to.be.oneOf(['permitted', 'refused']);
            expect(decision.transfer.outcome, contentClass).to.be.oneOf(['permitted', 'refused']);
            expect(decision.ingest.reason, contentClass).to.have.length.greaterThan(0);
        }
    });

    it('reports basis "none" whenever a gate refuses', () => {
        for (const contentClass of CONTENT_CLASSES) {
            const decision = decideAdmission(request({ contentClass }));
            if (decision.ingest.outcome === 'refused') {
                expect(decision.ingest.basis, contentClass).to.equal('none');
            }
            if (decision.transfer.outcome === 'refused') {
                expect(decision.transfer.basis, contentClass).to.equal('none');
            }
        }
    });
});
