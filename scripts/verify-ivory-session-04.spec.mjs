// @ts-check
'use strict';

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Session 04 teardown binds only checkout-local state through the Compose Postgres pin', async () => {
    const composeText = await readFile(path.join(root, 'infra', 'docker-compose.yml'), 'utf8');
    const verifier = await readFile(path.join(root, 'scripts', 'verify-ivory-session-04.mjs'), 'utf8');
    const match = composeText.match(/^ {4}image: (pgvector\/pgvector:pg16@sha256:[a-f0-9]{64})$/m);
    assert.ok(match?.[1], 'infra/docker-compose.yml must pin pgvector/pgvector:pg16 by digest');
    assert.match(verifier, /pgvector\\\/pgvector:pg16@sha256:\[a-f0-9\]\{64\}/);
    assert.match(verifier, /\$\{stateDirectory\}:\/ivory-tower-state/);
    assert.match(verifier, /find \/ivory-tower-state -mindepth 1 -maxdepth 1 -exec rm -rf \{\} \+/);
    assert.match(verifier, /path\.resolve\(root, '\.ivory-tower'\)/);
});

test('runtime verifier compiles API and worker before starting them', async () => {
    const runtime = await readFile(path.join(root, 'scripts', 'verify-ivory-runtime.mjs'), 'utf8');
    const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    assert.equal(
        packageJson.scripts['compile:ivory-services'],
        'npx lerna run compile --scope @ivory-tower/api --scope @ivory-tower/worker --include-dependencies',
    );
    assert.match(runtime, /runNpm\(\['run', 'compile:ivory-services'\]\);/);
});
