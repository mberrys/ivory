/**
 * Ivory Tower browser application ESBuild configuration.
 */
import { browserOptions, watch } from './gen-esbuild.browser.mjs';
import { nodeOptions } from './gen-esbuild.node.mjs';
import { exposeModulePlugin } from '@theia/bundle-plugin';
import esbuild from 'esbuild';

browserOptions.plugins.push(exposeModulePlugin());

const browserContext = await esbuild.context(browserOptions);
const nodeContext = await esbuild.context(nodeOptions);

if (watch) {
    await Promise.all([browserContext.watch(), nodeContext.watch()]);
} else {
    try {
        await browserContext.rebuild();
        await browserContext.dispose();
        await nodeContext.rebuild();
        await nodeContext.dispose();
    } catch {
        process.exit(1);
    }
}
