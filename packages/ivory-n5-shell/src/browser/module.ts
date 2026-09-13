// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
import { ContainerModule } from '@theia/core/shared/inversify';
import {
    bindViewContribution,
    FrontendApplicationContribution,
    WidgetFactory,
    WidgetStatusBarContribution,
    noopWidgetStatusBarContribution,
} from '@theia/core/lib/browser';
import { N5Widget } from './widget';
import { N5Contribution } from './contribution';

export default new ContainerModule(bind => {
    bindViewContribution(bind, N5Contribution);
    bind(FrontendApplicationContribution).toService(N5Contribution);
    bind(WidgetStatusBarContribution).toConstantValue(noopWidgetStatusBarContribution(N5Widget));
    bind(N5Widget).toSelf();
    bind(WidgetFactory)
        .toDynamicValue(context => ({ id: N5Widget.ID, createWidget: () => context.container.get(N5Widget) }))
        .inSingletonScope();
});
