// @ts-check
'use strict';

/**
 * Sentinel and credential scan for the Ivory Tower surface (IV-19 step 7).
 *
 * Two tiers, both configured in configs/ivory-dependency-policy.json:
 *   - critical patterns (sentinel, cloud keys, private keys, tokens, DSNs) are scanned across the
 *     whole repository, because they have effectively no false-positive surface;
 *   - the remaining patterns are scanned over Ivory-owned paths only. Upstream Theia's own
 *     hygiene is not this gate's subject, and scanning it would only produce noise.
 *
 * Bundle, log, telemetry, and audit-shaped redaction is the IV-22 contract
 * (docs/iv-22-deployment-secrets.md), not this repository scan.
 *
 * Flags:
 *   --root <dir>   scan a different tree (used by the adversarial fixtures)
 *   --quiet        suppress the success summary
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(SCRIPT_DIR, '..');

const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git', 'lib', 'coverage', '.nyc_output', 'artifacts']);
const SKIPPED_FILES = new Set(['package-lock.json', 'license-check-summary.txt']);
const BINARY_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot',
    '.zip', '.gz', '.tgz', '.jar', '.pdf', '.vsix', '.map', '.wasm',
]);

/** Additional build outputs scanned when they exist, even though they are gitignored. */
const BUILD_OUTPUT_DIRECTORIES = ['examples/ivory-tower-browser/lib', 'examples/ivory-tower-browser/src-gen'];

/** @param {string} pattern */
function globToRegExp(pattern) {
    let source = '';
    for (let index = 0; index < pattern.length; index++) {
        const character = pattern[index];
        if (character === '*') {
            if (pattern[index + 1] === '*') {
                source += '.*';
                index++;
                if (pattern[index + 1] === '/') {
                    index++;
                    source += '(?:/)?';
                }
            } else {
                source += '[^/]*';
            }
        } else if ('\\^$.|?+()[]{}'.includes(character)) {
            source += `\\${character}`;
        } else {
            source += character;
        }
    }
    return new RegExp(`^${source}$`, 'u');
}

/**
 * @param {string} root
 * @returns {string[]} repository-relative file paths
 */
function listFiles(root) {
    /** @type {string[]} */
    let files = [];
    try {
        // --others --exclude-standard also lists files that are staged for a first commit but
        // not yet tracked. A credential about to be committed is exactly what this gate is for.
        const tracked = execFileSync(
            'git',
            ['-C', root, 'ls-files', '--cached', '--others', '--exclude-standard'],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        files = tracked.split('\n').filter(Boolean);
    } catch {
        // Not a git repository (this is the case for the adversarial fixtures): walk the tree.
        const walk = directory => {
            /** @type {string[]} */
            const collected = [];
            const absolute = path.join(root, directory === '' ? '.' : directory);
            for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
                if (SKIPPED_DIRECTORIES.has(entry.name)) {
                    continue;
                }
                const relative = directory === '' ? entry.name : `${directory}/${entry.name}`;
                if (entry.isDirectory()) {
                    collected.push(...walk(relative));
                } else if (entry.isFile()) {
                    collected.push(relative);
                }
            }
            return collected;
        };
        files = walk('');
    }

    for (const outputDirectory of BUILD_OUTPUT_DIRECTORIES) {
        if (!fs.existsSync(path.join(root, outputDirectory))) {
            continue;
        }
        const walk = directory => {
            for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
                const relative = `${directory}/${entry.name}`;
                if (entry.isDirectory()) {
                    walk(relative);
                } else if (entry.isFile()) {
                    files.push(relative);
                }
            }
        };
        walk(outputDirectory);
    }

    return files.filter(file =>
        !SKIPPED_FILES.has(path.basename(file))
        && !BINARY_EXTENSIONS.has(path.extname(file).toLowerCase())
        && !file.split('/').some(segment => SKIPPED_DIRECTORIES.has(segment)));
}

/**
 * @param {{ sentinel: string, localDevelopmentPasswords?: string[] }} config
 */
function buildPatterns(config) {
    const localPasswords = new Set(config.localDevelopmentPasswords ?? []);
    const placeholder = value =>
        value.trim() === ''
        || localPasswords.has(value)
        || /^[<${]/u.test(value)
        || /^(?:x{3,}|\.{3,}|changeme|placeholder|example|true|false|undefined|null|your[-_]?\w*)$/iu.test(value);

    return [
        {
            id: 'sentinel',
            description: 'the Ivory secret sentinel',
            regexp: new RegExp(config.sentinel.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'gu'),
        },
        {
            id: 'aws-access-key',
            description: 'an AWS access key id',
            regexp: /\bAKIA[0-9A-Z]{16}\b/gu,
        },
        {
            id: 'private-key',
            description: 'a private key block',
            regexp: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/gu,
        },
        {
            id: 'github-token',
            description: 'a GitHub token',
            regexp: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/gu,
        },
        {
            id: 'sentry-dsn',
            description: 'a Sentry DSN carrying a key',
            regexp: /\bhttps:\/\/[0-9a-f]{32}@[\w.-]+\/\d+/gu,
        },
        {
            id: 'postgres-url',
            description: 'a PostgreSQL URL carrying a non-local password',
            regexp: /\bpostgres(?:ql)?:\/\/[^:\s'"@]+:([^@\s'"]+)@/gu,
            ignore: match => placeholder(match[1]),
        },
        {
            id: 'credential-assignment',
            description: 'a credential assignment with a literal value',
            // Deliberately not applied to source files: in TypeScript `leaseToken: string` is a
            // type annotation, not a credential. Configuration files are where a literal value
            // in a credential-shaped key actually means a committed secret.
            files: /(?:^|\/)(?:\.env[^/]*|[^/]*\.(?:ya?ml|json|jsonc|properties|ini|cfg|conf|sh|ps1|env))$/u,
            regexp: /^[^\n]*?\b[A-Z][A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API_?KEY|ACCESS_KEY)[A-Z0-9_]*[ \t]*[:=][ \t]*(?:'([^'\n]*)'|"([^"\n]*)"|([^\s'"#,;)}]+))/gimu,
            ignore: match => placeholder(match[1] ?? match[2] ?? match[3] ?? ''),
        },
    ];
}

/** @param {string} root */
function scanTree(root) {
    /** @type {string[]} */
    const findings = [];
    const policyPath = path.join(root, 'configs', 'ivory-dependency-policy.json');
    if (!fs.existsSync(policyPath)) {
        return ['configs/ivory-dependency-policy.json is missing; the secret scan cannot run.'];
    }
    const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    const config = policy.secretScan;
    if (!config || typeof config.sentinel !== 'string') {
        return ['configs/ivory-dependency-policy.json declares no secretScan.sentinel value.'];
    }

    const patterns = buildPatterns(config);
    const criticalPatterns = new Set(config.criticalPatterns ?? patterns.map(pattern => pattern.id));
    const scanPaths = config.scanPaths ?? ['**'];
    const allowlist = config.allowlist ?? [];

    for (const file of listFiles(root)) {
        const insideIvorySurface = scanPaths.some(pattern => globToRegExp(pattern).test(file));
        const allowedPatterns = new Set(allowlist
            .filter(entry => entry.path === file)
            .flatMap(entry => entry.patterns ?? patterns.map(pattern => pattern.id)));

        let contents;
        try {
            contents = fs.readFileSync(path.join(root, file), 'utf8');
        } catch {
            continue;
        }
        if (contents.includes('\u0000')) {
            continue;
        }

        for (const pattern of patterns) {
            if (!insideIvorySurface && !criticalPatterns.has(pattern.id)) {
                continue;
            }
            if (pattern.files && !pattern.files.test(file)) {
                continue;
            }
            if (allowedPatterns.has(pattern.id)) {
                continue;
            }
            pattern.regexp.lastIndex = 0;
            for (const match of contents.matchAll(pattern.regexp)) {
                if (pattern.ignore && pattern.ignore(match)) {
                    continue;
                }
                const line = contents.slice(0, match.index).split('\n').length;
                findings.push(`${file}:${line} contains ${pattern.description} (${pattern.id}).`);
            }
        }
    }

    return findings;
}

const argv = process.argv.slice(2);
const rootIndex = argv.indexOf('--root');
const scanRoot = rootIndex === -1 ? REPO_ROOT : path.resolve(argv[rootIndex + 1]);

const findings = scanTree(scanRoot);
if (findings.length > 0) {
    console.error('Ivory Tower secret scan findings:');
    for (const finding of findings) {
        console.error(`  - ${finding}`);
    }
    console.error('Remove the credential and rotate it. If the value is a documented local default, record it in configs/ivory-dependency-policy.json "secretScan.allowlist" with a reason and an owner.');
    process.exit(1);
}
if (!argv.includes('--quiet')) {
    console.log('Ivory Tower secret scan: no sentinel value or credential pattern found.');
}
