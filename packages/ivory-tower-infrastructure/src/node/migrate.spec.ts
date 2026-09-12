// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0

import { expect } from 'chai';
import { resolveIvoryMigrationBatch } from './migrate';

describe('resolveIvoryMigrationBatch', () => {
    const migrations = ['002_source_rights.sql', '001_runtime_topology.sql'];

    it('returns the sorted migration list when no upper boundary is set', () => {
        expect(resolveIvoryMigrationBatch(migrations)).to.deep.equal(['001_runtime_topology.sql', '002_source_rights.sql']);
    });

    it('includes the named upper boundary and every earlier migration', () => {
        expect(resolveIvoryMigrationBatch(migrations, '001_runtime_topology.sql')).to.deep.equal(['001_runtime_topology.sql']);
        expect(resolveIvoryMigrationBatch(migrations, '002_source_rights.sql')).to.deep.equal([
            '001_runtime_topology.sql',
            '002_source_rights.sql',
        ]);
    });

    it('rejects an upper boundary that is not in the checked-in migration set', () => {
        expect(() => resolveIvoryMigrationBatch(migrations, '999_does_not_exist.sql')).to.throw(
            'Unknown Ivory migration upper boundary: 999_does_not_exist.sql.',
        );
    });
});
