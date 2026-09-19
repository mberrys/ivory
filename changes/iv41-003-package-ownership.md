# IV41-003 — reconcile package ownership against V4.1

## Plan

1. Bind package ownership to the exact selected-dev package inventory from IV41-001/V41-I01.1.
2. Assign each V4.1 package responsibility to one canonical package owner.
3. Separate Core semantic authority from durable storage implementation and from non-authoritative clients/workers/adapters.
4. Retain exact repository, PR, branch, selected-dev SHA, package-manager, and Node-engine context.
5. Fail closed on duplicate responsibility owners, shadow research acceptance/write authority, or untracked architectural gaps.

## Implementation

- Added `configs/ivory-v41-package-ownership.json` covering all 12 selected-dev Ivory packages.
- Kept `@ivory-tower/research-kernel` as the only canonical research-state writer and research-acceptance owner.
- Assigned durable storage implementation to `@ivory-tower/infrastructure` without granting it research interpretation authority.
- Added validation and adversarial tests for package coverage, authority duplication, exact evidence context, and issue-first gap tracking.

## Validation

The existing required commands now include IV41-003 through the V4.1 authority validator:

```
npm run verify:ivory-v41-authority
npm run test:ivory-v41-authority
npm run verify:ivory-tower
```

No new qualification gate is claimed closed by this architecture reconciliation.
