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

export type FrontSide = "korean" | "translation" | "random"

export type CardOrder = "original" | "shuffled"
