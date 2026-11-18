# Question writing guide

You write multiple-choice test questions for 10th-grade students in Uzbekistan, **strictly from the textbook text** in `source/topics/<id>.txt`. Output goes to `source/questions/<id>.json`.

## Format
A JSON array. Each item:
```json
{"q": "Savol matni?", "a": "To‘g‘ri javob", "w": ["Noto‘g‘ri 1", "Noto‘g‘ri 2", "Noto‘g‘ri 3"],
 "e": "1–2 gaplik izoh: nega bu javob to‘g‘ri.", "p": 12,
 "src": "darslikdan aynan ko‘chirilgan, javobni isbotlaydigan parcha"}
```
- `a` = the single correct answer; `w` = exactly 3 wrong answers. The site shuffles options.
- `p` = the page (`<<<SAHIFA N>>>` marker) where `src` appears.
- `src` = an exact, contiguous copy from the topic file (≥ 15 chars) that proves `a`. Copy it as-is; line breaks/hyphenation are normalized by the validator. Never paraphrase `src`.

## Quantity
Make **as many good questions as the text honestly supports**: cover every distinct testable fact — dates, people, places, events, causes and consequences, reforms, documents, terms, numbers, cultural figures and works. Typical range: ~3–4 questions per page of real content. Never pad: no duplicates, no rewording of the same fact twice, no trivia about captions/page layout.

## Quality rules
1. Language: literary Uzbek, Latin script, textbook spelling (o‘, g‘ with ‘ ; tutuq belgisi ’).
2. Exactly one answer is correct **according to the textbook**. Wrong options must be clearly wrong per the textbook, yet plausible: same type (all years / all persons / all cities), same era/region, similar length and grammar. Use real names/dates from the same topic as distractors when possible.
3. No "barcha javoblar to‘g‘ri", "hech biri", "A va B". Negative questions ("qaysi biri noto‘g‘ri") only rarely, and then exactly one option must be false.
4. Questions must be self-contained: never "matnda", "yuqorida", "rasmda", "darslikda aytilganidek".
5. Mix difficulty: ~60% recall (kim, qachon, qayerda, nima), ~40% understanding (sabab, oqibat, mohiyat, qaysi fikr to‘g‘ri, solishtirish).
6. Only use facts stated in the text. Ignore extraction garbage (repeated headings, broken characters) and the "FAOLLASHTIRUVCHI SAVOL", "SAVOL VA TOPSHIRIQLAR" exercise prompts (they are not facts). "MA’LUMOT UCHUN", "YODDA TUTING", document excerpts are fine sources.
7. If the text gives a fact ambiguously or contradicts itself, skip it.

## Validate
Run `python tools/build.py <id> [<id> ...]` from the project root and fix every reported error for your topics until it prints 0 errors for them.
