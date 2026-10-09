# *****************************************************************************
# Copyright (C) 2026 Michael Berry and others.
#
# This program and the accompanying materials are made available under the
# terms of the Eclipse Public License v. 2.0 which is available at
# http://www.eclipse.org/legal/epl-2.0.
#
# SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
# *****************************************************************************

import json
import sys
import unittest
from pathlib import Path

PACKAGE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PACKAGE / 'python'))

from ivory_contracts import canonical_digest, canonical_json  # noqa: E402

VECTORS = json.loads((PACKAGE / 'test-resources' / 'research-revision-vectors.json').read_text(encoding='utf-8'))


class ResearchRevisionIdentity(unittest.TestCase):
    """Independent identity agreement; Core retains domain/acceptance authority."""

    def test_revision_preimages(self):
        fields = {'projectId', 'kind', 'schema', 'objectId', 'parent', 'author', 'initiatedBy', 'origin', 'body'}
        for vector in VECTORS:
            with self.subTest(vector['name']):
                value = vector['preimage']
                self.assertEqual(set(value), fields)
                self.assertEqual(value['schema'], value['kind'] + '@1')
                self.assertEqual(canonical_json(value), vector['canonical'])
                self.assertEqual(canonical_digest(value), vector['revisionId'])

    def test_mutations_change_identity(self):
        value = next(vector['preimage'] for vector in VECTORS if vector['preimage']['kind'] == 'statement')
        before = canonical_digest(value)
        changes = {
            'author': {'kind': 'researcher', 'id': 'Another author'},
            'initiatedBy': {'kind': 'researcher', 'id': 'Another actor'},
            'origin': {'kind': 'carried-forward', 'from': {'projectId': 'p', 'objectId': 'o', 'revisionId': 'r'},
                       'originalAuthor': {'kind': 'researcher', 'id': 'Original'}},
            'body': {'wording': 'A different statement.', 'scope': []},
            'schema': 'statement@2',
        }
        for field, change in changes.items():
            with self.subTest(field):
                self.assertNotEqual(canonical_digest(dict(value, **{field: change})), before)


if __name__ == '__main__':
    unittest.main()
