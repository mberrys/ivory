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
import * as path from 'path';
import { IvoryStoreError } from '../../common/store-protocol';
import { testHandlerModule } from '../test/spec-helpers';
import { defineCommitHandler, loadCommitHandlers } from './commit-handler';

// The workspace has no type declarations for eslint, and the spec uses only this much of it.
interface LintMessage {
    readonly ruleId?: string;
    readonly message: string;
}

interface LintEngine {
    lintText(text: string, options: { filePath: string }): Promise<{ messages: LintMessage[] }[]>;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ESLint } = require('eslint') as { ESLint: new (options: { cwd: string }) => LintEngine };

describe('commit handlers', function (): void {
    // Every store is a worker thread and a WAL database with full synchronous, and some specs start other processes.
    this.timeout(60000);

    describe('await between BEGIN and COMMIT: typing', () => {

        it('accepts a synchronous apply', () => {
            const handler = defineCommitHandler({
                kind: 'spec.sync',
                parse: (input: unknown) => String(input),
                apply: (tx, input) => input.length + tx.seq
            });
            expect(handler.kind).to.equal('spec.sync');
        });

        it('does not compile an apply that returns a promise', () => {
            // If this stops being a type error, the directive itself becomes one and the package no longer compiles.
            const handler = defineCommitHandler({
                kind: 'spec.async',
                parse: (input: unknown) => input,
                // @ts-expect-error apply must be synchronous
                apply: async () => 1
            });
            expect(handler.kind).to.equal('spec.async');
        });

        it('does not compile an apply that may return a promise', () => {
            const handler = defineCommitHandler({
                kind: 'spec.maybe-async',
                parse: (input: unknown) => input,
                // @ts-expect-error apply must be synchronous
                apply: (): number | Promise<number> => 1
            });
            expect(handler.kind).to.equal('spec.maybe-async');
        });
    });

    describe('registry', () => {

        it('loads the handlers of each module by kind', () => {
            const handlers = loadCommitHandlers([testHandlerModule]);
            expect([...handlers.keys()]).to.include.members(['test.put', 'test.attach']);
        });

        it('refuses to start with the same kind registered twice', () => {
            expect(() => loadCommitHandlers([testHandlerModule, testHandlerModule])).to.throw(IvoryStoreError).with.property('code', 'duplicate-handler');
        });

        it('refuses a module that does not export commitHandlers', () => {
            expect(() => loadCommitHandlers([path.join(__dirname, 'commit-handler.js')])).to.throw(IvoryStoreError).with.property('code', 'invalid-handler-module');
        });

    });

    describe('await between BEGIN and COMMIT: lint', function (): void {
        // Type-aware linting builds the whole program, which takes a while.
        this.timeout(180000);

        const packageDir = path.resolve(__dirname, '..', '..', '..');
        const handlerFile = path.join(packageDir, 'src', 'node', 'store', 'handlers', 'index.ts');
        const asyncHandler = `
import { defineCommitHandler } from '../commit-handler';

export const commitHandlers = [defineCommitHandler({
    kind: 'lint.async',
    parse: (input: unknown) => input,
    apply: async (tx, input) => {
        await Promise.resolve(input);
        tx.run('SELECT 1');
        return Promise.resolve(1).then(value => value + 1);
    }
})];
`;
        let eslint: LintEngine;
        before(() => {
            eslint = new ESLint({ cwd: packageDir });
        });

        async function ruleIds(filePath: string, text: string): Promise<string[]> {
            const [result] = await eslint.lintText(text, { filePath });
            return result.messages.map(message => message.ruleId ?? 'parse-error');
        }

        it('reports async functions, await and promise chains in a handler', async () => {
            const [result] = await eslint.lintText(asyncHandler, { filePath: handlerFile });
            const restricted = result.messages.filter(message => message.ruleId === 'no-restricted-syntax').map(message => message.message);
            expect(restricted.some(message => /no async functions/.test(message)), restricted.join('\n')).to.be.true;
            expect(restricted.some(message => /no await/.test(message)), restricted.join('\n')).to.be.true;
            expect(restricted.some(message => /no promise chains/.test(message)), restricted.join('\n')).to.be.true;
        });

        it('applies the same rules to a test handler module', async () => {
            const testHandlerFile = path.join(packageDir, 'src', 'node', 'test', 'test-handlers.ts');
            expect(await ruleIds(testHandlerFile, asyncHandler.replace('../commit-handler', '../store/commit-handler'))).to.include('no-restricted-syntax');
        });

        it('leaves a synchronous handler alone', async () => {
            const syncHandler = asyncHandler.replace(/apply: async[\s\S]*?\n    \}\n/, 'apply: (tx, input) => {\n        tx.run(\'SELECT 1\');\n        return input;\n    }\n');
            expect(await ruleIds(handlerFile, syncHandler)).to.not.include('no-restricted-syntax');
        });

        it('bans node:sqlite outside core/node/store', async () => {
            const text = 'import { DatabaseSync } from \'node:sqlite\';\n\nexport const database = DatabaseSync;\n';
            const [outside] = await eslint.lintText(text, { filePath: path.join(packageDir, 'src', 'node', 'project-layout.ts') });
            const banned = outside.messages.filter(message => message.ruleId === 'no-restricted-imports');
            expect(banned.map(message => message.message).join('\n')).to.include('No SQL outside core/node/store');
            const [inside] = await eslint.lintText(text, { filePath: path.join(packageDir, 'src', 'node', 'store', 'store-schema.ts') });
            expect(inside.messages.filter(message => message.ruleId === 'no-restricted-imports')).to.be.empty;
        });

        it('still bans the relative imports that the shared configuration bans', async () => {
            const text = 'import * as parent from \'..\';\n\nexport const value = parent;\n';
            const [result] = await eslint.lintText(text, { filePath: path.join(packageDir, 'src', 'node', 'project-layout.ts') });
            expect(result.messages.some(message => message.ruleId === 'no-restricted-imports')).to.be.true;
        });
    });
});
