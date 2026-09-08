// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import { ReactWidget } from '@theia/core/lib/browser';
import { CommandService } from '@theia/core/lib/common';
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import * as React from '@theia/core/shared/react';

@injectable()
export class N5Widget extends ReactWidget {
    static readonly ID = 'ivory.n5';
    @inject(CommandService) protected readonly commands: CommandService;
    private executionId = '';
    private key = '';
    private body = '{"kind":"validate","input":{},"contractVersion":1}';
    private researchBody = '{"projectId":"n5-demo","revision":"rev-1"}';
    private result: unknown = 'Not connected';

    @postConstruct()
    protected init(): void {
        this.id = N5Widget.ID;
        this.title.label = 'N5 research client';
        this.title.closable = true;
        this.update();
    }

    showResult(value: unknown): void {
        this.result = value;
        this.update();
    }

    private invoke(id: string, ...args: unknown[]): void {
        this.commands.executeCommand(id, ...args).catch(error => this.showResult({ error: String(error) }));
    }

    protected render(): React.ReactNode {
        return (
            <div style={{ padding: 24 }}>
                <h1>N5 research client</h1>
                <p>Research actions are served by the fixture research service published by ivory-api.</p>
                <button onClick={() => this.invoke('ivory.n5.open', this.researchBody)}>Open project</button>{' '}
                <button onClick={() => this.invoke('ivory.n5.cite', this.researchBody)}>Resolve citation</button>{' '}
                <button onClick={() => this.invoke('ivory.n5.run', this.researchBody)}>Request run</button>{' '}
                <button onClick={() => this.invoke('ivory.n5.edit', this.researchBody, this.key)}>Submit edit</button>
                <label>
                    Research request JSON (edit requires baseRevision, sourcePath, and edit)
                    <textarea
                        aria-label="Research request JSON"
                        rows={6}
                        style={{ display: 'block', width: '100%' }}
                        value={this.researchBody}
                        onChange={event => {
                            this.researchBody = event.target.value;
                            this.update();
                        }}
                    />
                </label>
                <h2>Existing execution transport</h2>
                <button onClick={() => this.invoke('ivory.n5.ready')}>Check connection</button>
                <p>
                    <label>
                        Execution ID{' '}
                        <input
                            value={this.executionId}
                            onChange={event => {
                                this.executionId = event.target.value;
                                this.update();
                            }}
                        />
                    </label>
                </p>
                <button onClick={() => this.invoke('ivory.n5.get', this.executionId)}>Read status</button>{' '}
                <button onClick={() => this.invoke('ivory.n5.watch', this.executionId)}>Watch / reconnect</button>{' '}
                <button onClick={() => this.invoke('ivory.n5.stop')}>Disconnect</button>
                <p>
                    <label>
                        Idempotency key (executions and edits){' '}
                        <input
                            value={this.key}
                            onChange={event => {
                                this.key = event.target.value;
                                this.update();
                            }}
                        />
                    </label>
                </p>
                <label>
                    Execution request JSON
                    <textarea
                        aria-label="Execution request JSON"
                        rows={6}
                        style={{ display: 'block', width: '100%' }}
                        value={this.body}
                        onChange={event => {
                            this.body = event.target.value;
                            this.update();
                        }}
                    />
                </label>
                <p>Retain the same request and key when retrying an uncertain submission.</p>
                <button onClick={() => this.invoke('ivory.n5.submit', this.body, this.key)}>Submit execution</button>
                <pre role="status" style={{ whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(this.result, undefined, 2)}
                </pre>
            </div>
        );
    }
}
