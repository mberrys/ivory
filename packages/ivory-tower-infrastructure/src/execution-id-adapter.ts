// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { randomUUID } from 'node:crypto';
import { ExecutionIdPort } from '@ivory-tower/adapters';

export class SystemExecutionIdAdapter implements ExecutionIdPort {
    next(): string {
        return randomUUID();
    }
}
