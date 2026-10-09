# P2 research contract qualification

This directory retains results for [ivory-issues#3](https://github.com/mberrys/ivory-issues/issues/3). The [contract](../../../architecture/v5-research-contract.md) gives the API, fixtures and claim limits.

The evidence runner records the exact clean implementation SHA, environment, fixture/source digests, commands, observed criteria and limitations. Each result has a separate digested ledger. Output files are created exclusively; reruns require a new name. Local compile, lint, TypeScript and Python results accompany the Windows contract record. Hosted results come from the Ivory contracts workflow's `p2-research-contracts` artifact.

```text
npx lerna run compile --scope @ivory/contracts
npx lerna run lint,test --scope @ivory/contracts
npm run test:python --workspace @ivory/contracts
node scripts/ivory/verify-research-contracts.mjs --output tmp/p2-contracts/qualification.json
```

The N1 criterion is bounded to P2 pure contracts. This evidence does not close authenticated command, persistence, converter/context, capsule, client-parity or human interpretation gates. P1 archive/package qualification remains in [PR #10](https://github.com/mberrys/ivory/pull/10).
