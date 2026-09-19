# Authored fixture sources

These Typst sources produce the repository-authored PDFs in `../pdf/`. They were compiled with
Typst 0.15.1 (the engine bundled with Quarto 1.10.18):

    typst compile <name>.typ <name>.pdf

Fonts are the system fonts named in each source (for example Microsoft YaHei, Yu Gothic,
Malgun Gothic, Arial, Times New Roman). The compiled PDFs are committed unmodified and their
SHA-256 values are pinned in `../manifest.json`.
