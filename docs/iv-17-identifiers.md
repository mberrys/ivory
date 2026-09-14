# IV-17 — Stable source, passage, and derived-artifact identifiers

Status: delivered · Phase 1 · Milestone: V1 — product and architecture contract
Reference implementation: [`packages/ivory-identity`](../packages/ivory-identity)

This document is normative. Where an implementation and this document disagree, this document is
the contract and the implementation is the defect.

---

## 1. Scope and non-goals

Ivory Tower's central promise is that a citation stays true. A researcher who cites a passage
today must land on the same bytes, the same span, and the same reasoning trail after the corpus
is re-indexed, the parser is upgraded, the chunker is retuned, or the embedding provider is
swapped. Identity is what makes that promise keepable, so it is fixed before anything is built
on top of it.

**In scope.** The rules that decide what an identifier is, when two things share one, when a
change creates a new one, how identifiers are encoded, what happens on collision, and how a
future scheme migrates.

**Not in scope.** Persistence and migrations, the field-level object schema (IV-16), the
pipeline-run manifest and its invalidation graph (IV-79), and any user interface. This document
defines identity and proves it; it does not store it.

IV-17 is deliberately lower-level than IV-16. It depends only on *which kinds of object exist* —
settled by IV-8 §2 — not on their field sets, which is why it can be delivered first and why
IV-79 and IV-18 can proceed against it.

## 2. Two classes of identifier

Every Ivory Tower identifier is either minted or derived. Nearly every question about identity
resolves to picking the right class, so the distinction comes first.

**Minted** identifiers are allocated once from cryptographic randomness and are never
re-derivable. A minted identifier answers *"which one is this?"*.

| kind | prefix | why minted |
|---|---|---|
| `Project` | `prj` | a research context is declared, not computed |
| `Corpus` | `cor` | a selection of sources is a curatorial act |
| `Source` | `src` | the stable handle for a document *as a research object*, which must survive both metadata corrections and byte replacement |
| `Execution` | `exec` | a run is an event; two runs of an identical computation are still two runs |

**Derived** identifiers are the hash of a canonical preimage over the object's identifying
inputs. Anyone holding those inputs can recompute the identifier and get the same answer. A
derived identifier answers *"what is this?"*.

| kind | prefix | derived from |
|---|---|---|
| `SourceVersion` | `sv` | its source and its raw bytes |
| `Passage` | `psg` | its source version, its extraction, and its character spans |
| `Artifact` | `art` | the fingerprint of the computation that produced it, plus its role and — when the computation is not reproducible — its output digest |
| `ExecutionFingerprint` | `fp` | what ran, on what, configured how, under which policy |

Deriving what should be minted destroys history: a `Source` whose identifier came from its bytes
would become a different source the moment a typo was fixed, and every citation to it would
dangle. Minting what should be derived destroys reproducibility: nobody could ever recompute the
identifier to check it, and two identical pipeline runs would produce two unrelated artifacts.

## 3. Grammar and encoding

```
identifier := prefix "_" 32*lowercase-hex
prefix     := "prj" / "cor" / "src" / "sv" / "psg" / "exec" / "art" / "fp"
```

Regular form: `^(prj|cor|src|sv|psg|exec|art|fp)_[0-9a-f]{32}$`

The 32 hex characters are the leading 128 bits of a SHA-256 digest (derived) or of 16 random
bytes (minted). Examples, taken from the verification fixtures:

```
src_0b7bd0e7bd2d4f2f9c4e6a1d8f3b5c72
sv_8b9f3008ec33685933e090e71a4cd1e4
art_f05140ae4c88aa04edafdf03de564662
psg_bed3e134865f35dd57b07dec11f81558
```

The grammar is deliberately narrow. Every identifier is fixed-length, ASCII-only, lowercase, and
built from characters that are unreserved in a URI, legal in a file name on every supported
platform, and inert in JSON, in a log line, and in a BibTeX or CSL field. Nothing needs escaping
anywhere Ivory Tower carries an identifier, and a system that upper-cases or pads one produces a
value that *fails to parse* rather than one that silently addresses something else.

The prefix types the identifier. Passing a passage where a source version is expected is caught
at the boundary rather than discovered as mis-resolved evidence later.

### 3.1 Resource URIs

Two forms, told apart unambiguously by segment count:

```
ivory://<kind-segment>/<id>                              e.g. ivory://passage/psg_bed3…
ivory://project/<prj_id>/<kind-segment>/<id>             e.g. ivory://project/prj_a1b2…/passage/psg_bed3…
```

Kind segments are the kebab-case names: `project`, `corpus`, `source`, `source-version`,
`passage`, `execution`, `artifact`, `fingerprint`.

The scoped form is what a client authorized for a single project (IV-70) receives, and is the
`uri` of an MCP resource (IV-69, IV-13). An unscoped project reference —
`ivory://project/prj_…` — has two segments and never collides with the four-segment scoped form.

## 4. The identity ladder

```
Source                       src_    minted
  └── SourceVersion          sv_     H(sourceId ‖ sha256(raw bytes))
        └── Extraction       art_    H(fingerprint ‖ outputRole)
              └── Passage    psg_    H(sourceVersionId ‖ extractionArtifactId ‖ spans)
        Chunks               art_    references passages — never identifies them
              └── Embeddings art_    H(fingerprint ‖ outputRole ‖ sha256(output))
```

### 4.1 SourceVersion depends on bytes and nothing else

`sv = H(sourceId ‖ contentDigest)` where `contentDigest` is SHA-256 over the raw bytes exactly as
received — no normalization, no re-encoding.

Excluded on purpose: bibliographic metadata, parser and OCR versions, chunking parameters,
embedding models, and every other pipeline setting. Those live below the source version in the
ladder, so changing them cannot reach up and disturb it.

- Re-ingesting an unchanged file reproduces its source version, so re-indexing preserves every
  reference. *(AC-1)*
- Replacing the bytes produces a *new* source version. The prior one is not overwritten,
  invalidated, or reused; it remains derivable from the bytes it was made of, so citations
  against it keep resolving. *(AC-2)*

The source is part of the preimage so that the same PDF ingested as two distinct research
objects yields two distinct versions. De-duplicating an upload against an existing source by
content digest is an **ingestion policy**, not an identity rule; identity does not decide whether
two uploads are the same research object.

### 4.2 Corrected metadata changes no identifier

Bibliographic metadata — title, authors, year, DOI, container — is a separately versioned record
attached to the `Source`, outside every preimage in this document. Correcting a misparsed author
name is routine, and it must never invalidate a citation. Prior exports stay auditable because
the correction is a new metadata revision rather than an edit of the old one (IV-45).

### 4.3 Passages are bound to the extraction they were measured in

`psg = H(sourceVersionId ‖ extractionArtifactId ‖ spanCount ‖ spans)`

A character offset means nothing without the text it indexes. The extraction artifact *is* that
text's identity, and it already carries the parser version, OCR settings, and layout options
through its fingerprint (§6), so those need not — and must not — be repeated in the passage
preimage.

The consequence is deliberate: **upgrading a parser produces new passages rather than silently
re-pointing old ones.** The old offsets no longer describe the new text, and pretending otherwise
would move a citation onto words the author never quoted. Prior passages remain stored and remain
resolvable against the extraction they were measured in. A re-anchoring edge (§5) links old to
new. Nothing is rewritten in place.

The source version is included as well as the extraction so that a passage carries its own
evidence of which bytes it came from. Callers must pass the source version the extraction was run
against; the identity layer cannot verify that relationship without the artifact record.

A passage may cover more than one span — a quotation interrupted by a footnote marker or a
running header is one passage over two ranges. Spans are half-open `[start, end)` ranges counted
in UTF-16 code units of the extracted text, and must be non-empty, ascending, and non-overlapping.
An unordered span list is rejected rather than sorted: it means the extraction step produced
something identity cannot interpret, and guessing would attach a stable identifier to an unstable
meaning.

### 4.4 Chunks are not passages

A retrieval chunk is a derived artifact that **references** passage anchors. It never identifies
them. Re-chunking a corpus therefore changes chunk artifacts and leaves every passage citation
intact — which is the whole reason retrieval tuning is safe to iterate on.

## 5. Passage anchoring: position and quote selectors

Following the W3C Web Annotation model, a passage anchor has two halves with different jobs.

- **Position selector** — the spans of §4.3. Identity-bearing and exact.
- **Quote selector** — SHA-256 digests of the quoted text and of the text immediately before and
  after it, computed after normalization (§7.2). Recovery only, and **never** part of passage
  identity. Digests rather than the text itself, so an anchor can be stored, logged, and exported
  without duplicating source content.

When an extraction changes, a prior passage is re-located in the new text through its quote
selector. That produces a **new passage plus a lineage edge**, marked `approximate`. An
approximate anchor is always labelled as such and can never satisfy IV-35's exact-passage release
criterion. A silent fallback would be worse than a broken link: it would present the wrong words
as verified evidence.

## 6. Execution identity: a run and a computation are different things

Two values, because conflating them loses one of two truths.

**`exec_` — minted, one per run.** Two runs with identical inputs are still two runs, at
different times, possibly by different actors. History says so.

**`fp_` — derived, one per computation.**

```
fp = H(transformation ‖ transformationVersion ‖ inputCount ‖ inputIds ‖ parameters ‖ policyVersion)
```

- `transformation` — stable name, e.g. `docling.convert`.
- `transformationVersion` — version of the implementation *and* of any model or binary it drives.
- `inputIds` — identifiers of everything consumed, **sorted** before hashing, so the accidental
  order in which a caller assembled its dependencies cannot change an artifact's identity. A
  transformation whose result genuinely depends on input order states that order in
  `parameters`, where it is visible and intentional. A duplicate input is rejected, not
  de-duplicated: it means the caller built the wrong list.
- `parameters` — the configuration, as a nested canonical preimage over lexicographically sorted
  keys with type-tagged values, so `512` and `"512"` never collide.
- `policyVersion` — the policy in force, so a policy change invalidates rather than silently
  reuses.

### 6.1 Artifact identity depends on whether the transformation is reproducible

Every transformation declares itself `deterministic` or `observed`.

```
deterministic:   art = H(fingerprint ‖ outputRole ‖ "deterministic")
observed:        art = H(fingerprint ‖ outputRole ‖ "observed" ‖ sha256(output bytes))
```

A **deterministic** transformation — a parser at a pinned version, a chunker, a hash — is a
function of its inputs, so its fingerprint and output role are enough, and re-running it
reproduces the same artifact identifier. Folding the output digest in is rejected, because it
would quietly cost the reproducibility the declaration promises.

An **observed** transformation — a model call, OCR with a nondeterministic backend — is not a
function of its inputs. Identifying its output by fingerprint alone would give one identifier to
two different contents. The output digest therefore joins the preimage, and two runs yield two
artifacts sharing one fingerprint. That is the honest record: the computation was the same, the
result was not. Omitting the digest is rejected rather than defaulted.

### 6.2 The identifier is opaque; the record carries the provenance

An artifact identifier encodes nothing readable, by design — a decodable identifier invites
parsing, and parsed identifiers become load-bearing. What ties an artifact to its origins is its
**record**, which states its source versions, transformation and version, determinism,
fingerprint, execution, output role, output digest where applicable, and the identifier scheme
version. *(AC-3)*

This record is the hand-off surface for IV-79, whose pipeline-run manifests extend it into a full
dependency graph with invalidation semantics.

## 7. Canonical preimages

### 7.1 Framing

Ivory Tower does not hash `JSON.stringify` output. Key order, number formatting, and escaping are
all under-specified, and plain concatenation is worse: `'ab' + 'c'` and `'a' + 'bc'` are the same
bytes, so two different passages could hash to one identifier and a citation would resolve to the
other's evidence.

Every field is therefore framed with its name and its **UTF-8 byte length**:

```
name <US> byteLength <US> value <RS>          US = U+001F, RS = U+001E
```

A preimage begins with two fixed fields: `v`, the framing version, and `d`, the domain. A real
`sourceVersion` preimage, with separators shown as escapes:

```
v\x1f13\x1fiv-preimage/1\x1e
d\x1f13\x1fsourceVersion\x1e
sourceId\x1f36\x1fsrc_0b7bd0e7bd2d4f2f9c4e6a1d8f3b5c72\x1e
contentDigest\x1f64\x1fb2090fe3af5248a662df758afa065734453b2a1fcb23a10a61ebe6a7f4f5b276\x1e
```

Rules:

- The length prefix makes the framing self-delimiting, so no value can impersonate a field
  boundary regardless of the characters it contains — including the separators themselves.
- The `d` field means a passage preimage can never equal an artifact preimage even if their
  fields coincide.
- **Field order is part of the contract.** Each domain declares a fixed order; reordering yields
  a different identifier.
- Field names must be unique and match `/^[a-zA-Z][a-zA-Z0-9._-]*$/`.
- Preimages nest safely, because the outer framing length-prefixes every value. This is how
  execution parameters are folded in.
- Parameter values are restricted to string, finite number, and boolean, and are type-tagged.
  `-0` is normalized to `0` so that two configurations no reader could tell apart hash alike.

### 7.2 Text normalization

Normalization applies to quote selectors **only**. Source bytes are hashed exactly as received.

Under `iv-norm/1`: Unicode NFC composition, then collapse of every whitespace run to a single
space, then trim. NFC because extraction backends disagree about composed versus decomposed
accents; whitespace collapse because they disagree about line breaks inside a paragraph. The
version tag is recorded on every selector, so a future normalization is a new version rather than
a silent reinterpretation of stored anchors.

## 8. What may never serve as a canonical reference

None of the following may appear as a reference in a claim, citation, evidence link, export,
manifest, or MCP resource:

| never canonical | why | where it belongs |
|---|---|---|
| display labels, titles, "Smith 2019" | not unique, not stable, locale- and correction-dependent | presentation fields |
| file names and upload paths | user-editable; collide across projects | source metadata |
| database row numbers, serial or auto-increment columns | assigned by insertion order; differ across environments and restores | never exposed beyond the storage adapter |
| vector-store point identifiers | transient; re-created wholesale on re-indexing, which is exactly the event identity must survive | inside the vector adapter, keyed *by* an Ivory Tower artifact identifier |
| provider-side identifiers (model, OCR, storage) | outside our control and versioning | adapter-local fields on the record |
| array indices and positions in a result list | meaningless after the next query | nowhere |
| URLs, including DOIs and landing pages | resolve to whatever the publisher serves today; not byte-stable | source metadata, as claims about the source |

The rule generalizes: **if something is assigned by a component Ivory Tower does not version, it
cannot be a reference.** Adapter-local identifiers are legitimate inside their adapter and must
be keyed by an Ivory Tower identifier, never the reverse.

## 9. Collision handling

Truncation to 128 bits gives a birthday bound near 2⁶⁴ — far beyond any corpus this system will
hold. The full SHA-256 digest is nevertheless persisted alongside every derived identifier, along
with the exact preimage that produced it, because the point is not probability but detectability.

Policy:

1. Uniqueness is enforced where identifiers meet storage.
2. On a repeat identifier, compare the full digest and preimage. Equal on both means it is the
   same object being re-derived, which is the normal, expected case.
3. A mismatch is a **defect or an attack**, never a coincidence. **Fail closed**: reject the
   write, log both preimages, surface the conflict. Never reuse the existing record, and never
   overwrite it — the two preimages describe different objects, and silently picking either makes
   a citation resolve to evidence it does not quote.

Widening path, should it ever be needed: the digest algorithm and the truncation width are pinned
by `IDENTIFIER_SCHEME_VERSION`, and the framing by `PREIMAGE_VERSION`. Changing either is a
scheme migration under §10 — it produces new identifiers alongside the old, and never rewrites
them.

## 10. Legacy identifiers and scheme migration

Ivory Tower has no legacy identifiers today, so what follows defines the **mechanism** rather
than performing a migration.

The governing rule: **a scheme change never rewrites stored identifiers in place.** An object
keeps the identifier it was created with. The new scheme adds a canonical identifier, and an
alias edge joins them. A citation written years earlier keeps resolving, and nothing has to be
back-filled to make that true.

An alias record states the retired or foreign reference, the scheme it came from, the identifier
that is authoritative now, why it exists, and when it was created.

Resolution rules:

- The alias table is consulted **first**. A retired reference can still be well formed — a scheme
  change that alters only what an identifier *means* leaves its shape intact — and resolving such
  a reference to itself would quietly point a citation at the wrong object.
- A reference with no alias entry resolves to itself if it is a valid identifier.
- Anything else is reported unresolvable. It is never guessed at.
- **Alias chains are rejected, not followed.** A canonical target that is itself an alias means
  the table was built by rewriting instead of adding — the exact failure this mechanism exists to
  prevent — and following the chain would hide it.
- A reference resolving to a different kind than expected is an error, not a miss.
- Aliases are never minted for new objects, and exports always emit canonical identifiers.

Every identifier-bearing record carries `identifierSchemeVersion`, so a future scheme is
detectable rather than inferred.

## 11. Identity boundary matrix

Normative. `=` means the identifier must not change; `≠` means it must. The verification suite
mirrors this table row for row, asserting the full partition in both directions — a rule that
over-invalidates destroys citations just as surely as one that under-invalidates lets them drift.

| mutated input | `src` | `sv` | extraction `fp` / `art` | `psg` | chunk `fp` / `art` | embedding `fp` / `art` | `exec` |
|---|---|---|---|---|---|---|---|
| source bytes replaced | = | ≠ | ≠ | ≠ | ≠ | ≠ | ≠ |
| bibliographic metadata corrected | = | = | = | = | = | = | ≠ |
| parser or OCR version bumped | = | = | ≠ | ≠ | ≠ | ≠ | ≠ |
| chunk size or overlap changed | = | = | = | = | ≠ | ≠ | ≠ |
| embedding model changed | = | = | = | = | = | ≠ | ≠ |
| policy version changed | = | = | ≠ | ≠ | ≠ | ≠ | ≠ |
| identical bytes under a different source | ≠ | ≠ | ≠ | ≠ | ≠ | ≠ | ≠ |
| re-run with identical inputs | = | = | = | = | = | = | ≠ |

The last row is the whole design in one line: everything derived holds, and only the record of
the run is new.

## 12. Open-source boundary

Reused: SHA-256 from the platform (`node:crypto`), and the platform's cryptographic randomness.
Ivory Tower does not implement primitives.

Owned: canonical serialization, the identity ladder, the boundary semantics of §11, the
minted/derived split, collision policy, and the migration mechanism. These are product
guarantees, not library behaviour, and are not delegated to a RAG framework or an ORM.

Identity derivation is exposed as pure functions rather than a rebindable service. A service that
could be replaced to change a hash would break every stored citation the moment an adopter
rebound it. Code needing dependency injection can bind a thin façade over these functions.

## 13. Downstream obligations

| issue | what it takes from here |
|---|---|
| IV-16 canonical research object schema | §2 and §4 supply the identity and versioning rule for every object it defines |
| IV-79 pipeline-run manifests | §6 is the base of the manifest; §6.2's artifact record is the node its dependency graph extends; §11 is the minimum invalidation contract |
| IV-35 passage deep links | §4.3 and §5; approximate anchors may not satisfy exact-passage criteria |
| IV-45 citation export, IV-88 dossier export | §3 for carriage safety, §4.2 so corrections do not invalidate prior exports, §8 for what may not be exported as a reference |
| IV-69, IV-13, IV-70 MCP surfaces | §3.1 resource URIs, including the project-scoped form |
| IV-18 typed service and API boundaries | §3 grammar as the wire form of every reference |

## 14. Verification

Implements this issue's verification clause — *run deterministic fixtures twice and compare every
generated identifier; mutate one controlled input and verify the expected identity boundary.*

```
npx lerna run test --scope @theia/ivory-identity
```

- `src/node/test/identity-fixtures.ts` — a fixed corpus defined entirely in code: no files, no
  clock, no randomness, no network. It carries bibliographic metadata that the pipeline never
  reads, so the suite fails the day metadata leaks into a preimage.
- `src/node/identity-boundaries.spec.ts` — determinism, then one case per row of §11, each
  asserting the whole partition.
- `src/node/identity.spec.ts` — derivation rules, the deterministic/observed split, artifact
  records, and fail-closed collision handling.
- `src/common/canonical-preimage.spec.ts` — framing, including values that would collide under
  naive concatenation and values containing the separators themselves.
- `src/common/identifier.spec.ts` — grammar, kind confusion, carriage safety, resource URIs.
- `src/common/identifier-alias.spec.ts` — alias resolution and chain rejection.

Acceptance criteria:

- **Re-indexing unchanged source bytes preserves source-version and passage references** — §4.1;
  determinism cases and the final row of §11.
- **Changed bytes create a new source version without destroying prior citations** — §4.1; the
  first row of §11, which also asserts the prior version stays derivable.
- **Derived artifacts identify their source versions, transformation, and execution** — §6.2 and
  its record assertions.
- **Identifiers are safe for URLs, exports, logs, and MCP resources** — §3 and §3.1; the carriage
  safety and resource URI cases.
