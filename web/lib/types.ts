export type Word = {
  id: string
  korean: string
  romanization: string
  translation: string
  note?: string
}

/** How a learner appears to everyone else: the handle, never the email. */
export type Author = { id: string; name: string }

export type Course = {
  id: string
  title: string
  /** ISO date of the lesson, `YYYY-MM-DD`. */
  date: string
  createdAt: string
  updatedAt: string
  /** `null` once the author deletes their account: readable, but frozen. */
  owner: Author | null
  words: Word[]
}

export type CourseSummary = Omit<Course, "words"> & {
  wordCount: number
  /** Whether the current viewer may change this lesson. */
  editable: boolean
}

/** `audio` plays the word without showing it, to write it from hearing alone. */
export type FrontSide = "korean" | "translation" | "random" | "audio"

export type CardOrder = "original" | "shuffled"

export type Verdict = "known" | "unknown"

/** Which words a series is drawn from: everything, the misses, or the unfinished. */
export type DeckSource = "all" | "review" | "todo"

/** What the launch screen lets you decide before a series starts. */
export type SeriesSettings = {
  frontSide: FrontSide
  shuffled: boolean
  source: DeckSource
  /** How many cards to draw, or `null` for the whole pool. */
  size: number | null
}

/**
 * A series is recorded; free practice is not. The distinction only exists on
 * the client — nothing untracked ever reaches the store.
 */
export type SeriesMode = "series" | "practice"

/** Consecutive successes needed before a word counts as acquired. */
export const KNOWN_STREAK = 3

/**
 * Where a word stands. `learning` covers a word answered right at least once
 * but not yet often enough; a word never answered has no standing at all.
 */
export type Standing = "review" | "learning" | "known"

export function standingOf(streak: number | undefined): Standing | null {
  if (streak === undefined) return null
  if (streak === 0) return "review"
  return streak >= KNOWN_STREAK ? "known" : "learning"
}

/**
 * The sense a series was played in. `mixed` is not a setting — it is what a
 * series becomes once the learner switches sides part-way through it.
 */
export type RunFront = FrontSide | "mixed"

/** One recorded series, with the verdict of every card that was answered. */
export type RunResult = {
  id: string
  /** ISO timestamp of the moment it was written. */
  at: string
  /** Ids of the words answered right, in the order they came up. */
  known: string[]
  /** Ids of the words flagged to review. */
  failed: string[]
  /** How many cards the deck held — larger than the answers if it was cut short. */
  size: number
  /** `false` when the series was closed before the last card. */
  completed: boolean
  frontSide: RunFront
}

/** A learner's standing on one lesson. Private, never shared between accounts. */
export type Progress = {
  /**
   * Consecutive successes, per word id. `0` means the last answer was a miss,
   * so the word is due for review; an absent id was never answered at all.
   */
  streaks: Record<string, number>
  /** Newest first. */
  runs: RunResult[]
}
