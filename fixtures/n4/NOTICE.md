# N4 qualification corpus

22 fixtures: 18 PDFs, 2 CSV files and 2 UTF-8 text files. Every fixture is checked in
unmodified and its SHA-256 is pinned in `manifest.json`. Each manifest entry carries a `source`
label; this notice gives the full provenance.

## Provenance and licence

| Fixture | Kind | Source and licence |
|---|---|---|
| `pdf/160F-2019.pdf` | columns | Mozilla pdf.js test corpus (`test/pdfs`), MPL-2.0 |
| `pdf/TAMReview.pdf` | plain | Mozilla pdf.js test corpus (`test/pdfs`), MPL-2.0 |
| `pdf/bitmap-composite-and-xnor-text.pdf` | scanned | Mozilla pdf.js test corpus (`test/pdfs`), MPL-2.0 — image-only page, no text layer |
| `pdf/bitmap-symbol-textbottomleft.pdf` | scanned | Mozilla pdf.js test corpus (`test/pdfs`), MPL-2.0 — image-only page, no text layer |
| `pdf/file_pdfjs_test.pdf` | plain | Mozilla pdf.js test corpus (`test/pdfs`), MPL-2.0 |
| `pdf/prefilled_f1040.pdf` | table | US Internal Revenue Service form 1040 (US Government work, public domain), via the Mozilla pdf.js test corpus |
| `pdf/pdfjs_wikipedia.pdf` | plain | Wikipedia article export, CC BY-SA 4.0 (attribution: Wikipedia contributors), via the Mozilla pdf.js test corpus |
| `pdf/open-two-column-paper.pdf` | columns | Repository-authored (born-digital, Typst source in `sources/`) |
| `pdf/open-methods-zh.pdf` | multilingual | Repository-authored (born-digital, Typst source in `sources/`; Chinese Han script) |
| `pdf/open-methods-ja.pdf` | multilingual | Repository-authored (born-digital, Typst source in `sources/`; Japanese kana and kanji) |
| `pdf/open-methods-ko.pdf` | multilingual | Repository-authored (born-digital, Typst source in `sources/`; Korean Hangul) |
| `pdf/open-methods-ar.pdf` | multilingual | Repository-authored (born-digital, Typst source in `sources/`; Arabic script) |
| `pdf/open-methods-ru.pdf` | multilingual | Repository-authored (born-digital, Typst source in `sources/`; Cyrillic and Greek) |
| `pdf/open-methods-he.pdf` | multilingual | Repository-authored (born-digital, Typst source in `sources/`; Hebrew script) |
| `pdf/open-research-notes.pdf` | plain | Repository-authored (born-digital, Typst source in `sources/`) |
| `pdf/open-methods-footnotes.pdf` | footnote | Repository-authored (born-digital, Typst source in `sources/`; footnotes) |
| `pdf/open-methods-footnote-review.pdf` | footnote | Repository-authored (born-digital, Typst source in `sources/`; footnotes) |
| `pdf/open-methods-table.pdf` | table | Repository-authored (born-digital, Typst source in `sources/`; table) |
| `csv/open-survey-missingness.csv` | csv | Repository-authored synthetic survey data (missingness and typed cells; no personal data) |
| `csv/open-multilingual-labels.csv` | csv | Repository-authored synthetic label data (French, Japanese and Arabic labels; no personal data) |
| `txt/open-advising-note.txt` | text | Repository-authored UTF-8 test data |
| `txt/open-methods-note.txt` | text | Repository-authored UTF-8 test data |

The two `scanned` PDFs are deliberately image-only: they exercise the declared `ocr_required`
outcome, which is the required handling for scanned inputs without a text layer.

The repository-authored PDFs are compiled from the Typst sources in `sources/`; see
`sources/README.md` for the exact tool version and command.
