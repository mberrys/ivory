// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { isPlainObject } from './canonical-json';
import { ExactRef } from './exact-ref';
import { IvoryContractError } from './ivory-contract-error';

/**
 * A dependency between two revisions: `from` depends on `to`.
 *
 * - `semantic`: `from` cites, annotates, derives from or otherwise means something through `to`.
 * - `activity`: a provenance back-link, such as the action that produced `from`.
 */
export interface DependencyEdge {
    readonly kind: 'semantic' | 'activity';
    readonly from: ExactRef;
    readonly to: ExactRef;
}

const EDGE_FIELDS = 'from,kind,to';

/**
 * The closure of a snapshot (ADR-004): the selected revisions plus every revision
 * reachable from them over semantic edges. Activity edges never pull a revision in,
 * and neither does an earlier revision of the same object; only a selection or a
 * semantic edge does.
 *
 * Fails closed. Every ref must be well-formed and in `projectId`, and every selected
 * revision and every semantic edge endpoint must be retained, whether or not the
 * traversal reaches it.
 *
 * @param retained the revisions the store holds.
 * @returns the closure without duplicates, sorted by {@link ExactRef.compare}.
 */
export function semanticClosure(
    projectId: string,
    selected: readonly ExactRef[],
    edges: readonly DependencyEdge[],
    retained: readonly ExactRef[]
): ExactRef[] {
    const retainedKeys = new Set(retained.map(ref => ExactRef.key(ExactRef.parse(ref, projectId))));
    const requireRetained = (ref: ExactRef, role: string): void => {
        if (!retainedKeys.has(ExactRef.key(ref))) {
            throw new IvoryContractError('dangling-ref', `${role} ${ExactRef.key(ref)} is not retained`);
        }
    };

    const dependencies = new Map<string, ExactRef[]>();
    for (const edge of edges) {
        if (!isPlainObject(edge) || Object.keys(edge).sort().join(',') !== EDGE_FIELDS) {
            throw new IvoryContractError('invalid-edge', `a dependency edge has exactly the fields ${EDGE_FIELDS}`);
        }
        const from = ExactRef.parse(edge.from, projectId);
        const to = ExactRef.parse(edge.to, projectId);
        if (edge.kind === 'activity') {
            continue;
        }
        if (edge.kind !== 'semantic') {
            throw new IvoryContractError('invalid-edge', `unknown dependency edge kind ${String(edge.kind)}`);
        }
        requireRetained(from, 'semantic edge source');
        requireRetained(to, 'semantic edge target');
        const fromKey = ExactRef.key(from);
        dependencies.set(fromKey, [...dependencies.get(fromKey) ?? [], to]);
    }

    const pending = selected.map(ref => ExactRef.parse(ref, projectId));
    pending.forEach(ref => requireRetained(ref, 'selected revision'));
    const closure = new Map<string, ExactRef>();
    for (let ref = pending.pop(); ref; ref = pending.pop()) {
        const refKey = ExactRef.key(ref);
        if (!closure.has(refKey)) {
            closure.set(refKey, ref);
            pending.push(...dependencies.get(refKey) ?? []);
        }
    }
    return [...closure.values()].sort(ExactRef.compare);
}
