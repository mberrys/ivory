<div align='center'>

<br />

<h2>IVORY TOWER - IDENTITY</h2>

<hr />

</div>

## Description

The Ivory Tower Identity package is the reference implementation of the identifier contract specified in [`docs/iv-17-identifiers.md`](../../docs/iv-17-identifiers.md) (IV-17).

It answers one question: what has to be true for a citation to stay true after the corpus is re-indexed, the parser is upgraded, the chunker is retuned, or the embedding provider is swapped.

### Features

- **Two identifier classes.** Minted identifiers (`prj_`, `cor_`, `src_`, `exec_`) are allocated once and never re-derived. Derived identifiers (`sv_`, `psg_`, `art_`, `fp_`) are a function of their inputs, so anyone holding those inputs can reproduce them.
- **A URL-, export-, log-, and MCP-safe grammar.** `^(prj|cor|src|sv|psg|exec|art|fp)_[0-9a-f]{32}$`, plus `ivory://` resource URIs in unscoped and project-scoped forms.
- **Unambiguous canonical preimages.** Every hashed field is framed with its name and UTF-8 byte length, so no two distinct objects can serialize to the same bytes.
- **Derivation rules with declared boundaries.** A source version depends on its bytes alone; a passage on the extraction its offsets were measured in; an artifact on the fingerprint of the computation that produced it, plus its output digest when that computation is not reproducible.
- **Fail-closed collision handling** and a legacy-alias resolver that refuses to follow rewrite chains.

### Layout

- `src/common` — grammar, parsing, resource URIs, canonical preimages, passage anchors, alias resolution. Safe to import from the frontend.
- `src/node` — digests, minting, and derivation. Backend only, because it uses `node:crypto`.

### Verification

`src/node/identity-boundaries.spec.ts` executes IV-17's verification clause: it runs a fixed fixture pipeline twice and compares every generated identifier, then mutates one controlled input at a time and asserts the full set of identifiers that move *and* the set that holds.

```
npx lerna run test --scope @theia/ivory-identity
```

## Additional Information

- [Identifier specification](../../docs/iv-17-identifiers.md)
- [Theia - GitHub](https://github.com/eclipse-theia/theia)

## License

- [Eclipse Public License 2.0](http://www.eclipse.org/legal/epl-2.0/)
- [GNU General Public License, version 2 with the GNU Classpath Exception](https://projects.eclipse.org/license/secondary-gpl-2.0-cp)
