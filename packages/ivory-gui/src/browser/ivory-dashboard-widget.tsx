// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { injectable, postConstruct } from '@theia/core/shared/inversify';
import { Message, ReactWidget, codicon } from '@theia/core/lib/browser';
import * as React from '@theia/core/shared/react';
import { filterIvoryEvidence, IvoryEvidence } from './ivory-dashboard-model';

export const PROTOTYPE_EVIDENCE: readonly IvoryEvidence[] = [
    {
        title: 'Browser smoke proof',
        summary: 'The real browser bundle opens the evidence workspace.',
        source: 'examples/browser',
        kind: 'Browser',
        status: 'ready'
    },
    {
        title: 'Token provenance',
        summary: 'The pinned token source is recorded beside the semantic layer.',
        source: 'packages/ivory-gui/src/browser/tokens/SOURCE.md',
        kind: 'Provenance',
        status: 'verified'
    },
    {
        title: 'Review queue',
        summary: 'A calm place to inspect claims before publishing them.',
        source: 'Ivory research workspace',
        kind: 'Review',
        status: 'queued'
    }
];

function StatusPill({ status }: { status: string }): React.ReactNode {
    return <span className='ivory-status-pill' data-status={status}>{status}</span>;
}

@injectable()
export class IvoryDashboardWidget extends ReactWidget {
    public static readonly ID = 'ivory.dashboard';
    public static readonly LABEL = 'Ivory evidence workspace';

    constructor() {
        super();
        this.id = IvoryDashboardWidget.ID;
        this.title.label = IvoryDashboardWidget.LABEL;
        this.title.caption = IvoryDashboardWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = codicon('dashboard');
    }

    @postConstruct()
    protected init(): void {
        this.update();
    }

    protected override onAfterAttach(message: Message): void {
        super.onAfterAttach(message);
    }

    // The application contribution owns the activation marker for the whole
    // session, so this widget deliberately neither sets nor clears it. Clearing
    // it on detach would strip the theme from a live workbench with no way back
    // short of a reload.

    private query = '';
    private evidenceStatus: string | undefined;

    protected render(): React.ReactNode {
        const evidence = filterIvoryEvidence(PROTOTYPE_EVIDENCE, this.query);
        return (
            <main data-ivory-dashboard='true' aria-labelledby='ivory-dashboard-title' tabIndex={-1}>
                <header className='ivory-dashboard-header'>
                    <div>
                        <p className='ivory-eyebrow'>Poteto prototype / evidence workspace</p>
                        <h1 id='ivory-dashboard-title'>{IvoryDashboardWidget.LABEL}</h1>
                        <p className='ivory-lede'>A quiet surface for tracing claims, sources, and open work.</p>
                    </div>
                    <button type='button' className='ivory-command-button' aria-label='Run evidence check' onClick={this.runEvidenceCheck}>
                        Run check
                    </button>
                </header>
                <section className='ivory-evidence-section' aria-labelledby='ivory-evidence-title'>
                    <div className='ivory-section-heading'>
                        <div>
                            <h2 id='ivory-evidence-title'>Evidence queue</h2>
                            <p>{evidence.length} of {PROTOTYPE_EVIDENCE.length} local records in this prototype.</p>
                        </div>
                        <label className='ivory-search-label'>
                            <span>Filter evidence</span>
                            <input
                                type='search'
                                value={this.query}
                                onChange={event => {
                                    this.query = event.currentTarget.value;
                                    this.update();
                                }}
                                placeholder='Try “token” or “browser”'
                            />
                        </label>
                    </div>
                    <EvidenceList evidence={evidence} />
                    {this.evidenceStatus && <p className='ivory-evidence-status' role='status'>{this.evidenceStatus}</p>}
                </section>
            </main>
        );
    }

    private readonly runEvidenceCheck = (): void => {
        const sourced = PROTOTYPE_EVIDENCE.filter(item => item.source.trim().length > 0).length;
        this.evidenceStatus = `Evidence check complete. ${sourced} of ${PROTOTYPE_EVIDENCE.length} local records have a source.`;
        this.update();
    };
}

interface EvidenceListProps {
    readonly evidence: readonly IvoryEvidence[];
}

function EvidenceList({ evidence }: EvidenceListProps): React.ReactNode {
    if (evidence.length === 0) {
        return <p className='ivory-empty-state'>No evidence matches this query.</p>;
    }
    return (
        <ol className='ivory-evidence-list'>
            {evidence.map(item => (
                <li className='ivory-evidence-card' key={item.title}>
                    <div className='ivory-card-topline'>
                        <span className='ivory-card-kind'>{item.kind}</span>
                        <StatusPill status={item.status} />
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.summary}</p>
                    <p className='ivory-card-source'>{item.source}</p>
                </li>
            ))}
        </ol>
    );
}
