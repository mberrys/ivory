# Clean Theia baseline build record

Exact base: `mberrys/ivory@b0f9e63a6d331135265869a341dce7c7f1eef158`. Tree: `5a7d54c71bde0ad5529c70b9d86b2691f612cb5e`. Source is reset-fork master, **not** `mberrys/ivory-archive@dev`.

The `clean-theia-baseline` job in `.github/workflows/ivory-v5-reset.yml` checks out that exact commit independently, records Node/npm/OS/SHA, installs the documented Linux native dependencies, runs `npm ci` and `npm run build` with the project's declared Node 24 toolchain, then records the lockfile SHA-256. The job is intentionally separate from isolated experiment tests so a large upstream Theia build cannot be misreported as a J1/J2 qualification.

**Result:** pending GitHub Actions execution for this job; do not mark R0 baseline-build passed until its named job finishes successfully. Environment claim is limited to the runner. Any build failure should be retained with its concrete exit code/logs, not silently attributed to the reset changes.
