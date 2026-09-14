// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { ContainerModule } from '@theia/core/shared/inversify';
import { readIvoryTowerEnvironment, validateIvoryTowerEnvironment } from '@ivory-tower/infrastructure';

export default new ContainerModule(() => {
    const env = readIvoryTowerEnvironment();
    validateIvoryTowerEnvironment(env);
});
