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
import struct
import sys
import unittest
from collections import OrderedDict
from pathlib import Path

PACKAGE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PACKAGE / 'python'))

from ivory_contracts import CanonicalJsonError, canonical_digest, canonical_json  # noqa: E402

VECTORS = json.loads((PACKAGE / 'test-resources' / 'canonical-json-vectors.json').read_text(encoding='utf-8'))


def double(bits):
    return struct.unpack('>d', bytes.fromhex(bits))[0]


class SharedVectors(unittest.TestCase):
    """The same vectors src/node/canonical-digest.spec.ts checks."""

    def test_valid(self):
        for vector in VECTORS['valid']:
            with self.subTest(vector['name']):
                value = json.loads(vector['json'])
                self.assertEqual(canonical_json(value), vector['canonical'])
                self.assertEqual(canonical_digest(value), vector['digest'])

    def test_invalid(self):
        for vector in VECTORS['invalid']:
            with self.subTest(vector['name']):
                self.assertRefused(json.loads(vector['json']), vector['code'])

    def test_numbers(self):
        for vector in VECTORS['numbers']:
            with self.subTest(vector['bits']):
                self.assertEqual(canonical_json(double(vector['bits'])), vector['canonical'])

    def test_invalid_numbers(self):
        for vector in VECTORS['invalidNumbers']:
            with self.subTest(vector['name']):
                self.assertRefused(double(vector['bits']), vector['code'])

    def assertRefused(self, value, code):
        with self.assertRaises(CanonicalJsonError) as refused:
            canonical_json(value)
        self.assertEqual(refused.exception.code, code)


class PythonSpecificRefusals(unittest.TestCase):
    """Inputs only Python can produce, which json.dumps would accept or change."""

    def test_refusals(self):
        cycle = []
        cycle.append({'cycle': cycle})
        cases = [
            ('NaN parsed by the lenient json module', json.loads('NaN'), 'non-finite-number'),
            ('tuple', (1, 2), 'unsupported-value'),
            ('set', {1}, 'unsupported-value'),
            ('non-string member name', {1: 'a'}, 'unsupported-value'),
            ('dict subclass', OrderedDict(a=1), 'unsupported-value'),
            ('surrogate pair spelled as two code points', chr(0xD83D) + chr(0xDE00), 'lone-surrogate'),
            ('value that contains itself', cycle, 'cyclic-value'),
        ]
        for name, value, code in cases:
            with self.subTest(name):
                with self.assertRaises(CanonicalJsonError) as refused:
                    canonical_json(value)
                self.assertEqual(refused.exception.code, code)

    def test_booleans_are_not_numbers(self):
        self.assertEqual(canonical_json([True, 1, False, 0]), '[true,1,false,0]')


if __name__ == '__main__':
    unittest.main()
