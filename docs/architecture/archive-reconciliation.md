# Archive extraction and package boundaries

P1 reconciles the source and license inputs for [issue #2](https://github.com/mberrys/ivory-issues/issues/2). The authority is the versioned [P0 baseline](README.md), especially [ADR-009](adr-009-v5-topology.md). The initial product uses the SQLite library Core. The provisional PGlite service described in the original issue is superseded by that ADR.

The [archive register](archive-carriers.json) records the disposition of every candidate at `dev@ec9e41f2b6991865345069d77791c7cb6422ab1f`. The original [reset manifest](../reset/archive-source-manifest.json), branch reconciliation, and provisional disposition remain historical records. P1 adds this assessment without editing those records.

## Refreshed source identities

On 2026-10-08, `git ls-remote origin 'refs/tags/archive/ivory-archive/*'` returned all ten retained archive heads. Their peeled commits match the original manifest. The source repository is now `mberrys/ivory`, as recorded in the manifest's relocation entry. The original `mberrys/ivory-archive` repository is unavailable.

GitHub ruleset `24153197`, `archive-evidence-tags`, is active. It blocks deletion, update, and non-fast-forward changes to `refs/tags/archive/**`, with no bypass actors. The register verifies each local tag's peeled commit, each tree, every candidate blob and byte digest, and the branch comparisons against archive dev.

| Source | Reconciled files | Decision |
| --- | ---: | --- |
| Archive dev, `bfcb283c4fe32b64b67a325f8f55aca08314296f` | 335 | 10 existing historical copies, 131 rewrite inputs, 185 external references, 9 rejected files. |
| N5, `91fe5341ff2d8f3789e636a8bb6fc5d86b547e8c` | 48 | Test and evidence references remain external. Runtime, package wiring, and deployment changes are rejected. |
| N7, `0aa03e29fbd9b0750de7d0f6400832a9a98889a8` | 4 | Both evidence versions remain references. The old evidence writer is rejected. |
| N1, `e93f6333bd8e9c6253fbd33a45870b6e7416df24` | 20 | Older tests and evidence remain references. Runtime and configuration versions are rejected. |
| Other archive changes | 294 | Excluded from runtime extraction. 126 are upstream Theia paths or extensions. Fixtures and support material have separate provenance. |

The ten historical copies already entered `docs/archive-evidence/` through P0. They are byte-identical to their source blobs and confer no V5 runtime qualification. A `rewrite` selects a requirement and its V5 owner. It does not admit archived implementation bytes or dependencies. Every candidate has `productCopyPermitted: false`.

Six source files have explicit mappings to existing V5 implementations. Those mappings record both destination paths and blobs at the P1 baseline. They cover exact refs, semantic closure, canonical JSON, CAS, commit ordering, and leases. The code differs. For example, the archived canonicalizer omits undefined fields, while the V5 canonicalizer rejects them. The delimiter-framed archived identities and in-memory acceptance store are excluded.

Other destination lists are empty with `status: "not-imported"`. That is a recorded exclusion or future rewrite input, not an unidentified port. Per-port behavioral proof remains the responsibility of the implementation slice.

## Branch differences

The register retains each of the 72 branch blobs beside its archive-dev comparison blob. Ancestry does not imply equal file content.

- N5 has 11 commits outside archive dev. Its client leaves `window.fetch` unbound, and its shell registers the proxy after middleware can consume the request body. Archive dev contains both fixes. The branch also removes the middleware boundary check. Its plugin scanner rebinding and old HTTP service graph conflict with ADR-009's workbench. The comparison tests remain useful external inputs.
- N7 has two commits outside dev. Its `n7-retain.mjs` drops the previous-evidence retention policy and can replace a retained live-provider result with `not-run`. The two evidence records and their test remain distinct historical references. Neither qualifies durable V5 acceptance.
- N1 has one commit outside dev. Its older kernel lacks the later fragment/context behavior. Human validation at that head is evidence about that experiment. It does not select the older runtime for V5.

`closeout/n1-n7`, `feat/v41-p02-fragment-context`, `pre-dev-foundation`, `cursor-fix-authority-reachability-80e7`, and `unstable` are ancestors of dev. Their tree identities remain in the register. Archive master is the old clean Theia baseline. The refreshed comparison finds 14 commits on master outside dev and 419 on dev outside master. The historical manifest's zero counts for master are not an ancestry proof.

## License and dependency disposition

The register records file SPDX declarations and copyright lines from the first 4 KiB of each candidate. It also pins the nearest package manifest, its declared license, and all four dependency sections. There are 34 distinct package manifests across the selected heads. Their dependencies and install scripts are excluded from the product.

The five archive license and notice files have pinned blobs and SHA-256 digests. Applicable notices and authorship must survive any later source copy. The repository notice is not evidence that every file has one license or that third-party content belongs to Ivory.

| Assessment | Files | Disposition |
| --- | ---: | --- |
| File SPDX present | 185 | Preserve the file header and applicable root notices. No runtime copy is selected. |
| Package license only | 88 | Retain the package declaration as evidence. No source copy is selected. |
| Neither file nor package declaration | 134 | Reference only. Do not infer a source-copy license from directory placement. |

The ten existing document copies retain their original text and source attribution. The assessment of a headerless historical reference does not authorize a new copy. The PDFs and other fixtures in `otherChanges` are excluded; their rights cannot be inferred from the repository license.

Archived PostgreSQL, S3, Graphile Worker, PGlite, Zod, provider SDKs, Theia plugin hosts, and their transitive dependencies do not enter V5 through this register. The new Core and contracts packages declare the repository's EPL/secondary-license expression in their manifests and source headers. Their current production dependencies are `tslib` and, for Core, `@ivory/contracts`. `@theia/ext-scripts` is development tooling.

Upstream-owned paths remain distinct from Ivory additions, including archive changes to `packages/core`, AI packages, plugin hosts, build tools, and shared manifests. P1 rejects those archive versions. The product receives upstream code through the Theia sync. The CI fence compares changed paths with the pinned upstream tree. `package-lock.json` is the sole metadata exception because adding a workspace regenerates it.

## Initial package graph

The [package policy](v5-package-boundaries.json) defines direct production and development dependency allow-lists. The CLI, workbench, and browser app are planned entries, not implemented packages.

| Package | Production dependencies | Responsibility |
| --- | --- | --- |
| `@ivory/contracts` | `tslib` | Exact references, canonical identity, closure contracts, and shared Python vectors. |
| `@ivory/core` | contracts, `tslib`, Node built-ins | Research authority and the worker-owned SQLite store. No Theia or client dependency. |
| `@ivory/cli` | Core, contracts, MCP SDK, `tslib` | CLI and `ivory mcp` hosts over typed Core sessions. |
| `@ivory/workbench` | Core, contracts, the listed Theia packages, `tslib` | Theia DI and the catalog facade. |
| `@ivory/browser` | workbench and the listed Theia packages | `examples/ivory-browser` assembly. AI, plugin hosts, and VSX are excluded. |
| `@ivory/qualification` | Core, contracts, `tslib` | Test tooling. Product packages cannot depend on it. |

These edges are checked in manifests, the lockfile, and literal source imports. Relative imports cannot cross Ivory package directories. An undeclared Ivory package or consumer fails the check. The archive package names, directories, and complete source-file copies are refused, including renamed files and CRLF changes. The exact two-line upstream ESLint configuration is an explicit shared configuration exception.

The check parses imports and exports with the existing TypeScript build tool. It does not resolve computed worker-module paths or detect edited source fragments. Source review remains necessary for those cases. This is a static package boundary, not an isolation mechanism.

## Clean baseline evidence

The selected upstream baseline is `8b94967c4cfa0dcf688a345d28b3ac2e0d7e298a`. Its lockfile SHA-256 is `3b777a78cd3e43f4defcd36886d60ce5e22af8683e90a867aac45329a6eaa6cb`.

The earlier [build job 109213132022](https://github.com/mberrys/ivory/actions/runs/36507823752/job/109213132022) was re-read on 2026-10-08. It passed `npm ci`, compilation of 94 projects, and the browser, browser-only, and Electron bundles. It used Ubuntu 22.04.5, runner image `ubuntu22/20260920.303`, Node v24.21.0, npm 11.19.0, and Python 3.13.15. The workflow was `.github/workflows/ivory-v5-reset.yml` at `0e9e313414333ffa6d1558e879f9d24141f778b1`. The overall run failed its separate archive checkout job. That failure remains part of the historical result.

[ivory-boundaries.yml](../../.github/workflows/ivory-boundaries.yml) repeats the clean baseline build in a separate checkout. It records the pinned source, implementation and workflow identities, runtime versions, runner image, filesystem, lockfile digest, step outcomes, post-build Git status, and log digests. The `p1-clean-baseline` artifact contains the record and raw build logs. Its claim applies to that upstream source on the observed Linux runner. It does not claim a build or runtime qualification of the V5 product.

The separate `p1-package-boundaries` artifact records the implementation SHA and policy/register digests for the static package check. A dirty checkout cannot produce a passing record. CI retains both artifacts for 90 days. The P1 closeout record belongs under `docs/ivory/qualification/p1/` after the hosted result is observed.

## Verification commands

From a clone with the retained tags and Node 24:

```sh
node scripts/ivory/archive-carriers.mjs
npm ci --ignore-scripts
node --test scripts/ivory/package-boundaries.spec.mjs
node scripts/ivory/check-package-boundaries.mjs --base=origin/dev
```

`archive-carriers.mjs --write` regenerates the register from the pinned Git objects and the explicit selection policy in the script. A register mismatch fails verification. Review the source and selection changes before regeneration.

The fresh baseline job runs these commands in its separate pinned checkout:

```sh
sudo apt-get update
sudo apt-get install -y libx11-dev libxkbfile-dev libsecret-1-dev
npm ci
npm run build
git status --porcelain
```

P1 closes source selection, license disposition for that selection, and the initial dependency contract. It does not pass later ports, client parity, composed research, durability, or release gates.
