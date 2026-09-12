// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { createExecutionRequestSchema } from './execution-contract';
import { expect } from 'chai';

describe('@ivory-tower/contracts package', () => {
    it('applies the default contract version', () => {
        const request = createExecutionRequestSchema.parse({ kind: 'convert', input: { sourceId: 'src-1' } });
        expect(request.contractVersion).to.equal(1);
    });
});
