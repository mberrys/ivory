// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from 'chai';
import { promises as fs } from 'fs';
import * as path from 'path';
import { IvoryStoreError, IvoryStoreErrorCode } from '../common/store-protocol';
import { fsyncDirectory, fsyncFile } from './durable-fs';
import { initProject, ProjectLayout, readManifest } from './project-layout';
import { SpecKit } from './test/spec-helpers';

async function errorCode(action: () => Promise<unknown>): Promise<IvoryStoreErrorCode | undefined> {
    try {
        await action();
        return undefined;
    } catch (error) {
        if (error instanceof IvoryStoreError) {
            return error.code;
        }
        throw error;
    }
}

describe('project directory', function (): void {
    // Every store is a worker thread and a WAL database with full synchronous, and some specs start other processes.
    this.timeout(60000);

    const kit = new SpecKit();
    afterEach(() => kit.dispose());

    it('initProject creates the directories and a manifest that readManifest returns', async () => {
        const directory = await kit.tempDir();
        const manifest = await initProject(directory, { projectId: 'project-1' });
        const layout = ProjectLayout.of(directory);
        expect(manifest).to.include({ format: 'ivory-project@1', projectId: 'project-1', role: 'live' });
        expect(manifest.storeInstanceId).to.be.a('string').that.is.not.empty;
        expect(await readManifest(directory)).to.deep.equal(manifest);
        for (const child of [layout.casRoot, layout.casStaging, layout.leases, layout.runs]) {
            expect((await fs.stat(child)).isDirectory(), child).to.be.true;
        }
    });

    it('initProject refuses a project id that is not an ExactRef id', async () => {
        for (const projectId of ['', '   ', 'latest', 'x'.repeat(257)]) {
            expect(await errorCode(async () => initProject(await kit.tempDir(), { projectId })), JSON.stringify(projectId)).to.equal('invalid-argument');
        }
        expect(await errorCode(async () => initProject(await kit.tempDir(), { projectId: 'x'.repeat(256) }))).to.be.undefined;
    });

    it('initProject leaves an existing project alone', async () => {
        const directory = await kit.project();
        const before = await fs.readFile(ProjectLayout.of(directory).manifest, 'utf8');
        expect(await errorCode(() => initProject(directory, { projectId: 'other' }))).to.equal('project-exists');
        expect(await fs.readFile(ProjectLayout.of(directory).manifest, 'utf8')).to.equal(before);
    });

    it('readManifest refuses a missing or malformed manifest', async () => {
        const directory = await kit.tempDir();
        const file = ProjectLayout.of(directory).manifest;
        expect(await errorCode(() => readManifest(directory)), 'missing').to.equal('invalid-manifest');
        const valid = { format: 'ivory-project@1', projectId: 'p', storeInstanceId: 'i', role: 'live' };
        const malformed: Record<string, string> = {
            'not JSON': '{',
            'an array': '[]',
            'a missing field': JSON.stringify({ ...valid, storeInstanceId: undefined }),
            'an extra field': JSON.stringify({ ...valid, extra: 1 }),
            'a wrong format': JSON.stringify({ ...valid, format: 'ivory-project@2' }),
            'an unknown role': JSON.stringify({ ...valid, role: 'primary' }),
            'a blank project id': JSON.stringify({ ...valid, projectId: ' ' }),
            'the project id latest': JSON.stringify({ ...valid, projectId: 'latest' })
        };
        for (const [name, text] of Object.entries(malformed)) {
            await fs.writeFile(file, text);
            expect(await errorCode(() => readManifest(directory)), name).to.equal('invalid-manifest');
        }
        await fs.writeFile(file, JSON.stringify(valid));
        expect((await readManifest(directory)).projectId).to.equal('p');
    });

    it('names a blob by the full hex under two shard directories', () => {
        const layout = ProjectLayout.of(path.join('some', 'project'));
        const hex = 'ab'.repeat(2) + 'c'.repeat(60);
        expect(ProjectLayout.blobPath(layout, `sha256:${hex}`)).to.equal(path.join(layout.casRoot, 'ab', 'ab', hex));
        expect(ProjectLayout.digestOfBlobName(hex)).to.equal(`sha256:${hex}`);
        expect(ProjectLayout.digestOfBlobName(`${hex}.tmp`)).to.be.undefined;
    });
});

describe('durable file system', function (): void {
    // Every store is a worker thread and a WAL database with full synchronous, and some specs start other processes.
    this.timeout(60000);

    const kit = new SpecKit();
    afterEach(() => kit.dispose());

    it('fsyncDirectory works on the current platform', async () => {
        const directory = await kit.tempDir();
        await fsyncDirectory(directory);
    });

    it('fsyncFile works on the current platform', async () => {
        const file = path.join(await kit.tempDir(), 'data');
        await fs.writeFile(file, 'bytes');
        await fsyncFile(file);
    });

    it('fsyncDirectory refuses a directory that does not exist', async () => {
        const missing = path.join(await kit.tempDir(), 'missing');
        let code: string | undefined;
        try {
            await fsyncDirectory(missing);
        } catch (error) {
            code = (error as NodeJS.ErrnoException).code;
        }
        expect(code).to.equal('ENOENT');
    });
});
