# P3a: Core ownership and byte admission evidence

Scope: [ivory-issues #4](https://github.com/mberrys/ivory-issues/issues/4), implemented over the current dev SQLite store. [ADR-011](../../../architecture/adr-011-p3a-core-ownership.md) records the scoped ownership change and claim limits.

## Reproduce

From the repository root with Node 24 and installed dependencies:

~~~text
npx lerna run compile --scope @ivory/qualification --include-dependencies
npx lerna run lint --scope @ivory/core --scope @ivory/qualification
npx lerna run test --scope @ivory/core --scope @ivory/qualification
node scripts/ivory/verify-core-admission.mjs --output tmp/p3a-review/qualification.json
~~~

The validator requires a clean checkout and new output paths. It runs the complete compiled Core suite and writes the common evidence fields, an observation ledger, the Mocha JSON report and diagnostic log. Each gate requires its named tests to be present, passing, and unskipped; the full regression suite must pass too.

Retained machine records live below this directory. The implementation SHA inside each record is the tested source; a later evidence-only commit does not change that qualification. Hosted artifacts qualify their recorded source head and runner independently.

## Source material

source-manifest.json pins both issue-provided N2 references with Git blob IDs and SHA-256 digests. Their bytes were recovered and verified from local Git objects at archive commit bfcb283c4fe32b64b67a325f8f55aca08314296f after the GitHub contents endpoint returned 404. No archived source is imported into the runtime.

## Limits

This qualifies the P3a storage/lifecycle boundary, including a real Node client host that stands in for Theia closing. It does not qualify Theia UI/bundling, hardware power loss, OS crashes, cloud sync, removable drives, hosted stores, research-domain commits, migrations, outbox delivery or release gates. The bootstrap byte transport admits at most 8 MiB per request; streaming remains P4/P5 work.
