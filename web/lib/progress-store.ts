import "server-only"

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { runWords, runs, wordProgress, words } from "@/lib/db/schema"
import { isId } from "@/lib/normalize"
import { KNOWN_STREAK } from "@/lib/types"
import type { FrontSide, Progress, RunResult } from "@/lib/types"

const MAX_RUNS = 20

const EMPTY: Progress = { streaks: {}, runs: [] }

export type RunInput = {
  /** Ids answered right, in deck order. */
  known: string[]
  /** Ids flagged to review, in deck order. */
  failed: string[]
  /** How many cards the deck held, answered or not. */
  size: number
  completed: boolean
  frontSide: FrontSide
}

export async function getProgress(
  userId: string,
  courseId: string
): Promise<Progress> {
  if (!isId(courseId)) return EMPTY

  const [standings, history] = await Promise.all([
    db
      .select({ wordId: wordProgress.wordId, streak: wordProgress.streak })
      .from(wordProgress)
      .where(
        and(
          eq(wordProgress.userId, userId),
          eq(wordProgress.courseId, courseId)
        )
      ),
    db
      .select()
      .from(runs)
      .where(and(eq(runs.userId, userId), eq(runs.courseId, courseId)))
      .orderBy(desc(runs.finishedAt))
      .limit(MAX_RUNS),
  ])

  // One extra query rather than one per series: the recap needs every card of
  // every listed run, and there are at most `MAX_RUNS` of them.
  const cards = history.length
    ? await db
        .select()
        .from(runWords)
        .where(
          inArray(
            runWords.runId,
            history.map((row) => row.id)
          )
        )
        .orderBy(asc(runWords.position))
    : []

  const byRun = new Map<string, { known: string[]; failed: string[] }>()
  for (const card of cards) {
    const entry = byRun.get(card.runId) ?? { known: [], failed: [] }
    entry[card.known ? "known" : "failed"].push(card.wordId)
    byRun.set(card.runId, entry)
  }

  return {
    streaks: Object.fromEntries(
      standings.map((row) => [row.wordId, row.streak])
    ),
    runs: history.map((row): RunResult => {
      const answers = byRun.get(row.id) ?? { known: [], failed: [] }
      return {
        id: row.id,
        at: row.finishedAt.toISOString(),
        known: answers.known,
        failed: answers.failed,
        size: row.size,
        completed: row.completed,
        frontSide: row.frontSide as FrontSide,
      }
    }),
  }
}

/**
 * Records one series — finished or cut short. Every answer moves the word's
 * streak: a hit adds one, a miss resets to zero. Word ids are checked against
 * the lesson so a stale client cannot flag arbitrary rows.
 */
export async function recordRun(
  userId: string,
  courseId: string,
  answers: RunInput
): Promise<Progress> {
  if (!isId(courseId)) return EMPTY

  const submitted = [...new Set([...answers.failed, ...answers.known])].filter(
    isId
  )
  if (submitted.length === 0) return getProgress(userId, courseId)

  await db.transaction(async (tx) => {
    const belongs = new Set(
      (
        await tx
          .select({ id: words.id })
          .from(words)
          .where(
            and(eq(words.courseId, courseId), inArray(words.id, submitted))
          )
      ).map((row) => row.id)
    )

    // A card is answered once, so a repeat — or an id sent on both sides —
    // means a confused client. The miss wins, and `run_words` keeps its
    // one-row-per-card promise instead of tripping over its primary key.
    const failed = [...new Set(answers.failed.filter((id) => belongs.has(id)))]
    const missed = new Set(failed)
    const known = [
      ...new Set(
        answers.known.filter((id) => belongs.has(id) && !missed.has(id))
      ),
    ]
    if (failed.length + known.length === 0) return

    const [run] = await tx
      .insert(runs)
      .values({
        userId,
        courseId,
        size: Math.max(answers.size, failed.length + known.length),
        completed: answers.completed,
        frontSide: answers.frontSide,
      })
      .returning({ id: runs.id })

    // `answers.known` and `answers.failed` are each in deck order; interleaving
    // them again would need the original ranks, which the client does not send.
    // Listing the hits then the misses is enough for a recap.
    await tx.insert(runWords).values([
      ...known.map((wordId, position) => ({
        runId: run.id,
        wordId,
        known: true,
        position,
      })),
      ...failed.map((wordId, position) => ({
        runId: run.id,
        wordId,
        known: false,
        position: known.length + position,
      })),
    ])

    if (failed.length > 0) {
      await tx
        .insert(wordProgress)
        .values(
          failed.map((wordId) => ({ userId, courseId, wordId, streak: 0 }))
        )
        .onConflictDoUpdate({
          target: [wordProgress.userId, wordProgress.wordId],
          set: { streak: 0, updatedAt: new Date() },
        })
    }

    if (known.length > 0) {
      await tx
        .insert(wordProgress)
        .values(
          known.map((wordId) => ({ userId, courseId, wordId, streak: 1 }))
        )
        .onConflictDoUpdate({
          target: [wordProgress.userId, wordProgress.wordId],
          set: {
            streak: sql`${wordProgress.streak} + 1`,
            updatedAt: new Date(),
          },
        })
    }
  })

  return getProgress(userId, courseId)
}

/** Marks a word acquired by hand, from the review list. */
export async function markAcquired(
  userId: string,
  courseId: string,
  wordId: string
): Promise<void> {
  if (!isId(courseId) || !isId(wordId)) return

  const [word] = await db
    .select({ id: words.id })
    .from(words)
    .where(and(eq(words.id, wordId), eq(words.courseId, courseId)))
  if (!word) return

  await db
    .insert(wordProgress)
    .values({ userId, courseId, wordId, streak: KNOWN_STREAK })
    .onConflictDoUpdate({
      target: [wordProgress.userId, wordProgress.wordId],
      set: { streak: KNOWN_STREAK, updatedAt: new Date() },
    })
}

/** Sends an acquired word back to the review list, without touching history. */
export async function markForReview(
  userId: string,
  wordId: string
): Promise<void> {
  if (!isId(wordId)) return
  await db
    .update(wordProgress)
    .set({ streak: 0, updatedAt: new Date() })
    .where(
      and(eq(wordProgress.userId, userId), eq(wordProgress.wordId, wordId))
    )
}

/** Wipes the series history. Word standings are deliberately left alone. */
export async function clearRuns(
  userId: string,
  courseId: string
): Promise<void> {
  if (!isId(courseId)) return
  await db
    .delete(runs)
    .where(and(eq(runs.userId, userId), eq(runs.courseId, courseId)))
}
