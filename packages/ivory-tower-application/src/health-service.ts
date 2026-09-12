// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { ClockPort } from '@ivory-tower/adapters';
import { HealthStatus } from '@ivory-tower/domain';

export class HealthService {
    constructor(
        private readonly clock: ClockPort = { now: () => new Date() },
        private readonly readiness: () => Promise<boolean> = async () => true,
    ) {}

    getStatus(): HealthStatus {
        return {
            level: 'ok',
            message: 'Ivory Tower scaffold is running',
            checkedAt: this.clock.now().toISOString(),
        };
    }

    async checkStatus(): Promise<HealthStatus> {
        const checkedAt = this.clock.now().toISOString();
        try {
            const ready = await this.readiness();
            return ready
                ? { level: 'ok', message: 'Ivory Tower runtime is ready', checkedAt }
                : { level: 'degraded', message: 'Ivory Tower runtime is not ready', checkedAt };
        } catch {
            return { level: 'unavailable', message: 'Ivory Tower readiness could not be checked', checkedAt };
        }
    }
}
