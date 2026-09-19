# IV41-005 — establish V4.1 qualification manifest

## Plan

1. Bind qualification records to the existing V4.1 authority, owner, carrier, and gate manifests.
2. Define exact repository head, environment, verifier, fixture, evidence, observation, decision, and limitation fields.
3. Validate retained fixture and evidence bytes with SHA-256 digests and reject unsafe repository paths.
4. Require every architectural gap to reference a tracked `IV41-*` issue.
5. Keep the qualification manifest evidence-bound and reject aggregate pass claims or machine-only qualification decisions.

## Implementation

- Added `configs/ivory-v41-qualification.json` with one record for each V4.1 gate. All six records remain explicitly `not-run` until retained evidence exists.
- Extended `scripts/ivory/v41-authority.mjs` so the existing authority reconciliation validates the qualification schema, exact context, digests, gate decisions, limitations, and issue-first gap records.
- Added adversarial tests for missing context, stale heads, dirty worktrees, machine-only decisions, digest drift, missing limitations, untracked gaps, duplicate gates, aggregate outcomes, and path traversal.
- Set the shared Prettier policy to `endOfLine: auto` so the existing source formatting passes consistently on LF and CRLF checkouts.
- Normalized the V1 cutline CRLF fixture source before generating CRLF so its cross-platform regression test does not create doubled carriage returns on Windows.
- Removed the pre-existing duplicate inherited Theia color-registration method exposed by the required Windows Electron compatibility build.

## Validation

```
node --test scripts/ivory/v41-authority.spec.mjs
npm run verify:ivory-v41-authority
```

The 26 focused tests pass and the authority reconciliation reports the six qualification records as not-run. No V4.1 qualification gate is claimed closed by this change.
