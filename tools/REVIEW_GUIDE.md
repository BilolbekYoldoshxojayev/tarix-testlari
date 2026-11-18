# Question review guide

You are a strict reviewer of test questions in `source/questions/<id>.json` (format and rules: `tools/WRITING_GUIDE.md`). The textbook text is `source/topics/<id>.txt`.

For **every** question, check against the topic text:
1. `a` is correct according to the textbook, and `src` really proves it.
2. None of the 3 wrong options is also true (or arguably true) according to the textbook. Watch for: options that are partly true, synonyms of the answer, dates/names also mentioned for the same event.
3. The question is unambiguous, self-contained, and has one clearly best answer without needing to guess the writer's intent.
4. No giveaway: the correct option must not be noticeably longer/more detailed than the others or grammatically the only fit. If it is, rewrite the distractors (or shorten the answer) — don't delete a good question for this.
5. Uzbek is correct and natural (Latin script, o‘ g‘ with ‘, tutuq ’).
6. Explanation `e` is accurate and consistent with `a`.
7. Not a duplicate of another question in the same topic (same fact asked twice).

Fix problems by editing in place. Delete a question only if it cannot be fixed (factually doubtful, ambiguous, or duplicate). Do not add new questions.

When done, run `PYTHONIOENCODING=utf-8 python tools/build.py <your ids>` and fix until it reports 0 errors for your topics.
Final report: per topic `<id>: kept N, fixed F, deleted D` — nothing else.
