import { HIGHLIGHT_KEYS, isHighlightKey } from "@/lib/colors"
import type { HighlightKey } from "@/lib/colors"

export { HIGHLIGHT_KEYS }
export type { HighlightKey }

/** One run of text sharing the same formatting. */
export type Segment = {
  text: string
  bold?: boolean
  highlight?: HighlightKey
}

const HIGHLIGHT_RE = /==(\w+):([^=]+)==/g
const BOLD_RE = /\*\*([^*]+)\*\*/g

/** Splits a plain string on `**bold**`, keeping the rest as unstyled runs. */
function splitBold(input: string): Segment[] {
  const segments: Segment[] = []
  let last = 0
  for (const match of input.matchAll(BOLD_RE)) {
    const index = match.index ?? 0
    if (index > last) segments.push({ text: input.slice(last, index) })
    segments.push({ text: match[1], bold: true })
    last = index + match[0].length
  }
  if (last < input.length) segments.push({ text: input.slice(last) })
  return segments
}

/**
 * Parses the lightweight markup a word's front/back/note can carry:
 * `**text**` for bold, `==color:text==` for a highlight, and
 * `==color:**text**==` to combine both (highlight wrapping bold only — not
 * the other way around, so this stays a simple two-pass parser instead of a
 * full grammar).
 */
export function parseRichText(input: string): Segment[] {
  const segments: Segment[] = []
  let last = 0
  for (const match of input.matchAll(HIGHLIGHT_RE)) {
    const index = match.index ?? 0
    const [whole, color, content] = match
    if (!isHighlightKey(color)) continue
    if (index > last) segments.push(...splitBold(input.slice(last, index)))
    for (const inner of splitBold(content)) {
      segments.push({ ...inner, highlight: color })
    }
    last = index + whole.length
  }
  if (last < input.length) segments.push(...splitBold(input.slice(last)))
  return segments
}

/** Plain text of a formatted string — for places that can't render spans, like a toast title. */
export function stripRichText(input: string): string {
  return parseRichText(input)
    .map((segment) => segment.text)
    .join("")
}

export type MarkerKind = "bold" | HighlightKey

const MARKERS: Record<MarkerKind, { open: string; close: string }> = {
  bold: { open: "**", close: "**" },
  ...Object.fromEntries(
    HIGHLIGHT_KEYS.map((key) => [key, { open: `==${key}:`, close: "==" }])
  ),
} as Record<MarkerKind, { open: string; close: string }>

/**
 * Wraps the selected range of `value` with the given marker (or, with no
 * selection, inserts an empty pair with the caret left in the middle — the
 * usual markdown-toolbar behavior). Returns the new value and where to put
 * the caret/selection next.
 */
export function applyMarker(
  value: string,
  start: number,
  end: number,
  kind: MarkerKind
): { value: string; start: number; end: number } {
  const { open, close } = MARKERS[kind]
  const selected = value.slice(start, end)
  const next = value.slice(0, start) + open + selected + close + value.slice(end)
  return selected
    ? { value: next, start, end: start + open.length + selected.length + close.length }
    : {
        value: next,
        start: start + open.length,
        end: start + open.length,
      }
}
