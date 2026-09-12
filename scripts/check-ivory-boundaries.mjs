// @ts-check
'use strict';

/**
 * Enforces Ivory Tower module-boundary import rules (IV-15).
 * Run via: npm run check:ivory-boundaries
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const LAYERS = [
    {
        name: '@theia/ivory-identity',
        dir: 'packages/ivory-identity/src',
        forbidden: [
            '@theia/',
            '@ivory-tower/',
            'liquidify-react',
            'pg',
            '@aws-sdk/',
            'graphile-worker',
            'docling',
        ],
    },
    {
        name: '@ivory-tower/contracts',
        dir: 'packages/ivory-tower-contracts/src',
        forbidden: [
            '@theia/',
            '@ivory-tower/application',
            '@ivory-tower/infrastructure',
            '@ivory-tower/health',
            'liquidify-react',
            'pg',
            '@aws-sdk/',
            'graphile-worker',
            'docling',
        ],
    },
    {
        name: '@ivory-tower/domain',
        dir: 'packages/ivory-tower-domain/src',
        forbidden: [
            '@theia/',
            '@ivory-tower/application',
            '@ivory-tower/infrastructure',
            '@ivory-tower/health',
            'liquidify-react',
            'pg',
            '@aws-sdk/',
            'graphile-worker',
            'docling',
        ],
    },
    {
        name: '@ivory-tower/adapters',
        dir: 'packages/ivory-tower-adapters/src',
        forbidden: [
            '@theia/',
            '@ivory-tower/application',
            '@ivory-tower/infrastructure',
            '@ivory-tower/health',
            '@ivory-tower/content-policy',
            'liquidify-react',
            'pg',
            '@aws-sdk/',
            'graphile-worker',
            'docling',
        ],
    },
    {
        name: '@ivory-tower/content-policy',
        dir: 'packages/ivory-tower-content-policy/src',
        forbidden: [
            '@theia/',
            '@ivory-tower/application',
            '@ivory-tower/infrastructure',
            '@ivory-tower/health',
            '@ivory-tower/adapters',
            '@ivory-tower/domain',
            'liquidify-react',
        ],
    },
    {
        name: '@ivory-tower/application',
        dir: 'packages/ivory-tower-application/src',
        forbidden: [
            '@theia/',
            '@ivory-tower/infrastructure',
            '@ivory-tower/health',
            'liquidify-react',
            'pg',
            '@aws-sdk/',
            'graphile-worker',
            'docling',
        ],
    },
    {
        name: '@ivory-tower/infrastructure',
        dir: 'packages/ivory-tower-infrastructure/src',
        forbidden: [
            '@theia/',
            '@ivory-tower/application',
            '@ivory-tower/health',
            'liquidify-react',
        ],
    },
    {
        name: '@ivory-tower/health',
        dir: 'packages/ivory-tower-health/src/browser',
        forbidden: [
            'liquidify-react',
            '@ivory-tower/adapters',
            '@ivory-tower/domain',
            '@ivory-tower/infrastructure',
        ],
    },
    {
        name: '@ivory-tower/api',
        dir: 'packages/ivory-tower-api/src',
        forbidden: [
            '@theia/',
            'liquidify-react',
        ],
    },
    {
        name: '@ivory-tower/worker',
        dir: 'packages/ivory-tower-worker/src',
        forbidden: [
            '@theia/',
            'liquidify-react',
        ],
    },
];

const IMPORT_PATTERN = /(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]/g;

function collectSourceFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectSourceFiles(fullPath));
        } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
            files.push(fullPath);
        }
    }
    return files;
}

function findViolations(layer) {
    const layerDir = path.join(ROOT, layer.dir);
    if (!fs.existsSync(layerDir)) {
        return [`missing layer directory: ${layer.dir}`];
    }

    const violations = [];
    for (const file of collectSourceFiles(layerDir)) {
        const content = fs.readFileSync(file, 'utf8');
        let match;
        while ((match = IMPORT_PATTERN.exec(content)) !== null) {
            const specifier = match[1];
            for (const forbidden of layer.forbidden) {
                if (specifier.includes(forbidden)) {
                    violations.push(`${layer.name}: ${path.relative(ROOT, file)} imports "${specifier}" (forbidden: ${forbidden})`);
                }
            }
        }
    }
    return violations;
}

const allViolations = LAYERS.flatMap(findViolations);

const fixturePath = path.join(ROOT, 'scripts', 'ivory-boundary-fixtures.json');
const fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
for (const fixture of fixtures) {
    const layer = LAYERS.find(candidate => candidate.name === fixture.layer);
    if (!layer || !layer.forbidden.some(forbidden => fixture.import.includes(forbidden))) {
        allViolations.push(`negative fixture is not covered by a prohibited import rule: ${fixture.layer} -> ${fixture.import}`);
    }
}

const ivoryBrowserPackage = path.join(ROOT, 'examples', 'ivory-tower-browser', 'package.json');
if (fs.existsSync(ivoryBrowserPackage)) {
    const browserSource = fs.readFileSync(ivoryBrowserPackage, 'utf8');
    if (browserSource.includes('@theia/plugin-ext') || browserSource.includes('--plugins=')) {
        allViolations.push('Ivory Tower browser application must not load a runtime plugin host.');
    }
}

if (allViolations.length > 0) {
    console.error('Ivory Tower module boundary violations:');
    for (const violation of allViolations) {
        console.error(`  - ${violation}`);
    }
    process.exit(1);
}

console.log('Ivory Tower module boundaries: OK');
