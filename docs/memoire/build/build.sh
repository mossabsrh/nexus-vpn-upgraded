#!/usr/bin/env bash
# Build the mémoire Word + PDF from the Markdown chapters.
#   Usage:  bash build/build.sh ch2 ch3        (from docs/memoire)
#   Output: build/out/memoire-<slug>.docx and .pdf, plus build/out/pages/*.png for visual review.
#
# Pipeline: preprocess.py (strip draft comments/Notes heading/HR, fix image paths + sizes, concat)
#           -> pandoc (Markdown -> Word, using the methodology-guide reference.docx)
#           -> LibreOffice (Word -> PDF)
#           -> PyMuPDF (PDF -> one PNG per page, for checking).
set -euo pipefail

# Tools are looked up so the build runs on any of the authors' PCs (override with PANDOC=... / SOFFICE=...).
# Without LibreOffice, Microsoft Word (COM, via build/docx2pdf.ps1) does the Word -> PDF step.
PANDOC="${PANDOC:-$(command -v pandoc || true)}"
for p in "/c/Users/My_Pc/AppData/Local/Pandoc/pandoc.exe" "${LOCALAPPDATA:-}/Pandoc/pandoc.exe"; do
  [ -n "$PANDOC" ] || { [ -x "$p" ] && PANDOC="$p"; }
done
[ -n "$PANDOC" ] || { echo "pandoc not found (install it or set PANDOC=...)" >&2; exit 1; }
SOFFICE="${SOFFICE:-/c/Program Files/LibreOffice/program/soffice.exe}"
# Python with python-docx, pymupdf, matplotlib, lxml (e.g. PYTHON=.../venv/Scripts/python.exe).
PY="${PYTHON:-python}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # docs/memoire/build
ROOT="$(cd "$HERE/.." && pwd)"                          # docs/memoire
cd "$ROOT"

mkdir -p build/out/pages

# "full" assembles the whole mémoire in the methodology-guide order; otherwise build the given chapters.
if [ "${1:-}" = "full" ]; then
  slug="full"
  # The title page is a copy of the cover, in the same first section, preceded by a blank page.
  tp="build/out/_title-page.md"
  {
    printf '```{=openxml}\n<w:p><w:r><w:br w:type="page"/></w:r></w:p>\n<w:p><w:r><w:br w:type="page"/></w:r></w:p>\n```\n\n'
    cat chapters/cover.md
  } > "$tp"
  src=(chapters/cover.md "$tp" chapters/dedication.md chapters/acknowledgements.md chapters/abstracts.md\
       chapters/list-of-figures.md chapters/list-of-tables.md chapters/list-of-abbreviations.md \
       chapters/contents.md chapters/introduction.md chapters/problem-statement.md \
       chapters/ch1.md chapters/ch2.md chapters/ch3.md chapters/ch4.md \
       chapters/conclusion.md chapters/bibliography.md chapters/annexes.md chapters/toc.md)
else
  chapters=("$@"); [ ${#chapters[@]} -gt 0 ] || chapters=(ch2 ch3)
  slug=$(IFS=-; echo "${chapters[*]}")
  src=(); for c in "${chapters[@]}"; do src+=("chapters/${c}.md"); done
fi

combined="build/out/combined.md"
docx="build/out/memoire-${slug}.docx"
pdf="build/out/memoire-${slug}.pdf"
workpdf="build/out/_pdf/memoire-${slug}.pdf"

# 1. (Re)build the reference.docx from pandoc's default + the methodology-guide styles.
if [ ! -f build/reference-default.docx ]; then
  "$PANDOC" -o build/reference-default.docx --print-default-data-file reference.docx
fi
"$PY" -I build/make_reference.py build/reference-default.docx build/reference.docx

build_once() {
  # 2. Preprocess + concatenate the Markdown parts.
  "$PY" -I build/preprocess.py "$combined" "$ROOT" "${src[@]}"

  # 3. Markdown -> Word (footnotes, figures and tables are native; run from docs/memoire so figures/ resolves).
  # -implicit_figures: we write our own bold caption line under each image, so disable pandoc's
  # auto-caption (from the alt text) to avoid a duplicate caption under every figure.
  "$PANDOC" "$combined" --reference-doc=build/reference.docx --from=markdown-implicit_figures --to=docx --resource-path="$ROOT" -o "$docx"
  "$PY" -I build/fix_docx.py "$docx"
  echo "docx written: $docx"

  # 4. Word -> PDF.
  # Convert into a work folder first (a PDF viewer may hold a lock on the published copy), then copy;
  # the checks below always read the fresh work copy, so a locked viewer copy never stops the build.
  mkdir -p build/out/_pdf
  rm -f "$workpdf"
  if [ -x "$SOFFICE" ]; then
    "$SOFFICE" --headless --convert-to pdf --outdir build/out/_pdf "$docx" >/dev/null 2>&1 || true
  else
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(cygpath -wa build/docx2pdf.ps1)" \
      "$(cygpath -wa "$docx")" "$(cygpath -wa "$workpdf")" || true
  fi
  [ -f "$workpdf" ] || { echo "PDF conversion failed" >&2; exit 1; }
  if cp -f "$workpdf" "$pdf" 2>/dev/null; then echo "pdf written:  $pdf"
  else echo "WARNING: $pdf is locked (open in a viewer?) - fresh PDF is at $workpdf"; fi
}

build_once

# 4b. Full build only: read the printed page numbers of every caption / part heading from the PDF,
# write them into the lists of figures / tables and the short contents, then rebuild once.
if [ "$slug" = "full" ]; then
  "$PY" -I build/fill_lists.py "$workpdf" chapters
  build_once
fi

# 5. PDF -> one PNG per page (for visual review).
rm -f build/out/pages/*.png
"$PY" -I - "$workpdf" build/out/pages <<'PY'
import sys, pymupdf
doc = pymupdf.open(sys.argv[1]); out = sys.argv[2]
for i, page in enumerate(doc, 1):
    page.get_pixmap(dpi=110).save(f"{out}/p{i:02d}.png")
print(f"rendered {doc.page_count} pages -> {out}/")
PY
