# V5 research contract: `ivory-research@1`

[P2](https://github.com/mberrys/ivory-issues/issues/3) defines the identity and domain contract consumed by Core and its clients. It implements ADR-004 as amended by [ADR-009](adr-009-v5-topology.md), the [decision package](v5-decision-package.md) §§4–5, and [ADR-010](adr-010-v5-typed-decision-seam.md). The implementation lives in `@ivory/contracts`; it has no storage, Theia, model or authentication dependency.

## Identity and ownership

`ExactRef` has exactly `{ projectId, objectId, revisionId }`. A typed `Ref<K>` adds only a compile-time brand. `ResearchGraph.ref` checks the retained target's kind; an object id alone, a navigation selector and `latest` are never exact refs.

Every revision has a kind-specific `schema` (`source@1`, `statement@1`, etc.) and these nine identity fields:

```text
revisionId = canonicalDigest({ projectId, kind, schema, objectId, parent,
                              author, initiatedBy, origin, body })
```

`canonicalDigest` is SHA-256 over the UTF-8 bytes of RFC 8785 canonical JSON, spelled `sha256:` plus 64 lowercase hex digits. `parent` is an exact ref or the literal `none`. Commit sequence is supplied by Core outside the preimage. Byte blobs use `blobDigest(bytes)`, not a canonical JSON digest of a string.

`parseRevisionPreimage` rejects unknown fields, unsupported schemas, non-I-JSON data and invalid authors. `createRevision` returns a deep-frozen copy; `parseRevision` also checks the supplied revision digest. Existing revisions are never rewritten. A preimage or body-format change requires a new schema; readers refuse unsupported schemas rather than migrate a body in place. The architecture's three-live-schema limit remains a future catalog constraint.

`AuthorOf` is the fixed ownership table. It describes the author of the research *record*, not the creator of imported source bytes or an endorsement of its contents.

| Record kinds | Author | Principal content and semantic dependencies |
| --- | --- | --- |
| `source` | researcher | Name, byte digest, media type, rights and source status. |
| `representation` | Core | Exact source, retained UTF-8 byte digest and converter profile. |
| `artifact` | Core | Exact inputs, output digest and transformation. |
| `fragment` | researcher | Exact representation/artifact, representation digest and UTF-8 byte selector. |
| `codebook` | researcher | Edition and unique code definitions. |
| `annotation` | researcher | Exact fragment, exact codebook edition, code id and rationale. Overlap is allowed. |
| `statement` | researcher | Wording and scope. Recording wording does not accept a claim. |
| `evidence-link` | researcher | Exact statement, cited fragment/annotation/artifact refs, explicit context refs, role and rationale. |
| `protocol` | researcher | Protocol text and exact inputs. |
| `proposal` | agent | Exact basis and a typed statement or EvidenceLink change with an expected head. |
| `mechanical` (`AssessmentBody`) | Core | Exact link and an exact/blocked mechanical finding. |
| `decision` (`AdjudicationBody`) | researcher | A typed support, acceptance, challenge, proposal-adoption, waiver or rights decision, presented basis and attestation. |
| `snapshot` | researcher | Exact statement selection, sequence fence, explicit basis, closure count and manifest digest. |
| `receipt` | Core | Request digest, command and exact refs written in the same commit. These are activity dependencies. |

Assessment and adjudication use the approved `mechanical` and `decision` wire kinds. There is no evaluator principal or model-advice record under ADR-010. Agent proposals retain their agent as author and initiator. Researcher-owned records require a researcher initiator. These checks constrain record ownership; later authenticated Core sessions must prove who the principals are.

`origin` distinguishes direct authorship, researcher adoption of an agent draft, and explicit EvidenceLink carry-forward. Adoption keeps the proposal, adopting decision, drafter and whether the body was edited. The adopted revision's author matches the adopting researcher, and its parent matches the proposal's expected head. Proposal/adoption references describe activity rather than adding research members to closure.

## Accepted history and exact citation

`validateRevisionTransition` requires both `expectedHead` and `parent` to equal the current exact head. A new object requires `none` for both. `readResearchGraph` validates the supplied accepted history: one linear history per object, no kind changes, no duplicate acceptance, no future semantic inputs and no two DecisionKey heads in one commit. It resolves every semantic dependency, including unselected records. Annotation codes must exist in their exact codebook edition.

The graph is a read-only validation view over Core-supplied `{ seq, revision }` records. It has no mutation or acceptance command. Core's transaction, authorization, head tables and idempotency enforcement belong to the later implementation slices.

Fragments select a non-empty retained UTF-8 byte span (`utf8-bytes@1`). `verifyFragment` checks the exact representation digest, the supplied bytes' digest, UTF-8 validity and code point boundaries, and exact equality between the quote and selected bytes. It preserves BOMs, line endings and Unicode bytes; it does not normalize or remap. Graph validation without blob bytes checks shape and references; Core must call the byte verifier before making a mechanical exact finding. A finding alone is never a semantic support judgment.

A source correction writes a new revision. Existing representations, fragments and EvidenceLinks keep their original exact refs. A statement correction similarly leaves old links attached to the old wording. `carryForwardEvidenceLink` constructs a new link revision only when explicitly requested; graph validation requires a later revision of the same statement, unchanged cited/context refs, role and rationale, and the original link author. `initiatedBy` records the researcher who carried it. Carry-forward origin is an activity edge and does not pull the old link or statement into semantic closure.

## Snapshot rule: `claim-basis@1`

`claimBasis({ graph, selected, asOfSeq })` selects at least one exact statement revision. At the recorded fence it materializes:

1. Each selected statement.
2. The accepted head of each incoming EvidenceLink naming that exact statement revision.
3. Each link's mechanical finding head.
4. The current head of every DecisionKey on the statement or those link objects.

DecisionKey is `(question, subject objectId, discriminator)`, with the challenge object id as the challenge-adoption discriminator. A decision's currency still depends on its *exact* subject revision. A stale decision stays visible in the basis so later release rules can report it. Its forward dependencies can therefore include old evidence; this is an explicit semantic dependency, not an implicit link carry-forward or traversal of history.

Forward `semanticClosure` runs from every basis member. References are deduplicated and sorted by `ExactRef.compare`. Activity backlinks, receipts, predecessor chains, newer source heads and post-freeze links do not enter through navigation. Claim-acceptance decisions referencing a snapshot are attestations about it and are excluded from basis expansion.

`freezeSnapshotBody` stores the explicit basis and closure count, and hashes the full membership object `{ basisRule, selected, asOfSeq, basis, members }`. `readResearchGraph` recomputes each snapshot at its original fence and refuses a changed basis, count or manifest digest. A snapshot fence must precede its acceptance commit. Reading a future snapshot/capsule card must resolve only these exact members; live/capsule client parity is a later qualification gate.

## Fixtures, evidence and limits

The [N1 fixture input](../../packages/ivory-contracts/test-resources/n1-research-fixture.json) pins the archived fixture commit, source digest and license. The retained transcript, correction, table and interpretation text comes from that fixture. The V5 trace rewrites the archived commands into typed records and replaces manual context selection with statement-only basis expansion. Its first closure contains 12 members; after the codebook/statement revisions and explicit carry-forward, the second contains 17. The imported matrix and competing statement remain retained independently. The corrected source head does not replace an earlier exact citation.

Thirty frozen [revision vectors](../../packages/ivory-contracts/test-resources/research-revision-vectors.json), calculated using Python's canonicalizer, pin the adapted trace's identities. TypeScript replays the trace against those fixed values; Python independently checks the same preimages and identity-sensitive mutations. Python performs identity verification, not domain acceptance.

```text
npx lerna run compile --scope @ivory/contracts
npx lerna run lint,test --scope @ivory/contracts
npm run test:python --workspace @ivory/contracts
node scripts/ivory/verify-research-contracts.mjs --output tmp/p2-contracts/qualification.json
```

The last command requires a clean implementation checkout and a new output path. It writes an immutable common [evidence record](evidence-record.md) and a digested observation ledger. The Ivory contracts workflow runs both language suites and retains this record for its exact PR head. Qualification records are retained under `docs/ivory/qualification/p2/`.

This slice does not qualify persistence, authenticated acceptance, presence attestations, converter or PDF/OCR behavior, contextual citations, capsule import/export, client parity or human interpretation. The initial proposal change union covers statements and EvidenceLinks; later domain commands can add versioned variants. P1 remains a separate dependency; no archived runtime package is imported.
