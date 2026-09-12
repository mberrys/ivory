<div align='center'>

<br />

<h2>IVORY TOWER - CONTENT POLICY</h2>

<hr />

</div>

## Description

Reference implementation of the V1 admission policy specified in [`docs/iv-128-content-rights.md`](../../docs/iv-128-content-rights.md) §9, and of the safe subset that [`docs/iv-8-product-model.md`](../../docs/iv-8-product-model.md) §4 makes the V1 default.

It answers two questions about a source, separately: may we reproduce it, and may we send its text to a third-party AI provider?

### Why two gates

A licence permitting an institution to *mine* content does not obviously permit *forwarding* that content to an unrelated commercial processor, and subscription terms commonly restrict third-party transfer. "Ingestable but not transmittable" is the likely real-world state for subscription content, and a single authorization boolean cannot represent it. So `decideAdmission` returns two independent decisions, each with its reason and the rights basis it relied on.

### Features

- **Content classes** with a declared **safe subset** — open-licensed, PMC OA, arXiv, DOAJ, preprint servers, public-domain archives, and researcher-authored material.
- **Recorded rights bases** rather than assertions. "The researcher confirmed authorization" is not a basis; the system stores *which* basis, so a decision can be re-examined later.
- **Topology-aware.** The research-organization exception is reachable only where a research organization performs the act, so a vendor-hosted deployment decides differently from a self-hosted one — and a test asserts that this is the *only* rule topology affects.
- **API-mediation aware.** A publisher grant that runs through the publisher's mining API does not cover a copy obtained by upload.
- **Fail-closed.** Unknown provenance, shadow-library content, and unrecognized combinations all refuse. Silence on third-party disclosure is refusal, not consent.

### Caveat

The policy encodes a **risk register, not legal advice**. Its source document is built from secondary commentary and no statutory text or licence was read in the original. Treat the defaults as a safe starting posture to be reviewed by counsel, not as a determination of what is lawful.

## Additional Information

- [Content-rights register](../../docs/iv-128-content-rights.md)
- [Product model](../../docs/iv-8-product-model.md)

## License

- [Eclipse Public License 2.0](http://www.eclipse.org/legal/epl-2.0/)
- [GNU General Public License, version 2 with the GNU Classpath Exception](https://projects.eclipse.org/license/secondary-gpl-2.0-cp)
