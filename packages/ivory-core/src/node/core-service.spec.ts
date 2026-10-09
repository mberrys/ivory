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
import { execFile } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, promises as fs } from 'fs';
import { request } from 'http';
import * as path from 'path';
import { CommitOutcome, IvoryStoreError } from '../common/store-protocol';
import { connectCore, CoreClient, startOrAttachCore } from './core-client';
import { CoreDescriptor, isRecord, MAX_BLOB_BYTES, parseCoreDescriptor, parseCoreIdentity } from './core-protocol';
import { CoreService, startCoreService } from './core-service';
import { ProjectLayout } from './project-layout';
import { childScript, eventually, SpecKit, testHandlerModule } from './test/spec-helpers';

const digestOf = (bytes: Uint8Array): Sha256Digest => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function cli(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise(resolve => execFile(process.execPath, [path.join(__dirname, 'core-cli.js'), ...args], { windowsHide: true }, (error, stdout, stderr) => {
        resolve({ code: error ? 1 : 0, stdout, stderr });
    }));
}

async function rejected(action: () => Promise<unknown>, code: string): Promise<void> {
    try {
        await action();
    } catch (error) {
        expect(error).to.be.instanceOf(IvoryStoreError).with.property('code', code);
        return;
    }
    throw new Error('the operation did not reject with ' + code);
}

describe('headless Core ownership and byte admission', function (): void {
    this.timeout(90000);
    const kit = new SpecKit();
    const services: CoreService[] = [];
    const detached: { projectDir: string; client: CoreClient }[] = [];
    afterEach(async () => {
        for (const core of services.splice(0)) {
            await core.close();
        }
        for (const { projectDir, client } of detached.splice(0)) {
            await client.stop().catch(() => undefined);
            await eventually(() => !existsSync(ProjectLayout.of(projectDir).coreDiscovery));
        }
        await kit.dispose();
    });

    async function service(directory: string): Promise<CoreService> {
        const core = await startCoreService(directory, { handlerModules: [testHandlerModule] });
        services.push(core);
        return core;
    }

    it('holds one OS writer lock even if discovery claims a dead PID, and does not replace that lock file', async () => {
        const directory = await kit.project();
        const child = kit.child(childScript('core-holder'), directory, 'owner');
        const ready = await child.next('ready');
        const identity = parseCoreIdentity(ready.identity);
        const layout = ProjectLayout.of(directory);
        const before = await fs.stat(layout.writerLock);
        const descriptor = parseCoreDescriptor(JSON.parse(await fs.readFile(layout.coreDiscovery, 'utf8')));
        await fs.writeFile(layout.coreDiscovery, JSON.stringify({ ...descriptor, pid: 2147483647 }));
        await rejected(() => kit.open(directory), 'writer-owned');
        expect((await connectCore(directory)).identity.pid).to.equal(identity.pid);
        await fs.rm(layout.coreDiscovery);
        await rejected(() => kit.open(directory), 'writer-owned');
        await child.kill();
        const recovered = await kit.open(directory);
        expect(recovered.writerEpoch).to.not.equal(identity.epoch);
        expect((await fs.stat(layout.writerLock)).ino).to.equal(before.ino);
    });

    it('refuses a second service in the same process, and a direct writable host while a service owns the project', async () => {
        const directory = await kit.project();
        await service(directory);
        await rejected(() => startCoreService(directory), 'already-open');
        await rejected(() => kit.open(directory), 'already-open');
        const reader = await kit.open(directory, { readOnly: true });
        expect(reader.writerEpoch).to.be.undefined;
        expect(await reader.headSeq()).to.equal(0);
        await rejected(() => reader.admitBlob(Buffer.from('refused')), 'read-only-project');
    });

    it('admits before semantic visibility, preserves referenced bytes across restart, and rejects corrupt references and reads', async () => {
        const directory = await kit.project();
        const bytes = Buffer.from('P3a durable source fixture\n');
        const core = await service(directory);
        const client = await connectCore(directory);
        const digest = await client.admitBlob(bytes, digestOf(bytes));
        await rejected(() => client.readBlob(digest), 'blob-unreferenced');
        expect(await client.headSeq()).to.equal(0);
        const committed = await client.commit({ kind: 'test.attach', input: { blob: digest }, principal: 'fixture', idempotencyKey: 'attach' });
        expect(CommitOutcome.isRefusal(committed)).to.be.false;
        expect(Buffer.from(await client.readBlob(digest))).to.deep.equal(bytes);
        await client.close();
        await core.close();
        const next = await service(directory);
        const attached = await connectCore(directory);
        expect(next.identity.epoch).to.not.equal(core.identity.epoch);
        expect(Buffer.from(await attached.readBlob(digest))).to.deep.equal(bytes);
        await fs.writeFile(ProjectLayout.blobPath(ProjectLayout.of(directory), digest), 'corrupted');
        await rejected(() => attached.readBlob(digest), 'cas-corrupt');
        const refused = await attached.commit({ kind: 'test.attach', input: { blob: digest }, principal: 'fixture', idempotencyKey: 'bad-attach' });
        expect(CommitOutcome.isRefusal(refused) && refused.refusal.code).to.equal('cas-corrupt');
        expect(await attached.headSeq()).to.equal(1);
        await attached.close();
    });

    it('rejects expected digest mismatch without creating a staged or installed blob', async () => {
        const directory = await kit.project();
        await service(directory);
        const client = await connectCore(directory);
        const bytes = Buffer.from('fixture');
        await rejected(() => client.admitBlob(bytes, digestOf(Buffer.from('other'))), 'digest-mismatch');
        expect(await fs.readdir(ProjectLayout.of(directory).casStaging)).to.be.empty;
        expect(existsSync(ProjectLayout.blobPath(ProjectLayout.of(directory), digestOf(bytes)))).to.be.false;
        await client.close();
    });

    it('never resolves the same digest from another project', async () => {
        const first = await kit.project('first');
        const second = await kit.project('second');
        await service(first);
        await service(second);
        const a = await connectCore(first);
        const b = await connectCore(second);
        const digest = await a.admitBlob(Buffer.from('project-scoped'));
        await a.commit({ kind: 'test.attach', input: { blob: digest }, principal: 'p', idempotencyKey: 'a' });
        await rejected(() => b.readBlob(digest), 'blob-unreferenced');
        await fs.copyFile(ProjectLayout.of(first).coreDiscovery, ProjectLayout.of(second).coreDiscovery);
        await rejected(() => connectCore(second), 'store-mismatch');
        // A copied live manifest can share both IDs, but discovery must still bind to the canonical directory.
        await fs.copyFile(ProjectLayout.of(first).manifest, ProjectLayout.of(second).manifest);
        await rejected(() => connectCore(second), 'store-mismatch');
        await a.close();
        await b.close();
    });

    it('authenticates and fences every request; rejects browser origins and malformed input', async () => {
        const directory = await kit.project();
        await service(directory);
        const descriptor: CoreDescriptor = parseCoreDescriptor(JSON.parse(await fs.readFile(ProjectLayout.of(directory).coreDiscovery, 'utf8')));
        async function raw(body: string, overrides: Record<string, string> = {}): Promise<{ status: number; body: unknown }> {
            return new Promise((resolve, reject) => {
                const req = request({
                    hostname: '127.0.0.1', port: descriptor.port, path: '/core', method: 'POST', agent: false,
                    headers: { Authorization: 'Bearer ' + descriptor.token, 'X-Ivory-Epoch': descriptor.epoch, ...overrides }
                }, res => {
                    const chunks: Buffer[] = [];
                    res.on('data', chunk => chunks.push(chunk));
                    res.on('end', () => {
                        const text = Buffer.concat(chunks).toString('utf8');
                        resolve({ status: res.statusCode ?? 0, body: text ? JSON.parse(text) : undefined });
                    });
                });
                req.on('error', reject);
                req.end(body);
            });
        }
        expect((await raw('{"op":"status"}', { Authorization: 'Bearer invalid' })).status).to.equal(403);
        expect((await raw('{"op":"status"}', { 'X-Ivory-Epoch': 'obsolete' })).status).to.equal(403);
        expect((await raw('{"op":"status"}', { Origin: 'https://example.test' })).status).to.equal(403);
        for (const command of ['{', '{"op":"admitBlob","bytes":"AB=="}', '{"op":"gc","graceMs":-1}', '{"op":"unknown"}']) {
            const response = await raw(command);
            expect(response.status).to.equal(200);
            expect(isRecord(response.body) && response.body.ok).to.equal(false);
        }
        const status = await raw('{"op":"status"}');
        expect(JSON.stringify(status.body)).to.not.include(descriptor.token);
        const client = await connectCore(directory);
        await rejected(() => client.admitBlob(new Uint8Array(MAX_BLOB_BYTES + 1)), 'invalid-argument');
        await client.close();
    });

    it('racing starters attach to one daemon, and detaching does not stop it', async () => {
        const directory = await kit.project();
        const clients = await Promise.all([1, 2, 3].map(() => startOrAttachCore(directory)));
        detached.push({ projectDir: directory, client: clients[0] });
        expect(new Set(clients.map(client => client.identity.epoch)).size).to.equal(1);
        expect(new Set(clients.map(client => client.identity.pid)).size).to.equal(1);
        await clients[1].close();
        await clients[2].close();
        expect((await connectCore(directory)).identity).to.deep.equal(clients[0].identity);
    });

    it('CLI reconnects to the same daemon after a workbench host process closes', async () => {
        const directory = await kit.project();
        const workbench = kit.child(childScript('core-holder'), directory, 'client');
        const ready = await workbench.next('ready');
        const original = parseCoreIdentity(ready.identity);
        const client = await connectCore(directory);
        detached.push({ projectDir: directory, client });
        await workbench.release();
        const status = await cli('status', directory);
        expect(status.code, status.stderr).to.equal(0);
        const value: unknown = JSON.parse(status.stdout);
        expect(parseCoreIdentity(value)).to.deep.equal(original);
        const source = path.join(directory, 'source-fixture.txt');
        const bytes = Buffer.from('CLI fixture\n');
        await fs.writeFile(source, bytes);
        const admitted = await cli('admit', directory, source, digestOf(bytes));
        expect(admitted.code, admitted.stderr).to.equal(0);
        const result: unknown = JSON.parse(admitted.stdout);
        expect(isRecord(result) && result.digest).to.equal(digestOf(bytes));
        expect(isRecord(result) && result.epoch).to.equal(original.epoch);
        const reconnected = await cli('start', directory);
        expect(reconnected.code, reconnected.stderr).to.equal(0);
        expect(parseCoreIdentity(JSON.parse(reconnected.stdout))).to.deep.equal(original);
        expect(admitted.stdout + status.stdout + reconnected.stdout).to.not.include('"token"');
    });
});
