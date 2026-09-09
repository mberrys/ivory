// *****************************************************************************
// Copyright (C) 2026 Berry Studio and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { ResearchKernel } from './kernel';
import { ExactRef } from './types';

/** The protocol's CLI-shaped reader path; it returns the text a CLI would print. */
export function explainClaimCli(kernel: ResearchKernel, snapshotId: string, claimRef: ExactRef): string {
    return kernel.explainClaim(snapshotId, claimRef).text;
}
