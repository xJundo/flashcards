import "server-only"

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"

import { db } from "@/lib/db"
import {
  cardImages,
  cards,
  courseCompletions,
  courseEditors,
  courseFavorites,
  courseSheets,
  courses,
  folderBanners,
  folders,
  spaceBanners,
  spaces,
  user,
  wordProgress,
} from "@/lib/db/schema"
import { isId, makeId } from "@/lib/normalize"
import { sniffImage } from "@/lib/sniff-image"
import { KNOWN_STREAK } from "@/lib/types"
import type {
  Author,
  Breadcrumb,
  Card,
  Course,
  CourseSummary,
  Finisher,
  Folder,
  GlobalStats,
  Space,
  SpaceSummary,
  TextAlign,
} from "@/lib/types"

type CourseRow = typeof courses.$inferSelect
type CardRow = typeof cards.$inferSelect
type SpaceRow = typeof spaces.$inferSelect
type FolderRow = typeof folders.$inferSelect

function toAuthor(row: { id: string; name: string } | null): Author | null {
  return row ? { id: row.id, name: row.name } : null
}

function toCard(
  row: CardRow,
  hasImage?: { front: boolean; back: boolean }
): Card {
  return {
    id: row.id,
    front: row.front,
    phonetic: row.phonetic,
    back: row.back,
    ...(row.note ? { note: row.note } : {}),
    ...(row.align ? { align: row.align as TextAlign } : {}),
    ...(hasImage?.front ? { frontImage: true } : {}),
    ...(hasImage?.back ? { backImage: true } : {}),
  }
}

function toCourseShell(row: CourseRow, owner: Author | null) {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    spaceId: row.spaceId,
    folderId: row.folderId,
    speechLocale: row.speechLocale,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    owner,
  }
}

function toSpace(
  row: SpaceRow,
  owner: Author | null,
  hasBanner: boolean
): Space {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    owner,
    color: row.color,
    hasBanner,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function toFolder(row: FolderRow, hasBanner: boolean): Folder {
  return {
    id: row.id,
    spaceId: row.spaceId,
    parentId: row.parentId,
    title: row.title,
    color: row.color,
    hasBanner,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Every lesson, whoever wrote it. `viewerId` only decides what comes back
 * alongside each one — whether it is editable, bookmarked, and how far along
 * the viewer is. It never filters the list, since reading is public.
 *
 * `scope` narrows to one space (and, within it, one folder or the space's
 * root) — used by the space/folder pages. Omitted, every lesson everywhere
 * comes back.
 *
 * The viewer-specific joins are all one row at most, so they ride along on the
 * word count without multiplying it; signed out, each is short-circuited to
 * `false` rather than being skipped, which keeps one query for both cases.
 */
export async function listCourses(
  viewerId?: string,
  scope?: { spaceId: string; folderId: string | null }
): Promise<CourseSummary[]> {
  const mine = (column: AnyPgColumn) =>
    viewerId ? eq(column, viewerId) : sql`false`

  const rows = await db
    .select({
      course: courses,
      owner: { id: user.id, name: user.name },
      wordCount: sql<number>`count(distinct ${cards.id})::int`,
      invited: sql<boolean>`bool_or(${courseEditors.userId} is not null)`,
      favorite: sql<boolean>`bool_or(${courseFavorites.userId} is not null)`,
      completedAt: sql<Date | null>`max(${courseCompletions.completedAt})`,
      hasSheet: sql<boolean>`bool_or(${courseSheets.courseId} is not null)`,
      known: sql<number>`count(distinct ${cards.id}) filter (where ${wordProgress.streak} >= ${KNOWN_STREAK})::int`,
      learning: sql<number>`count(distinct ${cards.id}) filter (where ${wordProgress.streak} > 0 and ${wordProgress.streak} < ${KNOWN_STREAK})::int`,
      review: sql<number>`count(distinct ${cards.id}) filter (where ${wordProgress.streak} = 0)::int`,
    })
    .from(courses)
    .leftJoin(user, eq(courses.ownerId, user.id))
    .leftJoin(cards, eq(cards.courseId, courses.id))
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
      and(eq(wordProgress.wordId, cards.id), mine(wordProgress.userId))
    )
    .leftJoin(courseSheets, eq(courseSheets.courseId, courses.id))
    .where(
      scope
        ? and(
            eq(courses.spaceId, scope.spaceId),
            scope.folderId === null
              ? isNull(courses.folderId)
              : eq(courses.folderId, scope.folderId)
          )
        : undefined
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
    hasSheet: row.hasSheet,
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

async function cardImageFlags(
  courseId: string
): Promise<Map<string, { front: boolean; back: boolean }>> {
  const rows = await db
    .select({ cardId: cardImages.cardId, side: cardImages.side })
    .from(cardImages)
    .innerJoin(cards, eq(cards.id, cardImages.cardId))
    .where(eq(cards.courseId, courseId))

  const flags = new Map<string, { front: boolean; back: boolean }>()
  for (const row of rows) {
    const entry = flags.get(row.cardId) ?? { front: false, back: false }
    entry[row.side as "front" | "back"] = true
    flags.set(row.cardId, entry)
  }
  return flags
}

export async function getCourse(id: string): Promise<Course | null> {
  if (!isId(id)) return null

  const [row] = await db
    .select({ course: courses, owner: { id: user.id, name: user.name } })
    .from(courses)
    .leftJoin(user, eq(courses.ownerId, user.id))
    .where(eq(courses.id, id))
  if (!row) return null

  const [rows, [sheet], imageFlags] = await Promise.all([
    db
      .select()
      .from(cards)
      .where(eq(cards.courseId, id))
      .orderBy(asc(cards.position)),
    db
      .select({ courseId: courseSheets.courseId })
      .from(courseSheets)
      .where(eq(courseSheets.courseId, id)),
    cardImageFlags(id),
  ])

  return {
    ...toCourseShell(row.course, toAuthor(row.owner)),
    cards: rows.map((card) => toCard(card, imageFlags.get(card.id))),
    hasSheet: Boolean(sheet),
  }
}

/**
 * Same as `getCourse`, but a card's `frontImage` / `backImage` becomes the
 * picture itself — a `data:image/...;base64,...` URL — instead of a bare
 * `true`, so the downloaded JSON can restore those pictures on re-import.
 * Skips the extra query entirely when the lesson carries no images.
 */
export async function getCourseForExport(id: string): Promise<Course | null> {
  const course = await getCourse(id)
  if (!course) return null
  if (!course.cards.some((card) => card.frontImage || card.backImage))
    return course

  const rows = await db
    .select({
      cardId: cardImages.cardId,
      side: cardImages.side,
      contentType: cardImages.contentType,
      data: cardImages.data,
    })
    .from(cardImages)
    .innerJoin(cards, eq(cards.id, cardImages.cardId))
    .where(eq(cards.courseId, id))

  const dataUrls = new Map<string, { front?: string; back?: string }>()
  for (const row of rows) {
    const entry = dataUrls.get(row.cardId) ?? {}
    entry[row.side as CardSide] =
      `data:${row.contentType};base64,${row.data.toString("base64")}`
    dataUrls.set(row.cardId, entry)
  }

  return {
    ...course,
    cards: course.cards.map((card) => {
      const images = dataUrls.get(card.id)
      if (!images) return card
      return {
        ...card,
        ...(images.front ? { frontImage: images.front } : {}),
        ...(images.back ? { backImage: images.back } : {}),
      }
    }),
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Same cap as a manual image upload — see the per-card image route. */
export const MAX_CARD_IMAGE_SIZE = 5 * 1024 * 1024

/**
 * Decodes an embedded picture back into bytes, re-sniffing its real format
 * from the magic bytes rather than trusting the data URL's claimed mime type
 * — the same check a manual upload goes through.
 */
function decodeImageDataUrl(dataUrl: string): CardImage | null {
  const match = /^data:[^,]*;base64,([A-Za-z0-9+/]+=*)$/.exec(dataUrl)
  if (!match) return null
  const data = Buffer.from(match[1], "base64")
  if (data.byteLength === 0 || data.byteLength > MAX_CARD_IMAGE_SIZE)
    return null
  const contentType = sniffImage(data)
  return contentType ? { contentType, data, size: data.byteLength } : null
}

/**
 * Persists whichever `frontImage` / `backImage` in `sourceCards` are actual
 * embedded pictures (a card just reconciled from a JSON import, itself
 * produced by this app's export) rather than plain booleans — restoring the
 * images a course was exported with. Returns the `cardId:side` pairs that
 * were actually saved, so callers can report accurate image flags back.
 */
async function saveImportedCardImages(
  tx: Tx,
  cardIds: string[],
  sourceCards: Card[]
): Promise<Set<string>> {
  const rows: (typeof cardImages.$inferInsert)[] = []
  sourceCards.forEach((card, index) => {
    const cardId = cardIds[index]
    for (const side of ["front", "back"] as const) {
      const value = side === "front" ? card.frontImage : card.backImage
      if (typeof value !== "string") continue
      const image = decodeImageDataUrl(value)
      if (image) rows.push({ cardId, side, ...image })
    }
  })
  if (rows.length === 0) return new Set()

  await tx
    .insert(cardImages)
    .values(rows)
    .onConflictDoUpdate({
      target: [cardImages.cardId, cardImages.side],
      set: {
        data: sql`excluded.data`,
        contentType: sql`excluded.content_type`,
        size: sql`excluded.size`,
        uploadedAt: new Date(),
      },
    })
  return new Set(rows.map((row) => `${row.cardId}:${row.side}`))
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
        spaceId: course.spaceId,
        folderId: course.folderId,
        speechLocale: course.speechLocale,
        ownerId,
      })
      .returning()

    // Always fresh ids: this creates a brand-new course, so an id carried
    // over from wherever the JSON came from (another course's export, most
    // often) must never be reused — it would either collide with the card it
    // was exported from or, worse, silently inherit that card's progress and
    // images.
    const cardRows = course.cards.map((card, position) => ({
      id: makeId(),
      courseId: row.id,
      front: card.front,
      phonetic: card.phonetic,
      back: card.back,
      note: card.note ?? null,
      align: card.align ?? null,
      position,
    }))

    let savedImages = new Set<string>()
    if (cardRows.length > 0) {
      await tx.insert(cards).values(cardRows)
      savedImages = await saveImportedCardImages(
        tx,
        cardRows.map((cardRow) => cardRow.id),
        course.cards
      )
    }

    const [owner] = await tx
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(eq(user.id, ownerId))

    return {
      ...toCourseShell(row, toAuthor(owner ?? null)),
      cards: cardRows.map((cardRow) => ({
        id: cardRow.id,
        front: cardRow.front,
        phonetic: cardRow.phonetic,
        back: cardRow.back,
        ...(cardRow.note ? { note: cardRow.note } : {}),
        ...(cardRow.align ? { align: cardRow.align as TextAlign } : {}),
        ...(savedImages.has(`${cardRow.id}:front`)
          ? { frontImage: true }
          : {}),
        ...(savedImages.has(`${cardRow.id}:back`) ? { backImage: true } : {}),
      })),
      hasSheet: false,
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

    const [existing, [sheet]] = await Promise.all([
      tx
        .select()
        .from(cards)
        .where(eq(cards.courseId, id))
        .orderBy(asc(cards.position)),
      tx
        .select({ courseId: courseSheets.courseId })
        .from(courseSheets)
        .where(eq(courseSheets.courseId, id)),
    ])
    const hasSheet = Boolean(sheet)
    const imageFlags = await cardImageFlags(id)

    const current: Course = {
      ...toCourseShell(row.course, toAuthor(row.owner)),
      cards: existing.map((card) => toCard(card, imageFlags.get(card.id))),
      hasSheet,
    }
    const next = mutate(current)

    const [updated] = await tx
      .update(courses)
      .set({
        title: next.title,
        date: next.date,
        spaceId: next.spaceId,
        folderId: next.folderId,
        speechLocale: next.speechLocale,
        updatedAt: new Date(),
      })
      .where(eq(courses.id, id))
      .returning()

    const kept = new Set(next.cards.map((card) => card.id))
    const removed = existing
      .filter((card) => !kept.has(card.id))
      .map((card) => card.id)
    if (removed.length > 0) {
      await tx.delete(cards).where(inArray(cards.id, removed))
    }

    const nextCardRows = next.cards.map((card, position) => ({
      id: isId(card.id) ? card.id : makeId(),
      courseId: id,
      front: card.front,
      phonetic: card.phonetic,
      back: card.back,
      note: card.note ?? null,
      align: card.align ?? null,
      position,
    }))

    let savedImages = new Set<string>()
    if (nextCardRows.length > 0) {
      await tx
        .insert(cards)
        .values(nextCardRows)
        .onConflictDoUpdate({
          target: cards.id,
          set: {
            front: sql`excluded.front`,
            phonetic: sql`excluded.phonetic`,
            back: sql`excluded.back`,
            note: sql`excluded.note`,
            align: sql`excluded.align`,
            position: sql`excluded.position`,
          },
        })
      // Only reconciles images that arrived as embedded data (a JSON import
      // of a course this app exported) — an existing card's `frontImage` /
      // `backImage` is already a plain boolean, so it's left untouched here.
      savedImages = await saveImportedCardImages(
        tx,
        nextCardRows.map((cardRow) => cardRow.id),
        next.cards
      )
    }

    return {
      ...toCourseShell(updated, toAuthor(row.owner)),
      cards: next.cards.map((card, index) => {
        const cardRow = nextCardRows[index]
        const existingFlags = imageFlags.get(card.id)
        const frontImage =
          typeof card.frontImage === "string"
            ? savedImages.has(`${cardRow.id}:front`)
            : Boolean(card.frontImage ?? existingFlags?.front)
        const backImage =
          typeof card.backImage === "string"
            ? savedImages.has(`${cardRow.id}:back`)
            : Boolean(card.backImage ?? existingFlags?.back)
        return {
          id: cardRow.id,
          front: cardRow.front,
          phonetic: cardRow.phonetic,
          back: cardRow.back,
          ...(cardRow.note ? { note: cardRow.note } : {}),
          ...(cardRow.align ? { align: cardRow.align as TextAlign } : {}),
          ...(frontImage ? { frontImage: true } : {}),
          ...(backImage ? { backImage: true } : {}),
        }
      }),
      hasSheet,
    }
  })
}

/** Moves a lesson to another space and/or folder, or just another folder. */
export async function moveCourse(
  id: string,
  target: { spaceId: string; folderId: string | null }
): Promise<Course | null> {
  return updateCourse(id, (current) => ({
    ...current,
    spaceId: target.spaceId,
    folderId: target.folderId,
  }))
}

/* -------------------------------------------------------------------------- */
/*  Spaces — the top-level subject a course files under.                      */
/* -------------------------------------------------------------------------- */

function slugify(title: string): string {
  const base =
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "espace"
  return base
}

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title)
  const existing = await db
    .select({ slug: spaces.slug })
    .from(spaces)
    .where(sql`${spaces.slug} = ${base} or ${spaces.slug} like ${base + "-%"}`)
  const taken = new Set(existing.map((row) => row.slug))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

export async function listSpaces(): Promise<SpaceSummary[]> {
  const rows = await db
    .select({
      space: spaces,
      owner: { id: user.id, name: user.name },
      courseCount: sql<number>`count(distinct ${courses.id})::int`,
      hasBanner: sql<boolean>`bool_or(${spaceBanners.spaceId} is not null)`,
    })
    .from(spaces)
    .leftJoin(user, eq(spaces.ownerId, user.id))
    .leftJoin(courses, eq(courses.spaceId, spaces.id))
    .leftJoin(spaceBanners, eq(spaceBanners.spaceId, spaces.id))
    .groupBy(spaces.id, user.id)
    .orderBy(asc(spaces.title))

  return rows.map((row) => ({
    ...toSpace(row.space, toAuthor(row.owner), row.hasBanner),
    courseCount: row.courseCount,
  }))
}

/** Looks a space up by id or by its readable slug — whichever was given. */
export async function getSpace(idOrSlug: string): Promise<Space | null> {
  const [row] = await db
    .select({
      space: spaces,
      owner: { id: user.id, name: user.name },
      hasBanner: sql<boolean>`${spaceBanners.spaceId} is not null`,
    })
    .from(spaces)
    .leftJoin(user, eq(spaces.ownerId, user.id))
    .leftJoin(spaceBanners, eq(spaceBanners.spaceId, spaces.id))
    .where(isId(idOrSlug) ? eq(spaces.id, idOrSlug) : eq(spaces.slug, idOrSlug))
  return row ? toSpace(row.space, toAuthor(row.owner), row.hasBanner) : null
}

export async function createSpace(
  title: string,
  ownerId: string | undefined,
  color?: string | null
): Promise<Space> {
  const slug = await uniqueSlug(title)
  const [row] = await db
    .insert(spaces)
    .values({ title: title.trim(), slug, ownerId, color: color ?? null })
    .returning()
  return toSpace(row, ownerId ? await lookupAuthor(ownerId) : null, false)
}

async function lookupAuthor(userId: string): Promise<Author | null> {
  const [row] = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(eq(user.id, userId))
  return toAuthor(row ?? null)
}

export async function updateSpace(
  id: string,
  patch: { title?: string; color?: string | null }
): Promise<Space | null> {
  if (!isId(id)) return null
  const [row] = await db
    .update(spaces)
    .set({
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
      updatedAt: new Date(),
    })
    .where(eq(spaces.id, id))
    .returning()
  if (!row) return null
  const [bannerRow] = await db
    .select({ spaceId: spaceBanners.spaceId })
    .from(spaceBanners)
    .where(eq(spaceBanners.spaceId, id))
  return toSpace(
    row,
    row.ownerId ? await lookupAuthor(row.ownerId) : null,
    Boolean(bannerRow)
  )
}

export type DeleteResult = "ok" | "not-empty" | "not-found"

export async function deleteSpace(id: string): Promise<DeleteResult> {
  if (!isId(id)) return "not-found"

  const [[folderRow], [courseRow]] = await Promise.all([
    db.select({ id: folders.id }).from(folders).where(eq(folders.spaceId, id)),
    db.select({ id: courses.id }).from(courses).where(eq(courses.spaceId, id)),
  ])
  if (folderRow || courseRow) return "not-empty"

  const deleted = await db
    .delete(spaces)
    .where(eq(spaces.id, id))
    .returning({ id: spaces.id })
  return deleted.length > 0 ? "ok" : "not-found"
}

/* -------------------------------------------------------------------------- */
/*  Folders — arbitrary-depth filing inside a space.                          */
/* -------------------------------------------------------------------------- */

export async function getFolder(id: string): Promise<Folder | null> {
  if (!isId(id)) return null
  const [row] = await db
    .select({
      folder: folders,
      hasBanner: sql<boolean>`${folderBanners.folderId} is not null`,
    })
    .from(folders)
    .leftJoin(folderBanners, eq(folderBanners.folderId, folders.id))
    .where(eq(folders.id, id))
  return row ? toFolder(row.folder, row.hasBanner) : null
}

/**
 * What sits directly inside a space (or one of its folders): subfolders and
 * courses at that level only — not the whole subtree.
 */
export async function listFolderContents(
  spaceId: string,
  folderId: string | null
): Promise<Folder[]> {
  const rows = await db
    .select({
      folder: folders,
      hasBanner: sql<boolean>`${folderBanners.folderId} is not null`,
    })
    .from(folders)
    .leftJoin(folderBanners, eq(folderBanners.folderId, folders.id))
    .where(
      and(
        eq(folders.spaceId, spaceId),
        folderId === null
          ? isNull(folders.parentId)
          : eq(folders.parentId, folderId)
      )
    )
    .orderBy(asc(folders.title))
  return rows.map((row) => toFolder(row.folder, row.hasBanner))
}

/** Every folder in a space, any depth — for the "move to…" picker. */
export async function listAllFolders(spaceId: string): Promise<Folder[]> {
  const rows = await db
    .select()
    .from(folders)
    .where(eq(folders.spaceId, spaceId))
    .orderBy(asc(folders.title))
  return rows.map((row) => toFolder(row, false))
}

/**
 * The trail from a space's root down to `folderId`, root first. Walked one
 * level at a time rather than with a recursive query — depth is expected to
 * stay shallow for a study app, and this keeps the code simple.
 */
export async function getFolderChain(
  folderId: string | null
): Promise<Folder[]> {
  const chain: Folder[] = []
  let current = folderId
  let guard = 0
  while (current && guard++ < 50) {
    const folder = await getFolder(current)
    if (!folder) break
    chain.unshift(folder)
    current = folder.parentId
  }
  return chain
}

/** The full breadcrumb for a course or folder page: space root, then folders. */
export async function getBreadcrumb(
  space: Space,
  folderId: string | null
): Promise<Breadcrumb[]> {
  const chain = await getFolderChain(folderId)
  return [
    { id: space.id, title: space.title, href: `/spaces/${space.slug}` },
    ...chain.map((folder) => ({
      id: folder.id,
      title: folder.title,
      href: `/spaces/${space.slug}/folders/${folder.id}`,
    })),
  ]
}

export async function createFolder(
  spaceId: string,
  parentId: string | null,
  title: string,
  color?: string | null
): Promise<Folder> {
  const [row] = await db
    .insert(folders)
    .values({ spaceId, parentId, title: title.trim(), color: color ?? null })
    .returning()
  return toFolder(row, false)
}

export async function updateFolder(
  id: string,
  patch: { title?: string; color?: string | null }
): Promise<Folder | null> {
  if (!isId(id)) return null
  const [row] = await db
    .update(folders)
    .set({
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
      updatedAt: new Date(),
    })
    .where(eq(folders.id, id))
    .returning()
  if (!row) return null
  const [bannerRow] = await db
    .select({ folderId: folderBanners.folderId })
    .from(folderBanners)
    .where(eq(folderBanners.folderId, id))
  return toFolder(row, Boolean(bannerRow))
}

/** Whether `candidate` is `ancestorId` itself, or sits anywhere below it. */
async function isDescendantOrSelf(
  candidate: string,
  ancestorId: string
): Promise<boolean> {
  let current: string | null = candidate
  let guard = 0
  while (current && guard++ < 50) {
    if (current === ancestorId) return true
    const folder = await getFolder(current)
    current = folder?.parentId ?? null
  }
  return false
}

export async function moveFolder(
  id: string,
  parentId: string | null
): Promise<Folder | null | "cycle"> {
  if (!isId(id)) return null
  if (parentId !== null && (await isDescendantOrSelf(parentId, id))) {
    return "cycle"
  }
  const [row] = await db
    .update(folders)
    .set({ parentId, updatedAt: new Date() })
    .where(eq(folders.id, id))
    .returning()
  if (!row) return null
  const [bannerRow] = await db
    .select({ folderId: folderBanners.folderId })
    .from(folderBanners)
    .where(eq(folderBanners.folderId, id))
  return toFolder(row, Boolean(bannerRow))
}

export async function deleteFolder(id: string): Promise<DeleteResult> {
  if (!isId(id)) return "not-found"

  const [[childRow], [courseRow]] = await Promise.all([
    db.select({ id: folders.id }).from(folders).where(eq(folders.parentId, id)),
    db.select({ id: courses.id }).from(courses).where(eq(courses.folderId, id)),
  ])
  if (childRow || courseRow) return "not-empty"

  const deleted = await db
    .delete(folders)
    .where(eq(folders.id, id))
    .returning({ id: folders.id })
  return deleted.length > 0 ? "ok" : "not-found"
}

/* -------------------------------------------------------------------------- */
/*  Cover banners — one optional image atop a space's or folder's card.       */
/* -------------------------------------------------------------------------- */

export type Banner = { contentType: string; data: Buffer; size: number }

export async function getSpaceBanner(spaceId: string): Promise<Banner | null> {
  if (!isId(spaceId)) return null
  const [row] = await db
    .select({
      contentType: spaceBanners.contentType,
      data: spaceBanners.data,
      size: spaceBanners.size,
    })
    .from(spaceBanners)
    .where(eq(spaceBanners.spaceId, spaceId))
  return row ?? null
}

/** A re-upload replaces whatever banner the space already had. */
export async function saveSpaceBanner(
  spaceId: string,
  banner: Banner
): Promise<void> {
  await db
    .insert(spaceBanners)
    .values({ spaceId, ...banner })
    .onConflictDoUpdate({
      target: spaceBanners.spaceId,
      set: {
        data: banner.data,
        contentType: banner.contentType,
        size: banner.size,
        uploadedAt: new Date(),
      },
    })
}

export async function deleteSpaceBanner(spaceId: string): Promise<boolean> {
  if (!isId(spaceId)) return false
  const deleted = await db
    .delete(spaceBanners)
    .where(eq(spaceBanners.spaceId, spaceId))
    .returning({ spaceId: spaceBanners.spaceId })
  return deleted.length > 0
}

export async function getFolderBanner(
  folderId: string
): Promise<Banner | null> {
  if (!isId(folderId)) return null
  const [row] = await db
    .select({
      contentType: folderBanners.contentType,
      data: folderBanners.data,
      size: folderBanners.size,
    })
    .from(folderBanners)
    .where(eq(folderBanners.folderId, folderId))
  return row ?? null
}

/** A re-upload replaces whatever banner the folder already had. */
export async function saveFolderBanner(
  folderId: string,
  banner: Banner
): Promise<void> {
  await db
    .insert(folderBanners)
    .values({ folderId, ...banner })
    .onConflictDoUpdate({
      target: folderBanners.folderId,
      set: {
        data: banner.data,
        contentType: banner.contentType,
        size: banner.size,
        uploadedAt: new Date(),
      },
    })
}

export async function deleteFolderBanner(folderId: string): Promise<boolean> {
  if (!isId(folderId)) return false
  const deleted = await db
    .delete(folderBanners)
    .where(eq(folderBanners.folderId, folderId))
    .returning({ folderId: folderBanners.folderId })
  return deleted.length > 0
}

/* -------------------------------------------------------------------------- */
/*  Revision sheet — a designed PDF, generated offline and uploaded whole.     */
/* -------------------------------------------------------------------------- */

export type CourseSheet = { filename: string; data: Buffer; size: number }

export async function getCourseSheet(
  courseId: string
): Promise<CourseSheet | null> {
  if (!isId(courseId)) return null
  const [row] = await db
    .select({
      filename: courseSheets.filename,
      data: courseSheets.data,
      size: courseSheets.size,
    })
    .from(courseSheets)
    .where(eq(courseSheets.courseId, courseId))
  return row ?? null
}

/** A re-upload replaces whatever sheet the lesson already had. */
export async function saveCourseSheet(
  courseId: string,
  sheet: CourseSheet
): Promise<void> {
  await db
    .insert(courseSheets)
    .values({ courseId, ...sheet })
    .onConflictDoUpdate({
      target: courseSheets.courseId,
      set: {
        filename: sheet.filename,
        data: sheet.data,
        size: sheet.size,
        uploadedAt: new Date(),
      },
    })
}

export async function deleteCourseSheet(courseId: string): Promise<boolean> {
  if (!isId(courseId)) return false
  const deleted = await db
    .delete(courseSheets)
    .where(eq(courseSheets.courseId, courseId))
    .returning({ courseId: courseSheets.courseId })
  return deleted.length > 0
}

/* -------------------------------------------------------------------------- */
/*  Card images — one optional image per face, independent of the other.      */
/* -------------------------------------------------------------------------- */

export type CardSide = "front" | "back"
export type CardImage = { contentType: string; data: Buffer; size: number }

/** Whether `cardId` is actually one of `courseId`'s cards — checked before any write. */
export async function cardBelongsToCourse(
  cardId: string,
  courseId: string
): Promise<boolean> {
  if (!isId(cardId) || !isId(courseId)) return false
  const [row] = await db
    .select({ id: cards.id })
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.courseId, courseId)))
  return Boolean(row)
}

export async function getCardImage(
  cardId: string,
  side: CardSide
): Promise<CardImage | null> {
  if (!isId(cardId)) return null
  const [row] = await db
    .select({
      contentType: cardImages.contentType,
      data: cardImages.data,
      size: cardImages.size,
    })
    .from(cardImages)
    .where(and(eq(cardImages.cardId, cardId), eq(cardImages.side, side)))
  return row ?? null
}

/** A re-upload replaces whatever image that face already had. */
export async function saveCardImage(
  cardId: string,
  side: CardSide,
  image: CardImage
): Promise<void> {
  await db
    .insert(cardImages)
    .values({ cardId, side, ...image })
    .onConflictDoUpdate({
      target: [cardImages.cardId, cardImages.side],
      set: {
        data: image.data,
        contentType: image.contentType,
        size: image.size,
        uploadedAt: new Date(),
      },
    })
}

export async function deleteCardImage(
  cardId: string,
  side: CardSide
): Promise<boolean> {
  if (!isId(cardId)) return false
  const deleted = await db
    .delete(cardImages)
    .where(and(eq(cardImages.cardId, cardId), eq(cardImages.side, side)))
    .returning({ cardId: cardImages.cardId })
  return deleted.length > 0
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
      db.select({ value: sql<number>`count(*)::int` }).from(cards),
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

export function createWord(input: Partial<Card>): Card {
  return {
    id: input.id ?? makeId(),
    front: input.front?.trim() ?? "",
    phonetic: input.phonetic?.trim() ?? "",
    back: input.back?.trim() ?? "",
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    ...(input.align ? { align: input.align } : {}),
  }
}
