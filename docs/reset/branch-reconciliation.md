# Ivory archive branch reconciliation (R0, recorded 2026-09-23)

Authoritative plan: https://app.notion.com/p/3e49cb079ddb81ba963be6c91d9a4765

**Destination:** `mberrys/ivory@master` `b0f9e63a6d331135265869a341dce7c7f1eef158`; working branch `integration/ivory-v5-reset-archive`. **Source:** `mberrys/ivory-archive@dev` `bfcb283c4fe32b64b67a325f8f55aca08314296f`, tree `342bc5aa40db06792230409dd37e640f5d778c4a`. Archive master is the clean Theia baseline, *not* the experimental implementation line. Do not merge it wholesale. SHA pins are historical inputs; branch names are not read-time selectors.

## Ancestry and unresolved work

| Archive ref | Pinned head | Relative to dev | Ahead / behind | Interpretation |
|---|---|---|---:|---|
| `dev` | `bfcb283c4fe32b64b67a325f8f55aca08314296f` | selected | 0 / 0 | Primary implementation/evidence source |
| `closeout/n1-n7` | `b3bf537763b2cbb853a866cfe666a6e573e2ea71` | ancestor | 0 / 184 | Reachable on dev (does not prove equal content at old head) |
| `feat/v41-p02-fragment-context` | `bce1896d4dac8e3c8bd0e5a85e235b03c2d9e9b3` | ancestor | 0 / 199 | Reachable on dev (does not prove equal content at old head) |
| `pre-dev-foundation` | `fa4647774273eced81f553f8ef7c5e3d96837b28` | ancestor | 0 / 3 | Reachable on dev (does not prove equal content at old head) |
| `cursor-fix-authority-reachability-80e7` | `0d016ced08c38b8f1fa36fe34c2c6e8480ece359` | ancestor | 0 / 1 | Reachable on dev (does not prove equal content at old head) |
| `unstable` | `7c303b1836421183d7013f0bd679a9a30ff0b5dc` | ancestor | 0 / 440 | Reachable on dev (does not prove equal content at old head) |
| `N5-architecture-proof` | `91fe5341ff2d8f3789e636a8bb6fc5d86b547e8c` | diverged | 11 / 408 | Branch-only work requires line-by-line disposition |
| `cursor-n7-proposal-integrity-aeda` | `0aa03e29fbd9b0750de7d0f6400832a9a98889a8` | diverged | 2 / 429 | Branch-only work requires line-by-line disposition |
| `v2-n1-experiment` | `e93f6333bd8e9c6253fbd33a45870b6e7416df24` | diverged | 1 / 434 | Branch-only work requires line-by-line disposition |

## Distinct relevant blobs not equal to dev

### `N5-architecture-proof` (48 candidate differences)

- `.github/workflows/ivory-tower.yml` @ `dda6b61d6c465cf51c68402d455e3b2b436aca36` vs dev `daa1c9ec7cc3cf9350d16c970db34ebc60b98ec4`. **R1 status:** unresolved; do not import code on branch name alone.
- `examples/ivory-n5-browser/extensions.lock.json` @ `11cb98c057edfe6ee43cc364fef07da4c91ece59` vs dev `b2a14e8351978661d572e7ff5788b8ae5a6c4119`. **R1 status:** unresolved; do not import code on branch name alone.
- `examples/ivory-n5-browser/package.json` @ `76df357d34a301e2f06f3df3037bd156c36018a5` vs dev `82cc231c064bdc2b306534bc1b0a45fc7247b85d`. **R1 status:** unresolved; do not import code on branch name alone.
- `examples/ivory-tower-browser/package.json` @ `9deab9dcc4ba18056b712fcb0e530df9c86672e9` vs dev `d83d6c0ae8846cc18aa85b9ebef4d880c6ee60fb`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-identity/package.json` @ `abcaa1359c9d1147e44bc6bb2286068b8243d1db` vs dev `81cfcdc3235864762fc8f4212432dde2ebdd88ba`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-n5-client/src/client.cjs` @ `6b34df4db736147672494064ee8c065cacad81fd` vs dev `b0a4e23818500dfaa7cbd4956a1c22ad53f02ff4`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-n5-client/test/client.test.cjs` @ `6478a1418de890a75a412cd67d009dbd958849ad` vs dev `fcf57ed8c7bb4175ab1ff3bb8f351e59484e5a6e`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-n5-shell/package.json` @ `ab81dd17952df845f9c674424b7b1369e7f39a8a` vs dev `9ca49d1a54c43fcd83c57ce84960a39b1c682a49`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-n5-shell/src/node/module.ts` @ `40245a996893600e32406727199cf0c438743675` vs dev `37b41858cd50b7e16795db7fa65d785a1f4c2289`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-adapters/package.json` @ `0a90113e68093f8388f8e97a56798098be188e78` vs dev `c27e75c987cfd83429470aaa307775e45224bc15`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-adapters/src/execution-ports.ts` @ `44071411cf23c63c09f51d8439e5e48cb2f841b4` vs dev `d9159cfc13aa6ccb8741bdfc7f5ce33d43f4c378`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-adapters/src/index.ts` @ `dc2fdfdf1dc4d68a0a2f2edf0c4695a5e639674e` vs dev `9dda4152a4b5d93f7ae069b66e51d0b33bce7176`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-api/package.json` @ `c50974c533b21663b3e87a0e6f79673e71ca091a` vs dev `f2c60629f94813c078432dfd59fb18afe4618107`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-api/src/api-server.ts` @ `11ce502e8ca2a76348212ffb0bf91b9e1a48877e` vs dev `615dd81a0ffd51278af2248ec3e91deb6b9696f5`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-api/src/package.spec.ts` @ `21f03fd2fc518c330bbd26db0dee78fe99805dd4` vs dev `e6a859b0a63df49cdab258668e8cea7591d2ce87`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-api/src/start.ts` @ `92812caefc2eacdde309d15a7c118f8ed15dd62e` vs dev `8a748b360b7949647bcc35de205508b160cbf362`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-application/package.json` @ `672eb625fdfa9df4a5d627fd772fa39f1ebfe21d` vs dev `8eaa297c23873bcb9a10b238162d6f893a9f9cd6`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-application/src/index.ts` @ `8c9d934cf6d6a1cf9ae32d6199e63c9c04969e6f` vs dev `be0151b2a8d67c1b3c3884a809c9080f17744907`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-content-policy/package.json` @ `aef77b267771e0ac67318ad34c7bed8b80c0a757` vs dev `030a596be7604c18adac0808125664ab3788a6a1`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-contracts/package.json` @ `e740dac87e8816f2b826f746adbe748c8d9e07d1` vs dev `8aedb131b0a1c2fdbd1fe522b9aa5db3ef753501`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-contracts/src/index.ts` @ `1d77c5656267e56619d35361c32aacfe01b717db` vs dev `394e60051f16f497e0e27ecd4c118f29bd3ad458`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-contracts/src/package.spec.ts` @ `ec7917d8c95572ef470b3f2f7ad8963c415cc30a` vs dev `9055ef246adca91869d3e0d6fc25da0c66fbbecd`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-contracts/src/research-contracts.ts` @ `d1bab8419af4f09dfbf77f65cb6cce6fe673bc68` vs dev `6ffecfb942a294a11b69e80f60cd7d3da03fbd02`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-domain/package.json` @ `d01b08c4f1c6f84cba03263b2fff552b5fa344c5` vs dev `cbb8082d12759befbcb3b1fc4e1f48dc741c2521`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-health/package.json` @ `54a0a59b911bc7ec66624c387200a9795540b7de` vs dev `7eb510ff4424827a7f93ee165b156a230c76e152`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-infrastructure/package.json` @ `21a9be1c2fdd1b6f840bd7a68c01145584c4d4bb` vs dev `2fccd05ca02a7751f5855af5f9d0faf32a29c5c1`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-infrastructure/src/admission-egress-policy.spec.ts` @ `ffb17054fb6489f6081c5ee72b3d9ebfe1cd7758` vs dev `90688ad6d94f6b50483e85e17d08fc6d016155c7`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-infrastructure/src/content-rights-admission-policy.ts` @ `c96e4aec631421a299fd25bb63a7a7501621b86d` vs dev `e3ca69fbf778d66b5be15981792d33a687e30598`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-infrastructure/src/docling-http-conversion-adapter.ts` @ `ff5933f7055d78724c41b3aff88ca1265151c39b` vs dev `5cc5471763fa3ccedaf5a3d0476c3eaac03f7b9e`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-infrastructure/src/environment.ts` @ `7003d6d8470f2d8388a97b10cb12596a7bcad412` vs dev `c315b2a12a8d1d89414bd91bb711aadde1e58e51`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-infrastructure/src/filesystem-object-store.ts` @ `4969b111237ece706f828a2f23b912060067d25b` vs dev `5eb45f1a37093354f6cd4c4b0de4c3b523959902`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-infrastructure/src/in-memory-research-service.ts` @ `921628c5abaea06aa60b8bdb162850aa55e0e101` vs dev `4e0efebae12902ecb1c2ad39483bfa1a4a13dd5f`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-infrastructure/src/index.ts` @ `20007f8a82522ece06271c238c0c4f05c4eaed37` vs dev `6903a2a3efe322f20f2e7e1a182214a6b00fb5a4`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-infrastructure/src/node/migrate.ts` @ `385f57d0b8462b274c4551c48d9ba74e17747524` vs dev `1530454f300f6b1d226b1c279dda616807ca78bb`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-infrastructure/src/package.spec.ts` @ `b98b64b1defd94378b4150ac8f5646cbdab1891b` vs dev `1174e628188b5d90da1fec59dd07ea67057c9860`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-infrastructure/src/s3-object-store.ts` @ `15f0c569ebc0e601703518de12efec28767419ea` vs dev `8230c91545aa43d3cd3cd65ce28314cded8aa50e`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-infrastructure/src/schema-readiness.ts` @ `51e68d5cd6783c0edc91238281f57b37ec3f21d5` vs dev `1786bb1c725b98a2f7de801fa36605ad79638641`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-infrastructure/src/sentry.ts` @ `67d15ddd18d0aa9d61aaf3cfe65d83d450d436bf` vs dev `c5014430f7ac2f7ae55d0c783df29be7df2404cd`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-infrastructure/tsconfig.json` @ `7b339356e16f8330982d52f4e726cba9fc54bf2c` vs dev `dd26861ec899c40447cb396e01aeb545a4d1a583`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-worker/package.json` @ `cf0bd98ed4549efadc525793e3d9e6c068cd3ae4` vs dev `b849bf2c4aba029d528fc922a1b7461e718c9f5a`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-worker/src/runtime-handlers.ts` @ `2cee11fc0a1ee10e3bf9d441e4567aecbd8600e2` vs dev `f356661c4a4bac24f7594a540c47e66080a34825`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-worker/src/start.ts` @ `db8e69afb97519c981e8ea04581974d88850c5ec` vs dev `d349ca23d513bacb0d9389d06b0d11c1803092c4`. **R1 status:** unresolved; do not import code on branch name alone.
- `scripts/ivory/v1-cutline.spec.mjs` @ `9b65eef31bbff715fe8f9700e15d09152e0c18c6` vs dev `d8b2eeb2ad321085ab540e4f773a08e9efe897a9`. **R1 status:** unresolved; do not import code on branch name alone.
- `scripts/n5/check-boundaries.mjs` @ `9d2f0064eeb14d7d59e6eb629f025600d6e55e41` vs dev `75d32bade8017995061360f3bb12a78f6cd2820a`. **R1 status:** unresolved; do not import code on branch name alone.
- `scripts/n5/compare.mjs` @ `e51ff406bbb6d41d3df1fb373174929b369813cf` vs dev `0eabf36daa6cc43dd45d2c398e96415e9bdcbf65`. **R1 status:** unresolved; do not import code on branch name alone.
- `scripts/n5/compare.test.mjs` @ `3df6b441aad708b5679c78e36e84d048ea715577` vs dev `43a3e23e1969391ec73634547abbff2320291e0a`. **R1 status:** unresolved; do not import code on branch name alone.
- `scripts/n5/evidence.mjs` @ `af3e78e4f296c45cb0fde5f463fcf3fd802233eb` vs dev `69240cac378e73fee3db24ac33d4874e5d15212a`. **R1 status:** unresolved; do not import code on branch name alone.
- `scripts/n5/v2-contract.test.mjs` @ `a356b9400dad92cbd4a40745d81ccfc874e1cb5a` (absent on dev). **R1 status:** unresolved; do not import code on branch name alone.

### `cursor-n7-proposal-integrity-aeda` (4 candidate differences)

- `docs/experiments/n7-scoped-agent-proposals.md` @ `bf614cf72e81ed1be794046a023140a02945be6d` vs dev `b6f55242cde1c82fb2eef1df2bd539331065d392`. **R1 status:** unresolved; do not import code on branch name alone.
- `docs/experiments/n7-v1-evidence.json` @ `fc75a7881627efb83e8c26c87d98b495de75724e` vs dev `c32fb97e3ab6444ebd074a28482685a86c012d73`. **R1 status:** unresolved; do not import code on branch name alone.
- `scripts/ivory/n7-evidence.spec.mjs` @ `aef0ec5c3b74f690fd3ca2be54fda1b755f29400` vs dev `47c96aff602beb729297e4b21ffa86dc52004deb`. **R1 status:** unresolved; do not import code on branch name alone.
- `scripts/ivory/n7-retain.mjs` @ `30d8a00c40635dd561d8eb5c7350b49ae4c6b18e` vs dev `fd8fd01417e6cbe6fc8cc699d5765b08b6c40a75`. **R1 status:** unresolved; do not import code on branch name alone.

### `v2-n1-experiment` (20 candidate differences)

- `docs/experiments/n1-v2-evidence.json` @ `b7fe588962015adbef03f88f4b606811c7d02f47` vs dev `3c5c2d2a77da4e2922d900200c71e5f9826cd976`. **R1 status:** unresolved; do not import code on branch name alone.
- `docs/experiments/n1-v2-reference-kernel.md` @ `6f450c778459d4b4f6f559ff5eeff605b5361592` vs dev `edb587f276d3b83b0cf8908eed1a634e8daf56ad`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-identity/src/common/canonical-preimage.spec.ts` @ `b8a0ae94f9e8e31b69f2b8e81b1591318d8b211f` vs dev `7c1ba6cb8bd36f78bcab3c14ede09d8d3d97a4e7`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-identity/src/common/canonical-preimage.ts` @ `6fc11de50e45d3d301a1a78fa137bb0f12a24caf` vs dev `903ec5bd934920ec6d2e403e5ba1d48464423054`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-identity/src/common/identifier-alias.spec.ts` @ `c4f9995d06a6ff9bc326489c7bc21c965161cbb1` vs dev `b27af0b2ccc5f6b0217bc621296fe7a8469354c6`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-identity/src/common/identifier-alias.ts` @ `4c0705f0de23d04d03d439be46b5f53529055c3a` vs dev `bbcc7bac18586c922c24cdb1de8b942c2de76d4e`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-identity/src/common/identifier.spec.ts` @ `87b681d2b7553b6d5f4a85fe7b417fbd2d86ae90` vs dev `306ee56c108d109ef32c1cad6038ebe91fae14ca`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-identity/src/common/identifier.ts` @ `eba44d4072881213a489906fe5d9bbf4b43197a0` vs dev `0c226766ad6d46ec568bb39b2b9b151aff073841`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-identity/src/common/identity-scheme.ts` @ `44ab3f3fed9dc64ac810e58aff8a6d4d01be138d` vs dev `cbc39829511433c89f03b530c23c0a55d3b5bc5a`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-identity/src/common/passage-anchor.ts` @ `188779eebc8c2349570b7f02dfba2440aabaf8df` vs dev `0fd1eff1b8cd4c1dcca65018146a7a03e12d7b10`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-identity/src/node/digest.ts` @ `55026a2a0bdaab84dec1fc3242bc740dd6a5e84f` vs dev `a22aee4c8823151960d9e55a3045957cbeda79fd`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-identity/src/node/identity-boundaries.spec.ts` @ `d24d26b4a8e52a34cb8d581ab1be7ee39f6e04a1` vs dev `73c0acc8280f50c5430dfc4b4dd7ebc1f69dbb14`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-identity/src/node/identity.spec.ts` @ `c4b9eb2bdfd376de3a1ee71e727e58180c97e787` vs dev `0655c89745e9312df5611254e96c56bb450460d0`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-identity/src/node/identity.ts` @ `3cb334107431f50db3b4ae266faf7354e8758542` vs dev `97a020668cdc6d4415ae8aabd3e71f213539b08e`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-identity/src/node/test/identity-fixtures.ts` @ `b77466cf2bdcb0dac825e0a581a1713041cbadde` vs dev `6bd056e74b9bfa211848a6a6b6816fa2f9935b4e`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-research-kernel/src/node/clients.ts` @ `debd8446a58070faa511fd53113931875e91bc63` vs dev `6e4e362eefd7f66eeba69247e1c9237d13e74c1d`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-research-kernel/src/node/kernel.ts` @ `62ddcc0dfb164d0d6c9697c34b23218fdc71ccad` vs dev `472da41440b220263d617de39df32db1c687871b`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-research-kernel/src/node/research-kernel.spec.ts` @ `fb48c0a5a6f30c8fc86b234bbd4899d8c0c7aae4` vs dev `f7eee3783b444b1df437905f3e57e9d2c28104b3`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-research-kernel/src/node/types.ts` @ `81ce691ba33b53e0eff03b2d2f1e13e199e7731f` vs dev `60a89bd1ded956bb48398de826e1d7d2be15f2c2`. **R1 status:** unresolved; do not import code on branch name alone.
- `packages/ivory-tower-research-kernel/tsconfig.json` @ `e0c9d25629c3e030077ded053fb87ac2cb966a6d` vs dev `2a8b393b9bfce5899b68e39959b90b71299cc8b8`. **R1 status:** unresolved; do not import code on branch name alone.

## Source families

- `.github`: 1 pinned blobs; initial disposition reference pending R1.
- `docs`: 44 pinned blobs; initial disposition reference pending R1.
- `docs/experiments`: 36 pinned blobs; initial disposition reference pending R1.
- `examples/ivory-n5-browser`: 12 pinned blobs; initial disposition reference pending R1.
- `examples/ivory-tower-browser`: 7 pinned blobs; initial disposition reference pending R1.
- `packages/ivory-identity`: 19 pinned blobs; initial disposition reference pending R1.
- `packages/ivory-n5-client`: 8 pinned blobs; initial disposition reference pending R1.
- `packages/ivory-n5-shell`: 8 pinned blobs; initial disposition reference pending R1.
- `packages/ivory-tower-adapters`: 9 pinned blobs; initial disposition reference pending R1.
- `packages/ivory-tower-agent-experiment`: 6 pinned blobs; initial disposition reference pending R1.
- `packages/ivory-tower-api`: 9 pinned blobs; initial disposition reference pending R1.
- `packages/ivory-tower-application`: 10 pinned blobs; initial disposition reference pending R1.
- `packages/ivory-tower-content-policy`: 9 pinned blobs; initial disposition reference pending R1.
- `packages/ivory-tower-contracts`: 13 pinned blobs; initial disposition reference pending R1.
- `packages/ivory-tower-domain`: 7 pinned blobs; initial disposition reference pending R1.
- `packages/ivory-tower-health`: 8 pinned blobs; initial disposition reference pending R1.
- `packages/ivory-tower-infrastructure`: 42 pinned blobs; initial disposition reference pending R1.
- `packages/ivory-tower-research-kernel`: 13 pinned blobs; initial disposition reference pending R1.
- `packages/ivory-tower-worker`: 9 pinned blobs; initial disposition reference pending R1.
- `scripts/ivory`: 36 pinned blobs; initial disposition reference pending R1.
- `scripts/n5`: 9 pinned blobs; initial disposition reference pending R1.
- `scripts/n7`: 11 pinned blobs; initial disposition reference pending R1.
- `spikes/n2-durable-store`: 30 pinned blobs; initial disposition reference pending R1.
- `spikes/n6-portable-reproduction`: 15 pinned blobs; initial disposition reference pending R1.

## Non-Ivory fork drift

294 non-Ivory paths differ from the reset baseline at the archived dev head (added, removed or changed in archive view; compare with baseline and file headers before making any fork patch). The exact per-path SHA map is in `archive-source-manifest.json`; it is not automatically selected for V5. The upstream license texts and notices in the destination are preserved. No archived lockfile, plugin host, hosted stack or generated asset is imported by this record.

## Qualification rule

A historical blob SHA is a provenance pointer, **not** a fresh test pass. Keep original N1–N7 records read-only at their archived URLs and retain negative fixtures in scope. N5 diverged (11 commits); N7 diverged (2); N1 diverged (1). The old N2 PGlite experiment and the old hosted Postgres application do not by themselves settle the V5 deployment choice. R0 baseline install/build and R1 line-item decisions remain open until independently verified and retained.
