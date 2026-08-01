export type Word = {
  id: string
  korean: string
  romanization: string
  translation: string
  note?: string
}

export type Course = {
  id: string
  title: string
  /** ISO date of the lesson, `YYYY-MM-DD`. */
  date: string
  createdAt: string
  updatedAt: string
  words: Word[]
}

export type CourseSummary = Omit<Course, "words"> & { wordCount: number }

/** `audio` plays the word without showing it, to write it from hearing alone. */
export type FrontSide = "korean" | "translation" | "random" | "audio"

export type CardOrder = "original" | "shuffled"
