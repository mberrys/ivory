# N7 experiment — scoped agent proposal integrity

Reproduce the headless prototype. This is not a production MCP write path.

Requires Node 24+. From the repository root:

```sh
npm run test:ivory-n7
npm run verify:ivory-n7
```

`test` runs the catalog, pipeline, MCP presenter, and evidence specs.
`verify` re-runs those specs, writes fixture-provider transcripts under
[`n7-transcripts/`](n7-transcripts/), and retains
[`n7-v1-evidence.json`](n7-v1-evidence.json).

Each invocation builds a fresh in-memory project. Closing it loses receipts
and proposals. There is no persistence or restart guarantee (N2).

## What is exercised

- Adversarial tool instructions in source text (`hostile-corpus`)
- Capability revocation mid-task (`revoked-tool`)
- Claim revision after a proposal is prepared (`stale-proposal`)
- Replayed acceptance (`duplicate-accept`)
- No-model qualitative path on `studio` / `cli`
- Configurable HTTP provider fail-closed against a loopback endpoint

## Live provider

Opt-in. Configure `N7_ENDPOINT` as the complete Chat Completions URL,
`N7_MODEL`, and `N7_API_KEY` if required. Do not put credentials in files.
HTTPS is required except for loopback HTTP. Live qualification is not part
of default verify; missing credentials leave that gate open.

Design record: [`docs/iv-n7-agent.md`](../iv-n7-agent.md).
Catalog map: [`docs/where-new-behavior-goes.md`](../where-new-behavior-goes.md).
