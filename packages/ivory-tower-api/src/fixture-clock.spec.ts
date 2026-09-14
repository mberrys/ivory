// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { expect } from 'chai';
import { fixtureClockOption } from './fixture-clock';

describe('N5 fixture clock option', () => {
    it('leaves the real clock in place when unset', () => {
        expect(fixtureClockOption(undefined)).to.deep.equal({});
        expect(fixtureClockOption('')).to.deep.equal({});
    });
    it('pins every reading to the given instant', () => {
        const option = fixtureClockOption('2026-09-13T00:00:00.000Z');
        expect(option.clock?.().toISOString()).to.equal('2026-09-13T00:00:00.000Z');
        expect(option.clock?.().toISOString()).to.equal('2026-09-13T00:00:00.000Z');
    });
    it('rejects a value that is not an ISO-8601 UTC timestamp', () => {
        expect(() => fixtureClockOption('yesterday')).to.throw(/ISO-8601/);
        expect(() => fixtureClockOption('2026-09-13')).to.throw(/ISO-8601/);
    });
});
