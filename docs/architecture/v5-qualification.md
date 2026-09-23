# Ivory V5 reset qualification ledger (not a release qualification)

Captured on 2026-09-23. [Reset plan](https://app.notion.com/p/3e49cb079ddb81ba963be6c91d9a4765). The branch currently contains read-only archive references and an isolated rules-only typed decision seam. It does **not** contain an accepted V5 architecture, persistent Core or deployable Ivory product.

| Gate | Current evidence | Decision |
|---|---|---|
| R0 identity and archive inventory | 335 selected-dev blobs, other archive head/tip and branch-only reconciliation; [GitHub Actions run 35935099633](https://github.com/mberrys/ivory/actions/runs/35935099633) verified the 335 source blobs | Verified for pinned archive dev source only; no claim that alternate branch code is ported |
| R0 clean baseline | Dedicated GitHub Actions job checks out `b0f9e63a6d331135265869a341dce7c7f1eef158` for npm ci/build at Node 24, Ubuntu 22.04 | Pending observable build result; upstream baseline is separate from integration branch |
| R1 archive disposition | Provisional disposition on every relevant archive-dev path: reference 195 / rewrite 131 / reject 9; ten history artifacts imported verbatim | License checks and destination implementation-by-implementation proof remain open |
| N1 exact identity | Original N1 evidence + ADR-004 pinned; separate J2-like synthetic context fixture | Historical reference; no V5 Core/persistence integration |
| N2 durability | ADR-005 and exact N2 records pinned in source manifest | Historical local Windows/PGlite envelope only; SQL crash/recovery untested for V5 |
| N3 governed compute | Exact archived N3 record | Historical Windows 11 Docker Desktop OCI envelope; no V5 worker |
| N4 exact fragments | Original N4 record | Converter versions had identical Markdown; genuine changed-representation proof open |
| N5 client parity | Archived and diverged N5 branches reconciled | Historical in-memory fixture; V5 Theia/CLI parity open |
| N6 reproduction | Archived N6 records | Same-machine restore only; independent-machine qualification open |
| N7 agent boundary | Archived and diverged N7 branch records reconciled | Historical scope; durable acceptance and broad provider proof open |
| J1 | Six preregistered **synthetic** labels, deterministic rules control; test assertions | Experiment fixture passes in isolated CI; no independently measured utility/calibration |
| J2 | Snapshot A/B fixture and exact-ref/digest negative tests | Boundary fixture passes in isolated CI; full N1 composed historical immutable store proof open |
| J3–J9 | Preregistered scenarios in `docs/reset/experiment-plan.md` | Not run; J3 projection safety test is a preflight, not full J3 |
| Four architect + four interrogate runs | Not launched; no qualifying independent outputs | Hard architecture decision gate open |
| Full V5 product | No archived runtime code promoted; no persistent Core | Not implemented/qualified |

**Release predicate:** not met. Do not file an ADR declaring V5 selected or present CI fixture pass as full J1/J2. The full final architecture sketch, information design, contracts, negative paths, proof and remaining risk dossier depend on the architecture and composed experiment gates, as the plan requires.
