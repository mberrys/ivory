import { isDeepStrictEqual } from 'node:util';

// Evidence projection only, not a service wire schema. Preserve *all* fields
// inside the resolved RunSpec and semantic result, including nested timestamps.
export function compareClients(records) {
    const clients = ['theia', 'cli', 'r', 'python'];
    if (
        !Array.isArray(records) ||
        records.length !== clients.length ||
        clients.some(client => records.filter(r => r.client === client).length !== 1)
    ) {
        return { status: 'blocked', reason: 'Exactly one observation from each of Theia, CLI, R and Python is required' };
    }
    if (
        records.some(
            record =>
                !Object.hasOwn(record, 'resolvedRunSpec') ||
                !Object.hasOwn(record, 'semanticResult') ||
                record.resolvedRunSpec === null ||
                record.resolvedRunSpec === undefined ||
                record.semanticResult === undefined,
        )
    ) {
        return { status: 'blocked', reason: 'Resolved RunSpec and semantic result observations are required' };
    }
    const first = records[0];
    const differences = records
        .filter(
            record =>
                !isDeepStrictEqual(record.resolvedRunSpec, first.resolvedRunSpec) ||
                !isDeepStrictEqual(record.semanticResult, first.semanticResult),
        )
        .map(record => record.client);
    return differences.length ? { status: 'failed', differences } : { status: 'passed' };
}
