// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { injectable } from '@theia/core/shared/inversify';
import { ReactWidget, codicon } from '@theia/core/lib/browser';
import * as React from '@theia/core/shared/react';

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

    protected render(): React.ReactNode {
        return (
            <main data-ivory-dashboard='true' aria-labelledby='ivory-dashboard-title'>
                <h1 id='ivory-dashboard-title'>{IvoryDashboardWidget.LABEL}</h1>
            </main>
        );
    }
}
