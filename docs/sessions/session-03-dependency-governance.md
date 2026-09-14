# Session 03 — Dependency, licensing, SBOM, and pinning gate (IV-19)

**Gate:** 0 — canonical executable baseline. **Primary owner:** IV-19.
**Branch:** `claude/session-3-q9tc4o`, atop `stable` @ `40d48b0`.
**Delivery-evidence state:** `implemented-local` → `canonical` once merged to `stable`.

## Objective

Make third-party dependency and release-artifact governance mechanically enforceable, so that a
prohibited licence, an unreviewed network-capable dependency, a floating production image, an
unscoped Ivory package, or a committed secret each fails a documented gate rather than a review.

## What the repository looked like at the start

`configs/ivory-dependency-policy.json` held five flat allowlists, and
`scripts/check-ivory-dependency-policy.mjs` inspected `packages/ivory-tower-*` plus
`examples/ivory-tower-browser`. Measured against IV-19's acceptance criteria, six things were
missing — and one of them was load-bearing:

1. **`@theia/ivory-identity` failed no Ivory gate at all.** The format globs matched
   `packages/ivory-tower-*`; the lerna scopes matched `@ivory-tower/*`. The identity package — which
   owns stable source, passage, and artifact identifiers, i.e. architectural invariants 3 and 4 —
   matched neither. Formatting, compile, lint, test, and dependency defects there were all silent.
2. No direct dependency recorded purpose, owner, data boundary, replacement path, or version
   policy. `@sentry/node` was approved by bare name, with no recorded data boundary despite being
   the one dependency in the tree that transmits anything outward.
3. No Ivory SBOM. `.github/workflows/generate-sbom.yml` is upstream Theia's — release-triggered,
   cdxgen, publishing to the Eclipse registry. It is not Ivory release evidence.
4. No third-party notices artifact and no exception register.
5. No image-pin enforcement. Docling was digest-pinned in four places by convention, but
   `infra/docker-compose.yml` ran `pgvector/pgvector:pg16`, MinIO, and `mc` on tags no gate read.
6. No secret scan, and no adversarial fixtures.

## Approach

**Offline and deterministic, by construction.** `package-lock.json` is lockfileVersion 3 and carries
a `license` field on 2677 of 2811 entries, so the licence closure of a deployable can be computed
from the working tree alone — no install, no registry, no Java, no external scanner. This matters
beyond convenience: a gate that needs the network is a gate that gets skipped. It also makes the
result reproducible from a commit by anyone, which is what "release evidence" has to mean.

SBOM generation started out shelling to `npm sbom` and ended up reading the lockfile too, for the
reason recorded below: npm refuses to emit any document while the tree holds an invalid dependency
edge, and this tree holds one. Every gate here now depends only on files in the working tree.

**Fixtures execute the gate.** The existing boundary fixtures
(`scripts/ivory-boundary-fixtures.json`) only assert that *some rule covers* each prohibited import.
That cannot catch a checker which stops rejecting. The seven new fixtures are minimal synthetic
trees run through the real checker via `--root`, and each must exit non-zero with a specific
message. They run inside `npm run dependency:policy`, so the negative cases cannot rot.

## What was built

| Area | Artifact |
| --- | --- |
| Policy as data | `configs/ivory-dependency-policy.json` — licence classes, defaults, quality scope, deployables, inventory, images, secret-scan config, data terms, exceptions |
| Policy gate | `scripts/check-ivory-dependency-policy.mjs` (`--root`, `--fixtures`) |
| Lockfile resolution | `scripts/ivory-lockfile.mjs` — npm-semantics closure walker, shared by the gate and notices |
| Secret scan | `scripts/check-ivory-secrets.mjs` |
| SBOM | `scripts/generate-ivory-sbom.mjs` → `artifacts/sbom/` |
| Notices | `scripts/generate-ivory-notices.mjs` → `artifacts/notices/` |
| Fixtures | `scripts/fixtures/dependency-policy/*` + `scripts/ivory-dependency-policy-fixtures.json` |
| CI | `.github/workflows/ivory-tower.yml` — new `governance` job uploading `artifacts/**` |
| Docs | `docs/iv-19-dependency-governance.md` |

## Findings the new gate produced on the real tree

These were not hypothetical. Running the gate for the first time surfaced:

- **`@theia/ivory-identity` outside all four quality scopes** — four violations. Fixed by matching
  Ivory workspaces by *name* (`@ivory-tower/*`, `@theia/ivory-*`) rather than directory prefix, and
  by widening the format globs and lerna scopes. Bringing it under the pinned Prettier config
  reformatted 13 files (`1a7afe3`, formatting only).
- **`jschardet@2.3.0` is LGPL-2.1+**, reached transitively through upstream Theia core. Weak
  copyleft, consumed unmodified and dynamically imported — recorded as an owned, expiring exception
  with the bundling mode named, because the obligation changes if the bundling does.
- **Four packages publish no licence field at all** — `busboy@1.6.0`, `streamsearch@1.1.0`,
  `fuzzy@0.1.3`, `xmlhttprequest-ssl@2.1.2`. Confirmed against the npm registry packument on
  2026-08-19: this is genuinely absent published metadata, not a lockfile artifact. Their licence
  text ships only in their own LICENSE files. Recorded as `license-unknown` with a short expiry,
  because they are unfinished work rather than settled decisions.
- **`@vscode/codicons@0.0.45` is CC-BY-4.0** — an attribution licence over an icon font. The
  obligation is attribution, which the notices artifact discharges.
- **`pgvector/pgvector:pg16` is a rebuilt floating tag.** Recorded with an expiry rather than
  pinned, because the local environment belongs to IV-21 (Session 04).
- **A stale exception.** `caniuse-lite` was initially recorded, then removed when the gate's
  staleness rule showed it is build-time only and never in a runtime closure. The rule worked
  before the register did.
- **The secret scan only saw tracked files.** `git ls-files` omits untracked ones, so a credential
  staged for a first commit was invisible — the exact case the gate exists for. Now
  `--cached --others --exclude-standard`.

## Two calibration decisions worth recording

**The `credential-assignment` pattern does not run on TypeScript sources.** Its first run produced
36 findings, every one a type annotation or identifier — `leaseToken: string`,
`secretAccessKey: options.secretAccessKey`, `const token = getDeepLToken()` — and no true positives.
A scan that cries wolf 36 times gets disabled by the third pull request. It now runs on
configuration-shaped files, where a literal value under a credential-shaped key really does mean a
committed secret. The other six patterns still cover source.

**The licence closure covers runtime dependencies, not build tooling.** Build tooling's licences do
not travel to users, and including them would have buried the four genuinely unresolved packages
under hundreds of irrelevant rows.

## Verification

Run at `40d48b0` + this branch, on **Node 22.22.2 / npm 10.9.7 with no `node_modules`** — every new
script is dependency-free by design and reads manifests, `package-lock.json`, and Compose YAML
directly.

| Command | Result |
| --- | --- |
| `node scripts/check-ivory-dependency-policy.mjs` | pass — licences, inventory, quality scope, image pins, exceptions |
| `node scripts/check-ivory-dependency-policy.mjs --fixtures` | pass — 7/7 fixtures still rejected, each for its own reason |
| `node scripts/check-ivory-secrets.mjs` | pass — no sentinel or credential pattern |
| `node scripts/generate-ivory-sbom.mjs` | 4 CycloneDX 1.5 documents: source 551, ivory-api 131, ivory-worker 130, ivory-browser 549 components; validated for duplicate and dangling `bom-ref` |
| `node scripts/generate-ivory-notices.mjs` | 527 components, 4 licence-unresolved |
| `node scripts/generate-ivory-notices.mjs --check` | pass — byte-identical on regeneration |
| `node scripts/check-ivory-boundaries.mjs` | pass — no regression |
| `npx prettier@3.6.2 --check` over the full Ivory format scope | pass, including `ivory-identity` |

**Adversarial checks against the real tree**, each reverted afterwards:

- Docling ref changed to `:latest` → rejected with
  `references the mutable image tag "quay.io/docling-project/docling-serve:latest"`. Tree restored;
  gate green again.
- Each fixture inspected individually to confirm it fails for its intended rule and not
  incidentally. The `sentinel-secret` fixture initially passed for the **wrong** reason — its
  planted `.env` was hidden by `.gitignore`, and the match came from the sentinel declared in the
  fixture's own config. Repaired: fixtures now declare their own distinct sentinel, and the planted
  file is `deploy.env`.

## What the first CI run added

Three failures on `5baad3e`, two of them this session's to own:

1. **`Verify (windows-2022)` — `format:check:ivory-tower` failed on all 13 `ivory-identity` files**
   that pass on Linux. `.gitattributes` forces `eol=lf` for `packages/ivory-tower-*/src/**` and the
   browser example but never covered `packages/ivory-identity/src/**`, so Windows checked them out
   as CRLF and the pinned `endOfLine: "lf"` rejected them. Adding the two matching rules is the
   same repair commit `cc6db16` made for the other packages. This is the cost of widening a format
   scope: the gate is only as portable as the checkout rules underneath it.
2. **`Dependency governance evidence (IV-19)` — `npm sbom` refused to run**:
   `invalid: yauzl@3.3.2, ^2.4.2 required by decompress-unzip@4.0.1`. Upstream Theia's root
   `overrides` block pins `yauzl` to `~3.3.2`, violating the range that consumer declares.
   **Pre-existing on `stable`** — the new tooling only surfaced it.

   The first attempt was to catch the error and fall back to `--package-lock-only`. That failed
   too: reproducing locally with `npx npm@11.13.0` showed npm 11 rejects the lockfile path as
   well, and neither `--force` nor extra `--omit` flags bypass the check. Workspace-scoped runs
   worked for `ivory-api` and `ivory-worker` but not for `ivory-browser` — a required deployable.

   Since `decompress` reaches four upstream packages and the override arrived in an upstream
   commit, changing it is upstream's dependency-resolution decision, not this PR's. So
   `sbom:generate` now builds CycloneDX 1.5 directly from `package-lock.json`, which is what every
   other gate in this session already does. The invalid edge is still detected and recorded under
   `dependencyTreeProblems` — the generator rediscovers it independently, from the overrides block,
   and reports the same edge npm did.
3. **`github-advanced-security`** failed in a Copilot SWE-agent cleanup step that this diff does not
   touch. Not acted on. CodeQL and all three `Analyze` jobs passed.

Writing the generator then surfaced a **real defect in the licence gate itself**. Validating the
output for duplicate `bom-ref` values (which CycloneDX forbids) turned up three, and the cause was
that `dependencyClosure` classified a package as first-party if its lockfile entry carried a `name`
field. npm *aliases* carry one too — `node_modules/strip-ansi-cjs` has `name: "strip-ansi"` — so
five aliased packages (`react-is-18`, `react-is-19`, `string-width-cjs`, `strip-ansi-cjs`,
`wrap-ansi-cjs`) were being treated as workspaces and **skipped by the licence closure entirely**.
All five are MIT, so nothing was wrongly allowed, but an aliased dependency with a prohibited
licence would have passed. Classification is now by lockfile path (`node_modules/` in the key),
which is exact. The notices artifact grew from 524 to 527 components as a result.

This is the argument for validating your own evidence rather than trusting that it looks right: the
duplicate-ref check was written to satisfy a schema rule and found a hole in the gate instead.

## Not verifiable in the container — and how CI closed it

`npm run verify:ivory-tower` cannot run here. It fails at its first step: `check:ivory-toolchain`
requires Node 24.16.0 / npm 11.13.0 (`configs/ivory-toolchain.json`), and this environment provides
22.22.2 / 10.9.7 with no install. The component-level runs above are not a substitute for the
aggregate gate, and per operating rule 3 this session did not claim one.

**CI supplied it.** At `1f4fa2b` ([run 32282211584](https://github.com/mberrys/ivory-tower/actions/runs/32282211584)):
the aggregate gate passes on **both** `ubuntu-22.04` and `windows-2022` — including
`typecheck:ivory-tower`, `lint:ivory-tower`, and `test:ivory-tower` under their widened
`@theia/ivory-*` scope, and `test:ivory-browser` — and the `governance` job passes and uploads its
evidence bundle.

The Windows job is still red overall, but only at the separate Electron compatibility step, on
upstream `packages/scm` type errors that are equally red on `stable` @ `40d48b0`. That is the base
branch's failure, not this PR's; the full table is in `session-03-handoff.md` under **CI evidence**.

## Scope held

Not touched, and deliberately so: bundle/log/telemetry redaction and deployment profiles
(IV-22, Session 05); the cutline manifest (IV-128, Session 06); vulnerability disposition
(Session 38). Upstream `generate-sbom.yml` and `license-check.yml` were left alone — every upstream
file edited becomes a recurring merge conflict, and Ivory's evidence belongs in Ivory's own
workflow.
