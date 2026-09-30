// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { RecoveryReport } from '../../common/store-protocol';
import { recoverDeadLeases } from './process-lease';

/**
 * Crash recovery (C1): removes what the hosts that died left behind. A lease that is held, or whose pid still
 * exists, is never touched, so a live host's staging files are safe. Does nothing to the database: SQLite recovers
 * its own WAL, and the commit log has no half-committed state.
 */
export function recoverStore(projectDir: string, ownProcessId: string): RecoveryReport {
    return recoverDeadLeases(projectDir, ownProcessId);
}
