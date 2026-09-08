// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import * as path from 'node:path';

const FIXTURES = ['research.py', 'research.R', 'research.qmd', 'conditional.ipynb'] as const;
export type FixtureName = (typeof FIXTURES)[number] | 'all';

interface FixtureFile {
    readonly revision: string;
    readonly bytes: string;
    readonly contentHash: string;
}
interface Citation {
    readonly sourcePath: string;
    readonly sourceRevision: string;
    readonly anchorId: string;
    readonly startOffset: number;
    readonly endOffset: number;
    readonly passage: string;
    readonly contentHash: string;
}
interface ResearchState {
    projectId: string;
    headRevision: string;
    entryPaths: string[];
    files: Map<string, FixtureFile>;
    citations: Map<string, Citation>;
    editReplays: Map<string, unknown>;
}

export interface InMemoryResearchServiceOptions {
    readonly fixturesDir: string;
    readonly projectId?: string;
    readonly clock?: () => Date;
}

// Synthetic research service for the N5 fixture runtime: seeds equivalent initial
// project states from the committed fixture files and applies deterministic,
// first-writer-wins revisions. It is a fixture, not a persistence layer.
export class InMemoryResearchService {
    private readonly fixturesDir: string;
    private readonly projectId: string;
    private readonly clock: () => Date;
    private state: ResearchState | undefined;
    private environment: Record<string, string> | undefined;
    private editIndex = 0;

    constructor(options: InMemoryResearchServiceOptions) {
        this.fixturesDir = options.fixturesDir;
        this.projectId = options.projectId ?? 'n5-demo';
        this.clock = options.clock ?? (() => new Date());
    }

    private requireFixtureFiles(): Array<{ path: string; bytes: string }> {
        if (!existsSync(this.fixturesDir)) {
            throw new Error(`Research fixture directory not found: ${this.fixturesDir}`);
        }
        return readdirSync(this.fixturesDir)
            .filter(name => (FIXTURES as readonly string[]).includes(name))
            .map(name => ({ path: name, bytes: readFileSync(path.join(this.fixturesDir, name), 'utf8') }));
    }

    reset(fixture: FixtureName = 'all'): {
        projectId: string; revision: string; entryPaths: string[]; sourceHashes: Record<string, string>; resetAt: string;
    } {
        const files = new Map<string, FixtureFile>();
        const sourceHashes: Record<string, string> = {};
        const entryPaths: string[] = [];
        for (const file of this.requireFixtureFiles()) {
            if (fixture !== 'all' && file.path !== fixture) {
                continue;
            }
            files.set(file.path, { revision: 'rev-1', bytes: file.bytes, contentHash: sha256(file.bytes) });
            sourceHashes[file.path] = sha256(file.bytes);
            entryPaths.push(file.path);
        }
        const citations = new Map<string, Citation>();
        for (const [sourcePath, file] of files) {
            citations.set(this.citationId(sourcePath), {
                sourcePath,
                sourceRevision: file.revision,
                anchorId: `anchor-${sourcePath}`,
                startOffset: 0,
                endOffset: file.bytes.length,
                passage: file.bytes,
                contentHash: file.contentHash,
            });
        }
        this.state = { projectId: this.projectId, headRevision: 'rev-1', entryPaths, files, citations, editReplays: new Map() };
        this.editIndex = 0;
        return { projectId: this.projectId, revision: 'rev-1', entryPaths, sourceHashes, resetAt: this.clock().toISOString() };
    }

    open(projectId: string, revision: string | undefined):
        { projectId: string; revision: string; headRevision: string; openedAt: string; entryPaths: string[] } {
        const state = this.requireState(projectId);
        const requested = revision ?? state.headRevision;
        if (requested !== state.headRevision) {
            const error: { code: string; message: string } = {
                code: 'revision_stale',
                message: `Revision ${requested} is not the head revision ${state.headRevision}; no nearby/latest source substitution is performed.`,
            };
            throw error;
        }
        return {
            projectId: state.projectId,
            revision: state.headRevision,
            headRevision: state.headRevision,
            openedAt: this.clock().toISOString(),
            entryPaths: [...state.entryPaths],
        };
    }

    resolveCitation(projectId: string, revision: string, citationId: string): {
        citationId: string; projectId: string; resolvedAt: string; anchor: Citation;
    } {
        const state = this.requireState(projectId);
        if (revision !== state.headRevision) {
            const error: { code: string; message: string } = {
                code: 'citation_stale',
                message: `Citation resolution requires the head revision ${state.headRevision}, not ${revision}.`,
            };
            throw error;
        }
        const citation = state.citations.get(citationId);
        if (citation === undefined) {
            const error: { code: string; message: string } = {
                code: 'citation_not_found',
                message: `Citation ${citationId} is not bound in this fixture project.`,
            };
            throw error;
        }
        return { citationId, projectId, resolvedAt: this.clock().toISOString(), anchor: { ...citation, passage: citation.passage } };
    }

    private requireEnvironment(): Record<string, string> {
        if (this.environment === undefined) {
            this.environment = {
                node: process.version,
                platform: `${process.platform}/${process.arch}`,
            };
        }
        return this.environment;
    }

    resolveRunSpec(projectId: string, revision: string, protocolVersionId: string | undefined): {
        runId: string; resolvedRunSpec: {
            runId: string; projectId: string; revision: string; protocolVersionRef?: unknown; sourceSetVersion: string;
            environment: Record<string, string>; commands: string[]; resolvedAt: string;
        }; semanticResult: { status: string; output: string[] };
    } {
        const state = this.requireState(projectId);
        if (revision !== state.headRevision) {
            const error: { code: string; message: string } = {
                code: 'revision_stale',
                message: `RunSpec resolution requires the head revision ${state.headRevision}, not ${revision}.`,
            };
            throw error;
        }
        const runId = `run-${createHash('sha256').update(`${projectId}|${revision}|${protocolVersionId ?? ''}`).digest('hex').slice(0, 16)}`;
        return {
            runId,
            resolvedRunSpec: {
                runId,
                projectId,
                revision,
                ...(protocolVersionId === undefined
                    ? {}
                    : { protocolVersionRef: { protocolId: protocolVersionId, protocolVersionId, stage: 'specified', branchId: 'main' } }),
                sourceSetVersion: `fixtures-${state.headRevision}`,
                environment: this.requireEnvironment(),
                commands: ['python research.py', 'Rscript research.R', 'quarto render research.qmd'],
                resolvedAt: this.clock().toISOString(),
            },
            semanticResult: { status: 'succeeded', output: ['9'] },
        };
    }

    submitEdit(projectId: string, baseRevision: string, sourcePath: string,
        edit: { kind: 'replace' | 'insert' | 'delete'; startOffset: number; endOffset: number; text: string },
        idempotencyKey: string): { replayed: boolean; record: unknown } {
        const state = this.requireState(projectId);
        const replay = state.editReplays.get(idempotencyKey);
        if (replay !== undefined) {
            return { replayed: true, record: replay };
        }
        const file = state.files.get(sourcePath);
        if (file === undefined) {
            const error: { code: string; message: string } = { code: 'source_not_found', message: `Source ${sourcePath} is not in the fixture project.` };
            throw error;
        }
        if (baseRevision !== state.headRevision) {
            const conflict = {
                code: 'revision_conflict',
                baseRevision,
                headRevision: state.headRevision,
                authoritative: { sourcePath, revision: state.headRevision, bytes: file.bytes, contentHash: file.contentHash },
                rejectedRequest: { projectId, baseRevision, sourcePath, edit },
            };
            throw conflict;
        }
        const { startOffset, endOffset, text, kind } = edit;
        if (startOffset < 0 || endOffset < startOffset || endOffset > file.bytes.length || (kind === 'replace' && startOffset === endOffset && text.length === 0)) {
            const error: { code: string; message: string } = { code: 'invalid_edit_range', message: 'Edit offsets are out of range for the current bytes.' };
            throw error;
        }
        let bytes: string;
        if (kind === 'delete') {
            bytes = file.bytes.slice(0, startOffset) + file.bytes.slice(endOffset);
        } else if (kind === 'insert') {
            bytes = file.bytes.slice(0, startOffset) + text + file.bytes.slice(endOffset);
        } else {
            bytes = file.bytes.slice(0, startOffset) + text + file.bytes.slice(endOffset);
        }
        this.editIndex += 1;
        const newRevision = `rev-${this.editIndex + 1}`;
        state.files.set(sourcePath, { revision: newRevision, bytes, contentHash: sha256(bytes) });
        state.headRevision = newRevision;
        const response = { projectId, sourcePath, baseRevision, newRevision, appliedAt: this.clock().toISOString() };
        state.editReplays.set(idempotencyKey, response);
        return { replayed: false, record: response };
    }

    private requireState(projectId: string): ResearchState {
        if (this.state === undefined || this.state.projectId !== projectId) {
            const error: { code: string; message: string } = { code: 'project_not_found', message: `Project ${projectId} is not present; call POST /v1/fixtures/reset first.` };
            throw error;
        }
        return this.state;
    }

    private citationId(sourcePath: string): string {
        return `cite-${sourcePath.replace(/\./g, '-')}`;
    }
}

function sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}
