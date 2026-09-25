// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { injectable } from '@theia/core/shared/inversify';
import { IvoryDashboardWidget } from './ivory-dashboard-widget';

@injectable()
export class IvoryDashboardContribution extends AbstractViewContribution<IvoryDashboardWidget> {
    constructor() {
        super({
            widgetId: IvoryDashboardWidget.ID,
            widgetName: IvoryDashboardWidget.LABEL,
            defaultWidgetOptions: {
                area: 'main',
                rank: 0
            }
        });
    }
}
