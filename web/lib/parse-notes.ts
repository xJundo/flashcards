import { makeId, normalizeDate } from "@/lib/normalize"
import type { ParsedImport } from "@/lib/normalize"
import type { Word } from "@/lib/types"

const HANGUL = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힯]/

/** Separators seen in Google Docs notes, longest/most explicit first. */
const SEPARATORS = [
  "\t",
  " | ",
  "|",
  " — ",
  " – ",
  " - ",
  " : ",
  "=>",
  "→",
  ":",
  " / ",
]

const DATE_LINE =
  /^\s*(?:cours\s*(?:du|de)?\s*)?(\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{4}-\d{2}-\d{2})\s*(?:[-—–:]\s*(.+))?$/i

function hasHangul(value: string): boolean {
  return HANGUL.test(value)
}

function splitLine(line: string): string[] {
  for (const separator of SEPARATORS) {
    if (line.includes(separator)) {
      return line
        .split(separator)
        .map((part) => part.trim())
        .filter(Boolean)
    }
  }
  return [line.trim()]
}

/** Pulls `annyeong` out of `안녕 (annyeong)`. */
function extractParenthesis(value: string): { text: string; inner: string } {
  const match = value.match(/^(.*?)[([]([^)\]]+)[)\]]\s*$/)
  if (!match) return { text: value.trim(), inner: "" }
  return { text: match[1].trim(), inner: match[2].trim() }
}

function toWord(parts: string[]): Word | null {
  if (parts.length === 0) return null

  let [first, second, third] = parts
  // A line may put the translation first; the hangul side is the reliable anchor.
  if (
    parts.length >= 2 &&
    !hasHangul(first) &&
    hasHangul(parts[parts.length - 1])
  ) {
    ;[first, second, third] = [...parts].reverse()
  }

  const head = extractParenthesis(first)
  const korean = head.text
  let romanization = head.inner
  let translation = ""

  if (parts.length >= 3) {
    romanization = romanization || second
    translation = third
  } else if (parts.length === 2) {
    const tail = extractParenthesis(second)
    if (tail.inner) {
      translation = tail.text
      romanization = romanization || tail.inner
    } else if (
      !romanization &&
      !hasHangul(second) &&
      looksRomanized(second, korean)
    ) {
      romanization = second
    } else {
      translation = second
    }
  }

  if (!korean && !translation) return null
  return {
    id: makeId(),
    korean,
    romanization,
    translation,
    ...(parts.length > 3 ? { note: parts.slice(3).join(" — ") } : {}),
  }
}

/**
 * A 2-column line is ambiguous: `한국 - hanguk` is a reading, `한국 - Corée` is a
 * translation. Romanised Korean is lowercase, unaccented and roughly as long as
 * the hangul it transcribes.
 */
function looksRomanized(value: string, korean: string): boolean {
  if (!korean) return false
  if (!/^[a-z][a-z\s'-]*$/.test(value)) return false
  return value.replace(/\s/g, "").length <= korean.replace(/\s/g, "").length * 4
}

export type ParseNotesResult = ParsedImport & { skipped: string[] }

/**
 * Parses a raw Google Docs note (plain text) into a lesson.
 * Recognises an optional leading `dd/mm/yyyy — Titre` or `# Titre` heading.
 */
export function parseNotes(input: string): ParseNotesResult {
  const lines = input
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•‣▪]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)

  const words: Word[] = []
  const skipped: string[] = []
  let title: string | undefined
  let date: string | undefined

  for (const [index, line] of lines.entries()) {
    const dateMatch = line.match(DATE_LINE)
    if (dateMatch && !date) {
      date = normalizeDate(dateMatch[1])
      if (dateMatch[2]?.trim() && !title) title = dateMatch[2].trim()
      continue
    }

    if (line.startsWith("#")) {
      const heading = line.replace(/^#+\s*/, "").trim()
      if (!title && heading) title = heading
      continue
    }

    const parts = splitLine(line)
    if (parts.length === 1) {
      // A lone line before any vocabulary is a title; anywhere else it is noise.
      if (!title && index < 2 && !hasHangul(line)) title = line
      else skipped.push(line)
      continue
    }

    const word = toWord(parts)
    if (word) words.push(word)
    else skipped.push(line)
  }

  return {
    ...(title ? { title } : {}),
    ...(date ? { date } : {}),
    words,
    skipped,
  }
}
