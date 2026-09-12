// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { AbstractViewContribution, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { injectable } from '@theia/core/shared/inversify';
import { HealthWidget } from './health-widget';

@injectable()
export class HealthContribution extends AbstractViewContribution<HealthWidget> implements FrontendApplicationContribution {
    constructor() {
        super({
            widgetId: HealthWidget.ID,
            widgetName: HealthWidget.LABEL,
            defaultWidgetOptions: {
                area: 'main',
            },
        });
    }

    async initializeLayout(): Promise<void> {
        await this.openView({ activate: true });
    }
}
