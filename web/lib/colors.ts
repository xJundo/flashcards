/**
 * The accent palette for spaces and folders. The app itself is grayscale, so
 * these are the only spots of color in the UI — kept to a curated set rather
 * than a free color picker, so any choice looks intentional.
 */
export const COLOR_KEYS = [
  "slate",
  "red",
  "orange",
  "amber",
  "lime",
  "emerald",
  "teal",
  "cyan",
  "blue",
  "indigo",
  "violet",
  "pink",
] as const

export type ColorKey = (typeof COLOR_KEYS)[number]

export function isColorKey(value: string): value is ColorKey {
  return (COLOR_KEYS as readonly string[]).includes(value)
}

/** The swatch shown in the picker, and the flat dot used as a fallback cover. */
export const COLOR_SWATCH: Record<ColorKey, string> = {
  slate: "bg-slate-400 dark:bg-slate-500",
  red: "bg-red-400 dark:bg-red-500",
  orange: "bg-orange-400 dark:bg-orange-500",
  amber: "bg-amber-400 dark:bg-amber-500",
  lime: "bg-lime-400 dark:bg-lime-500",
  emerald: "bg-emerald-400 dark:bg-emerald-500",
  teal: "bg-teal-400 dark:bg-teal-500",
  cyan: "bg-cyan-400 dark:bg-cyan-500",
  blue: "bg-blue-400 dark:bg-blue-500",
  indigo: "bg-indigo-400 dark:bg-indigo-500",
  violet: "bg-violet-400 dark:bg-violet-500",
  pink: "bg-pink-400 dark:bg-pink-500",
}

/**
 * The highlight palette usable from a word's rich-text toolbar. Deliberately
 * separate from `COLOR_KEYS` (and much smaller): a highlight sits behind text
 * people need to keep reading, so it needs to stay a soft tint at every size
 * rather than the bold accent dot used for spaces and folders.
 */
export const HIGHLIGHT_KEYS = ["yellow", "green", "blue", "pink", "purple"] as const

export type HighlightKey = (typeof HIGHLIGHT_KEYS)[number]

export function isHighlightKey(value: string): value is HighlightKey {
  return (HIGHLIGHT_KEYS as readonly string[]).includes(value)
}

/** The solid dot shown for each choice in the highlight color picker. */
export const HIGHLIGHT_SWATCH: Record<HighlightKey, string> = {
  yellow: "bg-yellow-400 dark:bg-yellow-500",
  green: "bg-green-400 dark:bg-green-500",
  blue: "bg-blue-400 dark:bg-blue-500",
  pink: "bg-pink-400 dark:bg-pink-500",
  purple: "bg-purple-400 dark:bg-purple-500",
}

/** The actual highlight rendered behind a word's text, on a card. */
export const HIGHLIGHT_MARK_CLASS: Record<HighlightKey, string> = {
  yellow: "bg-yellow-200/80 dark:bg-yellow-900/50",
  green: "bg-green-200/80 dark:bg-green-900/50",
  blue: "bg-blue-200/80 dark:bg-blue-900/50",
  pink: "bg-pink-200/80 dark:bg-pink-900/50",
  purple: "bg-purple-200/80 dark:bg-purple-900/50",
}

/** The soft gradient used as a card's cover when it has no banner image. */
export const COLOR_COVER: Record<ColorKey, string> = {
  slate: "from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-800",
  red: "from-red-200 to-red-100 dark:from-red-900 dark:to-red-950",
  orange:
    "from-orange-200 to-orange-100 dark:from-orange-900 dark:to-orange-950",
  amber: "from-amber-200 to-amber-100 dark:from-amber-900 dark:to-amber-950",
  lime: "from-lime-200 to-lime-100 dark:from-lime-900 dark:to-lime-950",
  emerald:
    "from-emerald-200 to-emerald-100 dark:from-emerald-900 dark:to-emerald-950",
  teal: "from-teal-200 to-teal-100 dark:from-teal-900 dark:to-teal-950",
  cyan: "from-cyan-200 to-cyan-100 dark:from-cyan-900 dark:to-cyan-950",
  blue: "from-blue-200 to-blue-100 dark:from-blue-900 dark:to-blue-950",
  indigo:
    "from-indigo-200 to-indigo-100 dark:from-indigo-900 dark:to-indigo-950",
  violet:
    "from-violet-200 to-violet-100 dark:from-violet-900 dark:to-violet-950",
  pink: "from-pink-200 to-pink-100 dark:from-pink-900 dark:to-pink-950",
}
