// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { HealthService } from '@ivory-tower/application';
import { FrontendApplicationConfigProvider } from '@theia/core/lib/browser/frontend-application-config-provider';
import {
    bindViewContribution,
    FrontendApplicationContribution,
    noopWidgetStatusBarContribution,
    WidgetFactory,
    WidgetStatusBarContribution,
} from '@theia/core/lib/browser';
import { ContainerModule, interfaces } from '@theia/core/shared/inversify';
import { HealthContribution } from './health-contribution';
import { HealthWidget } from './health-widget';

export default new ContainerModule((bind: interfaces.Bind) => {
    bind(HealthService)
        .toDynamicValue(() => {
            const config = FrontendApplicationConfigProvider.get() as { ivoryApiBaseUrl?: string };
            const apiBaseUrl = config.ivoryApiBaseUrl ?? 'http://localhost:4100';
            return new HealthService(undefined, async () => (await fetch(`${apiBaseUrl}/health/ready`)).ok);
        })
        .inSingletonScope();

    bindViewContribution(bind, HealthContribution);
    bind(FrontendApplicationContribution).toService(HealthContribution);
    bind(WidgetStatusBarContribution).toConstantValue(noopWidgetStatusBarContribution(HealthWidget));
    bind(HealthWidget).toSelf();
    bind(WidgetFactory)
        .toDynamicValue(context => ({
            id: HealthWidget.ID,
            createWidget: () => context.container.get<HealthWidget>(HealthWidget),
        }))
        .inSingletonScope();
});
