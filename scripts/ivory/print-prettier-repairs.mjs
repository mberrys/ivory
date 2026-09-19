// Temporary CI diagnostic for the inherited P02 formatter regression.
import { readFileSync } from 'node:fs';
import prettier from 'prettier';

const config = JSON.parse(readFileSync('configs/ivory-prettier.json', 'utf8'));
for (const file of [
    'packages/ivory-tower-research-kernel/src/node/kernel.ts',
    'packages/ivory-tower-research-kernel/src/node/fragment-context.spec.ts',
]) {
    const formatted = await prettier.format(readFileSync(file, 'utf8'), { ...config, filepath: file });
    console.log('IVORY_FORMATTED_FILE ' + file + ' ' + Buffer.from(formatted, 'utf8').toString('base64'));
}
