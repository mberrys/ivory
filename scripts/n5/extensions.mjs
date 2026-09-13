import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
execFileSync(
    process.env.IVORY_N5_PYTHON || 'python',
    [fileURLToPath(new URL('./extensions.py', import.meta.url)), ...process.argv.slice(2)],
    { stdio: 'inherit' },
);
