# Evidence record

Every slice of the V5 plan records its results in one common form, so that a gate can be checked from the record alone. The gates are defined in [v5-qualification.md](v5-qualification.md). The fields below are the requirement. The IV5-6 record, `ivory-qualification@1`, already meets it, so this change touches no code.

## Fields

| Field | Content |
| --- | --- |
| `issue` | The issue id, for example `IV5-6`. |
| `gates` | The gate ids the record claims, for example `N2` and `J7`. |
| `head` | `commit`: the implementation SHA, 40 hex characters. `branch`. `dirty`: must be `false` for a pass. |
| `command` | The exact command line, as run. |
| `environment` | `platform`, `osVersion`, `arch`, runtime versions (`node`, `sqlite`), `filesystem` of the project directory, and the machine identity or CI runner image. |
| `fixtures` | A SHA-256 digest for each fixture or harness input the run used. |
| `criteria` | One entry per criterion, with `pass`, `gated` and the measured values. This is the observed result. |
| `outcome` | `pass` or `fail`. |
| `failReasons` | Each failed criterion and each other failure, such as `dirty-tree`. Failures stay in the record. |
| `limits` | Each claim the run does not support, in words. |
| `ledger` | Required when the criteria are computed from raw observations: the file name, row count and SHA-256 of the ledger. |

## Template

```json
{
  "record": "<name>@<version>",
  "issue": "<issue id>",
  "gates": ["<gate id>"],
  "head": { "commit": "<40-hex SHA>", "branch": "<branch>", "dirty": false },
  "command": "<exact command line>",
  "environment": { "platform": "", "osVersion": "", "arch": "", "node": "", "sqlite": "", "filesystem": "", "machine": "" },
  "fixtures": { "<fixture name>": "<sha-256>" },
  "criteria": { "<criterion id>": { "pass": true, "gated": true } },
  "outcome": "pass",
  "failReasons": [],
  "limits": ["<claim the run does not support>"],
  "ledger": { "file": "<file name>", "rows": 0, "sha256": "<sha-256>" }
}
```

## Rules

- A record is immutable. A re-run writes a new record.
- A gate passes only when a record claims it with `outcome: "pass"` and `head.dirty: false`. The ledger cites each record by path and commit, and a gate's state changes only when that citation exists.
- Records are committed under `docs/ivory/qualification/<issue id in lower case>/<machine>/`, for example `docs/ivory/qualification/iv5-6/windows-11/`.
- Historical N-records and CI runs of isolated fixtures are references, not V5 passes.
- An ADR is a design decision, not a test result.
- `limits` carries the standing limits of the gate. For durability, that is process kill only: power loss is not claimed.

## Existing record

`packages/ivory-qualification` writes `ivory-qualification@1` records for IV5-6, with these fields. Its [README](../../packages/ivory-qualification/README.md) gives the commands and the criteria.
