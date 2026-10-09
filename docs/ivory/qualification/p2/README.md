# P2 research contract qualification

This directory retains results for [ivory-issues#3](https://github.com/mberrys/ivory-issues/issues/3). The [contract](../../../architecture/v5-research-contract.md) gives the API, fixtures and claim limits.

The evidence runner records the exact clean implementation SHA, environment, fixture/source digests, commands, observed criteria and limitations. Each result has a separate digested ledger. Output files are created exclusively; reruns require a new name. Local compile, lint, TypeScript and Python results accompany the Windows contract record. Hosted results come from the Ivory contracts workflow's `p2-research-contracts` artifact.

| Record | Implementation | Observed result |
| --- | --- | --- |
| [Windows N1 contracts](windows-local/windows-qualification.json) | `7a6ec82c8364fed2811e8c90a2a55b9252f27285`, clean | All 15 criteria pass, including 12/17 snapshot members and all six required refusal classes. |
| [Windows build and suites](windows-local/checks.json) | Same clean implementation | Compile and lint pass; 141 TypeScript tests and 8 Python tests pass. Three compressed logs and their digests are retained. |
| [Linux hosted N1 contracts](linux-ci/qualification.json) | `20188018e93d79bd148caf3d3a98aa92d47f68b5`, clean | All 15 criteria pass on Node 24.21.0 / Python 3.13.16. [Run 37863425206](https://github.com/mberrys/ivory/actions/runs/37863425206) also passes compile, lint, 141 TypeScript tests and 8 Python tests; its metadata and compressed log are retained. |

The hosted checkout is detached (`head.branch` is empty). Its exact head differs from the Windows implementation only by committed P2 evidence. Later evidence-only commits do not change the qualified implementation.

```text
npx lerna run compile --scope @ivory/contracts
npx lerna run lint,test --scope @ivory/contracts
npm run test:python --workspace @ivory/contracts
node scripts/ivory/verify-research-contracts.mjs --output tmp/p2-contracts/qualification.json
```

The N1 criterion is bounded to P2 pure contracts. This evidence does not close authenticated command, persistence, converter/context, capsule, client-parity or human interpretation gates. P1 archive/package qualification remains in [PR #10](https://github.com/mberrys/ivory/pull/10).
