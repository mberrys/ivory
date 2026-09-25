// *****************************************************************************
// Copyright (C) 2026 Michael Berry and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { ContainerModule } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution, WidgetFactory, bindViewContribution } from '@theia/core/lib/browser';
import { IvoryDashboardContribution } from './ivory-dashboard-contribution';
import { IvoryGuiApplicationContribution } from './ivory-gui-application-contribution';
import { IvoryDashboardWidget } from './ivory-dashboard-widget';
import '../../src/browser/tokens/liquidify.generated.css';
import '../../src/browser/tokens/ivory-semantic-tokens.css';
import '../../src/browser/style/ivory-gui.css';

export default new ContainerModule(bind => {
    bindViewContribution(bind, IvoryDashboardContribution);
    bind(IvoryDashboardWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(context => ({
        id: IvoryDashboardWidget.ID,
        createWidget: () => context.container.get<IvoryDashboardWidget>(IvoryDashboardWidget)
    })).inSingletonScope();
    bind(IvoryGuiApplicationContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(IvoryGuiApplicationContribution);
});
