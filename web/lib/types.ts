/** How a card's front/back text (and note) is aligned. `undefined` means centered. */
export type TextAlign = "left" | "center" | "right" | "justify"

export const TEXT_ALIGNS: TextAlign[] = ["left", "center", "right", "justify"]

export type Card = {
  id: string
  front: string
  /** A generic pronunciation/reading hint — romanization, IPA, anything. */
  phonetic: string
  back: string
  note?: string
  /** Alignment for the card's text. Optional on import — defaults to centered. */
  align?: TextAlign
  /**
   * Whether that face carries an uploaded image, alongside or instead of
   * text. On export, and on import of a course exported this way, this
   * carries the image itself instead — a `data:image/...;base64,...` URL —
   * so downloading a course and re-importing that same JSON restores its
   * pictures.
   */
  frontImage?: boolean | string
  backImage?: boolean | string
}

/** How a learner appears to everyone else: the handle, never the email. */
export type Author = { id: string; name: string }

/** Someone who acquired every word of a lesson, as everyone else sees them. */
export type Finisher = Author & { completedAt: string }

export type Course = {
  id: string
  title: string
  /** ISO date of the lesson, `YYYY-MM-DD`. */
  date: string
  /** The space (subject) this course belongs to. */
  spaceId: string
  /** `null` means the course sits at the space's root, not inside a folder. */
  folderId: string | null
  /**
   * BCP-47 locale for pronunciation (e.g. `ko-KR`). `null` means the course
   * carries no spoken-language content, so no TTS UI is shown for it.
   */
  speechLocale: string | null
  createdAt: string
  updatedAt: string
  /** `null` once the author deletes their account: readable, but frozen. */
  owner: Author | null
  cards: Card[]
  /** Whether a revision sheet (PDF) has been uploaded for this lesson. */
  hasSheet: boolean
}

export type CourseSummary = Omit<Course, "cards"> & {
  wordCount: number
  /** Whether the current viewer may change this lesson. */
  editable: boolean
  /** Bookmarked by the viewer. Always `false` when signed out. */
  favorite: boolean
  /** Where the viewer stands on this lesson — `null` when signed out. */
  standing: CourseStanding | null
}

/**
 * How much of one lesson one learner holds. The four counts add up to the
 * lesson's word count, `untouched` being the words never answered at all.
 */
export type CourseStanding = {
  known: number
  learning: number
  review: number
  untouched: number
  /**
   * When every word was acquired, ISO. Kept once earned: see
   * `course_completions` for why it is never taken back.
   */
  completedAt: string | null
}

/** The share of the lesson acquired, rounded — what the meter shows. */
export function percentOf(known: number, total: number): number {
  return total ? Math.round((known / total) * 100) : 0
}

/** A learner's standing across every lesson, for the stats page. */
export type GlobalStats = {
  words: {
    known: number
    learning: number
    review: number
    untouched: number
    total: number
  }
  courses: {
    /** Lessons with at least one word answered. */
    tracked: number
    completed: number
    favorites: number
    total: number
  }
}

/** A top-level subject: a language, or anything else worth its own catalogue. */
export type Space = {
  id: string
  title: string
  slug: string
  owner: Author | null
  /** A palette key from `lib/colors.ts`, or `null` for the neutral default. */
  color: string | null
  /** Whether a cover banner has been uploaded for this space. */
  hasBanner: boolean
  createdAt: string
  updatedAt: string
}

export type SpaceSummary = Space & {
  /** Courses anywhere in the space, folders included. */
  courseCount: number
}

export type Folder = {
  id: string
  spaceId: string
  parentId: string | null
  title: string
  /** A palette key from `lib/colors.ts`, or `null` for the neutral default. */
  color: string | null
  /** Whether a cover banner has been uploaded for this folder. */
  hasBanner: boolean
  createdAt: string
  updatedAt: string
}

/** One crumb of the trail back to a space's root. */
export type Breadcrumb = { id: string; title: string; href: string }

/** `audio` plays the word without showing it, to write it from hearing alone. */
export type FrontSide = "front" | "back" | "random" | "audio"

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

/** Everything recorded about one word, for one learner, on one lesson. */
export type WordStat = {
  /** Consecutive successes. `0` means the last answer was a miss. */
  streak: number
  /** Times answered right, all series merged. */
  hits: number
  /** Times the word landed in "à revoir", by a miss or by hand. */
  misses: number
}

export const NO_STAT: WordStat = { streak: 0, hits: 0, misses: 0 }

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
  /** Per word id. An absent id was never answered at all. */
  stats: Record<string, WordStat>
  /** Newest first. */
  runs: RunResult[]
}
