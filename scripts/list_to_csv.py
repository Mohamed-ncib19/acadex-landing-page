# Turns a published list of schools (a PDF with tables, or an Excel/CSV file)
# into one clean table: a CSV, or an Excel file when the output ends in .xlsx.
#
#   python scripts/list_to_csv.py liste-primaire.pdf liste-secondaire.pdf -o ecoles.csv
#   python scripts/list_to_csv.py liste.pdf -o ecoles.xlsx
#   python scripts/list_to_csv.py liste.pdf -o ecoles.csv --sep ";"      (Excel in French)
#   python scripts/list_to_csv.py liste.pdf -o ecoles.csv --rtl off      (Arabic comes out wrong: try off, or on)
#
# Needs: pip install pdfplumber openpyxl
#
# What it does: reads every table of every page, takes the first row of the
# first table as the column names, drops the header rows repeated on the next
# pages, the empty rows and the exact duplicates, and adds where each row comes
# from (file, page). Arabic that the PDF stores as it is drawn (letter shapes,
# left to right) is put back the way it is typed, and the columns of a
# right-to-left table are put back in their order. It does not guess, correct
# or complete any content.
#
# Checked on a sample PDF made for the test (Arabic and French, three pages),
# not on the ministry's own file: open the result and compare a few rows with
# the PDF before using it.
#
# What it cannot do: a scanned PDF has no text to read (it needs OCR first), and
# a list laid out without table lines comes out as one column of text.
#
# The list is the ministry's; contacting the schools in it, and the rules that
# apply to that (consent, personal data), are the owner's responsibility.
import argparse
import csv
import re
import sys
import unicodedata
from pathlib import Path

ARABIC = re.compile(r"[؀-ۿﭐ-﷿ﹰ-﻿]")


DRAWN = re.compile(r"[ﭐ-﷿ﹰ-﻿]")  # letter shapes as drawn, not as typed
MIRROR = str.maketrans("()[]{}«»", ")(][}{»«")
# At the start and in the middle of a word, Arabic fonts draw yeh, heh and kaf
# with the same shapes as three Persian/Urdu letters, and a PDF may name the
# shape after the wrong one. Here they are named after the Arabic letter again.
SAME_SHAPE = str.maketrans({"ﯾ": "ﻳ", "ﯿ": "ﻴ", "ﮬ": "ﻫ", "ﮭ": "ﻬ", "ﮐ": "ﻛ", "ﮑ": "ﻜ"})


def clean(value, drawn=False):
    """One cell: single spaces, and Arabic put back the way it is typed and read."""
    text = "" if value is None else str(value)
    lines = [re.sub(r"\s+", " ", line.replace(" ", " ")).strip() for line in text.splitlines()]
    lines = [line for line in lines if line]
    if not ARABIC.search(text):
        return " ".join(lines)
    if drawn:
        # The PDF stores Arabic as it is drawn: letter shapes, left to right.
        # Each line is put back in reading order.
        lines = [" ".join(word[::-1].translate(MIRROR) if ARABIC.search(word) else word for word in reversed(line.split(" "))) for line in lines]
    # Letter shapes become letters again.
    return unicodedata.normalize("NFKC", " ".join(lines).translate(SAME_SHAPE))


def rows_from_pdf(path, rtl):
    import pdfplumber

    raw = []
    with pdfplumber.open(path) as pdf:
        for number, page in enumerate(pdf.pages, start=1):
            for table in page.extract_tables():
                for row in table:
                    raw.append((number, ["" if cell is None else str(cell) for cell in row]))
        if not raw:
            # No table lines: keep the text, one line per row, so nothing is lost.
            for number, page in enumerate(pdf.pages, start=1):
                for line in (page.extract_text() or "").splitlines():
                    if line.strip():
                        raw.append((number, [line]))
            if raw:
                print(f"  {path.name}: no table found, the text is kept as one column", file=sys.stderr)
            else:
                print(f"  {path.name}: no text at all — a scanned PDF needs OCR first", file=sys.stderr)
    # One answer for the whole file: is its Arabic stored as it is drawn?
    drawn = rtl == "on" or (rtl == "auto" and any(DRAWN.search(cell) for _, cells in raw for cell in cells))
    rows = [(number, [clean(cell, drawn) for cell in cells]) for number, cells in raw]
    # A table written right to left is read by the PDF library from its left edge:
    # its first column comes last. When the header is in Arabic, the columns are put back.
    first = next((cells for _, cells in rows if any(cells)), [])
    arabic_header = sum(1 for cell in first if ARABIC.search(cell)) * 2 > sum(1 for cell in first if cell)
    if rtl == "on" or (rtl == "auto" and arabic_header and len(first) > 1):
        rows = [(number, cells[::-1]) for number, cells in rows]
    return rows


def rows_from_sheet(path):
    rows = []
    if path.suffix.lower() == ".csv":
        with open(path, newline="", encoding="utf-8-sig") as handle:
            sample = handle.read(4096)
            handle.seek(0)
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t") if sample.strip() else csv.excel
            for record in csv.reader(handle, dialect):
                rows.append((1, [clean(cell) for cell in record]))
        return rows
    from openpyxl import load_workbook

    book = load_workbook(path, read_only=True, data_only=True)
    for sheet in book.worksheets:
        for record in sheet.iter_rows(values_only=True):
            rows.append((sheet.title, [clean(cell) for cell in record]))
    return rows


def convert(paths, rtl="auto"):
    header, out = None, []
    seen = set()
    for path in paths:
        suffix = path.suffix.lower()
        rows = rows_from_pdf(path, rtl) if suffix == ".pdf" else rows_from_sheet(path)
        kept = 0
        for origin, cells in rows:
            while cells and not cells[-1]:
                cells.pop()
            if not any(cells):
                continue
            if header is None:
                header = cells
                continue
            if cells == header[: len(cells)] or cells[: len(header)] == header:
                continue  # the header, repeated on a new page or in the next file
            key = tuple(cells)
            if key in seen:
                continue
            seen.add(key)
            out.append(cells + [""] * (len(header) - len(cells)) + [path.name, origin])
            kept += 1
        print(f"  {path.name}: {kept} rows", file=sys.stderr)
    if header is None:
        return [], []
    width = max([len(header)] + [len(row) - 2 for row in out])
    names = [name or f"col_{index + 1}" for index, name in enumerate(header + [""] * (width - len(header)))]
    table = [row[:-2] + [""] * (width - (len(row) - 2)) + row[-2:] for row in out]
    return names + ["source_file", "source_page"], table


def main():
    parser = argparse.ArgumentParser(description="Published list of schools (PDF, Excel, CSV) → one clean CSV or Excel table.")
    parser.add_argument("files", nargs="+", type=Path)
    parser.add_argument("-o", "--output", type=Path, required=True)
    parser.add_argument("--sep", default=",", help='column separator of the CSV (use ";" for Excel in French)')
    parser.add_argument("--rtl", choices=["auto", "on", "off"], default="auto",
                        help="Arabic stored as drawn in the PDF: auto detects it and puts text and columns back in reading order; on forces it; off leaves the file as read")
    args = parser.parse_args()

    missing = [str(path) for path in args.files if not path.exists()]
    if missing:
        sys.exit("not found: " + ", ".join(missing))
    names, table = convert(args.files, args.rtl)
    if not table:
        sys.exit("nothing to write: no row was read")

    if args.output.suffix.lower() == ".xlsx":
        from openpyxl import Workbook

        book = Workbook()
        sheet = book.active
        sheet.append(names)
        for row in table:
            sheet.append(row)
        sheet.freeze_panes = "A2"
        book.save(args.output)
    else:
        # utf-8-sig: Excel then reads the accents and the Arabic correctly.
        with open(args.output, "w", newline="", encoding="utf-8-sig") as handle:
            writer = csv.writer(handle, delimiter=args.sep)
            writer.writerow(names)
            writer.writerows(table)
    print(f"wrote {args.output}: {len(table)} rows, {len(names)} columns")


if __name__ == "__main__":
    main()
