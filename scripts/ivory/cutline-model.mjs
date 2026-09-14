import fs from 'node:fs';
import path from 'node:path';

export const RELEASE_CLASSES = ['Required', 'Conditional', 'Experimental', 'Post-V1'];
export const PHASES = [1, 2, 3, 4, 5, 6, 7];
export const V1_PHASES = [1, 2, 3, 4, 5, 6];

const CONDITIONAL_FIELDS = [
    'trigger',
    'evidenceSource',
    'decisionOwner',
    'evaluateBy',
    'ifTriggered',
    'ifNotTriggered',
    'downstreamIssuesAffected',
];

const EXPERIMENTAL_FIELDS = [
    'isolationBoundary',
    'howDisabledRemoved',
    'supportedContractDisclaimer',
    'dataSchemaCompatibilityImpact',
    'releaseGateImpact',
];

export function readManifest(manifestPath) {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

export function isV1Required(issue) {
    return issue.releaseClass === 'Required'
        || (issue.releaseClass === 'Conditional' && issue.conditionalTriggered === true);
}

function increment(map, key, value = 1) {
    map[key] = (map[key] || 0) + value;
}

export function computeStats(manifest) {
    const releaseClassCounts = {};
    const phaseCounts = {};
    const estimatePointsByClass = {};
    const estimatePointsByPhase = {};

    for (const issue of manifest.issues || []) {
        increment(releaseClassCounts, issue.releaseClass);
        increment(phaseCounts, String(issue.phase));
        increment(estimatePointsByClass, issue.releaseClass, Number(issue.estimate || 0));
        increment(estimatePointsByPhase, String(issue.phase), Number(issue.estimate || 0));
    }

    return {
        totalIssues: (manifest.issues || []).length,
        releaseClassCounts,
        phaseCounts,
        estimatePointsByClass,
        estimatePointsByPhase,
    };
}

function hasValue(value) {
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null;
}

export function validateManifest(manifest, { repositoryRoot = process.cwd() } = {}) {
    const errors = [];
    const issues = Array.isArray(manifest.issues) ? manifest.issues : [];
    const ids = issues.map(issue => issue.id);
    const byId = new Map();

    if (manifest.schemaVersion !== 1) {
        errors.push(`manifest schemaVersion must be 1, received ${manifest.schemaVersion}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}T/.test(String(manifest.trackerSnapshotAt || ''))) {
        errors.push('trackerSnapshotAt must be an ISO-8601 timestamp');
    }
    if (!/^[0-9a-f]{40}$/i.test(String(manifest.repositoryCommit || ''))) {
        errors.push('repositoryCommit must be a 40-character commit SHA');
    }
    if (!manifest.trackerDataSource) {
        errors.push('trackerDataSource is required');
    }

    for (const issue of issues) {
        if (!Number.isInteger(issue.id) || issue.id < 1) {
            errors.push(`invalid issue id: ${issue.id}`);
            continue;
        }
        if (byId.has(issue.id)) {
            errors.push(`duplicate issue id IV-${issue.id}`);
        }
        byId.set(issue.id, issue);
        if (!hasValue(issue.title)) {
            errors.push(`IV-${issue.id}: title is required`);
        }
        if (!PHASES.includes(issue.phase)) {
            errors.push(`IV-${issue.id}: invalid phase ${issue.phase}`);
        }
        if (!RELEASE_CLASSES.includes(issue.releaseClass)) {
            errors.push(`IV-${issue.id}: invalid or missing Release class`);
        }
        if (!hasValue(issue.status)) {
            errors.push(`IV-${issue.id}: status is required`);
        }
        if (!Array.isArray(issue.blockers) || issue.blockers.some(blocker => !Number.isInteger(blocker))) {
            errors.push(`IV-${issue.id}: blockers must be an array of numeric issue IDs`);
        }
    }

    const range = manifest.issueIdRange || {};
    const excluded = new Set((manifest.excludedIssueIds || []).map(Number));
    if (!Number.isInteger(range.min) || !Number.isInteger(range.max) || range.min > range.max) {
        errors.push('issueIdRange must contain an integer min not greater than max');
    } else {
        for (let id = range.min; id <= range.max; id += 1) {
            if (!excluded.has(id) && !byId.has(id)) {
                errors.push(`missing issue id IV-${id}`);
            }
        }
        for (const id of byId.keys()) {
            if (id < range.min || id > range.max || excluded.has(id)) {
                errors.push(`issue id IV-${id} is outside the declared tracker range`);
            }
        }
    }

    for (const issue of issues) {
        for (const blockerId of issue.blockers || []) {
            const blocker = byId.get(blockerId);
            if (!blocker) {
                errors.push(`IV-${issue.id}: missing blocker IV-${blockerId}`);
                continue;
            }
            if (isV1Required(issue) && (blocker.releaseClass === 'Experimental' || blocker.releaseClass === 'Post-V1')) {
                errors.push(`IV-${issue.id}: V1-required path depends on ${blocker.releaseClass} IV-${blocker.id}`);
            }
        }
        if (isV1Required(issue) && (!V1_PHASES.includes(issue.phase))) {
            errors.push(`IV-${issue.id}: V1-required issue is outside Phases 1-6`);
        }
    }

    const metadataById = new Map((manifest.classificationMetadata || []).map(entry => [entry.issueId, entry]));
    for (const issue of issues) {
        if (issue.releaseClass === 'Conditional' || issue.releaseClass === 'Experimental') {
            const metadata = metadataById.get(issue.id);
            const fields = issue.releaseClass === 'Conditional' ? CONDITIONAL_FIELDS : EXPERIMENTAL_FIELDS;
            if (!metadata) {
                errors.push(`IV-${issue.id}: missing ${issue.releaseClass} classification metadata`);
                continue;
            }
            for (const field of fields) {
                if (!hasValue(metadata[field])) {
                    errors.push(`IV-${issue.id}: missing ${issue.releaseClass} metadata field ${field}`);
                }
            }
            if (issue.releaseClass === 'Experimental' && metadata.releaseGateImpact !== 'none') {
                errors.push(`IV-${issue.id}: Experimental releaseGateImpact must be 'none'`);
            }
        }
    }

    const computed = computeStats(manifest);
    const expectedCounts = manifest.counts || {};
    if (expectedCounts.totalIssues !== computed.totalIssues) {
        errors.push(`manifest totalIssues ${expectedCounts.totalIssues} does not reconcile with ${computed.totalIssues} issues`);
    }
    for (const [name, actual] of Object.entries(computed.releaseClassCounts)) {
        if ((expectedCounts.releaseClassCounts || {})[name] !== actual) {
            errors.push(`release class count for ${name} does not reconcile`);
        }
    }
    for (const name of Object.keys(expectedCounts.releaseClassCounts || {})) {
        if (!(name in computed.releaseClassCounts)) {
            errors.push(`manifest contains stale release class count for ${name}`);
        }
    }
    for (const [phase, actual] of Object.entries(computed.phaseCounts)) {
        if ((expectedCounts.phaseCounts || {})[phase] !== actual) {
            errors.push(`phase ${phase} count does not reconcile`);
        }
    }
    for (const [phase, actual] of Object.entries(computed.estimatePointsByPhase)) {
        if ((expectedCounts.estimatePointsByPhase || {})[phase] !== actual) {
            errors.push(`phase ${phase} estimate points do not reconcile`);
        }
    }

    const gatePhases = new Set((manifest.phaseGates || []).map(gate => gate.phase));
    for (const phase of V1_PHASES) {
        const gate = (manifest.phaseGates || []).find(candidate => candidate.phase === phase);
        if (!gate || !gate.exitEvidence || !Array.isArray(gate.evidence) || gate.evidence.length === 0) {
            errors.push(`Phase ${phase}: missing phase-exit contract or evidence references`);
        }
    }
    for (const phase of gatePhases) {
        if (!V1_PHASES.includes(phase)) {
            errors.push(`phase-gate manifest contains invalid phase ${phase}`);
        }
    }

    return { errors, computed, repositoryRoot };
}

export function dependencyLayers(manifest) {
    const byId = new Map(manifest.issues.map(issue => [issue.id, issue]));
    const layers = new Map();
    const visiting = new Set();

    function resolve(id) {
        if (layers.has(id)) return layers.get(id);
        if (visiting.has(id)) throw new Error(`cycle detected at IV-${id}`);
        visiting.add(id);
        const issue = byId.get(id);
        const layer = issue.blockers.length === 0
            ? 1
            : Math.max(...issue.blockers.map(resolve)) + 1;
        visiting.delete(id);
        layers.set(id, layer);
        return layer;
    }

    for (const issue of manifest.issues) resolve(issue.id);
    return layers;
}

function escapeCell(value) {
    return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function normalizeNewlines(text) {
    return text.replace(/\r\n/g, '\n');
}

export function renderGeneratedCutlineBlock(manifest) {
    const { computed } = validateManifest(manifest);
    const layers = dependencyLayers(manifest);
    const phaseRows = V1_PHASES.map(phase => `| Phase ${phase} | ${computed.phaseCounts[String(phase)] || 0} | ${computed.estimatePointsByPhase[String(phase)] || 0} |`).join('\n');
    const classRows = RELEASE_CLASSES.map(releaseClass => `| ${releaseClass} | ${computed.releaseClassCounts[releaseClass] || 0} | ${computed.estimatePointsByClass[releaseClass] || 0} |`).join('\n');
    const issueRows = manifest.issues
        .slice()
        .sort((a, b) => a.id - b.id)
        .map(issue => `| IV-${issue.id} | ${escapeCell(issue.title)} | Phase ${issue.phase} | ${issue.releaseClass} | ${escapeCell(issue.status)} |`)
        .join('\n');
    const layerRows = [...layers.entries()]
        .sort((a, b) => a[1] - b[1] || a[0] - b[0])
        .reduce((rows, [id, layer]) => {
            const previous = rows.at(-1);
            if (!previous || previous.layer !== layer) rows.push({ layer, ids: [] });
            rows.at(-1).ids.push(`IV-${id}`);
            return rows;
        }, [])
        .map(row => `- Layer ${row.layer}: ${row.ids.join(', ')}`)
        .join('\n');

    return [
        '<!-- BEGIN GENERATED: v1-cutline -->',
        '## Generated V1 cutline reconciliation',
        '',
        `- Tracker snapshot: ${manifest.trackerSnapshotAt}`,
        `- Repository commit: \`${manifest.repositoryCommit}\``,
        `- Non-template issues: ${computed.totalIssues}`,
        `- V1 phases: 1-6 (${V1_PHASES.reduce((sum, phase) => sum + (computed.phaseCounts[String(phase)] || 0), 0)} issues; ${V1_PHASES.reduce((sum, phase) => sum + (computed.estimatePointsByPhase[String(phase)] || 0), 0)} estimate points)`,
        `- Post-V1 phase: 7 (${computed.phaseCounts['7'] || 0} issues; ${computed.estimatePointsByPhase['7'] || 0} estimate points)`,
        '',
        '### Phase exit inventory',
        '',
        '| Phase | Issues | Estimate points |',
        '|---|---:|---:|',
        phaseRows,
        '',
        '### Release-class inventory',
        '',
        '| Release class | Issues | Estimate points |',
        '|---|---:|---:|',
        classRows,
        '',
        '### Dependency layers',
        '',
        layerRows,
        '',
        '### Issue classification',
        '',
        '| Issue | Title | Phase | Release class | Status |',
        '|---|---|---|---|---|',
        issueRows,
        '<!-- END GENERATED: v1-cutline -->',
    ].join('\n');
}

export function verifyGeneratedMap(documentPath, manifest) {
    const document = fs.readFileSync(documentPath, 'utf8');
    const expected = renderGeneratedCutlineBlock(manifest);
    const begin = document.indexOf('<!-- BEGIN GENERATED: v1-cutline -->');
    const endMarker = '<!-- END GENERATED: v1-cutline -->';
    const end = document.indexOf(endMarker);
    if (begin === -1 || end === -1 || end < begin) {
        return { ok: false, expected, actual: null };
    }
    const actual = document.slice(begin, end + endMarker.length);
    return { ok: normalizeNewlines(actual) === normalizeNewlines(expected), expected, actual };
}

export function writeGeneratedMap(documentPath, manifest) {
    const document = fs.readFileSync(documentPath, 'utf8');
    const block = renderGeneratedCutlineBlock(manifest);
    const beginMarker = '<!-- BEGIN GENERATED: v1-cutline -->';
    const endMarker = '<!-- END GENERATED: v1-cutline -->';
    const begin = document.indexOf(beginMarker);
    const end = document.indexOf(endMarker);
    if (begin !== -1 && end >= begin) {
        fs.writeFileSync(documentPath, document.slice(0, begin) + block + document.slice(end + endMarker.length), 'utf8');
        return;
    }
    const insertion = document.indexOf('## V1 contract');
    if (insertion === -1) throw new Error('Could not locate ## V1 contract in repository map');
    fs.writeFileSync(documentPath, document.slice(0, insertion) + block + '\n\n' + document.slice(insertion), 'utf8');
}

export function formatErrors(errors) {
    return errors.map(error => `FAIL  ${error}`).join('\n');
}
