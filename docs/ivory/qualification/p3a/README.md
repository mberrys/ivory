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

## Recorded results

All records below tested clean implementation commit `ee1f0cc9b9e877fc1ad867d976e2ef70784dba9a` on Windows 11 Home 10.0.26300, x64, Node 24.16.0 and SQLite 3.53.0. The successful runs used local NTFS. The ledgers and raw reports are retained beside their records, with Git newline conversion disabled so their recorded byte digests remain verifiable.

| Record | Result | Claim limit |
| --- | --- | --- |
| [P3a Core qualification](windows-11/qualification.json) | All 114 Core tests passed, none skipped; all seven criteria passed. | Same-user local service and real Node host/CLI lifecycle; Theia UI and bundling remain unqualified. |
| [FULL process-kill smoke](windows-11/kill-win32-FULL.json) | All 12 cycles passed across six crash points; no lost acknowledgement, phantom observation or invalid referenced blob. | Two cycles per point, below the recorded 1,000-cycle target. |
| [Service latency smoke](windows-11/latency-win32-FULL.json) | Eight measured seconds; event-loop p99 16.736255 ms, 19 matching receipts and two recovered victims. | Intentional three-second writer holds; commit p99 4,662 ms. This is event-loop responsiveness evidence, not a low commit-latency claim. |
| [Sandbox diagnostic](windows-sandbox/qualification.json) | Failed: sandbox temporary storage denied project-manifest atomic renames, including unchanged initialization tests. | Retained failure from the redirected filesystem; the successful Core record above used the normal local filesystem. |

To repeat the two smoke records, run from `packages/ivory-qualification` after compiling:

~~~text
node lib/node/qualify.js kill --cycles 2 --synchronous FULL --seed 7 --out ../../tmp/p3a-kill-review
node lib/node/qualify.js latency --duration 8 --warmup 1 --victim-interval 2 --seed 7 --out ../../tmp/p3a-latency-review
~~~

The compile and lint commands above passed for both changed packages; their combined test command passed 114 Core tests and seven qualification-harness tests. The retained clean-SHA Core record independently reran the complete Core suite. These bounded results do not close the broader N2/J7 or release qualification gates.

## Source material

source-manifest.json pins both issue-provided N2 references with Git blob IDs and SHA-256 digests. Their bytes were recovered and verified from local Git objects at archive commit bfcb283c4fe32b64b67a325f8f55aca08314296f after the GitHub contents endpoint returned 404. No archived source is imported into the runtime.

## Limits

This qualifies the P3a storage/lifecycle boundary, including a real Node client host that stands in for Theia closing. It does not qualify Theia UI/bundling, hardware power loss, OS crashes, cloud sync, removable drives, hosted stores, research-domain commits, migrations, outbox delivery or release gates. The bootstrap byte transport admits at most 8 MiB per request; streaming remains P4/P5 work.
