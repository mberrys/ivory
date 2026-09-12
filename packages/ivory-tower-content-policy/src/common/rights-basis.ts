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

/**
 * The rights bases on which content may be admitted, and the deployment topology that
 * determines which of them are reachable.
 *
 * Implements `docs/iv-128-content-rights.md` §8 and §9.4. The register's fourth rule is that
 * "the researcher asserted authorization" is *not* a basis — the system must record **which**
 * basis, so that the position is auditable after the fact. These types make that a schema
 * requirement rather than a policy aspiration.
 */

/**
 * Where the software is running, and therefore who performs the reproduction.
 *
 * This is the dominant variable in the whole analysis. EU DSM Art. 3 grants its exception to
 * *research organizations* conducting scientific research, and rightsholders cannot contract
 * out of it. A commercial operator is not a research organization, so the same software
 * performing the same operation has a different rights position depending on who runs it.
 */
export type DeploymentTopology =
    /** Ivory Tower operates the service. A commercial operator performs the reproduction. */
    | 'vendorHosted'
    /** A subscribing research organization runs the software itself and performs the act. */
    | 'selfHostedAtResearchOrganization';

/** The kinds of rights basis the system recognizes. */
export type RightsBasisKind =
    /** An open licence attached to the work itself. */
    | 'openLicence'
    /** The work is out of copyright or dedicated to the public domain. */
    | 'publicDomain'
    /** The researcher authored the material. */
    | 'researcherAuthored'
    /** A negotiated text-and-data-mining agreement between an institution and a publisher. */
    | 'publisherTdmAgreement'
    /** A statutory research exception, e.g. EU DSM Art. 3. */
    | 'researchOrganizationException'
    /** No basis has been established. */
    | 'none';

/**
 * A recorded rights basis. Persisted on the `Source` record (IV-16), not held transiently, so
 * that a decision made today can be re-examined later against the basis it actually relied on.
 */
export interface RightsBasis {
    readonly kind: RightsBasisKind;
    /** Licence identifier where the basis is a licence, e.g. `CC-BY-4.0`. */
    readonly licence?: string;
    /** Counterparty publisher where the basis is a negotiated agreement. */
    readonly publisher?: string;
    /**
     * Whether the agreement's grant runs through the publisher's mining API.
     *
     * Recorded because every surveyed publisher grant is API-mediated (§4 of the register), and
     * a grant to mine *through an API* does not cover material obtained by other means.
     */
    readonly apiMediated?: boolean;
    /**
     * Whether the agreement permits disclosing licensed text to an unrelated third party.
     *
     * Defaults to absent, which is treated as *not permitted*. Subscription terms commonly
     * restrict third-party transfer, and a TDM grant rarely addresses it at all.
     */
    readonly permitsThirdPartyDisclosure?: boolean;
    /** Jurisdiction where the basis is a statutory exception. */
    readonly jurisdiction?: 'eu' | 'uk' | 'us';
}

/** A basis carrying no rights at all. The default when nothing has been established. */
export const NO_BASIS: RightsBasis = { kind: 'none' };

/**
 * Whether a statutory research exception is reachable under this topology.
 *
 * Only the self-hosted topology puts a research organization in the position of performing the
 * act. Under vendor hosting the actor is a commercial operator, the Art. 3 exception is
 * unavailable, and the operation falls to the general TDM exception where a rightsholder
 * opt-out applies and contractual override is *not* precluded.
 */
export function researchExceptionAvailable(topology: DeploymentTopology): boolean {
    return topology === 'selfHostedAtResearchOrganization';
}
