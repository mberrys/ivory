// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

/**
 * Why a value was refused. The canonical JSON codes are shared with the Python
 * implementation, and the shared vectors assert that both report the same one.
 */
export type IvoryContractErrorCode =
    | 'unsupported-value'
    | 'non-finite-number'
    | 'lone-surrogate'
    | 'cyclic-value'
    | 'invalid-exact-ref'
    | 'cross-project-ref'
    | 'invalid-edge'
    | 'dangling-ref';

/**
 * Raised when a value violates an Ivory contract. Contract checks fail closed:
 * they refuse the value rather than repair, coerce or drop part of it.
 */
export class IvoryContractError extends Error {
    constructor(readonly code: IvoryContractErrorCode, message: string) {
        super(message);
        this.name = 'IvoryContractError';
    }
}
