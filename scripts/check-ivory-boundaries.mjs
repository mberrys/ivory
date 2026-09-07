// @ts-check
'use strict';

/**
 * Enforces the N1 headless research-kernel boundary.
 *
 * This branch is upstream Theia rather than the Ivory Tower service scaffold. The N1 package may
 * consume only the delivered IV-17 identity grammar; it must not acquire a Theia UI or server
 * dependency while it remains a headless reference kernel.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'packages', 'ivory-tower-research-kernel', 'src');
const ALLOWED_THEIA_IMPORT = '@theia/ivory-identity';
const IMPORT_PATTERN = /(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]/g;

function collectSourceFiles(dir) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectSourceFiles(fullPath));
        } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
            files.push(fullPath);
        }
    }
    return files;
}

const violations = [];
for (const file of collectSourceFiles(SOURCE)) {
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = IMPORT_PATTERN.exec(content)) !== null) {
        const specifier = match[1];
        if (specifier.startsWith('@theia/') && specifier !== ALLOWED_THEIA_IMPORT && !specifier.startsWith(`${ALLOWED_THEIA_IMPORT}/`)) {
            violations.push(`${path.relative(ROOT, file)} imports forbidden Theia module "${specifier}"`);
        }
    }
}

if (violations.length > 0) {
    console.error('N1 research-kernel boundary violations:');
    for (const violation of violations) {
        console.error(`  - ${violation}`);
    }
    process.exit(1);
}

console.log('N1 research-kernel boundary: OK');
