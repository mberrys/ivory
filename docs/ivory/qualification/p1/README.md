# P1 archive and package boundary evidence

[Issue #2](https://github.com/mberrys/ivory-issues/issues/2) is implemented at `96f3654850c06c0b7333cf4684c0f4e3012054de`. The later evidence commit adds these records and documentation to the same PR. It changes no checked implementation, policy, or source register.

[GitHub Actions run 37850613890](https://github.com/mberrys/ivory/actions/runs/37850613890) passed both jobs on 2026-10-08. Its workflow definition was evaluated at the PR merge snapshot `f86d73f4e17d157a3690ec6775dc792e9344e960`, while the checks explicitly checked out the implementation head above. Each record preserves that distinction.

| Record | Observed result | Claim |
| --- | --- | --- |
| [linux-ci/archive-selection.json](linux-ci/archive-selection.json) | 10 head trees, 407 candidate blobs, 294 excluded changes, five license/notice blobs, and nine refusal tests passed. | Source selection and license disposition for this selection, with zero admitted archive runtime copies. |
| [linux-ci/package-boundaries.json](linux-ci/package-boundaries.json) | Three current Ivory packages and 3,761 source files passed the declarations, installed graph, literal imports, byte-copy check, and upstream fence. The checkout was clean. | Static package boundaries at the implementation SHA. |
| [windows-local/package-boundaries.json](windows-local/package-boundaries.json) | The same boundary check and fixture digests passed locally with a clean checkout. | The static check also runs on Windows. |
| [linux-ci/clean-baseline.json](linux-ci/clean-baseline.json) | `npm ci`, compilation of 94 projects, browser, browser-only, and Electron bundles passed. Post-build Git status was clean and the lockfile digest matched. | A clean build of upstream Theia at `8b94967c4cfa0dcf688a345d28b3ac2e0d7e298a`, on this Linux runner. |
| [linux-ci/hosted-result.json](linux-ci/hosted-result.json) | Both jobs and their required steps completed successfully. | The completed GitHub run and step identities. |

The Linux runner used Ubuntu 22.04.5, image `20261004.315.1`, Node v24.21.0, npm 11.19.0, Python 3.13.16, and x64. The baseline record retains the observed filesystem label, `ext2/ext3`, from `stat -f`, without inferring a more specific filesystem. The local Windows check used OS build `10.0.26300`, Node v24.16.0, TypeScript 5.9.3, and x64.

The registry and policy fixture digests cover UTF-8 text with CRLF normalized to LF. Archive source digests cover exact Git blob bytes. The source-manifest digest refers to its pinned blob, not the Windows checkout's line endings.

The raw baseline log names in `clean-baseline.json` are preserved here as `.log.gz` files. Decompressing them produces the bytes whose SHA-256 values are in that record:

- [p1-baseline-install.log.gz](linux-ci/p1-baseline-install.log.gz)
- [p1-baseline-build.log.gz](linux-ci/p1-baseline-build.log.gz)
- [archive-boundaries.log.gz](linux-ci/archive-boundaries.log.gz), the GitHub CLI job-log transcription used by the archive-selection record.

The `p1-clean-baseline` and `p1-package-boundaries` artifacts remain on the run for 90 days. The records and compressed logs above remain in Git. All retained log digests were checked after decompression.

The baseline build is a separate upstream checkout. It does not prove a build or runtime of the V5 product. These records do not pass durability, client parity, composed research, dependency-transitive licensing, future source ports, or release gates. The historical N1/N5/N7 evidence keeps its original claim limits.
