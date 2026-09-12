# IV-128 — Content licensing, TDM rights, and provider transfer

**Version 1** · 2026-08-02 · **Status:** delivered as a risk register
**Owning issue:** IV-128 — *creation pending; see §12*

> [!IMPORTANT]
> **This is not legal advice, and its author is not a lawyer.** It is a structured risk
> register whose purpose is to *scope the question for counsel* — to establish where to
> look, what to ask, and which decisions are already constrained. Every conclusion is
> provisional pending review by a qualified practitioner in the relevant jurisdiction.
> Nothing here should be relied on as a permission.

---

## 1. The question

Ivory Tower's Path A ingests copyrighted scholarly PDFs, extracts passages, and
transmits passage text to third-party AI providers. Three questions follow, and the
product model currently assumes favourable answers to all three without stating a basis:

- **Q1 — Ingestion.** May the product reproduce and convert a copyrighted article?
- **Q2 — Provider transfer.** May it transmit passage text to a commercial AI provider?
- **Q3 — Who is the actor?** Does the answer change depending on whether Ivory Tower or
  the researcher's institution performs the act?

Q3 turns out to be the one that governs the other two (§8).

### 1.1 Why this has no owner

Scanning all 126 tracker issues, the nearest containers each cover something else:

| Issue | Covers | Does not cover |
|---|---|---|
| IV-19 | Dependency licensing, SBOM, version pinning | *Software* licensing, not content |
| IV-20 | Supported content and restricted data | Framed around microdata and human subjects, not copyright |
| IV-87 | Provider data-egress policy | The *mechanism* of egress, not the right to egress |
| IV-67 | Security and privacy threat model | Not intellectual property |
| IV-83 | Supported-content admission | Enforcement point, but no rights basis to enforce |

## 2. Method and sources

Sources carry the five-class taxonomy of
[`iv-102-landscape-review.md`](iv-102-landscape-review.md) §2 — **V** vendor,
**E** independent empirical, **I** institutional, **P** practitioner, **C** commentary —
bounding what each may support.

This register adds one axis that document does not use: a **retrieval tier**, recording
whether a source was read (**T1**), confirmed in a search index but known only through its
extraction (**T2**), or merely referenced elsewhere (**T3**). **Every source here is T2.**
No statutory text, licence, or contract was read in the original.

That limitation bites harder here than in a landscape review. A legal position that rests
on search-engine summaries of statutes is a *starting point for research*, never a
conclusion. §10 states what that means in practice.

| # | Source | Class | RQ |
|---|---|---|---|
| L1 | [The New Copyright Directive: Text and Data Mining (Arts. 3 and 4)](https://legalblogs.wolterskluwer.com/copyright-blog/the-new-copyright-directive-text-and-data-mining-articles-3-and-4/), Kluwer Copyright Blog | C | Q1 |
| L2 | [TDM opt-out in Article 4(3) CDSMD](https://academic.oup.com/jiplp/article/19/5/453/7614898), *Journal of IP Law & Practice* | E | Q1 |
| L3 | [Text and data mining in the EU](https://www.reedsmith.com/articles/entertainment-and-media-guide-to-ai/text-and-data-mining-in-eu/), Reed Smith | C | Q1 |
| L4 | [Creative Commons statement on the Art. 4 TDM exception](https://creativecommons.org/wp-content/uploads/2021/12/CC-Statement-on-the-TDM-Exception-Art-4-DSM-Final.pdf) | I | Q1 |
| L5 | [Elsevier text and data mining policy](https://www.elsevier.com/about/policies-and-standards/text-and-data-mining) | V | Q1, Q2 |
| L6 | [Developments in publishers' TDM policy](https://sparcopen.org/our-work/developments-in-tdm-policy/), SPARC | I | Q1 |
| L7 | [Publisher TDM policies](https://libguides.hkust.edu.hk/tdm), HKUST Library | I | Q1 |
| L8 | [Index of TDM policies](https://clemson.libguides.com/tdm), Clemson University | I | Q1 |
| L9 | [Publisher policies for TDM](https://library.cranfield.ac.uk/text-and-data-mining/publisher-policies), Cranfield University | I | Q1 |
| L10 | [Text mining: acquiring text](https://libguides.umn.edu/text-mining), University of Minnesota | I | Q1 |
| L11 | [STM sample licence for TDM of subscribed content](https://stm-assoc.org/what-we-do/core-services/ip-copyright/licensing/text-and-data-mining/) | V | Q1, Q2 |
| L12 | [AI copyright cases update 2026](https://www.nortonrosefulbright.com/en/knowledge/publications/ce8eaa5f/ai-in-litigation-series-an-update-on-ai-copyright-cases-in-2026), Norton Rose Fulbright | C | Q1 |
| L13 | [Three key decisions on AI training and copyrighted content, 2025](https://ipwatchdog.com/2025/12/23/copyright-ai-collide-three-key-decisions-ai-training-copyrighted-content-2025/), IPWatchdog | C | Q1 |
| L14 | [Fair use and AI, 2026 update](https://library.osu.edu/site/copyright/2026/03/20/fair-use-and-artificial-intelligence-2026-update/), Ohio State University Libraries | I | Q1 |

**Composition:** 1 class **E**, 8 class **I**, 2 class **V**, 3 class **C**. Note that
the legal-analysis sources are predominantly law-firm and library commentary rather than
primary statutory text or peer-reviewed scholarship — appropriate for orientation,
insufficient for reliance.

---

## 3. The statutory layer

### 3.1 European Union — DSM Directive Arts. 3 and 4

Two exceptions, and the difference between them is the whole issue.

**Article 3 — scientific research.** Permits reproductions for text and data mining
carried out by **research organizations** and cultural heritage institutions, for the
purposes of **scientific research**, where they have **lawful access**. Art. 3(2) permits
secure retention of copies, including for verification of results.

Two features make this the strong exception. First, per L1 and L3, the lawful-access
requirement **does not let rightsholders contractually exclude TDM** — contractual
provisions contrary to the exception are unenforceable. Second, there is **no opt-out**:
a publisher cannot reserve out of Art. 3.

**Article 4 — general TDM.** Permits reproductions and extractions of lawfully accessed
works for TDM **unless expressly reserved by the rightsholder in an appropriate,
machine-readable manner**, per Art. 4(3). Commercial activity falls here. L2 and L4
document the opt-out as the contested mechanism, and its scope as unsettled.

**The consequence for Ivory Tower is direct: Art. 3 turns on *who performs the act*.**
A commercial software vendor is not a research organization. If Ivory Tower Ltd performs
the reproduction, Art. 3 is unavailable and the operation falls to Art. 4, where any
publisher opt-out bites and the contractual-override protection does not apply.

### 3.2 United Kingdom — CDPA s.29A

The UK exception permits copies for **computational analysis for non-commercial
research**, with lawful access. It is materially narrower than EU Art. 3 in that the
*purpose* must be non-commercial, and proposals to broaden it have repeatedly stalled.
**Not independently verified in this version** — recorded as a known gap in §10.

### 3.3 United States — fair use

There is no TDM exception; there is fair use, which is a **defence rather than a
permission**, assessed case by case. Three 2025 decisions bound the current position
(L12–L14):

| Case | Holding | Relevance here |
|---|---|---|
| *Bartz v. Anthropic* (Jun 2025) | Training held fair use; **retaining pirated copies was not** | Corpus provenance is dispositive, independent of the use |
| *Kadrey v. Meta* (Jun 2025) | Training held fair use on that record | Transformative-purpose reasoning |
| *Thomson Reuters v. Ross* (Feb 2025) | **Not fair use** — the AI competed directly with Westlaw's research service | **Closest analogue, and adverse** |

**The Ross fact pattern is the one to worry about.** Ross built a *legal research product*
on a rightsholder's content and lost on market harm, because it competed with the
rightsholder's own research service. Ivory Tower is a research product built over
publisher content, and major publishers sell research and discovery services — Elsevier
sells Scopus AI. The structural similarity is uncomfortable and should be put to counsel
directly.

Two mitigating distinctions, neither of which resolves it: all three cases concern
**model training**, whereas Ivory Tower performs **inference-time retrieval over
user-supplied content** — a different act. And fair use is US-only; it offers nothing in
the EU or UK.

---

## 4. What publishers actually grant

The consistent finding across L5–L11, and it does not match the product's assumed shape.

| Publisher | Grant shape |
|---|---|
| **Elsevier** | TDM rights in the standard ScienceDirect subscription agreement for academic libraries; requires an agreement and an **API key**; **non-commercial** purposes |
| **Springer Nature** | TDM for **non-commercial** purposes for subscribers; standard TDM terms in new and renewed agreements; API use may carry additional cost |
| **Wiley** | Requires a **separate TDM agreement** with the institution, plus a click-through licence and an ORCID-obtained **API token** |

Three properties recur, and each one cuts against the product's current design:

1. **API-mediated.** The grant is to mine *through the publisher's API*, not to process
   files obtained by other means. Ivory Tower's model — a researcher uploads a PDF they
   already hold — sits outside that channel.
2. **Non-commercial.** The grant is for non-commercial research. A commercial SaaS
   performing the processing is not obviously within it, even when the researcher's own
   purpose is non-commercial.
3. **Institution-scoped.** The counterparty is the subscribing library, not the
   individual researcher, and not a vendor the researcher chooses.

L11's STM sample licence exists precisely because publishers intend TDM to be governed by
**negotiated terms**, per-project or per-subscription — which is evidence that a blanket
right is not the default assumption in the sector.

---

## 5. Two distinct operations, two distinct rights

The register's central structural point. The product currently treats "may we use this
document?" as one question. It is two, and they can resolve differently:

| | Operation | Act | Governing basis |
|---|---|---|---|
| **Op A** | Ingest, convert, chunk, index | Reproduction | TDM exception *or* publisher TDM grant |
| **Op B** | Transmit passage text to a commercial AI provider | Reproduction **plus** disclosure to a third party | Rarely addressed by a TDM grant; often restricted by subscription terms |

**Op B is the sharper risk and the less examined one.** A TDM licence that permits an
institution to mine content does not obviously permit forwarding that content to an
unrelated commercial processor. Subscription agreements commonly restrict systematic
downloading and transfer to third parties, and the AI provider is a third party.

**Design consequence:** IV-83 (admission) and IV-87 (egress) must carry **separate
gates**, not one authorization flag. A document may be lawfully ingestable and
un-transmittable. If the two are conflated in a single boolean, the system cannot express
the most likely real-world state.

---

## 6. Content-rights matrix

Provisional. Read with §10.

| Content class | Op A ingest | Op B provider transfer | Basis |
|---|---|---|---|
| CC-BY / CC0 open access | **Permitted** | **Permitted** | Licence grants reuse including redistribution |
| PMC Open Access subset | **Permitted** | **Permitted** (per-item licence) | Explicit reuse licences; verify per item |
| arXiv preprints | **Permitted** | **Check per item** | Licences vary — not all arXiv items are CC |
| DOAJ-listed OA journals | **Permitted** | **Likely permitted** | OA licences, verify per journal |
| Publisher-licensed subscription articles | **Conditional** | **Likely prohibited** | API-mediated, non-commercial, institution-scoped (§4) |
| Books under institutional licence | **Conditional** | **Likely prohibited** | Same, typically narrower |
| Public archival documents | **Likely permitted** | **Likely permitted** | Often public domain; verify archive terms |
| Researcher-authored notes | **Permitted** | **Permitted** | Researcher owns them |
| Pirated or shadow-library copies | **Prohibited** | **Prohibited** | *Bartz* — provenance is dispositive even where the use is fair |

The last row deserves emphasis because it is a *product* requirement, not only a policy
one: if the system cannot evidence lawful provenance for a source, it inherits the
weakest position in *Bartz*. Provenance recording is therefore a legal control, not
merely a citation feature — which is a second, independent justification for IV-17's
identity work.

---

## 7. The safe subset

Substantial enough to build V1 on, and the recommendation in §9 rests on it:

- **PMC Open Access subset** — millions of full-text articles with explicit reuse licences
- **arXiv** — with per-item licence checking
- **DOAJ-listed open-access journals**
- **OpenAlex / Crossref metadata** — bibliographic metadata, distinct from full text
- **Preprint servers** — bioRxiv, medRxiv, SocArXiv, PsyArXiv
- **Public-domain and CC-licensed archival material**
- **Researcher-authored content**

This is not a degraded corpus. For a V1 whose purpose is proving that provenance-bearing
evidence synthesis works, it is sufficient — and it removes the largest legal unknown
from the critical path.

---

## 8. Deployment topology is the dominant variable

**The most consequential finding in this register, and it belongs to IV-14 rather than
here.**

Because EU Art. 3 turns on the actor being a research organization conducting scientific
research (§3.1), the *same software performing the same operation* has a materially
different rights position depending on who runs it:

| Topology | Actor performing the reproduction | Art. 3 available? | Publisher non-commercial grant applies? |
|---|---|---|---|
| **Vendor-hosted SaaS** | Ivory Tower, a commercial operator | **No** — falls to Art. 4, subject to opt-out | **Doubtful** — the processor is commercial |
| **Self-hosted at a subscribing institution** | The research organization | **Likely yes**, with lawful access | **Likely yes** — the institution is the licensee |

Under the self-hosted topology the institution is the actor, Art. 3 becomes available,
and — critically — **the publisher cannot contract out of it** (§3.1). Under vendor-hosted
SaaS, none of that protection is reachable.

**ADR-001 selected web-first hosted deployment, wrapped for desktop.** That decision was
recorded against deployment complexity, local-development cost, streaming, and provenance
requirements. On the evidence here, it also selected the **weaker rights position**, and
the ADR does not appear to have weighed that.

This does not mean the decision was wrong. Self-hosting carries real costs, and the safe
subset (§7) may make the difference moot for V1. But it is a factor IV-14 should have on
the record, and it is the kind of consideration that is cheap to weigh now and expensive
to revisit after Phase 2 builds the shell.

---

## 9. Recommended V1 admission policy

Five rules, each traceable to a finding above.

1. **Default the V1 corpus to the safe subset (§7).** It removes the largest legal unknown
   from the critical path without meaningfully weakening the V1 proof.
2. **Admit publisher-licensed content only on a stated basis** — either (a) an
   institutional TDM agreement exercised through the publisher's API, or (b) a
   self-hosted deployment where the institution is the acting research organization.
   Absent one of those, refuse at admission (IV-83).
3. **Separate the ingest gate from the transfer gate (§5).** Model them as two rights on
   the source record, not one authorization flag. A source may be ingestable and
   un-transmittable, and the system must be able to represent that.
4. **Record the rights basis, not a checkbox.** "The researcher asserted authorization" is
   not a basis. Store *which* basis — licence type, agreement, or exception — so the
   position is auditable later. This is a first-class field for IV-16.
5. **Fail closed.** Unknown provenance or unknown licence means refuse, consistent with
   IV-83's admission-before-conversion rule and IV-87's egress enforcement.

---

## 10. What this does not settle

- **No primary source was read.** Every statutory and licence claim is T2 — a
  search-engine rendering of secondary commentary. **No conclusion here is safe to rely
  on without reading the instruments.**
- **UK CDPA s.29A is unverified** (§3.2) and was characterized from general knowledge
  rather than a retrieved source. Treat that subsection as a research task, not a finding.
- **Actual subscription agreements were not examined.** The operative restriction for any
  given adopter lives in *their* contract, and those are not public. This is the direct
  cost of the generic-landscape scope.
- **No jurisdiction outside the EU, UK, and US was considered.**
- **Whether Op B constitutes a prohibited third-party transfer is genuinely unsettled**,
  and is the single question most worth putting to counsel first.
- **The *Ross* market-harm analogy is the author's, not a lawyer's.** It may be
  overstated — Ross concerned training on a competitor's proprietary editorial content,
  which differs from retrieval over a user's own licensed copies. It is flagged because
  it is uncomfortable enough to be worth an hour of a professional's time, not because it
  is established.

### 10.1 Questions for counsel, in priority order

1. Does transmitting passage text of a subscription-licensed article to a commercial LLM
   API constitute a prohibited third-party transfer under typical institutional
   agreements?
2. Does a vendor-hosted deployment forfeit the EU Art. 3 research-organization exception
   that a self-hosted deployment would retain?
3. Does *Thomson Reuters v. Ross* market-harm reasoning extend from training to
   inference-time retrieval over user-supplied content?
4. Is the UK s.29A non-commercial-purpose limit assessed on the researcher's purpose or
   the operator's?

---

## 10.2 Implementation status

§9's five rules are implemented in
[`packages/ivory-tower-content-policy`](../packages/ivory-tower-content-policy) — content classes and
the safe subset, recorded rights bases, the two gates, topology awareness, and fail-closed
defaults, with 26 tests. Each test pins a finding from this register, so a future change
that quietly merges the two gates or treats silence as consent fails the suite.

§7's safe subset is normative in
[`iv-8-product-model.md`](iv-8-product-model.md) §4.0 as the V1 default corpus.

**The implementation encodes this register's conclusions, and inherits their limitations.**
It is a safe *starting posture* whose defaults refuse rather than permit — not a
determination of what is lawful. When counsel answers §10.1, the policy changes with it.

## 11. Downstream obligations

| Issue | Obligation |
|---|---|
| **IV-14** | Weigh §8 — deployment topology changes the rights position, and ADR-001 did not record it |
| **IV-16** | Add a rights-basis field to `Source`; §9.4 makes it schema, not policy |
| **IV-20** | Adopt §6 as the copyright dimension of the supported-content matrix |
| **IV-83** | Enforce §9.2 and §9.5 at admission, before conversion |
| **IV-87** | Enforce §9.3 as a gate distinct from admission |
| **IV-8** | §4.1's content matrix gains a rights column; currently it addresses restricted data but not copyright |

## 12. Issue-creation status

The IV-128 tracker entry **has not been created** — the Notion write required approval
that was not granted in this session. Consequently:

- This document is named on the expectation that the tracker assigns **IV-128**, the next
  identifier after the current maximum of 127. If a different number is assigned, rename
  the file and update the references in §11.
- **The tracker-invariant update is deliberately deferred.**
  `scripts/verify-product-model.js` still asserts 126 rows and 125 phased issues, which
  remains correct until the issue exists. Updating ground truth before the ground changes
  would defeat the check.

Once IV-128 exists: refresh the `TRACKER` constants from a fresh query, add rows to
`scripts/product-model/{issues,assignments}.json`, regenerate IV-8 §7 with
`node scripts/verify-product-model.js --write`, and update the README's tracked-issue
count.
