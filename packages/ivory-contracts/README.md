# @ivory/contracts

Framework-free contracts that every Ivory surface and worker must agree on byte for byte. No Theia, storage or model dependency.

| Module | Contract |
| --- | --- |
| `common/exact-ref` | `ExactRef`: `{ projectId, objectId, revisionId }`, exactly those fields, each a non-blank string of at most 256 characters other than `latest` (ADR-004). |
| `common/semantic-closure` | `semanticClosure`: selected revisions plus everything reachable over semantic edges; activity edges and earlier revisions never pull anything in; dangling or cross-project refs fail closed (ADR-004). |
| `common/canonical-json` | `canonicalJson`: RFC 8785 (JCS) text. Refuses non-I-JSON input (undefined, lone surrogates, NaN, class instances, cycles) instead of converting it. |
| `node/canonical-digest` | `canonicalDigest`: `sha256:` + hex SHA-256 of the canonical text's UTF-8 bytes. |
| `python/ivory_contracts` | `canonical_json` and `canonical_digest` for the Python workers and adapters. |

These are plain functions rather than injectable services on purpose: they define identity, so an adopter must not be able to rebind them.

## Shared vectors

`test-resources/canonical-json-vectors.json` is checked by both `src/node/canonical-digest.spec.ts` and `python/tests/test_canonical_json.py`. It holds the RFC 8785 samples, the RFC's IEEE 754 number table, and cases where naive implementations drift apart: member order by UTF-16 code unit rather than code point, integer-like member names, integers beyond 2^53, and refusals with the error code both sides must report. When either implementation changes, add a vector rather than a one-sided test.

## Running

```text
npx lerna run compile,lint,test --scope @ivory/contracts
npm run test:python --workspace @ivory/contracts
```

The root `npm run test:theia` only covers `@theia/*` packages, so `.github/workflows/ivory-contracts.yml` runs both suites.
