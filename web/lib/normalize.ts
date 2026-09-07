import { TEXT_ALIGNS } from "@/lib/types"
import type { Card, Course, TextAlign } from "@/lib/types"

/**
 * Field aliases accepted on import. Notes exported from Google Docs (or run
 * through ChatGPT) rarely use the exact same keys twice, so we accept the
 * French, English and romanised spellings of each column — plus the generic
 * recto/verso vocabulary for imports that aren't Korean at all.
 */
const FRONT_KEYS = [
  "front",
  "recto",
  "korean",
  "ko",
  "mot",
  "word",
  "hangul",
  "coreen",
  "coréen",
]
const PHONETIC_KEYS = [
  "phonetic",
  "phonetique",
  "phonétique",
  "romanization",
  "romanisation",
  "prononciation",
  "pronunciation",
  "romaja",
  "reading",
]
const BACK_KEYS = [
  "back",
  "verso",
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
const FRONT_IMAGE_KEYS = ["frontimage", "rectoimage", "imagerecto", "imagefront"]
const BACK_IMAGE_KEYS = ["backimage", "versoimage", "imageverso", "imageback"]
const ALIGN_KEYS = ["align", "alignment", "textalign", "alignement"]

/**
 * What the export endpoint embeds for a card's picture. Only this exact
 * shape is accepted on import — a bare URL or a stray `true`/`false` is
 * ignored — so this only ever round-trips an image this app exported itself.
 */
const IMAGE_DATA_URL = /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/]+=*$/

export function makeId(): string {
  return globalThis.crypto.randomUUID()
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Ids are database keys, so anything that isn't a UUID is rejected outright. */
export function isId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value)
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
    .replace(/[̀-ͯ]/g, "")
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

/** An embedded picture, in the exact shape the export endpoint writes it. */
function pickImageData(
  source: Record<string, unknown>,
  keys: string[]
): string | undefined {
  const normalized = index(source)
  for (const key of keys) {
    const value = normalized.get(normalizeKey(key))
    if (typeof value === "string" && IMAGE_DATA_URL.test(value.trim()))
      return value.trim()
  }
  return undefined
}

/** `align: "Justify"`, `"JUSTIFY"`, etc. all resolve the same way; anything
 *  else (a typo, an unsupported value) is dropped rather than rejecting the
 *  whole word — it just falls back to the centered default. */
function pickAlign(source: Record<string, unknown>): TextAlign | undefined {
  const normalized = index(source)
  for (const key of ALIGN_KEYS) {
    const value = normalized.get(normalizeKey(key))
    if (typeof value !== "string") continue
    const align = value.trim().toLowerCase()
    if (TEXT_ALIGNS.includes(align as TextAlign)) return align as TextAlign
  }
  return undefined
}

/** Turns one loosely-typed entry into a `Card`, or `null` if it carries nothing. */
export function normalizeWord(input: unknown): Card | null {
  if (typeof input === "string") {
    const value = input.trim()
    return value ? { id: makeId(), front: value, phonetic: "", back: "" } : null
  }
  if (!input || typeof input !== "object") return null

  const source = input as Record<string, unknown>
  const front = pick(source, FRONT_KEYS)
  const phonetic = pick(source, PHONETIC_KEYS)
  const back = pick(source, BACK_KEYS)
  const note = pickAll(source, NOTE_KEYS).join(" · ")
  const frontImage = pickImageData(source, FRONT_IMAGE_KEYS)
  const backImage = pickImageData(source, BACK_IMAGE_KEYS)
  const align = pickAlign(source)
  if (!front && !back) return null

  // Always a fresh id: every caller either creates a brand-new course or
  // appends brand-new cards, never reconciles against an existing one by id.
  // Trusting an id carried over in the JSON — typically another card's own
  // id, from a previous export — would risk colliding with it, or silently
  // inheriting its progress and images.
  return {
    id: makeId(),
    front,
    phonetic,
    back,
    ...(note ? { note } : {}),
    ...(frontImage ? { frontImage } : {}),
    ...(backImage ? { backImage } : {}),
    ...(align ? { align } : {}),
  }
}

export function normalizeWords(input: unknown): Card[] {
  const list = Array.isArray(input) ? input : [input]
  return list.map(normalizeWord).filter((word): word is Card => word !== null)
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
  words: Card[]
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
    source.cards ??
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
    source.words ??
    source.cards ??
    source.mots ??
    source.vocabulary ??
    source.vocabulaire
  )
}

/** The author is attached when the lesson is stored, not when it is parsed. */
export function toCourse(
  parsed: ParsedImport,
  fallbackTitle: string
): Omit<Course, "owner" | "spaceId" | "folderId" | "speechLocale"> {
  const now = new Date().toISOString()
  return {
    id: makeId(),
    title: parsed.title?.trim() || fallbackTitle,
    date: normalizeDate(parsed.date),
    createdAt: now,
    updatedAt: now,
    cards: parsed.words,
    hasSheet: false,
  }
}

export { normalizeDate }
