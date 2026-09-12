// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { expect } from 'chai';
import { HealthService } from './health-service';

describe('@ivory-tower/application', () => {
    it('reports ok health from the scaffold service', () => {
        const service = new HealthService({ now: () => new Date('2026-08-02T12:00:00.000Z') });
        const status = service.getStatus();
        expect(status.level).to.equal('ok');
        expect(status.checkedAt).to.equal('2026-08-02T12:00:00.000Z');
    });

    it('reports runtime readiness through the application contract', async () => {
        const service = new HealthService({ now: () => new Date('2026-08-03T12:00:00.000Z') }, async () => true);
        expect((await service.checkStatus()).level).to.equal('ok');

        const unavailable = new HealthService(undefined, async () => false);
        expect((await unavailable.checkStatus()).level).to.equal('degraded');

        const failed = new HealthService(undefined, async () => {
            throw new Error('probe failed');
        });
        expect((await failed.checkStatus()).level).to.equal('unavailable');
    });
});
