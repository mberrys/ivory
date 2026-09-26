// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { createHash } from 'crypto';
import { canonicalJson } from '../common/canonical-json';
import { Sha256Digest } from '../common/sha256-digest';

/**
 * SHA-256 over the UTF-8 bytes of the value's RFC 8785 canonical JSON.
 * Refuses exactly the values {@link canonicalJson} refuses.
 */
export function canonicalDigest(value: unknown): Sha256Digest {
    return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`;
}
