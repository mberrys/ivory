# Jev-like R4 next experiment — historical title/abstract screen + local NLI cascade

**Preregistration:** 2026-09-23 PDT, before inspecting any model observations. Branch `experiment/jev-r2-r3-semantic-seam`. Execution commit `8e902e1ef29af4c1905547bb5fedeabd1931c8ed`; [named GitHub Actions run 35947960101](https://github.com/mberrys/ivory/actions/runs/35947960101). Research-only. Does not open a PR, ship a model or close R4.

## Why this experiment differs from the failed Qwen3 series

Previous Qwen3-0.6B/1.7B four-way classification on **authored synthetics** failed explicit exclusion triage, despite legal JSON/choice syntax. Next test a **small task-specific NLI cross-encoder + lexical rules** on **real historical systematic-review title/abstract screening records**, without treating model scores as accepted scholarship or automatically discarding any record.

## Provenance, source and label semantics

- Upstream [ASReview SYNERGY dataset index](https://github.com/asreview/synergy-dataset/blob/master/index.csv) lists `Nagtegaal_2019`, **CC0**, and `title_abstract_inclusions=True`: nudging healthcare professionals towards evidence-based medicine (public administration / clinical behavioral interventions), 2,019 indexed records. Actual source [historical published CSV](https://raw.githubusercontent.com/asreview/systematic-review-datasets/metadata-v1-final/datasets/Nagtegaal_2019/output/Nagtegaal_2019.csv), columns `record_id,title,abstract,label_included,label_abstract_screening,duplicate_record_id`. Download from GitHub in a clean Actions runner; record raw SHA256, branch SHA where resolvable, original counts, duplicate conflicts and nonempty/valid labels. No private Ivory data.
- Primary historical outcome: `label_abstract_screening` (binary prior review screening decision); secondary only: `label_included` (can depend on unobserved full text). These are **review-specific binary outcomes**, *not* an NLI entailment label or a transferable eligibility judgment about adult patient qualitative interviews. The public data does not by itself prove the identities and independence of two annotators per record; do **not** assert dual-review qualification.
- Frozen sample algorithm: deduplicate exact normalized title+abstract and drop conflicting-label duplicate groups; sort separately by SHA256(`ivory-nli-nagtegaal-v1-preregistered-20260923|record_id|text_sha256`); choose first **24 title/abstract-screen-positive and 72 negative** records. Never change selection or criterion after inspecting outcomes. Stratification **does not** preserve dataset's natural prevalence; report full source counts separately. No training set or prompt tuning.
- Log record IDs, source and text SHA256, model revision, question SHA256, rules flags, NLI uncalibrated three-way distribution, score, class and ranking. Do not upload entire abstracts to project artifact.

## Frozen arms and task

**Task:** propose which abstracts the *researcher* reviews first for possible nudge/behavior-change interventions targeting clinicians/healthcare personnel in clinical settings. No autonomous exclusion and no factual claim verification; the reviewed abstracts themselves never authorize evaluator tools or publication.

1. **Rules-only priority:** four binary lexical flags (nudge/choice architecture, healthcare-professional actor, intervention design, clinical domain), sum `0..4`. The flags are in [source code](../../experiments/jev-seam/synergy-screening-nli.py); not tuned to the observed cohort.
2. **Local MiniLM NLI:** pinned `cross-encoder/nli-MiniLM2-L6-H768@b95119ce93d3e065de6214e38cd4a97b0f2f2c6d`, text premise title+abstract, fixed hypothesis “This original study evaluates a behavioral nudge or choice-architecture intervention targeting healthcare professionals in clinical settings to change their professional clinical behavior or evidence-based practice.” 384 max tokens, 8 batch, CPU. Extract entailment softmax as **uncalibrated ranking signal** (not research-truth probability).
3. **Cascade:** lexical score primary + model entailment tie-break `(rules_score + entailment)/5`; separately report diagnostic candidate union `rules_score>=3 OR entailment>=0.5`, **never auto-exclude even if neither fires**.

## Primary measurements and falsifiability

- Fixed ranking budget top 24, 48, 72 out of 96; for each arm count actual historical abstract-screen positives retrieved, recall@k, precision@k and average precision. Include all per-case errors and secondary *final* inclusion outcome separately.
- Report candidate union's screen-label false negatives **only as not prioritized**, not excluded; no threshold tuned or retrospective chosen winner.
- If cascade does not improve primary screening recall at fixed cost over rules alone, or only improves via a label not observable from title/abstract, record a **negative** finding. An NLI neutrality/contradiction output is not equivalent to the study authors' final inclusion decision. Benchmark cannot establish independent dual-review or prospective scholarly quality.

## Existing immutable safety boundaries

- Historical N1 citation's mechanical context-unavailable case must still abstain **before inference**. The original [N1 bridge run 35940936300](https://github.com/mberrys/ivory/actions/runs/35940936300) and synthetic J3 safety suite are separate; this new public dataset analysis **does not run a real N1 authenticated snapshot**.
- No accepts/rejects, EvidenceLink confidence field, external rights-protected corpus, duplicate provenance store, workflow-machine authority, or product model dependency.
- Production gates: human reviewer study, complete Core mechanical basis, durable Assessment/Receipt and actual N7 rights/approval, restart, two-client parity, per-domain qualification. Even a large improvement on public binary screening labels does **not** close the Jev research epic.

**Status at preregistration:** executable code and workflow submitted, empirical outcomes not yet read.
