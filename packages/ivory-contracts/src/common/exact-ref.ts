// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { canonicalJson, isPlainObject } from './canonical-json';
import { IvoryContractError } from './ivory-contract-error';

/**
 * An exact reference to one accepted revision (ADR-004). Exact references never
 * move: a correction creates a new revision, and `latest` is navigation only,
 * never part of a reference.
 */
export interface ExactRef {
    readonly projectId: string;
    readonly objectId: string;
    readonly revisionId: string;
}

export namespace ExactRef {
    export const MAX_ID_LENGTH = 256;
    export const LATEST = 'latest';
    const FIELDS = ['projectId', 'objectId', 'revisionId'] as const;
    const SORTED_FIELDS = [...FIELDS].sort().join(',');

    /**
     * Validates `value` and returns a frozen copy. Throws unless it has exactly the
     * three identifier fields, each a non-blank string of at most {@link MAX_ID_LENGTH}
     * characters other than {@link LATEST}, and, when `projectId` is given, it belongs
     * to that project.
     */
    export function parse(value: unknown, projectId?: string): ExactRef {
        if (!isPlainObject(value) || Object.keys(value).sort().join(',') !== SORTED_FIELDS) {
            throw new IvoryContractError('invalid-exact-ref', `an exact ref has exactly the fields ${FIELDS.join(', ')}`);
        }
        const ref: ExactRef = Object.freeze({
            projectId: identifier(value.projectId, 'projectId'),
            objectId: identifier(value.objectId, 'objectId'),
            revisionId: identifier(value.revisionId, 'revisionId')
        });
        if (projectId !== undefined && ref.projectId !== projectId) {
            throw new IvoryContractError('cross-project-ref', `a ref into ${ref.projectId} was used in ${projectId}`);
        }
        return ref;
    }

    export function is(value: unknown): value is ExactRef {
        try {
            parse(value);
            return true;
        } catch (error) {
            if (error instanceof IvoryContractError) {
                return false;
            }
            throw error;
        }
    }

    export function equals(a: ExactRef, b: ExactRef): boolean {
        return FIELDS.every(field => a[field] === b[field]);
    }

    /** A string that identifies the ref, for use as a map key. Not a wire format. */
    export function key(ref: ExactRef): string {
        return canonicalJson(FIELDS.map(field => ref[field]));
    }

    /** Orders by project, object, then revision, comparing UTF-16 code units as canonical JSON does. */
    export function compare(a: ExactRef, b: ExactRef): number {
        for (const field of FIELDS) {
            if (a[field] !== b[field]) {
                return a[field] < b[field] ? -1 : 1;
            }
        }
        return 0;
    }

    function identifier(value: unknown, field: string): string {
        if (typeof value !== 'string' || !value.trim() || value === LATEST || value.length > MAX_ID_LENGTH) {
            throw new IvoryContractError('invalid-exact-ref',
                `${field} must be a non-blank identifier of at most ${MAX_ID_LENGTH} characters other than '${LATEST}'`);
        }
        return value;
    }
}
