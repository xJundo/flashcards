import type { Course, Word } from "@/lib/types"

/**
 * Field aliases accepted on import. Notes exported from Google Docs (or run
 * through ChatGPT) rarely use the exact same keys twice, so we accept the
 * French, English and romanised spellings of each column.
 */
const KOREAN_KEYS = [
  "korean",
  "ko",
  "mot",
  "word",
  "hangul",
  "coreen",
  "coréen",
]
const ROMANIZATION_KEYS = [
  "romanization",
  "romanisation",
  "prononciation",
  "pronunciation",
  "romaja",
  "reading",
  "phonetique",
  "phonétique",
]
const TRANSLATION_KEYS = [
  "translation",
  "traduction",
  "fr",
  "french",
  "francais",
  "français",
  "meaning",
  "sens",
  "definition",
  "définition",
]
/**
 * A word can carry several notes at once (a usage example *and* the rule that
 * tells two homophones apart), so unlike the other columns every match is kept.
 */
const NOTE_KEYS = [
  "note",
  "notes",
  "remarque",
  "example",
  "exemple",
  "comment",
  "commentaire",
  "note additionnelle",
  "note additionelle",
  "note supplementaire",
  "additional note",
  "explication",
  "regle",
  "astuce",
]

export function makeId(): string {
  return globalThis.crypto.randomUUID()
}

/**
 * Field names only have to match down to case, accents and separators, so
 * `note_additionnelle`, `Note additionnelle` and `note-additionnelle` are the
 * same column. Misspellings still need their own alias.
 */
function normalizeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "")
}

function index(source: Record<string, unknown>): Map<string, unknown> {
  const normalized = new Map<string, unknown>()
  for (const [key, value] of Object.entries(source)) {
    normalized.set(normalizeKey(key), value)
  }
  return normalized
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number") return String(value)
  return ""
}

function pick(source: Record<string, unknown>, keys: string[]): string {
  const normalized = index(source)
  for (const key of keys) {
    const value = text(normalized.get(normalizeKey(key)))
    if (value) return value
  }
  return ""
}

/** Like `pick`, but collects every alias present instead of the first one. */
function pickAll(source: Record<string, unknown>, keys: string[]): string[] {
  const normalized = index(source)
  const values: string[] = []
  for (const key of keys) {
    const value = text(normalized.get(normalizeKey(key)))
    if (value && !values.includes(value)) values.push(value)
  }
  return values
}

/** Turns one loosely-typed entry into a `Word`, or `null` if it carries nothing. */
export function normalizeWord(input: unknown): Word | null {
  if (typeof input === "string") {
    const value = input.trim()
    return value
      ? { id: makeId(), korean: value, romanization: "", translation: "" }
      : null
  }
  if (!input || typeof input !== "object") return null

  const source = input as Record<string, unknown>
  const korean = pick(source, KOREAN_KEYS)
  const romanization = pick(source, ROMANIZATION_KEYS)
  const translation = pick(source, TRANSLATION_KEYS)
  const note = pickAll(source, NOTE_KEYS).join(" · ")
  if (!korean && !translation) return null

  const id = typeof source.id === "string" && source.id ? source.id : makeId()
  return { id, korean, romanization, translation, ...(note ? { note } : {}) }
}

export function normalizeWords(input: unknown): Word[] {
  const list = Array.isArray(input) ? input : [input]
  return list.map(normalizeWord).filter((word): word is Word => word !== null)
}

/** `YYYY-MM-DD` for today, in local time. */
export function today(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function normalizeDate(input: unknown): string {
  if (typeof input !== "string" || !input.trim()) return today()
  const raw = input.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  // Accept `DD/MM/YYYY` and `DD-MM-YYYY`, the usual Google Docs heading format.
  const fr = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (fr) return `${fr[3]}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}`
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime())
    ? today()
    : parsed.toISOString().slice(0, 10)
}

export type ParsedImport = {
  title?: string
  date?: string
  words: Word[]
}

/**
 * Accepts every shape we realistically get on import:
 * a bare array of words, `{ title, date, words }`, or `{ mots: [...] }`.
 * Arrays of *courses* are handled by `normalizeImportedCourses`.
 */
export function normalizeImport(input: unknown): ParsedImport {
  if (Array.isArray(input)) return { words: normalizeWords(input) }
  if (!input || typeof input !== "object") return { words: [] }

  const source = input as Record<string, unknown>
  const wordsField =
    source.words ??
    source.mots ??
    source.vocabulary ??
    source.vocabulaire ??
    source.entries
  const title = pick(source, [
    "title",
    "titre",
    "name",
    "nom",
    "lesson",
    "cours",
  ])
  const date = source.date ?? source.jour ?? source.day
  return {
    ...(title ? { title } : {}),
    ...(typeof date === "string" && date ? { date: normalizeDate(date) } : {}),
    words: normalizeWords(wordsField ?? []),
  }
}

/** A JSON payload may describe several lessons at once. */
export function normalizeImportedCourses(input: unknown): ParsedImport[] {
  if (Array.isArray(input) && input.some((item) => isCourseLike(item))) {
    return input
      .map(normalizeImport)
      .filter((course) => course.words.length > 0)
  }
  const single = normalizeImport(input)
  if (single.words.length > 0) return [single]

  // Nothing at the top level: the payload probably wraps the lessons in a key we
  // don't know about (`{ "cours": [...] }`, `{ "data": { "lessons": [...] } }`,
  // an object keyed by lesson name…). Rather than enumerate every possible
  // wrapper, look for whatever inside actually holds words.
  return searchForCourses(input)
}

/** Depth-first scan for the deepest containers that hold word-like entries. */
function searchForCourses(input: unknown, depth = 0): ParsedImport[] {
  if (depth > 6 || !input || typeof input !== "object") return []

  if (Array.isArray(input)) {
    if (input.some((item) => isCourseLike(item))) {
      return input
        .map(normalizeImport)
        .filter((course) => course.words.length > 0)
    }
    const words = normalizeWords(input)
    if (words.length > 0) return [{ words }]
    return input.flatMap((item) => searchForCourses(item, depth + 1))
  }

  const source = input as Record<string, unknown>
  if (isCourseLike(source)) {
    const course = normalizeImport(source)
    if (course.words.length > 0) return [course]
  }

  return Object.entries(source).flatMap(([key, value]) => {
    const found = searchForCourses(value, depth + 1)
    // An object keyed by lesson name gives the lesson its title for free.
    const isIndex = !Number.isNaN(Number(key))
    return found.map((course) =>
      course.title || isIndex ? course : { ...course, title: key }
    )
  })
}

function isCourseLike(input: unknown): boolean {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false
  const source = input as Record<string, unknown>
  return Boolean(
    source.words ?? source.mots ?? source.vocabulary ?? source.vocabulaire
  )
}

export function toCourse(parsed: ParsedImport, fallbackTitle: string): Course {
  const now = new Date().toISOString()
  return {
    id: makeId(),
    title: parsed.title?.trim() || fallbackTitle,
    date: normalizeDate(parsed.date),
    createdAt: now,
    updatedAt: now,
    words: parsed.words,
  }
}

export { normalizeDate }
