"""Validate source/questions/<id>.json and publish docs/data/*.json (without source quotes).

Question format (source):
  {"q": str, "a": str (correct), "w": [str, str, str] (wrong), "e": str (explanation),
   "p": int (textbook page), "src": str (verbatim textbook snippet supporting the answer)}

Usage: python tools/build.py [topic_id ...]   (validate only given topics; publish all valid)
Exit code 1 if any error.
"""
import json
import re
import sys
from pathlib import Path

from topics import BOOKS, TOPICS

ROOT = Path(__file__).resolve().parent.parent
SRC_Q = ROOT / "source" / "questions"
SRC_T = ROOT / "source" / "topics"
OUT = ROOT / "docs" / "data"

APOS = re.compile(r"[ʻʼ‘’`´']")


def norm(s: str) -> str:
    s = APOS.sub("'", s)
    s = re.sub(r"[“”«»\"]", '"', s)
    s = re.sub(r"[–—]", "-", s)
    s = re.sub(r"-\s*\n\s*", "", s)  # hyphenated line breaks
    s = re.sub(r"\s+", " ", s)
    return s.strip().lower()


def pages(text: str) -> dict:
    out = {}
    for m in re.finditer(r"<<<SAHIFA (\d+)>>>\n(.*?)(?=\n<<<SAHIFA |\Z)", text, re.S):
        out[int(m.group(1))] = m.group(2)
    return out


def check(tid: str, start: int, end: int) -> tuple[list, list]:
    errors = []
    qs = json.loads((SRC_Q / f"{tid}.json").read_text(encoding="utf-8"))
    pg = pages((SRC_T / f"{tid}.txt").read_text(encoding="utf-8"))
    seen = set()
    for i, q in enumerate(qs, 1):
        tag = f"{tid}#{i}"
        if set(q) != {"q", "a", "w", "e", "p", "src"}:
            errors.append(f"{tag}: fields {sorted(q)}")
            continue
        opts = [q["a"], *q["w"]]
        if len(q["w"]) != 3 or any(not isinstance(o, str) or not o.strip() for o in opts):
            errors.append(f"{tag}: need 1 correct + 3 non-empty wrong options")
        if len({norm(o) for o in opts}) != 4:
            errors.append(f"{tag}: duplicate options")
        if not (start <= q["p"] <= end):
            errors.append(f"{tag}: page {q['p']} outside {start}-{end}")
        nq = norm(q["q"])
        if nq in seen:
            errors.append(f"{tag}: duplicate question")
        seen.add(nq)
        near = norm(" ".join(pg.get(p, "") for p in (q["p"] - 1, q["p"], q["p"] + 1)))
        if len(norm(q["src"])) < 15 or norm(q["src"]) not in near:
            errors.append(f"{tag}: src not found verbatim near p.{q['p']}: {q['src'][:60]!r}")
    return qs, errors


def main(only: list) -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    books = {k: {"title": v["title"]} for k, v in BOOKS.items()}
    index, all_errors = {"books": books, "topics": []}, []
    for tid, book, title, start, end in TOPICS:
        f = SRC_Q / f"{tid}.json"
        if not f.exists():
            continue
        if only and tid not in only:
            qs, errs = json.loads(f.read_text(encoding="utf-8")), []
        else:
            qs, errs = check(tid, start, end)
        all_errors += errs
        if errs:
            continue
        pub = [{k: q[k] for k in ("q", "a", "w", "e", "p")} for q in qs]
        (OUT / f"{tid}.json").write_text(json.dumps(pub, ensure_ascii=False), encoding="utf-8")
        index["topics"].append({"id": tid, "book": book, "title": title, "pages": [start, end], "count": len(qs)})
    (OUT / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    for e in all_errors:
        print("ERROR", e)
    total = sum(t["count"] for t in index["topics"])
    print(f"published {len(index['topics'])} topics, {total} questions, {len(all_errors)} errors")
    return 1 if all_errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
