import "server-only"

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { courseEditors, courses, user, words } from "@/lib/db/schema"
import { isId, makeId } from "@/lib/normalize"
import type { Author, Course, CourseSummary, Word } from "@/lib/types"

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
 * Every lesson, whoever wrote it. `viewerId` only decides which ones come back
 * flagged as editable — it never filters the list, since reading is public.
 */
export async function listCourses(viewerId?: string): Promise<CourseSummary[]> {
  const rows = await db
    .select({
      course: courses,
      owner: { id: user.id, name: user.name },
      wordCount: sql<number>`count(distinct ${words.id})::int`,
      invited: sql<boolean>`bool_or(${courseEditors.userId} is not null)`,
    })
    .from(courses)
    .leftJoin(user, eq(courses.ownerId, user.id))
    .leftJoin(words, eq(words.courseId, courses.id))
    .leftJoin(
      courseEditors,
      and(
        eq(courseEditors.courseId, courses.id),
        viewerId ? eq(courseEditors.userId, viewerId) : sql`false`
      )
    )
    .groupBy(courses.id, user.id)
    .orderBy(desc(courses.date), desc(courses.createdAt))

  return rows.map(({ course, owner, wordCount, invited }) => ({
    ...toCourseShell(course, toAuthor(owner)),
    wordCount,
    editable: Boolean(viewerId && (course.ownerId === viewerId || invited)),
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

export function createWord(input: Partial<Word>): Word {
  return {
    id: input.id ?? makeId(),
    korean: input.korean?.trim() ?? "",
    romanization: input.romanization?.trim() ?? "",
    translation: input.translation?.trim() ?? "",
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  }
}
