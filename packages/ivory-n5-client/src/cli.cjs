#!/usr/bin/env node
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
'use strict';
const { readFileSync } = require('node:fs');
const { ExecutionClient, missingCapabilities } = require('./client.cjs');

async function main() {
    const [command, argument, key] = process.argv.slice(2);
    const client = new ExecutionClient(process.env.IVORY_N5_SERVICE_URL || 'http://127.0.0.1:4100');
    if (missingCapabilities.includes(command)) {
        console.error(JSON.stringify({ status: 'blocked', capability: command, reason: 'Prerequisite service contract missing' }));
        process.exitCode = 2;
        return;
    }
    const signal = AbortSignal.timeout(30000);
    if (command === 'ready') {
        console.log(JSON.stringify(await client.ready(signal)));
    } else if (command === 'get' && argument) {
        console.log(JSON.stringify(await client.get(argument, signal)));
    } else if (command === 'submit' && argument && key) {
        console.log(JSON.stringify(await client.submit(JSON.parse(readFileSync(argument, 'utf8')), key, signal)));
    } else if (command === 'events' && argument) {
        for await (const event of client.events(argument, Number(key ?? 0), signal)) {
            console.log(JSON.stringify(event));
        }
    } else {
        throw new Error('Usage: ivory-n5 ready | get ID | submit REQUEST.json KEY | events ID [AFTER]');
    }
}
main().catch(error => {
    console.error(JSON.stringify({ error: error.message, status: error.status, body: error.body }));
    process.exitCode = 1;
});
