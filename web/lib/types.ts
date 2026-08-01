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

/** One finished series: how many cards were acquired out of the deck. */
export type RunResult = { at: string; known: number; total: number }

/** A learner's standing on one lesson. Private, never shared between accounts. */
export type Progress = {
  /** Ids of the words to work again, fed by every failed card. */
  review: string[]
  /** Newest first. */
  runs: RunResult[]
}
