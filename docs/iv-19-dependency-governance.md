# IV-19 — Dependency, licensing, SBOM, and pinning governance

**Status:** implemented at Gate 0 (Session 03). **Owner:** Engineering.
**Policy as data:** [`configs/ivory-dependency-policy.json`](../configs/ivory-dependency-policy.json).

This document explains the policy. The JSON file *is* the policy — every rule below is
mechanically enforced, and prose here never overrides it.

## 1. Why this exists

Open-source reuse is a stated Ivory Tower strategy, so the risk is not reuse itself but
*unreviewed* reuse: a dependency nobody chose, a licence nobody read, a network-capable package
nobody bounded, or a production image that silently changes under a mutable tag. IV-19 makes each
of those a mechanical failure rather than a review question.

The gates are **fail-closed and offline**. Every input — workspace manifests, `package-lock.json`,
and the Compose and runtime image references — is read from the working tree. No install, no
registry, no Java, and no external scanner is required, so the result is reproducible from a commit
by anyone.

## 2. Commands

| Command | What it does | In the required gate |
| --- | --- | --- |
| `npm run dependency:policy` | Licences, dependency inventory, quality scope, image pins, exception register, **and the adversarial fixtures** | yes |
| `npm run secret:scan` | Sentinel and credential scan | yes |
| `npm run sbom:generate` | CycloneDX 1.5 SBOMs into `artifacts/sbom/` — source tree plus one per deployable, built from `package-lock.json` | CI / release |
| `npm run notices:generate` | Third-party notices into `artifacts/notices/` | CI / release |
| `npm run notices:check` | Fails if the notices artifact is stale | available, not gate-wired |
| `npm run license:check` | Upstream Eclipse dash-licenses (Theia's own gate; needs Java and network) | no — upstream-owned |

`npm run verify:ivory-tower` runs the first two. SBOM and notices generation is deliberately kept
out of the local gate: it is release evidence, it is slow, and it depends on install state.
`artifacts/` is gitignored and uploaded by the CI `governance` job instead of being committed, so a
dependency bump does not produce a notices diff on every pull request.

## 3. Licence classes

Three classes, in `licenseClasses`:

- **allowed** — permissive and file-level-copyleft expressions that need no per-package decision.
- **reviewRequired** — weak copyleft (LGPL) and attribution-over-content licences (CC-BY). These
  fail unless a recorded exception names the exact `package@version`.
- **prohibited** — strong copyleft and source-available licences (GPL, AGPL, SSPL, BUSL, Elastic),
  plus `UNLICENSED`. **A prohibited licence has no exception path.** The only remedy is removal.

A missing licence is `unknown`, which is treated like `reviewRequired` and denied by default
(`defaults.unknownLicense: "deny"`).

SPDX expressions are evaluated, not string-matched: an `OR` expression passes if any operand is
allowed (`(MPL-2.0 OR Apache-2.0)` resolves through Apache-2.0), and an `AND` expression requires
every operand to be allowed (`(OFL-1.1 AND MIT)`).

**Scope.** The licence closure is computed over the **runtime** dependencies of each entry in
`deployables` — what actually ships. Build and test tooling is out of scope: its licences do not
travel to users, and including it would bury the real signal.

## 4. The dependency inventory

`packages` is the reviewed third-party inventory. Every direct dependency of every Ivory-owned
workspace must have an entry recording:

`allowed`, `scope`, `purpose`, `owner`, `license`, `networkCapable`, `native`, `dataBoundary`,
`sourceContentCrossesBoundary`, `versionPolicy`, `replacementPath`.

A direct dependency with no entry fails the gate
(`defaults.uninventoriedDirectDependency: "deny"`). There is no prefix allowlist — the previous
`@types/*` and `@theia/*` prefix rules let unreviewed packages through, and they are gone.

Two fields carry weight beyond bookkeeping:

- **`dataBoundary` / `sourceContentCrossesBoundary`** record whether research content can cross the
  package boundary. `@sentry/node` is approved as `scrubbed operational metadata only`; if that
  ever stops being true, the entry is wrong and must change before the code does.
- **`replacementPath`** names how the dependency would be replaced. Architectural invariant 2 says
  libraries stay behind owned adapters; a dependency with no credible replacement path is a
  dependency that has quietly become the architecture.

`versionPolicy` is enforced: `exact` requires a pinned version, `range` accepts a reviewable
caret/tilde range, and everything is lockfile-pinned regardless.

## 5. Quality scope

The gate reads the root `package.json` and asserts that **every** Ivory-owned workspace — matched
by name (`@ivory-tower/*`, `@theia/ivory-*`), not by directory prefix — is covered by the scope of
`format:check:ivory-tower`, `typecheck:ivory-tower`, `lint:ivory-tower`, and `test:ivory-tower`.

This closes the specific hole IV-19 step 2 names. Before Session 03, `@theia/ivory-identity` was
invisible to all four: the format globs matched `packages/ivory-tower-*` only, and the lerna scopes
matched `@ivory-tower/*` only. A dependency or lint defect in the identity package failed nothing.
Adding a package under an Ivory name but outside those scopes is now itself a gate failure.

## 6. Image pinning

Every image reference in `infra/docker-compose.yml`, `.env.example`,
`scripts/verify-ivory-runtime.mjs`, `scripts/verify-ivory-session-04.mjs`, and
`packages/ivory-tower-infrastructure/src/environment.ts` must be registered in `images`.

- **Mutable tags are never admissible.** `latest`, `main`, `master`, `edge`, `stable`, `dev`, and
  `nightly` fail unconditionally, in any environment.
- **`environment: "runtime"`** requires an `@sha256:` digest. Docling is pinned this way, and
  environment validation rejects a mutable `DOCLING_IMAGE` at startup independently of this gate.
- **`environment: "local"`** also requires an `@sha256:` digest. The Compose PostgreSQL/pgvector,
  MinIO server, and MinIO client references are resolved manifest digests; the verification gate
  therefore recreates the same local runtime rather than trusting a release tag to remain stable.

Digest-pinning MinIO does **not** clear the unreviewed AGPL-3.0 licence question in §13. Those
images remain local-dev/test infrastructure only.

## 7. Exceptions

An exception is a **specific, owned, expiring** record. Every one requires `kind`, `subject`,
`reason`, `owner`, `expires`, and `compensatingControl`; the gate fails on a missing field, on an
expired record, and on a **stale** record that no longer matches anything in the tree. There is no
wildcard form, by construction.

Current register:

| Subject | Kind | Why |
| --- | --- | --- |
| `jschardet@2.3.0` | licence-review | LGPL-2.1+ encoding detection inherited from upstream Theia core; consumed unmodified and dynamically imported |
| `@vscode/codicons@0.0.45` | licence-review | CC-BY-4.0 icon font; the obligation is attribution, satisfied by the notices artifact |
| `busboy@1.6.0`, `streamsearch@1.1.0`, `fuzzy@0.1.3`, `xmlhttprequest-ssl@2.1.2` | licence-unknown | These packages publish **no** `license` field — confirmed against the registry packument on 2026-08-19, not merely absent from the lockfile. Their licence text ships only in their own LICENSE files and must be read from an installed tree before a tagged release |

The four licence-unknown records expire sooner than the review records precisely because they are
unfinished work, not settled decisions.

## 8. Secret scanning

Two tiers, because a single tier is either noisy or useless:

- **Critical patterns** — the sentinel, AWS access keys, private-key blocks, GitHub tokens, and
  Sentry DSNs — are scanned across the whole repository. These have effectively no false-positive
  surface.
- **Remaining patterns** are scanned over the Ivory-owned surface (`secretScan.scanPaths`).
  Upstream Theia's own hygiene is not this gate's subject.

The `credential-assignment` pattern deliberately does not run on TypeScript sources: in
TypeScript, `leaseToken: string` is a type annotation, not a credential, and scanning source files
produced dozens of such false positives with no true ones. It runs on configuration-shaped files,
where a literal value under a credential-shaped key really does mean a committed secret.

The scan covers files that are **staged but not yet committed** (`git ls-files --cached --others
--exclude-standard`), because a credential about to be committed is exactly what the gate is for.

Allowlist entries are exact paths with a reason, an owner, and the specific pattern ids they
suppress — never a directory wildcard.

**Boundary:** this is a repository and build-output scan. Redaction across process logs,
HTTP error bodies, telemetry, and audit-shaped payloads is the **IV-22 contract**
(`docs/iv-22-deployment-secrets.md`) and is not claimed here.

## 9. Adversarial fixtures

`npm run dependency:policy` runs seven fixtures under
`scripts/fixtures/dependency-policy/`, each a minimal synthetic tree executed through the **real**
checker. Each must exit non-zero with the expected message:

| Fixture | Proves |
| --- | --- |
| `prohibited-license` | a deployable whose closure reaches GPL-3.0-only is rejected |
| `unapproved-network-dependency` | a network-capable package the inventory refused cannot be depended on |
| `missing-inventory-entry` | a direct dependency with no recorded purpose or data boundary fails |
| `floating-image-tag` | a production image on a mutable tag fails |
| `expired-exception` | a lapsed review window fails |
| `omitted-from-quality-scope` | an Ivory package no required script covers fails |
| `sentinel-secret` | the secret scan rejects a planted sentinel |

These **execute** the gate rather than asserting that a rule exists. The existing boundary fixtures
in `scripts/ivory-boundary-fixtures.json` only check that some rule covers each import, which
cannot catch a checker that stops rejecting; these can.

Fixtures declare their own sentinel value so the repository sentinel never appears in the fixture
tree, and the planted file is named `deploy.env` rather than `.env` so `.gitignore` cannot hide it.

## 10. Model licences and scholarly-data terms

`dataTerms` records these **separately from software licences**, and the separation is the point.

> A software licence is never authorization to ingest scholarly content.

Content admissibility is governed by IV-20 and IV-83 and documented in
[`docs/iv-128-content-rights.md`](iv-128-content-rights.md). This file records only that the
distinction is tracked: V1 bundles **no** model assets (recorded as an explicit empty set, not an
omission), and the scholarly sources named in the safe-open allowlist carry their own terms.

## 11. Update cadence

Per the IV-19 V1 governance addendum (2026-08-03):

- Theia upstream synchronization is owned by Engineering, with a **monthly drift review** and a
  review at each adopted upstream release. Both re-check the licence expressions behind the
  recorded exceptions, since those exceptions describe upstream-inherited packages.
- Exception expiries are the backstop: an expired record fails the gate whether or not a review
  happened on schedule.
- CI runs the full governance job on every push and pull request to `stable` and `dev`, uploading
  SBOMs and notices as build artifacts.

## 12. Known limits

- **The dependency tree contains an invalid edge**, recorded in every SBOM manifest under
  `dependencyTreeProblems`:

  ```text
  invalid: root override "yauzl": "~3.3.2" conflicts with "^2.4.2" required by decompress-unzip@4.0.1
  ```

  Upstream Theia's root `overrides` block pins `yauzl` to `~3.3.2` while `decompress-unzip@4.0.1`
  declares `^2.4.2`. This predates IV-19; the SBOM work only surfaced it. It is also why
  `sbom:generate` does **not** use `npm sbom`: npm refuses to emit any document at all while such
  an edge exists — on npm 11 that killed the source tree and the browser deployable outright, and
  neither `--force` nor `--omit` bypasses it. The generator reads `package-lock.json` directly
  instead, like every other gate here.

  Resolving the edge is a **dependency-resolution decision, not a tooling fix**, and it belongs to
  whoever owns the override. The narrow remedy is a nested override letting that one consumer keep
  the 2.x line:

  ```jsonc
  "overrides": { "yauzl": "~3.3.2", "decompress-unzip": { "yauzl": "^2.4.2" } }
  ```

  That reintroduces `yauzl` 2.x for one transitive build-time consumer, which is presumably what
  the flat override was added to avoid — so the trade-off needs a decision rather than a patch.
- The four licence-unknown packages are unfinished, not settled. Resolving them requires reading
  LICENSE files from an installed tree.
- Vulnerability disposition (`npm audit` findings and their recorded resolution) is **not**
  implemented here. `advisoryExceptions` exists and is validated, but no advisory feed is wired to
  it; that belongs with the release-drill work in Session 38.

## 13. Session 03 addendum — two findings not otherwise recorded

A second, independent execution of Session 03 ran concurrently with the one that produced this
document and PR #20. By the time it reached verification, PR #20 had already merged, and its
gate mechanism (this file, `configs/ivory-dependency-policy.json`,
`scripts/check-ivory-dependency-policy.mjs`, `scripts/generate-ivory-sbom.mjs`,
`scripts/generate-ivory-notices.mjs`, the fixture suite, and the `governance` CI job) was
materially more complete than the duplicate implementation the second execution had built. That
duplicate work was discarded rather than merged or rebased on top of this file's mechanism — see
`docs/sessions/session-03-addendum.md` for the full account. Two findings from that discarded work
survive here because they are not otherwise recorded:

- **`quay.io/minio/minio` and `quay.io/minio/mc` (§6) have an unreviewed licence, not just an
  unpinned digest.** Session 04 (IV-21) pinned both images by digest for local reproducibility.
  That does not resolve the licence. MinIO Server is believed to have moved to AGPL-3.0 in 2021
  (from Apache-2.0); neither this document's `exceptions` (§7, npm-package-scoped) nor `images`
  (§6, digest-pinning-scoped) records that licence. Running the unmodified image as local
  dev/test infrastructure — its only current use — is unlikely to trigger AGPL's network-copyleft
  clause, but that is an observation, not a ruling. If either image is ever used as more than
  local dev/test infrastructure — e.g. a self-hosted production object store instead of the hosted
  S3-compatible storage ADR-002 calls for — this needs counsel review before that decision is
  made, the same way `docs/iv-128-content-rights.md` routes open content-rights questions to
  counsel rather than resolving them here.
- **Dependencies ADR-001/ADR-002 name but that are not installed yet have no recorded owner.**
  `liquidify-react` (peers: `react`/`react-dom` ^18 or ^19, `@ark-ui/react`, `framer-motion`,
  `lucide-react`), `pdfjs-dist`, and an Ivory-owned AI SDK provider adapter for ADR-002's provider
  registry are absent from `package-lock.json` today, so `packages` (§4) correctly does not list
  them — an uninstalled dependency isn't yet a dependency. But recording *nothing* about them risks
  two failure modes when they do land: the add slips in without a `packages` entry, or someone
  mistakes an unrelated existing package for the real thing. On that second risk: `package-lock.json`
  already contains `@ai-sdk/anthropic`, `@ai-sdk/gateway`, and related packages, and `cytoscape` —
  but tracing `package-lock.json`'s dependency graph shows both are pulled in solely by upstream
  Theia's own `packages/ai-vercel-ai` (its built-in AI Chat feature) and by `mermaid` respectively,
  not by any `@ivory-tower/*` package. Neither is evidence that Ivory Tower's own ADR-002 provider
  registry or a future claim-evidence graph view has started. Whoever adds the real, Ivory-owned
  dependency should add its `packages` (§4) entry at the same time, not after.

## 14. Session 03 addendum 2 — the module-boundary gate had the same gap this document closed elsewhere

A **third** execution against this branch's Session 03 objective hit the same collision described
in §13, one step later: it fetched `stable`/`claude/session-3-q9tc4o` before starting, found the
branch apparently unmodified from a stale local checkout, and built a second, independent
implementation of the entire IV-19 mechanism before discovering — mid-task, on `git push` — that
this document's mechanism (plus the §13 addendum) was already merged and CI-green. Per the §13
precedent, the duplicate mechanism was discarded rather than reconciled file-by-file: a real merge
(`git merge origin/claude/session-3-q9tc4o -X theirs`) took this branch's version of every
conflicting file, so nothing here changed as a result. `git reset --hard` was not available (blocked
by this environment's permission policy for destructive git operations), which is why a merge
commit records this rather than a clean rebase — the effect is the same: no content from the
discarded duplicate survives except the two findings below.

Both are narrow, previously-unrecorded, and fixed directly (not just recorded) as part of this
addendum:

- **`scripts/check-ivory-boundaries.mjs` (the IV-15 module-boundary gate) never gained a layer for
  `@theia/ivory-identity`.** Every other IV-19 gate in this document was widened to include
  `@theia/ivory-identity` — format, typecheck, lint, dependency policy — but the boundary checker
  is an IV-15 mechanism this document doesn't own, and it was missed. `packages/ivory-identity/src`
  imports only its own relative modules and Node's built-in `crypto` (verified by inspection: zero
  `@theia/`, `@ivory-tower/`, `pg`, `@aws-sdk/`, `graphile-worker`, or `docling` imports), so a
  layer forbidding all of those was added, along with two negative fixtures in
  `scripts/ivory-boundary-fixtures.json`. `npm run check:ivory-boundaries` was green both before and
  after.
- **`verify:ivory-tower`'s inline `lerna run test` step never picked up the widened
  `@theia/ivory-*` scope.** `typecheck:ivory-tower`, `lint:ivory-tower`, and the standalone
  `test:ivory-tower` script all run `--scope "@ivory-tower/*" --scope "@theia/ivory-*"`, but the
  test step embedded directly inside the `verify:ivory-tower` chain in `package.json` still read
  `--scope "@ivory-tower/*"` alone — so `@theia/ivory-identity`'s tests were exercised by `npm run
  test:ivory-tower` in isolation, but silently skipped by the actual CI gate
  (`.github/workflows/ivory-tower.yml`'s `verify` job, which calls `verify:ivory-tower`). Fixed by
  widening that one inline scope to match its siblings.

Nothing under `configs/`, `scripts/generate-ivory-*`, `scripts/check-ivory-dependency-policy.mjs`,
`scripts/check-ivory-secrets.mjs`, `scripts/ivory-lockfile.mjs`, or the `governance` CI job changed
— the discarded duplicate's version of each was strictly inferior to what's already here, per the
same reasoning as §13. See `docs/sessions/session-03-addendum-2.md` for the full account.
