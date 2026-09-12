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

import { ContentClass, isAlwaysRefused, isSafeSubset, requiresItemLicenceCheck } from './content-class';
import { DeploymentTopology, NO_BASIS, researchExceptionAvailable, RightsBasis, RightsBasisKind } from './rights-basis';

/**
 * The V1 admission policy of `docs/iv-128-content-rights.md` §9, made executable.
 *
 * The register's second finding is that **ingestion and third-party transfer are distinct
 * rights and can resolve differently**: a licence permitting an institution to mine content
 * does not obviously permit forwarding that content to an unrelated commercial processor. A
 * single authorization boolean cannot express "ingestable but not transmittable", which is the
 * most likely real-world state for subscription content. So there are two gates, and they are
 * decided separately.
 *
 * Everything here fails closed. An unrecognized combination refuses rather than permits.
 */

/** The outcome of one gate. */
export type GateOutcome = 'permitted' | 'refused';

/** A gate's decision, with the reason and the basis it relied on. */
export interface GateDecision {
    readonly outcome: GateOutcome;
    /** Human-readable justification, surfaced to the researcher and written to the audit record. */
    readonly reason: string;
    /** The basis the decision relied on. `none` whenever the outcome is `refused`. */
    readonly basis: RightsBasisKind;
}

/** How the bytes reached Ivory Tower. */
export type AcquisitionRoute =
    /** Retrieved through the publisher's text-and-data-mining API. */
    | 'publisherApi'
    /** Uploaded by the researcher from a copy they already held. */
    | 'upload'
    /** Retrieved from an open repository such as PMC, arXiv, or a preprint server. */
    | 'openRepository';

/** Everything the policy needs to decide both gates. */
export interface AdmissionRequest {
    readonly contentClass: ContentClass;
    /** Where the software runs, and therefore who performs the reproduction. */
    readonly topology: DeploymentTopology;
    /** How the bytes were obtained. */
    readonly route: AcquisitionRoute;
    /** The recorded basis. Absent means none has been established, which refuses. */
    readonly basis?: RightsBasis;
    /** Whether a per-item licence has been confirmed, for classes that require it. */
    readonly itemLicenceConfirmed?: boolean;
}

/** The two gates. */
export interface AdmissionDecision {
    /** May the source be reproduced, converted, chunked, and indexed? */
    readonly ingest: GateDecision;
    /** May passage text be transmitted to a third-party AI provider? */
    readonly transfer: GateDecision;
}

const refuse = (reason: string): GateDecision => ({ outcome: 'refused', reason, basis: 'none' });
const permit = (basis: RightsBasisKind, reason: string): GateDecision => ({ outcome: 'permitted', reason, basis });

/**
 * Decides both gates for one source.
 *
 * Transfer is never permitted where ingest is refused — a source that may not be reproduced
 * certainly may not be disclosed — but the converse is common and is the point of the design.
 */
export function decideAdmission(request: AdmissionRequest): AdmissionDecision {
    const { contentClass, topology, route } = request;
    const basis = request.basis ?? NO_BASIS;

    // Refused outright, on any basis and under any topology.
    if (isAlwaysRefused(contentClass)) {
        const refusalReason =
            contentClass === 'shadowLibrary'
                ? 'content originating from a shadow library is refused; retaining such copies was held not to be fair use in Bartz v. Anthropic'
                : 'provenance cannot be evidenced, so the source inherits the weakest available rights position';
        return { ingest: refuse(refusalReason), transfer: refuse(refusalReason) };
    }

    // The V1 safe subset: the class itself establishes the rights position.
    if (isSafeSubset(contentClass)) {
        const ingest = permit(safeSubsetBasis(contentClass), `'${contentClass}' is in the V1 safe subset`);
        if (requiresItemLicenceCheck(contentClass) && request.itemLicenceConfirmed !== true) {
            return {
                ingest,
                transfer: refuse(
                    `'${contentClass}' carries per-item licences; the item's licence must be confirmed before its text may be transmitted to a third party`,
                ),
            };
        }
        return { ingest, transfer: permit(safeSubsetBasis(contentClass), `'${contentClass}' permits redistribution`) };
    }

    // Licensed content: admitted only on a stated basis, and transfer is decided separately.
    if (contentClass === 'publisherLicensed' || contentClass === 'institutionallyLicensedBook') {
        return decideLicensed(basis, topology, route);
    }

    // Fail closed: an unrecognized class is refused rather than permitted by omission.
    const reason = `no admission rule covers content class '${contentClass}'`;
    return { ingest: refuse(reason), transfer: refuse(reason) };
}

function decideLicensed(basis: RightsBasis, topology: DeploymentTopology, route: AcquisitionRoute): AdmissionDecision {
    if (basis.kind === 'publisherTdmAgreement') {
        // Every surveyed publisher grant is API-mediated. A grant to mine through the
        // publisher's API does not extend to a copy the researcher obtained by other means.
        if (basis.apiMediated === true && route !== 'publisherApi') {
            const outsideGrant = `the agreement with ${basis.publisher ?? 'the publisher'} grants mining through its API, which does not cover content obtained by '${route}'`;
            return { ingest: refuse(outsideGrant), transfer: refuse(outsideGrant) };
        }
        const ingest = permit(
            'publisherTdmAgreement',
            `covered by the text-and-data-mining agreement with ${basis.publisher ?? 'the publisher'}`,
        );
        // Transfer needs its own express permission. Silence is not consent: subscription terms
        // commonly restrict third-party disclosure, and TDM grants rarely address it at all.
        if (basis.permitsThirdPartyDisclosure !== true) {
            return {
                ingest,
                transfer: refuse(
                    'the agreement does not expressly permit disclosing licensed text to a third party, and third-party transfer is not implied by a mining grant',
                ),
            };
        }
        return { ingest, transfer: permit('publisherTdmAgreement', 'the agreement expressly permits third-party disclosure') };
    }

    if (basis.kind === 'researchOrganizationException') {
        if (!researchExceptionAvailable(topology)) {
            const wrongActor =
                'the research-organization exception requires the act to be performed by a research organization; under vendor hosting the operator is commercial';
            return { ingest: refuse(wrongActor), transfer: refuse(wrongActor) };
        }
        return {
            ingest: permit(
                'researchOrganizationException',
                'the research organization performs the reproduction for scientific research with lawful access',
            ),
            // The exception covers reproduction for research by the organization. It does not
            // extend to disclosing the work to an unrelated commercial processor.
            transfer: refuse(
                'the research exception covers reproduction for scientific research, not disclosure of the work to a commercial third party',
            ),
        };
    }

    const reason = "licensed content requires a stated rights basis; a researcher's assertion of authorization is not itself a basis";
    return { ingest: refuse(reason), transfer: refuse(reason) };
}

function safeSubsetBasis(contentClass: ContentClass): RightsBasisKind {
    if (contentClass === 'researcherAuthored') {
        return 'researcherAuthored';
    }
    if (contentClass === 'publicDomainArchive') {
        return 'publicDomain';
    }
    return 'openLicence';
}
