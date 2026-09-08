// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import { AbstractViewContribution, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { CommandRegistry } from '@theia/core/lib/common';
import { injectable } from '@theia/core/shared/inversify';
import { ExecutionClient, HttpError } from '@ivory-tower/n5-client';
import { N5Widget } from './widget';

@injectable()
export class N5Contribution extends AbstractViewContribution<N5Widget> implements FrontendApplicationContribution {
    private readonly client = new ExecutionClient(`${window.location.origin}/n5/service`);
    private stream: AbortController | undefined;
    constructor() {
        super({ widgetId: N5Widget.ID, widgetName: 'N5 research client', defaultWidgetOptions: { area: 'main' } });
    }
    async initializeLayout(): Promise<void> {
        await this.openView({ activate: true });
    }
    onStop(): void {
        this.stream?.abort();
    }

    override registerCommands(registry: CommandRegistry): void {
        super.registerCommands(registry);
        const action = (id: string, label: string, run: (...args: string[]) => Promise<unknown>) => {
            registry.registerCommand(
                { id: `ivory.n5.${id}`, label: `N5: ${label}` },
                {
                    execute: async (...args: string[]) => {
                        const widget = await this.openView({ activate: true });
                        try {
                            widget.showResult(await run(...args));
                        } catch (error) {
                            widget.showResult(
                                error instanceof HttpError ? { status: error.status, body: error.body } : { error: String(error) },
                            );
                        }
                    },
                },
            );
        };
        action('ready', 'Check connection', () => this.client.ready(AbortSignal.timeout(30000)));
        action('get', 'Read execution status', id => this.client.get(this.requireId(id), AbortSignal.timeout(30000)));
        action('submit', 'Submit execution', (body, key) => this.client.submit(JSON.parse(body), key, AbortSignal.timeout(30000)));
        action('stop', 'Disconnect', async () => {
            this.stream?.abort();
            return { connection: 'disconnected' };
        });
        action('watch', 'Watch execution', async id => {
            this.requireId(id);
            this.stream?.abort();
            const controller = new AbortController();
            this.stream = controller;
            const widget = await this.widget;
            const dispose = widget.onDidDispose(() => controller.abort());
            // Background read loop; submission never occurs during reconnect.
            (async () => {
                try {
                    for await (const message of this.client.watch(id, controller.signal)) {
                        if (!controller.signal.aborted) {
                            widget.showResult(message);
                        }
                    }
                } catch (error) {
                    if (!controller.signal.aborted) {
                        widget.showResult({ error: String(error) });
                    }
                } finally {
                    dispose.dispose();
                }
            })();
            return { connection: 'connecting', executionId: id };
        });
    }
    private requireId(id: string): string {
        if (!id?.trim()) {
            throw new Error('Enter an execution ID in the N5 view.');
        }
        return id;
    }
}
