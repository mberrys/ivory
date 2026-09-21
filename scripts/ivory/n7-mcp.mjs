import { CatalogError, OPERATIONS } from './n7-catalog.mjs';

export const MCP_TOOLS = Object.freeze([
    {
        name: 'resolve_fragment',
        operation: 'ivory.resolveFragment',
        description: 'Read one authorized exact research excerpt.',
    },
    {
        name: 'propose_claim',
        operation: 'ivory.proposeClaim',
        description: 'Propose a claim and one evidence link; cannot accept research changes.',
    },
]);

const FORBIDDEN_TOOLS = Object.freeze([
    'bash',
    'shell',
    'read_file',
    'write_file',
    'accept_proposal',
    'ivory.acceptProposal',
    'ivory.revokeCapability',
]);

export function listMcpTools() {
    return MCP_TOOLS.map(tool => ({
        name: tool.name,
        description: tool.description,
        effectClass: OPERATIONS[tool.operation].effectClass,
        operation: tool.operation,
    }));
}

export class IvoryMcpPresenter {
    constructor(pipeline, { capabilityId } = {}) {
        this.pipeline = pipeline;
        this.capabilityId = capabilityId;
    }

    listTools() {
        return listMcpTools();
    }

    callTool(name, args = {}) {
        if (FORBIDDEN_TOOLS.includes(name)) {
            throw new CatalogError('arbitrary_execution_denied', name);
        }
        const tool = MCP_TOOLS.find(item => item.name === name);
        if (!tool) {
            throw new CatalogError('unknown_tool', name);
        }
        return this.pipeline.invoke({
            operation: tool.operation,
            surface: 'mcp',
            actor: 'agent',
            capabilityId: this.capabilityId,
            input: args,
        });
    }
}

export function profilesFor(operationName) {
    return OPERATIONS[operationName].surfaces;
}
