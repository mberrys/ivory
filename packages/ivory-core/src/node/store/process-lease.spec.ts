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
import { existsSync, writeFileSync } from 'fs';
import { DatabaseSync } from 'node:sqlite';
import * as path from 'path';
import { IvoryStoreError } from '../../common/store-protocol';
import { acquireLease, createLeaseFile, processId, recoverDeadLeases } from './process-lease';
import { ProjectLayout } from '../project-layout';
import { childScript, SpecKit } from '../test/spec-helpers';

/** No process has a pid this large, on any platform. */
const IMPOSSIBLE_PID = 2 ** 31 - 2;

describe('process lease', function (): void {
    // Every store is a worker thread and a WAL database with full synchronous, and some specs start other processes.
    this.timeout(60000);

    const kit = new SpecKit();
    afterEach(() => kit.dispose());

    it('has a process id of 32 hex digits that is the same for every lease of the process', () => {
        expect(processId).to.match(/^[0-9a-f]{32}$/);
    });

    it('creates the lease file whole, with its row, and removes it on release', async () => {
        const directory = await kit.project();
        const layout = ProjectLayout.of(directory);
        const lease = acquireLease(directory, 'spec-host');
        const file = path.join(layout.leases, `${processId}.sqlite`);
        expect(lease.file).to.equal(file);
        expect(existsSync(`${file}.init`)).to.be.false;
        const probe = new DatabaseSync(file, { timeout: 0, readOnly: true });
        try {
            // The exclusive lock keeps even a reader out, which is what makes the lease visible to other hosts.
            expect(() => probe.prepare('SELECT pid FROM lease').all()).to.throw(/locked/);
        } finally {
            probe.close();
        }
        lease.release();
        lease.release();
        expect(existsSync(file)).to.be.false;
    });

    it('records the pid and host kind in the row', async () => {
        const directory = await kit.project();
        const file = createLeaseFile(ProjectLayout.of(directory).leases, 'someone', { pid: 4242, hostKind: 'spec-host' });
        const db = new DatabaseSync(file, { readOnly: true });
        try {
            const row = db.prepare('SELECT pid, host_kind FROM lease').get();
            expect(row).to.deep.include({ pid: 4242, host_kind: 'spec-host' });
        } finally {
            db.close();
        }
    });

    it('refuses to take a lease that is already held', async () => {
        const directory = await kit.project();
        const lease = acquireLease(directory, 'spec-host');
        try {
            expect(() => acquireLease(directory, 'spec-host')).to.throw(IvoryStoreError).with.property('code', 'already-open');
        } finally {
            lease.release();
        }
    });

    it('sweeps a dead lease and the staging files tagged with its process id, and only those', async () => {
        const directory = await kit.project();
        const layout = ProjectLayout.of(directory);
        const dead = createLeaseFile(layout.leases, 'dead', { pid: IMPOSSIBLE_PID, hostKind: 'spec-host' });
        writeFileSync(path.join(layout.casStaging, 'dead-1.tmp'), 'x');
        writeFileSync(path.join(layout.casStaging, 'dead-2.tmp'), 'x');
        writeFileSync(path.join(layout.casStaging, 'deadly-3.tmp'), 'x');
        writeFileSync(path.join(layout.casStaging, `${processId}-mine.tmp`), 'x');
        const report = recoverDeadLeases(directory, processId);
        expect(report.swept).to.deep.equal(['dead']);
        expect(existsSync(dead)).to.be.false;
        expect(existsSync(path.join(layout.casStaging, 'dead-1.tmp'))).to.be.false;
        expect(existsSync(path.join(layout.casStaging, 'dead-2.tmp'))).to.be.false;
        expect(existsSync(path.join(layout.casStaging, 'deadly-3.tmp')), 'a different process id that starts the same').to.be.true;
        expect(existsSync(path.join(layout.casStaging, `${processId}-mine.tmp`))).to.be.true;
    });

    it('never probes its own lease', async () => {
        const directory = await kit.project();
        const lease = acquireLease(directory, 'spec-host');
        try {
            expect(recoverDeadLeases(directory, processId)).to.deep.equal({ swept: [], skippedAlive: [], malformed: [], deferred: [] });
            expect(existsSync(lease.file)).to.be.true;
        } finally {
            lease.release();
        }
    });

    it('leaves a held lease alone', async () => {
        const directory = await kit.project();
        const layout = ProjectLayout.of(directory);
        const lease = acquireLease(directory, 'spec-host', 'another-host');
        writeFileSync(path.join(layout.casStaging, 'another-host-1.tmp'), 'x');
        try {
            const report = recoverDeadLeases(directory, processId);
            expect(report.skippedAlive).to.deep.equal(['another-host']);
            expect(report.swept).to.be.empty;
            expect(existsSync(path.join(layout.casStaging, 'another-host-1.tmp'))).to.be.true;
        } finally {
            lease.release();
        }
    });

    it('does not treat a lease file without a row as dead, and reports it', async () => {
        const directory = await kit.project();
        const layout = ProjectLayout.of(directory);
        const empty = path.join(layout.leases, 'empty.sqlite');
        new DatabaseSync(empty).close();
        const rowless = path.join(layout.leases, 'rowless.sqlite');
        const db = new DatabaseSync(rowless);
        db.exec('CREATE TABLE lease(pid INTEGER, host_kind TEXT, started_at TEXT)');
        db.close();
        writeFileSync(path.join(layout.leases, 'garbage.sqlite'), 'this is not a database, and it is long enough to be read as one'.repeat(4));
        writeFileSync(path.join(layout.casStaging, 'empty-1.tmp'), 'x');
        const report = recoverDeadLeases(directory, processId);
        expect(report.malformed).to.have.members(['empty', 'rowless', 'garbage']);
        expect(report.swept).to.be.empty;
        expect(existsSync(empty) && existsSync(rowless), 'the files stay').to.be.true;
        expect(existsSync(path.join(layout.casStaging, 'empty-1.tmp'))).to.be.true;
    });

    it('ignores files that are still being created', async () => {
        const directory = await kit.project();
        const layout = ProjectLayout.of(directory);
        writeFileSync(path.join(layout.leases, 'young.sqlite.init'), 'half written');
        expect(recoverDeadLeases(directory, processId)).to.deep.equal({ swept: [], skippedAlive: [], malformed: [], deferred: [] });
        expect(existsSync(path.join(layout.leases, 'young.sqlite.init'))).to.be.true;
    });

    it('has nothing to recover in a project without a leases directory', async () => {
        const directory = await kit.tempDir();
        expect(recoverDeadLeases(directory, processId).swept).to.be.empty;
    });

    it('skips a lease whose lock is free but whose pid is a live process', async () => {
        const directory = await kit.project();
        const layout = ProjectLayout.of(directory);
        const file = createLeaseFile(layout.leases, 'reused-pid', { pid: process.pid, hostKind: 'spec-host' });
        writeFileSync(path.join(layout.casStaging, 'reused-pid-1.tmp'), 'x');
        const report = recoverDeadLeases(directory, processId);
        expect(report.skippedAlive).to.deep.equal(['reused-pid']);
        expect(existsSync(file)).to.be.true;
        expect(existsSync(path.join(layout.casStaging, 'reused-pid-1.tmp'))).to.be.true;
    });

    it('sees a lease held by another process as alive, and sweeps it once that process is killed', async () => {
        const directory = await kit.project();
        const layout = ProjectLayout.of(directory);
        const child = kit.child(childScript('lease-holder'), directory);
        const { processId: childId } = await child.next('ready') as { processId: string };
        expect(recoverDeadLeases(directory, processId).skippedAlive).to.deep.equal([childId]);
        expect(existsSync(path.join(layout.casStaging, `${childId}-x.tmp`))).to.be.true;
        await child.kill();
        const report = recoverDeadLeases(directory, processId);
        expect(report.swept).to.deep.equal([childId]);
        expect(existsSync(path.join(layout.casStaging, `${childId}-x.tmp`))).to.be.false;
        expect(existsSync(path.join(layout.leases, `${childId}.sqlite`))).to.be.false;
    });
});
