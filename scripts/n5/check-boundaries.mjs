// Strict client allowlist catches relative imports and CommonJS/dynamic imports too.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dirs = ['packages/ivory-n5-client', 'packages/ivory-n5-shell'];
const errors = [];
function walk(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(dir, entry.name);
        return entry.isDirectory() && !['lib', 'node_modules', 'test'].includes(entry.name) ? walk(file) : entry.isFile() ? [file] : [];
    });
}
for (const dir of dirs) {
    const boundary = path.join(root, dir);
    const manifest = JSON.parse(readFileSync(path.join(boundary, 'package.json')));
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
        if (!['@ivory-tower/n5-client', '@theia/core', '@theia/plugin-ext', '@theia/plugin-ext-vscode', 'tslib'].includes(dependency)) {
            errors.push(`Forbidden dependency: ${dependency}`);
        }
    }
    for (const file of walk(boundary).filter(file => /\.(cjs|ts|tsx|py|R)$/.test(file))) {
        const content = readFileSync(file, 'utf8');
        for (const match of content.matchAll(/(?:from\s*|require\s*\(\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)) {
            const specifier = match[1];
            if (dir.endsWith('ivory-n5-client') && specifier.startsWith('@theia/')) {
                errors.push(`${file}: framework import in portable client`);
            }
            if (specifier.startsWith('.')) {
                if (!path.resolve(path.dirname(file), specifier).startsWith(boundary + path.sep)) {
                    errors.push(`${file}: cross-package relative import ${specifier}`);
                }
            } else if (
                !specifier.startsWith('@theia/core/') &&
                ![
                    '@ivory-tower/n5-client',
                    '@theia/plugin-ext',
                    '@theia/plugin-ext-vscode/lib/node/scanner-vscode',
                    'node:http',
                    'node:https',
                    'node:fs',
                ].includes(specifier)
            ) {
                errors.push(`${file}: forbidden import ${specifier}`);
            } else if (specifier === 'node:fs' && !file.endsWith('cli.cjs')) {
                errors.push(`${file}: filesystem access outside CLI input reader`);
            }
        }
        if (
            /child_process|subprocess|sqlite|psycopg|boto3|@ivory-tower\/(domain|application|infrastructure|adapters)|\bsystem2?\s*\(/.test(
                content,
            )
        ) {
            errors.push(`${file}: forbidden domain, storage, or process access`);
        }
    }
}
const app = JSON.parse(readFileSync(path.join(root, 'examples/ivory-n5-browser/package.json')));
const lock = JSON.parse(readFileSync(path.join(root, 'examples/ivory-n5-browser/extensions.lock.json')));
const scanner = readFileSync(path.join(root, 'packages/ivory-n5-shell/src/node/scanner.ts'), 'utf8');
const policy = Object.fromEntries([...scanner.matchAll(/'([^']+)': '([^']+)'/g)].map(match => [match[1], match[2]]));
if (
    Object.keys(policy).length !== lock.extensions.length ||
    lock.extensions.some(entry => policy[entry.id.toLowerCase()] !== entry.version)
) {
    errors.push('Runtime extension policy differs from artifact lock');
}
if (app.dependencies['@theia/vsx-registry'] || app.dependencies['@ivory-tower/health'] || app.theiaPluginsDir) {
    errors.push('N5 application includes a registry, legacy domain-coupled health widget, or shared plugin directory');
}
if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
} else {
    console.log('N5 client boundaries: OK');
}
