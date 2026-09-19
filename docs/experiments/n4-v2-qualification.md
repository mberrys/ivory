# N4 V2 qualification record

**Status:** qualified — 22 fixtures, zero false-exact, review queue disposition recorded above.

This is the retained procedure and decision boundary for the N4 experiment described in the
attached V1 implementation plan. The run is deliberately evidence-producing: a green static
check does not become a converter qualification until the live ledger and the retained JSON
record agree.

## Review queue disposition

The retained run classified all 120 anchors as `exact` under both the production remapper and the
independent oracle, so there are zero review-queue entries to dispose of (`reviewQueueSize: 0`).

| observed \ oracle | exact | ambiguous | unresolved |
|---|---|---|---|
| exact | 120 | 0 | 0 |
| ambiguous | 0 | 0 | 0 |
| unresolved | 0 | 0 | 0 |

`falseExact` (matrix `exact→ambiguous` plus `exact→unresolved`) is 0. Two things must be stated
plainly rather than left to inference:

1. The differential's purpose — detecting silent re-anchoring when a representation changes — is
   satisfied for this corpus: the two pinned converter versions produced byte-identical Markdown
   for all 22 fixtures (the A and B `textSha256` values are equal for every fixture), so there was
   no representation change for the remapper and the oracle to disagree about. That identity is
   itself the observed result of Docling v1.21.0 versus v1.22.0 on these documents.
2. The `ambiguous` and `unresolved` branches are exercised by the harness's own tests rather than
   by this live corpus, and the corpus contains no repeated-quotation fixture. That is the
   experiment's declared limitation: a follow-up could add a document with duplicated passages to
   force an ambiguous remap against a changed representation. No disagreement is invented here,
   and the zero false-exact claim stands as an empty off-diagonal, which is a result.

## Exact run

~~~text
npm run verify:ivory-n4-v2
~~~

For a bounded diagnostic rerun, set N4_DOCKER_PULL_TIMEOUT_MS (the default is ten minutes per
image); a timeout is retained as evidence and leaves the qualification NO-GO.

The command compiles the Ivory Tower packages needed by the verifier, invokes both immutable
Docling images against all 22 checked-in fixtures — 18 PDFs, the two CSV fixtures and the two
UTF-8 text fixtures (`fixtures/n4/txt/open-advising-note.txt` and
`fixtures/n4/txt/open-methods-note.txt`) — and retains:

- `artifacts/n4/qualification-ledger.json` — full gitignored observations and raw-response
  digests under `artifacts/n4/raw/`;
- `docs/experiments/n4-v2-evidence.json` — the small versioned evidence record.

The two converter references are fixed to:

- A: `quay.io/docling-project/docling-serve:v1.21.0@sha256:32b3de41f325f93c1dd35907cd9147fa35df9f7c5abc86eb2788b6bda7ce6d10`
- B: `quay.io/docling-project/docling-serve:v1.22.0@sha256:8880b8f5a511b1d93edb22a2e2e7380461657a0401febb4e43f7e41ef9d9661c`

Each fixture is attempted independently by both converters. A successful run selects six
non-empty anchors from the actual A markdown output, persists the A and B representations and
anchor selectors, reopens them from the store, and exercises permitted source-membership
transfer. CSV fixtures are independently parsed into typed cells with raw text, missingness,
and physical source-row identity. Docling JSON output is retained and used only to attach
inspectable PDF page coordinates; no coordinates are invented when the converter does not emit
them.

The production remapper supplies the observed classification. A separate exact-normalized-quote
occurrence oracle supplies the independent classification. The ledger records all three
outcomes (`exact`, `ambiguous`, and `unresolved`) in a 3x3 observed-versus-oracle matrix.
Every disagreement, ambiguous result, and unresolved result enters the review queue. The
false-exact count is:

~~~text
matrix.exact.ambiguous + matrix.exact.unresolved
~~~

## Qualification gate

The retained record may say `qualified` only when all of these are true:

1. all 22 fixtures were attempted against both digest-pinned converter versions;
2. at least 100 anchors came from real A-side extraction text;
3. every persisted anchor reopens exactly before and after permitted project transfer;
4. PDF anchor quotes have converter-emitted page coordinates, and both CSVs pass the typed/raw
   fidelity contract;
5. any extraction failure is a schema-valid actionable record; only declared scanned/OCR
   failures may remain;
6. the complete independent classification matrix is present; and
7. false-exact is zero.

Otherwise the evidence is explicitly `NO-GO`, and the architecture decision remains “do not
promote converter or selector profile.” This prevents the old converter output from becoming
the truth by mutation and keeps unresolved OCR/representation limitations visible.
