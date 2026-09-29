# Ivory V5 qualification ledger

**Status (2026-09-28):**
- The V5.0 architecture baseline is accepted: [ADR-009](adr-009-v5-topology.md) and [ADR-010](adr-010-v5-typed-decision-seam.md).
- The V5.0 **release predicate is not met.**
- No Core slice exists yet.

**Decision page:** [Ivory V5.0 Architecture](https://app.notion.com/p/3e99cb079ddb8105aaabfa282dcda257). **Reset plan:** [Notion](https://app.notion.com/p/3e49cb079ddb81ba963be6c91d9a4765).

**Branches:** this branch now merges `dev@8b94967c4`. Ivory PRs target `dev`; `master` mirrors upstream Theia.

**Rules for this ledger:**
- A gate passes only with a retained record: head, command, environment, fixture digests, outcome and limits.
- Historical N-records and CI runs of isolated fixtures are references, not V5 passes.
- An ADR is a design decision, not a test result.

## Reset gates

| Gate | Evidence | State |
|---|---|---|
| R0 archive identity | [Run 35935099633](https://github.com/mberrys/ivory/actions/runs/35935099633) verified 335 pinned archive-dev source blobs on 2026-09-23. Since 2026-09-29, `mberrys/ivory-archive` returns 404 ([run 36507823752](https://github.com/mberrys/ivory/actions/runs/36507823752) fails at checkout) | Historical pass only. **Cannot be re-verified** until the owner restores or re-homes the archive |
| R0 clean baseline (`b0f9e63a6`) | [Run 35935375013](https://github.com/mberrys/ivory/actions/runs/35935375013): `npm ci`, compile of 94 projects, browser, browser-only and electron bundles; Ubuntu 22.04, Node 24 | **Passed** on the runner (`baseline-verification.md` §1) |
| R0 clean baseline (`dev@8b94967c4`) | [Run 36507823752](https://github.com/mberrys/ivory/actions/runs/36507823752): `npm ci`, compile of 94 projects, browser, browser-only and electron bundles; Ubuntu 22.04.5, Node 24.21.0 | **Passed** on the runner (`baseline-verification.md` §2) |
| R1 archive disposition | Provisional path-level disposition (`docs/reset/integration-disposition.md`); ADR-009 decides the per-package outcomes | License checks and per-port proof remain open, per slice |
| Four-way architecture arena | Four independent candidates (A record-centered, B receipt ledger, C no classifier, D embedded library), recorded on the decision page | **Done** 2026-09-27 |
| Four-way interrogation | Four independent reviews: 51 findings (5 critical, 34 major, 12 minor), with an agreement map and dispositions | **Done** 2026-09-28; baseline revised; no material rearchitecture |

## N1–N7 carry-forward

| Lesson | V5 carrier | Proof slice | State |
|---|---|---|---|
| N1 exact identity, closure, attribution | `@ivory/contracts` (ExactRef, closure); content-addressed revisions; `claim-basis@1`; `origin` | 3 | Contracts exist on `feat/ivory-contracts`; composed proof not run |
| N2 CAS then SQL, idempotency, recovery | ADR-009 §4, leases, migration sentinel | 1, 2 | Not run on SQLite; the PGlite/Windows envelope is a historical reference |
| N3 governed compute | RunSpec, capability report, tmpfs output, attempt fence and lease | 6 | Not run; historical envelope is Windows 11 + Docker Desktop |
| N4 exact fragments, honest remap | Exactly-one resolution, context findings, `displayable`, remap query | 4 | Not run; heterogeneous-converter remap unproven |
| N5 replaceable clients | One library, catalog facade, frontend digest parity, version labels | 8 | Not run |
| N6 capsule honesty | Project-format capsule, attestations, verdict, chain anchor, Python verifier | 9 | Not run; independent-machine reproduction `not-claimed` |
| N7 proposal-only agents, human acceptance | AgentSession, reserve-then-serve, attestation, `origin.adopted`, TTY gate, listener hardening | 7, 8 | Not run; live-provider qualification open |

## J1–J9, re-scoped by ADR-009 and ADR-010

| ID | V5.0 role | State |
|---|---|---|
| J1 domain fit | Closed negative for routing and gating; the seam is omitted | Evidence: runs 35945776462, 35946966485, 35947960101, 35949038033 (experiment branch) |
| J2 snapshot invariance | Required: statement-rooted freeze; a link added after the freeze must stay out; the live card equals the capsule card | Isolated fixture only (`experiments/jev-seam`); composed proof not run |
| J3 disclosure minimization | Required, re-scoped to MCP reserve-then-serve, effective rights and served bytes | Not run |
| J4 calibration | Not a V5.0 gate; it is the ADR-010 re-entry predicate | 0 independent votes |
| J5 citation vs support | Required, with no model: exact non-entailing quote, waiver laundering, misquote, unadjudicated challenge | Not run |
| J6 containment | Required, plus shell-agent CLI, RPC without the launch secret, filesystem service, DNS-rebinding Host | Not run (48/48 isolated seam tests are history) |
| J7 durability | Required: ordering kill harness **with a `synchronous=OFF` control**, migration window, lease re-adoption, Windows file semantics; power loss not claimed | Not run. Interrogation probes lost 0 of 420,687 commits even with OFF, so the harness alone cannot discriminate |
| J8 end to end | Required, reduced: one synthetic protocol, no discovery, no model, plus one scripted-agent variant | Not run |
| J9 replaceability | Required, reframed: no-model completeness, two-client parity across versions, re-entry through a fixture `score-table/1` with no schema change | Not run |

## Slices (one owned slice per PR against `dev`)

0. **Housekeeping.** Retarget to `dev`, correct R0, file ADR-009 and ADR-010, merge `@ivory/contracts`.
1. **Store-host bake-off.**
   - Worker-thread store, synchronous `commit()`, leases, Windows CAS semantics.
   - Kill harness plus its `synchronous=OFF` control.
   - Exit criteria: event-loop p99 under 100 ms under contention; no phantom `seq`; `recover` never kills a live lease.
   - On failure: take the ADR-009 fallback, then run a fresh four-way interrogation.
2. **Migration and version fences.** Sentinel, `backup()`, build stamps, restore instance ids, `.partial` exports.
3. **Identity (N1/J2).** Records, `AuthorOf`, `claim-basis@1`, the golden trace (12/17 members), source dedup by bytes.
4. **Fragments (N4).** Exactly-one resolution, context findings and waiver, display fidelity (BOM, EOL, invalid UTF-8, duplicate quote), remap.
5. **Decisions (J5).** DecisionKey, currency, atomic narrowing, the `releasePredicate@1` fixture table, the presentation basis fence, attestation, verdict receipts.
6. **Compute (N3).** R and Python images, tmpfs output, lstat admission, caps, re-adoption.
7. **Agents (N7/J6/J3).** `ivory mcp`, reserve-then-serve, effective rights, adoption attribution, TTY gate, shell-agent negatives.
8. **Workbench (N5).** Listener hardening, views, catalog facade, frontend digest parity, version skew, Playwright.
9. **Capsule (N6/J7).** Membership with attestations and verdict, capsule verify profile, Python verifier, loss reporting.
10. **Redaction.**
11. **Pilot.** J8 reduced and J9 reframed.

## V5.0 release predicate (merging this branch into `dev`)

**Required.** All of the following, each with a retained record:
- slices 0–11 green;
- J2, J3, J5, J6, J7, J8-reduced and J9-reframed passing;
- documentation that matches the selected head.

**Open and labelled, not blocking:**
- power-loss durability;
- independent-machine reproduction;
- live-provider agents;
- calibration and seam re-entry;
- heterogeneous-converter remap;
- the hosted profile.
