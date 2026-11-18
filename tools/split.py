"""Extract each topic's pages from the textbook PDFs into source/topics/<id>.txt.

Usage: python tools/split.py "<folder with PDFs>"
"""
import sys
from pathlib import Path

import pymupdf

from topics import BOOKS, TOPICS

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "source" / "topics"


def main(pdf_dir: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    docs = {k: pymupdf.open(Path(pdf_dir) / b["pdf"]) for k, b in BOOKS.items()}
    for tid, book, title, start, end in TOPICS:
        doc = docs[book]
        parts = [f"# {title}\n"]
        for p in range(start, end + 1):
            parts.append(f"\n<<<SAHIFA {p}>>>\n" + doc[p - 1].get_text())
        text = "".join(parts)
        (OUT / f"{tid}.txt").write_text(text, encoding="utf-8")
        print(tid, f"pp.{start}-{end}", len(text), "chars")


if __name__ == "__main__":
    main(sys.argv[1])
