import "server-only"

import { and, desc, eq, inArray } from "drizzle-orm"

import { db } from "@/lib/db"
import { reviewWords, runs, words } from "@/lib/db/schema"
import { isId } from "@/lib/normalize"
import type { Progress, RunResult } from "@/lib/types"

const MAX_RUNS = 20

const EMPTY: Progress = { review: [], runs: [] }

export async function getProgress(
  userId: string,
  courseId: string
): Promise<Progress> {
  if (!isId(courseId)) return EMPTY

  const [review, history] = await Promise.all([
    db
      .select({ wordId: reviewWords.wordId })
      .from(reviewWords)
      .where(
        and(eq(reviewWords.userId, userId), eq(reviewWords.courseId, courseId))
      ),
    db
      .select()
      .from(runs)
      .where(and(eq(runs.userId, userId), eq(runs.courseId, courseId)))
      .orderBy(desc(runs.finishedAt))
      .limit(MAX_RUNS),
  ])

  return {
    review: review.map((row) => row.wordId),
    runs: history.map((row): RunResult => ({
      at: row.finishedAt.toISOString(),
      known: row.known,
      total: row.total,
    })),
  }
}

/**
 * Records one finished series: the failures join the review list, the words
 * answered right leave it. Word ids are checked against the lesson so a stale
 * client cannot flag arbitrary rows.
 */
export async function recordRun(
  userId: string,
  courseId: string,
  answers: { failed: string[]; known: string[] }
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

    const failed = answers.failed.filter((id) => belongs.has(id))
    const known = answers.known.filter((id) => belongs.has(id))
    if (failed.length + known.length === 0) return

    await tx.insert(runs).values({
      userId,
      courseId,
      known: known.length,
      total: failed.length + known.length,
    })

    if (known.length > 0) {
      await tx
        .delete(reviewWords)
        .where(
          and(
            eq(reviewWords.userId, userId),
            inArray(reviewWords.wordId, known)
          )
        )
    }

    if (failed.length > 0) {
      await tx
        .insert(reviewWords)
        .values(failed.map((wordId) => ({ userId, courseId, wordId })))
        .onConflictDoNothing()
    }
  })

  return getProgress(userId, courseId)
}

/** Marks a word acquired by hand, from the review list. */
export async function clearReviewWord(
  userId: string,
  wordId: string
): Promise<void> {
  if (!isId(wordId)) return
  await db
    .delete(reviewWords)
    .where(and(eq(reviewWords.userId, userId), eq(reviewWords.wordId, wordId)))
}

export async function clearRuns(
  userId: string,
  courseId: string
): Promise<void> {
  if (!isId(courseId)) return
  await db
    .delete(runs)
    .where(and(eq(runs.userId, userId), eq(runs.courseId, courseId)))
}
