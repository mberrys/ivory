// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

/** `sha256:` followed by 64 lowercase hex digits. */
export type Sha256Digest = `sha256:${string}`;

export namespace Sha256Digest {
    const PATTERN = /^sha256:[0-9a-f]{64}$/;

    export function is(value: unknown): value is Sha256Digest {
        return typeof value === 'string' && PATTERN.test(value);
    }
}
