// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

export interface IvoryEvidence {
    readonly title: string;
    readonly summary: string;
    readonly source: string;
    readonly kind: string;
    readonly status: string;
}

export function filterIvoryEvidence(evidence: readonly IvoryEvidence[], query: string): IvoryEvidence[] {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) {
        return [...evidence];
    }
    return evidence.filter(item => [item.title, item.summary, item.source, item.kind, item.status]
        .some(value => value.toLocaleLowerCase().includes(normalizedQuery)));
}
