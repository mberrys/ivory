// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { ClockPort } from '@ivory-tower/adapters';

export class SystemClockAdapter implements ClockPort {
    now(): Date {
        return new Date();
    }
}
