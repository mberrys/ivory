// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { expect } from 'chai';

describe('@ivory-tower/domain', () => {
    it('exports health status types', () => {
        const status = { level: 'ok', message: 'ready', checkedAt: '2026-08-02T00:00:00.000Z' };
        expect(status.level).to.equal('ok');
    });
});
