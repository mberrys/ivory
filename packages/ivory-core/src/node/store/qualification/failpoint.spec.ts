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
import { expect } from 'chai';
import { createHash } from 'crypto';
import { existsSync, promises as fs, readdirSync, statSync } from 'fs';
import * as path from 'path';
import { StoreFailpoint } from '../../../common/store-protocol';
import { ProjectLayout } from '../../project-layout';
import { childScript, SpecKit } from '../../test/spec-helpers';
import { countBlobRefs } from '../test/sql-fixtures';
import { configureFailpoint, failpoint } from './failpoint';
import { qualificationHandlerModule } from './qualification-handler-module';

/** What the log holds after the child died at the second hit: the first key is always committed. */
const COMMITTED_AFTER_KILL: Record<StoreFailpoint, number> = {
    duringBlobStage: 1,
    beforeBlobInstall: 1,
    afterBlobInstall: 1,
    beforeDbCommit: 1,
    afterDbCommit: 2
};

describe('failpoints', function (): void {
    this.timeout(60000);

    const kit = new SpecKit();
    afterEach(async () => {
        configureFailpoint(undefined);
        await kit.dispose();
    });

    it('does nothing when no failpoint is configured, or when another one is', async () => {
        const markerFile = path.join(await kit.tempDir(), 'marker.json');
        for (const name of StoreFailpoint.ALL) {
            failpoint(name);
        }
        configureFailpoint({ name: 'duringBlobStage', afterHits: 1, markerFile });
        failpoint('afterDbCommit');
        failpoint('beforeDbCommit');
        expect(existsSync(markerFile)).to.be.false;
    });

    for (const name of StoreFailpoint.ALL) {
        it(`kills the host at ${name} and writes the marker first`, async () => {
            const directory = await kit.project();
            const markerFile = path.join(await kit.tempDir(), 'marker.json');
            const layout = ProjectLayout.of(directory);
            const child = kit.child(childScript('failpoint-child'), directory, name, '2', markerFile);
            const { processId } = await child.next('ready') as { processId: string };
            await child.exited;

            const marker = JSON.parse(await fs.readFile(markerFile, 'utf8')) as { name: string; pid: number };
            expect(marker).to.deep.equal({ name, pid: child.process.pid });
            expect(child.process.exitCode === 0, 'the child did not exit on its own').to.be.false;

            const staged = readdirSync(layout.casStaging).filter(file => file.startsWith(`${processId}-`));
            const digest: Sha256Digest = `sha256:${createHash('sha256').update(createHash('sha256').update('k1').digest()).digest('hex')}`;
            const blob = ProjectLayout.blobPath(layout, digest);
            switch (name) {
                case 'duringBlobStage':
                    expect(staged, 'half of the bytes are staged').to.have.length(1);
                    expect(statSync(path.join(layout.casStaging, staged[0])).size).to.equal(16);
                    expect(existsSync(blob)).to.be.false;
                    break;
                case 'beforeBlobInstall':
                    expect(staged).to.have.length(1);
                    expect(statSync(path.join(layout.casStaging, staged[0])).size).to.equal(32);
                    expect(existsSync(blob)).to.be.false;
                    break;
                case 'afterBlobInstall':
                    expect(existsSync(blob), 'the blob is installed').to.be.true;
                    expect(countBlobRefs(directory, digest), 'and nothing references it').to.equal(0);
                    break;
                default:
                    break;
            }

            const store = await kit.open(directory, { handlerModules: [qualificationHandlerModule] });
            expect(store.openRecovery.swept).to.include(processId);
            expect(readdirSync(layout.casStaging).filter(file => file.startsWith(`${processId}-`))).to.be.empty;
            expect(existsSync(path.join(layout.leases, `${processId}.sqlite`))).to.be.false;
            expect((await store.head())?.seq ?? 0).to.equal(COMMITTED_AFTER_KILL[name]);
            expect(await store.receiptFor('qual', 'k1') !== undefined).to.equal(name === 'afterDbCommit');
            expect((await store.verifyChain()).ok).to.be.true;
            if (name !== 'afterDbCommit') {
                let error: unknown;
                await store.readBlob(digest).catch(caught => { error = caught; });
                expect(error, 'interrupted and orphaned bytes stay semantically invisible').to.have.property('code', 'blob-unreferenced');
            } else {
                expect(Buffer.from(await store.readBlob(digest))).to.deep.equal(createHash('sha256').update('k1').digest());
            }
        });
    }
});
