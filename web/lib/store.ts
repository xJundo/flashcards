import "server-only"

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"

import { db } from "@/lib/db"
import {
  courseCompletions,
  courseEditors,
  courseFavorites,
  courses,
  user,
  wordProgress,
  words,
} from "@/lib/db/schema"
import { isId, makeId } from "@/lib/normalize"
import { KNOWN_STREAK } from "@/lib/types"
import type {
  Author,
  Course,
  CourseSummary,
  Finisher,
  GlobalStats,
  Word,
} from "@/lib/types"

type CourseRow = typeof courses.$inferSelect
type WordRow = typeof words.$inferSelect

function toAuthor(row: { id: string; name: string } | null): Author | null {
  return row ? { id: row.id, name: row.name } : null
}

function toWord(row: WordRow): Word {
  return {
    id: row.id,
    korean: row.korean,
    romanization: row.romanization,
    translation: row.translation,
    ...(row.note ? { note: row.note } : {}),
  }
}

function toCourseShell(row: CourseRow, owner: Author | null) {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    owner,
  }
}

/**
 * Every lesson, whoever wrote it. `viewerId` only decides what comes back
 * alongside each one — whether it is editable, bookmarked, and how far along
 * the viewer is. It never filters the list, since reading is public.
 *
 * The viewer-specific joins are all one row at most, so they ride along on the
 * word count without multiplying it; signed out, each is short-circuited to
 * `false` rather than being skipped, which keeps one query for both cases.
 */
export async function listCourses(viewerId?: string): Promise<CourseSummary[]> {
  const mine = (column: AnyPgColumn) =>
    viewerId ? eq(column, viewerId) : sql`false`

  const rows = await db
    .select({
      course: courses,
      owner: { id: user.id, name: user.name },
      wordCount: sql<number>`count(distinct ${words.id})::int`,
      invited: sql<boolean>`bool_or(${courseEditors.userId} is not null)`,
      favorite: sql<boolean>`bool_or(${courseFavorites.userId} is not null)`,
      completedAt: sql<Date | null>`max(${courseCompletions.completedAt})`,
      known: sql<number>`count(distinct ${words.id}) filter (where ${wordProgress.streak} >= ${KNOWN_STREAK})::int`,
      learning: sql<number>`count(distinct ${words.id}) filter (where ${wordProgress.streak} > 0 and ${wordProgress.streak} < ${KNOWN_STREAK})::int`,
      review: sql<number>`count(distinct ${words.id}) filter (where ${wordProgress.streak} = 0)::int`,
    })
    .from(courses)
    .leftJoin(user, eq(courses.ownerId, user.id))
    .leftJoin(words, eq(words.courseId, courses.id))
    .leftJoin(
      courseEditors,
      and(eq(courseEditors.courseId, courses.id), mine(courseEditors.userId))
    )
    .leftJoin(
      courseFavorites,
      and(
        eq(courseFavorites.courseId, courses.id),
        mine(courseFavorites.userId)
      )
    )
    .leftJoin(
      courseCompletions,
      and(
        eq(courseCompletions.courseId, courses.id),
        mine(courseCompletions.userId)
      )
    )
    .leftJoin(
      wordProgress,
      and(eq(wordProgress.wordId, words.id), mine(wordProgress.userId))
    )
    .groupBy(courses.id, user.id)
    .orderBy(desc(courses.date), desc(courses.createdAt))

  return rows.map((row) => ({
    ...toCourseShell(row.course, toAuthor(row.owner)),
    wordCount: row.wordCount,
    editable: Boolean(
      viewerId && (row.course.ownerId === viewerId || row.invited)
    ),
    favorite: Boolean(viewerId && row.favorite),
    standing: viewerId
      ? {
          known: row.known,
          learning: row.learning,
          review: row.review,
          untouched: row.wordCount - row.known - row.learning - row.review,
          completedAt: row.completedAt
            ? new Date(row.completedAt).toISOString()
            : null,
        }
      : null,
  }))
}

export async function getCourse(id: string): Promise<Course | null> {
  if (!isId(id)) return null

  const [row] = await db
    .select({ course: courses, owner: { id: user.id, name: user.name } })
    .from(courses)
    .leftJoin(user, eq(courses.ownerId, user.id))
    .where(eq(courses.id, id))
  if (!row) return null

  const rows = await db
    .select()
    .from(words)
    .where(eq(words.courseId, id))
    .orderBy(asc(words.position))

  return {
    ...toCourseShell(row.course, toAuthor(row.owner)),
    words: rows.map(toWord),
  }
}

/** Creates the lesson and its words in one go. Only used on import/creation. */
export async function saveCourse(
  course: Omit<Course, "owner">,
  ownerId: string
): Promise<Course> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(courses)
      .values({
        id: isId(course.id) ? course.id : makeId(),
        title: course.title,
        date: course.date,
        ownerId,
      })
      .returning()

    if (course.words.length > 0) {
      await tx.insert(words).values(
        course.words.map((word, position) => ({
          id: isId(word.id) ? word.id : makeId(),
          courseId: row.id,
          korean: word.korean,
          romanization: word.romanization,
          translation: word.translation,
          note: word.note ?? null,
          position,
        }))
      )
    }

    const [owner] = await tx
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(eq(user.id, ownerId))

    return {
      ...toCourseShell(row, toAuthor(owner ?? null)),
      words: course.words,
    }
  })
}

export async function deleteCourse(id: string): Promise<boolean> {
  if (!isId(id)) return false
  const deleted = await db
    .delete(courses)
    .where(eq(courses.id, id))
    .returning({ id: courses.id })
  return deleted.length > 0
}

/**
 * Read–modify–write inside a transaction, so the callers keep working on a
 * whole `Course` rather than on rows. Words are reconciled by id instead of
 * being replaced wholesale: their ids are referenced by everyone's progress.
 */
export async function updateCourse(
  id: string,
  mutate: (course: Course) => Course
): Promise<Course | null> {
  if (!isId(id)) return null

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ course: courses, owner: { id: user.id, name: user.name } })
      .from(courses)
      .leftJoin(user, eq(courses.ownerId, user.id))
      .where(eq(courses.id, id))
      .for("update", { of: courses })
    if (!row) return null

    const existing = await tx
      .select()
      .from(words)
      .where(eq(words.courseId, id))
      .orderBy(asc(words.position))

    const current: Course = {
      ...toCourseShell(row.course, toAuthor(row.owner)),
      words: existing.map(toWord),
    }
    const next = mutate(current)

    const [updated] = await tx
      .update(courses)
      .set({ title: next.title, date: next.date, updatedAt: new Date() })
      .where(eq(courses.id, id))
      .returning()

    const kept = new Set(next.words.map((word) => word.id))
    const removed = existing
      .filter((word) => !kept.has(word.id))
      .map((word) => word.id)
    if (removed.length > 0) {
      await tx.delete(words).where(inArray(words.id, removed))
    }

    if (next.words.length > 0) {
      await tx
        .insert(words)
        .values(
          next.words.map((word, position) => ({
            id: isId(word.id) ? word.id : makeId(),
            courseId: id,
            korean: word.korean,
            romanization: word.romanization,
            translation: word.translation,
            note: word.note ?? null,
            position,
          }))
        )
        .onConflictDoUpdate({
          target: words.id,
          set: {
            korean: sql`excluded.korean`,
            romanization: sql`excluded.romanization`,
            translation: sql`excluded.translation`,
            note: sql`excluded.note`,
            position: sql`excluded.position`,
          },
        })
    }

    return {
      ...toCourseShell(updated, toAuthor(row.owner)),
      words: next.words,
    }
  })
}

/* -------------------------------------------------------------------------- */
/*  Permissions                                                                */
/* -------------------------------------------------------------------------- */

/** Reading is public; writing takes the owner, or an explicit invitation. */
export async function canWrite(
  courseId: string,
  userId: string | undefined
): Promise<boolean> {
  if (!userId || !isId(courseId)) return false

  const [row] = await db
    .select({ ownerId: courses.ownerId })
    .from(courses)
    .where(eq(courses.id, courseId))
  if (!row) return false
  if (row.ownerId === userId) return true

  const [editor] = await db
    .select({ userId: courseEditors.userId })
    .from(courseEditors)
    .where(
      and(
        eq(courseEditors.courseId, courseId),
        eq(courseEditors.userId, userId)
      )
    )
  return Boolean(editor)
}

export async function isOwner(
  courseId: string,
  userId: string | undefined
): Promise<boolean> {
  if (!userId || !isId(courseId)) return false
  const [row] = await db
    .select({ ownerId: courses.ownerId })
    .from(courses)
    .where(eq(courses.id, courseId))
  return row?.ownerId === userId
}

export async function listEditors(courseId: string): Promise<Author[]> {
  if (!isId(courseId)) return []
  const rows = await db
    .select({ id: user.id, name: user.name })
    .from(courseEditors)
    .innerJoin(user, eq(courseEditors.userId, user.id))
    .where(eq(courseEditors.courseId, courseId))
    .orderBy(asc(user.name))
  return rows
}

/** Replaces the invitation list wholesale; the owner is implicit, never stored. */
export async function setEditors(
  courseId: string,
  userIds: string[]
): Promise<Author[]> {
  if (!isId(courseId)) return []

  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ ownerId: courses.ownerId })
      .from(courses)
      .where(eq(courses.id, courseId))

    const wanted = [...new Set(userIds)].filter((id) => id !== row?.ownerId)

    await tx.delete(courseEditors).where(eq(courseEditors.courseId, courseId))
    if (wanted.length > 0) {
      await tx
        .insert(courseEditors)
        .values(wanted.map((userId) => ({ courseId, userId })))
    }
  })

  return listEditors(courseId)
}

/** Every account, for the share picker. Handles only — emails stay private. */
export async function listUsers(): Promise<Author[]> {
  return db
    .select({ id: user.id, name: user.name })
    .from(user)
    .orderBy(asc(user.name))
}

export async function findUserByEmail(email: string): Promise<Author | null> {
  const [row] = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(eq(user.email, email.trim().toLowerCase()))
  return row ?? null
}

/* -------------------------------------------------------------------------- */
/*  Favourites & completions                                                   */
/* -------------------------------------------------------------------------- */

/** Bookmarks a lesson, or drops the bookmark. Idempotent either way. */
export async function setFavorite(
  userId: string,
  courseId: string,
  favorite: boolean
): Promise<boolean> {
  if (!isId(courseId)) return false

  if (!favorite) {
    await db
      .delete(courseFavorites)
      .where(
        and(
          eq(courseFavorites.userId, userId),
          eq(courseFavorites.courseId, courseId)
        )
      )
    return false
  }

  // A bookmark on a lesson that no longer exists would trip the foreign key,
  // and a stale card in an open tab is the ordinary way to get there.
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.id, courseId))
  if (!course) return false

  await db
    .insert(courseFavorites)
    .values({ userId, courseId })
    .onConflictDoNothing()
  return true
}

/**
 * Everyone who finished this lesson, first to last. The only part of anyone's
 * progress that is public — the fact alone, never the figures behind it.
 */
export async function listFinishers(courseId: string): Promise<Finisher[]> {
  if (!isId(courseId)) return []
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      completedAt: courseCompletions.completedAt,
    })
    .from(courseCompletions)
    .innerJoin(user, eq(courseCompletions.userId, user.id))
    .where(eq(courseCompletions.courseId, courseId))
    .orderBy(asc(courseCompletions.completedAt))

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    completedAt: row.completedAt.toISOString(),
  }))
}

/** What the viewer's own header shows on a lesson: the star and the date. */
export async function getViewerState(
  courseId: string,
  userId: string | undefined
): Promise<{ favorite: boolean; completedAt: string | null }> {
  if (!userId || !isId(courseId)) return { favorite: false, completedAt: null }

  const [[favorite], [completion]] = await Promise.all([
    db
      .select({ userId: courseFavorites.userId })
      .from(courseFavorites)
      .where(
        and(
          eq(courseFavorites.userId, userId),
          eq(courseFavorites.courseId, courseId)
        )
      ),
    db
      .select({ completedAt: courseCompletions.completedAt })
      .from(courseCompletions)
      .where(
        and(
          eq(courseCompletions.userId, userId),
          eq(courseCompletions.courseId, courseId)
        )
      ),
  ])

  return {
    favorite: Boolean(favorite),
    completedAt: completion?.completedAt.toISOString() ?? null,
  }
}

/**
 * The learner's standing across every lesson. Words never answered have no
 * row at all, so `untouched` is what the catalogue holds minus what they have
 * touched — which is also why the totals are read from the lessons themselves.
 */
export async function globalStats(userId: string): Promise<GlobalStats> {
  const tally = (predicate: ReturnType<typeof sql>) =>
    sql<number>`count(*) filter (where ${predicate})::int`

  const [[progress], [wordTotal], [courseTotal], [completed], [favorites]] =
    await Promise.all([
      db
        .select({
          known: tally(sql`${wordProgress.streak} >= ${KNOWN_STREAK}`),
          learning: tally(
            sql`${wordProgress.streak} > 0 and ${wordProgress.streak} < ${KNOWN_STREAK}`
          ),
          review: tally(sql`${wordProgress.streak} = 0`),
          tracked: sql<number>`count(distinct ${wordProgress.courseId})::int`,
        })
        .from(wordProgress)
        .where(eq(wordProgress.userId, userId)),
      db.select({ value: sql<number>`count(*)::int` }).from(words),
      db.select({ value: sql<number>`count(*)::int` }).from(courses),
      db
        .select({ value: sql<number>`count(*)::int` })
        .from(courseCompletions)
        .where(eq(courseCompletions.userId, userId)),
      db
        .select({ value: sql<number>`count(*)::int` })
        .from(courseFavorites)
        .where(eq(courseFavorites.userId, userId)),
    ])

  const total = wordTotal?.value ?? 0
  const known = progress?.known ?? 0
  const learning = progress?.learning ?? 0
  const review = progress?.review ?? 0

  return {
    words: {
      known,
      learning,
      review,
      untouched: Math.max(total - known - learning - review, 0),
      total,
    },
    courses: {
      tracked: progress?.tracked ?? 0,
      completed: completed?.value ?? 0,
      favorites: favorites?.value ?? 0,
      total: courseTotal?.value ?? 0,
    },
  }
}

/* -------------------------------------------------------------------------- */

export function createWord(input: Partial<Word>): Word {
  return {
    id: input.id ?? makeId(),
    korean: input.korean?.trim() ?? "",
    romanization: input.romanization?.trim() ?? "",
    translation: input.translation?.trim() ?? "",
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  }
}
