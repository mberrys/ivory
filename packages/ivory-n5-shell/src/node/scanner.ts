// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import { injectable } from '@theia/core/shared/inversify';
import { PluginPackage, PluginModel } from '@theia/plugin-ext';
import { VsCodePluginScanner } from '@theia/plugin-ext-vscode/lib/node/scanner-vscode';

// Checked against extensions.lock.json by scripts/n5/check-boundaries.mjs.
export const candidateVersions: Record<string, string> = {
    'reditorsupport.r': '2.8.8',
    'reditorsupport.r-syntax': '0.1.4',
    'ms-python.python': '2026.2.0',
    'detachhead.basedpyright': '1.40.0',
    'quarto.quarto': '1.137.0',
    'vscode.python': '1.95.3',
    'vscode.yaml': '1.95.3',
};

@injectable()
export class CandidateScanner extends VsCodePluginScanner {
    override getModel(plugin: PluginPackage): PluginModel {
        const id = `${plugin.publisher}.${plugin.name}`.toLowerCase();
        if (candidateVersions[id] !== plugin.version) {
            throw new Error(`Extension outside the N5 candidate: ${id}@${plugin.version}`);
        }
        return super.getModel(plugin);
    }

    override getDependencies(plugin: PluginPackage): Map<string, string> | undefined {
        // Theia normally treats extensionPack as dependencies. N5 explicitly
        // excludes that optional pack and installs only locked hard dependencies.
        return super.getDependencies({ ...plugin, extensionPack: [] });
    }
}
