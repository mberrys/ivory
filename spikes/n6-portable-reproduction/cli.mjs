import { resolve } from 'node:path';
import { createStudy } from './fixture.mjs';
import { exportStudy, restoreStudy, inspectProject } from './portable.mjs';
import { reproduce, run } from './reproduce.mjs';

const [command, input, output] = process.argv.slice(2);
try {
    if (!input) { throw new Error('Usage: cli.mjs create|export|restore|verify|reproduce|prepare INPUT [OUTPUT]'); }
    let result;
    switch (command) {
        case 'create': result = await createStudy(resolve(input)); break;
        case 'export': if (!output) { throw new Error('Export destination required'); } result = (await exportStudy(resolve(input), resolve(output))).manifest; break;
        case 'restore': if (!output) { throw new Error('Restore destination required'); } result = await restoreStudy(resolve(input), resolve(output)); break;
        case 'verify': {
            const inspected = await inspectProject(resolve(input));
            result = { projectId: inspected.study.projectId, citations: inspected.citations, records: inspected.dump.revisions.length }; break;
        }
        case 'reproduce': if (!output) { throw new Error('Runtime config required'); } result = await reproduce(resolve(input), resolve(output)); break;
        case 'prepare': result = await run('powershell.exe', ['-NoProfile', '-File',
            resolve('spikes/n6-portable-reproduction/prepare-runtime.ps1'), '-Destination', resolve(input),
            ...(output ? ['-RHome', resolve(output)] : [])], { cwd: process.cwd() }); break;
        default: throw new Error(`Unknown command: ${command}`);
    }
    console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
