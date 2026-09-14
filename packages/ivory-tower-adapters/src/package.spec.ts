// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { expect } from 'chai';
import { ClockPort } from './clock-port';

describe('@ivory-tower/adapters', () => {
    it('defines clock port symbol', () => {
        expect(ClockPort).to.be.a('symbol');
    });
});
