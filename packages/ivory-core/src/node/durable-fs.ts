// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { promises as fs } from 'fs';

/** Flushes a file's data and metadata to stable storage. */
export async function fsyncFile(filePath: string): Promise<void> {
    const handle = await fs.open(filePath, 'r+');
    try {
        await handle.sync();
    } finally {
        await handle.close();
    }
}

/**
 * Flushes a directory entry to stable storage, so a rename or create survives a crash.
 * Windows only lets a directory be opened for flushing with write access, other platforms with read access.
 */
export async function fsyncDirectory(directory: string): Promise<void> {
    const handle = await fs.open(directory, process.platform === 'win32' ? 'r+' : 'r');
    try {
        await handle.sync();
    } finally {
        await handle.close();
    }
}
