// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { Sha256Digest } from '@ivory/contracts';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ProjectManifest, ProjectRole } from '../common/project-manifest';
import { IvoryStoreError } from '../common/store-protocol';
import { fsyncDirectory, fsyncFile } from './durable-fs';

/** Where the parts of a project directory live. */
export interface ProjectLayout {
    readonly projectDir: string;
    readonly manifest: string;
    readonly store: string;
    readonly writerLock: string;
    readonly coreDiscovery: string;
    readonly casRoot: string;
    readonly casStaging: string;
    readonly leases: string;
    readonly runs: string;
}

export namespace ProjectLayout {
    const HEX_DIGEST = /^[0-9a-f]{64}$/;

    export function of(projectDir: string): ProjectLayout {
        const root = path.resolve(projectDir);
        return {
            projectDir: root,
            manifest: path.join(root, ProjectManifest.FILE_NAME),
            store: path.join(root, 'store.sqlite'),
            writerLock: path.join(root, 'core-writer.sqlite'),
            coreDiscovery: path.join(root, 'core-service.json'),
            casRoot: path.join(root, 'cas', 'sha256'),
            casStaging: path.join(root, 'cas', 'tmp'),
            leases: path.join(root, 'leases'),
            runs: path.join(root, 'runs')
        };
    }

    /** `cas/sha256/<h0h1>/<h2h3>/<64-hex>`: the file name is the whole hex, without the `sha256:` prefix. */
    export function blobPath(layout: ProjectLayout, digest: Sha256Digest): string {
        const hex = digest.slice('sha256:'.length);
        return path.join(layout.casRoot, hex.slice(0, 2), hex.slice(2, 4), hex);
    }

    /** The digest a blob file name stands for, or `undefined` when the name is not a full hex digest. */
    export function digestOfBlobName(name: string): Sha256Digest | undefined {
        return HEX_DIGEST.test(name) ? `sha256:${name}` : undefined;
    }
}

export interface InitProjectOptions {
    readonly projectId: string;
    readonly role?: ProjectRole;
}

/** Creates the directories and the manifest of a new project. Refuses to touch an existing project. */
export async function initProject(projectDir: string, options: InitProjectOptions): Promise<ProjectManifest> {
    const layout = ProjectLayout.of(projectDir);
    const manifest = ProjectManifest.parse({
        format: ProjectManifest.FORMAT,
        projectId: ProjectManifest.parseProjectId(options.projectId),
        storeInstanceId: randomUUID(),
        role: options.role ?? 'live'
    });
    if (await exists(layout.manifest)) {
        throw new IvoryStoreError('project-exists', `${layout.manifest} already exists`);
    }
    for (const directory of [layout.casRoot, layout.casStaging, layout.leases, layout.runs]) {
        await fs.mkdir(directory, { recursive: true });
    }
    const temporary = `${layout.manifest}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(manifest, undefined, 2)}\n`, { flag: 'w' });
    await fsyncFile(temporary);
    await fs.rename(temporary, layout.manifest);
    await fsyncDirectory(layout.projectDir);
    return manifest;
}

/** Reads and validates the manifest. A missing or malformed manifest is refused. */
export async function readManifest(projectDir: string): Promise<ProjectManifest> {
    const file = ProjectLayout.of(projectDir).manifest;
    let text: string;
    try {
        text = await fs.readFile(file, 'utf8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new IvoryStoreError('invalid-manifest', `${file} does not exist`);
        }
        throw error;
    }
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch {
        throw new IvoryStoreError('invalid-manifest', `${file} is not valid JSON`);
    }
    return ProjectManifest.parse(value);
}

async function exists(file: string): Promise<boolean> {
    try {
        await fs.access(file);
        return true;
    } catch {
        return false;
    }
}
