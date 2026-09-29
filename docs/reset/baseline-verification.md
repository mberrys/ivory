# Clean Theia baseline build record

The `clean-theia-baseline` job in `.github/workflows/ivory-v5-reset.yml` builds the destination commit on its own. It is separate from the isolated experiment tests so that a large upstream Theia build is never misreported as a J1/J2 qualification. The job:

1. checks out the pinned destination commit;
2. records the Node, npm, OS and commit versions;
3. installs the documented Linux native dependencies;
4. runs `npm ci` and `npm run build` with the project's Node 24 toolchain;
5. records the lockfile SHA-256.

Every result below holds only for the GitHub-hosted runner it ran on.

## Records

### 1. Original reset baseline

- **Base:** `mberrys/ivory@b0f9e63a6d331135265869a341dce7c7f1eef158`, tree `5a7d54c71bde0ad5529c70b9d86b2691f612cb5e`. The source is the reset fork's master, not `mberrys/ivory-archive@dev`.
- **Result: passed.** [GitHub Actions run 35935375013](https://github.com/mberrys/ivory/actions/runs/35935375013) on reset head `3189d26fc`, in job "Clean upstream Theia baseline install and build":
  - 3m35s on ubuntu-22.04 with Node 24;
  - `npm ci` added 2,079 packages;
  - `lerna run compile` succeeded for 94 projects;
  - `build:browser`, `build:browser-only` and `build:electron` succeeded.
- The earlier runs 35935333173 and 35935348161 also completed this job successfully. Each failed only its separate `archive-and-boundaries` job; see the ledger.
- This record previously said "pending". That was stale and was corrected on 2026-09-28.

### 2. Retargeted baseline (2026-09-28)

- **Base:** `mberrys/ivory@dev` = `8b94967c4cfa0dcf688a345d28b3ac2e0d7e298a` (the Theia 1.76.0 sync).
- **Why it moved:**
  - Ivory work targets `dev`, and `master` mirrors upstream Theia.
  - The reset branch now merges `dev`.
- The workflow pin moved to this commit.
- **Result: passed.** [GitHub Actions run 36507823752](https://github.com/mberrys/ivory/actions/runs/36507823752) on reset head `0e9e31341`, job "Clean upstream Theia baseline install and build":
  - 5m54s on ubuntu-22.04.5 with Node v24.21.0 and npm 11.19.0;
  - `npm ci` added 2,079 packages;
  - `lerna run compile` succeeded for 94 projects;
  - `build:browser`, `build:browser-only` and `build:electron` succeeded;
  - lockfile SHA-256 `3b777a78cd3e43f4defcd36886d60ce5e22af8683e90a867aac45329a6eaa6cb`.
- In the same run, the separate `archive-and-boundaries` job failed: `mberrys/ivory-archive` returned "Repository not found" at checkout. That is an archive-identity failure, not a baseline failure; see the ledger.
