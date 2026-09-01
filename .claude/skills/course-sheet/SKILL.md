---
name: course-sheet
description: Generates a one-page "fiche de révision" PDF study sheet from a flashcards course JSON (the format used by this app's courses — title, date, words with korean/romanization/translation/note). Triggers when the user asks to generate, create, or make a PDF, a "fiche de révision", a study sheet, or a revision sheet for a course, especially when pointing at one of the dated course JSON files in this repo (e.g. `2026-09-04-le-passe-atsseoyo-eosseoyo.json`). The output gets uploaded by hand into the app's course page ("Importer le PDF") — this skill only produces the file, it never touches the database.
---

# Course sheet

Turns a course's raw word list into a designed, memorable one-page PDF — the
kind of dense revision sheet a good teacher hands out before an exam, not a
plain export of the word table. The app already renders whatever PDF gets
uploaded (inline, in a bottom drawer during a series, and on the course
page); this skill is the other half — the thing that produces that PDF in
the first place, run locally, once per course, whenever the user asks for
one.

## Inputs

A path to a course JSON, shaped like the files at the root of this repo:

```json
{
  "title": "Le passé : -았/었어요",
  "date": "2026-09-04",
  "words": [
    { "korean": "...", "romanization": "...", "translation": "...", "note": "" }
  ]
}
```

`note` is optional and often empty. Some words are grammar terminations
(`았어요 / 었어요`), some are full example sentences — treat both as material
for the sheet, not just the "vocabulary" ones.

If the user hands over a course JSON that lives in the app's own format
instead (from the `/api/courses/:id/export` endpoint — has `id`, `owner`,
etc.), the relevant fields are the same `title`, `date`, and `words`; ignore
the rest.

## What makes this sheet worth reading twice

Do not just reformat the word list. Read every word and note, work out the
*grammar or theme actually being taught*, and build the sheet around that —
the same synthesis a tutor does before writing a handout. Concretely, apply:

- **Chunking** — group words by pattern or theme, never as one long flat
  list. A course teaching a vowel-harmony rule wants a group per branch of
  the rule, not one table of 15 conjugated forms.
- **Contrast, not repetition** — when two forms of the same idea keep
  appearing (a regular vs. an irregular verb, a rule split on a final
  consonant vs. vowel), show them side by side once, rather than restating
  the rule under every row. The template's `.contrast` block and
  `.rule-pair` exist for exactly this.
- **Dual coding** — two kinds, don't mix them on one row. Each group header
  gets one fitting emoji (a pointer back to the group's idea, not decoration).
  Each *concrete* word — a person, place, object, food, animal — gets a real
  icon instead: a small `.icon-badge` with an inline SVG from
  [icons.md](./icons.md), the same Lucide icon set the app's own UI uses.
  Emoji reads as a note in the margin; a proper icon reads as the word's own
  picture, which is the point for a noun a learner can actually visualize.
  Never put both an emoji and an icon on the same word.
- **One mnemonic hook per group** — a short, concrete image or story for
  *why* a form is what it is (e.g. "가 + 았어요 s'embrassent et fusionnent
  en 갔어요"), not a restatement of the grammatical rule in different words.
- **Primacy + recency** — the sheet opens with "L'essentiel en 10
  secondes" (the single idea to keep even from a five-second glance) and
  always closes with a "Teste-toi" retrieval prompt — never let the last
  thing on the page be a plain table.

## Which sections to use

Not every course has all of these — a pure vocabulary list has no rule to
contrast, and that's fine.

| Section | Use it when… | Skip it when… |
|---|---|---|
| `.essential` (🎯) | Always. | Never skip. |
| `.rule-pair` | There's a binary condition worth seeing before any word list (vowel harmony, regular/irregular). | The course is just vocabulary with no rule. |
| `.group` (🧩/🧊/…) | Per pattern or theme — 3 to 6 words each is a good size. | A single leftover word: fold it into the closest group instead of making a group of one. |
| `.contrast` inside a `.group` | Exactly two forms are genuinely confusable and worth a side-by-side. | More than two forms — use a plain group table instead. |
| `.icon-badge` (per word, from [icons.md](./icons.md)) | The word names a concrete, illustratable thing. | Grammar particles, endings, abstract words — leave the row with no icon rather than force one. |
| `.test-yourself` (🔁) | Always, last. | Never skip. |

## Building the sheet

1. **Read the source JSON.** Note the title, date, and every word + note.
2. **Group the words** by the actual grammar point or theme, in teaching
   order (the order a lesson would introduce them), not the JSON's order.
3. **Copy [template.html](./template.html)** to a scratch path and replace
   every `<!-- FILL: ... -->` block with real content, following the section
   table above. Keep the `<style>` block byte-for-byte — it is the shared
   visual identity across every sheet this skill produces; do not invent new
   colors, fonts, or layout.
4. **Keep it dense but honest.** Aim for one page. A long course (25+ words)
   can run to two pages before it stops being a quick "fiche" — don't shrink
   the font past what the template already uses to force a fit; drop the
   least essential example sentences instead.
5. **Render it to PDF**, from the scratch HTML file:

   ```
   chromium --headless --disable-gpu --no-sandbox \
     --print-to-pdf=<output>.pdf \
     --print-to-pdf-no-header --no-pdf-header-footer \
     file:///absolute/path/to/scratch.html
   ```

   If `chromium` isn't on `PATH`, try `chromium-browser`, `google-chrome`,
   `google-chrome-stable`, or `brave-browser` in that order — same flags.
   Everything is system-font based (Noto Sans CJK KR for Hangul is already
   installed on this machine; emoji render through Noto Color Emoji) and
   fully offline — no network fetch happens during the render, so nothing
   about page structure depends on internet access.

   Name the output after the source JSON: `<same-basename>.pdf` next to it
   (e.g. `2026-09-04-le-passe-atsseoyo-eosseoyo.pdf`), unless the user asked
   for somewhere else.

6. **Proofread it before handing it back.** Rasterize the first page and
   look at it — a sheet that silently renders with tofu boxes, an overflowing
   table, or a washed-out palette is worse than admitting it needs another
   pass:

   ```
   pdftoppm -png -r 110 <output>.pdf <output>-preview
   ```

   then read `<output>-preview-1.png` with the Read tool. Fix and re-render
   if anything looks wrong — cut-off text, a broken color, or a group that
   spilled onto an unwanted second page.

7. **Hand it back.** Tell the user the absolute path to the finished PDF,
   and remind them how it reaches the app: open the course's page, use
   "Importer le PDF" in the "Fiche de révision" section (or drag a new
   version in later to replace it — a re-upload always replaces the
   previous sheet, there's only ever one per course). This skill never
   calls the app's API or touches the database itself.

## Notes

- Never invent vocabulary or grammar not present in the source JSON — every
  Korean form on the sheet must trace back to a `word` or its `note`.
- If a note already explains the mnemonic better than you could rephrase it
  (many of this app's course notes already carry the teaching insight, e.g.
  "가+았어요 se contracte en 갔어요"), reuse that wording rather than
  inventing a different one.
- Keep sheet copy in French, matching the app and its courses; Korean stays
  in Korean, romanization stays lowercase-with-spaces as given in the JSON.
