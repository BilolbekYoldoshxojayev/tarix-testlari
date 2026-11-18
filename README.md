# Tarix testlari — 10-sinf

Static quiz site for the 10th-grade textbooks **O‘zbekiston tarixi** (12 topics, pp. 6–79) and **Jahon tarixi** (topics 1–13, pp. 6–76). Every question is grounded in a verbatim textbook passage (checked by `tools/build.py`).

Features: per-topic tests, practice mode (instant feedback + explanation + page), timed exam mode, per-book mixed test, "Xatolarim" (repeat mistakes), best score per topic. Progress is stored in the browser (localStorage); no server, no accounts.

## Layout
| Path | What |
|---|---|
| `docs/` | The website (published). `docs/data/*.json` are generated — don't edit by hand. |
| `source/questions/<id>.json` | Question sources with `src` quotes (edit these). |
| `source/topics/<id>.txt` | Extracted textbook text (git-ignored, regenerate with `split.py`). |
| `tools/topics.py` | Topic list and page ranges. |
| `tools/build.py` | Validates questions and publishes `docs/data/`. |
| `tools/WRITING_GUIDE.md` | Rules for writing questions. |

## Edit questions
```bash
python tools/split.py "C:/Users/Bilolbek/Downloads/Telegram Desktop"
```
```bash
python tools/build.py
```
`split.py` is only needed once (it needs `pip install pymupdf`). `build.py` must report `0 errors`; then commit and push.

## Preview locally
```bash
python -m http.server 8123 -d docs
```
Open http://localhost:8123

## Publish free on GitHub Pages
1. Create a new repository on github.com (e.g. `tarix-testlari`), public.
2. In this folder:
   ```bash
   git init && git add . && git commit -m "Tarix testlari" && git branch -M main
   ```
   ```bash
   git remote add origin https://github.com/<username>/tarix-testlari.git && git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main`, folder: `/docs` → Save**.
4. After ~1 minute the site is live at `https://<username>.github.io/tarix-testlari/`.

Updates: edit `source/questions`, run `build.py`, commit, push — the site updates automatically.
