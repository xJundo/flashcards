import "server-only"

import {
  mkdir,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises"
import path from "node:path"

import { makeId } from "@/lib/normalize"
import type { Course, CourseSummary, Word } from "@/lib/types"

/**
 * One JSON file per lesson under `$DATA_DIR/courses`. The directory is a Docker
 * volume, so the files stay readable and hand-editable outside the app.
 */
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data")
const COURSES_DIR = path.join(DATA_DIR, "courses")

/** Serialises writes so two requests can't clobber the same file. */
let writeQueue: Promise<unknown> = Promise.resolve()

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(task, task)
  writeQueue = result.catch(() => undefined)
  return result
}

async function ensureDir(): Promise<void> {
  await mkdir(COURSES_DIR, { recursive: true })
}

function fileFor(id: string): string {
  // `id` always comes from `crypto.randomUUID()`, but it arrives via the URL so
  // it is validated here rather than trusted.
  if (!/^[a-zA-Z0-9_-]+$/.test(id))
    throw new Error(`Identifiant de cours invalide: ${id}`)
  return path.join(COURSES_DIR, `${id}.json`)
}

function isCourse(value: unknown): value is Course {
  if (!value || typeof value !== "object") return false
  const course = value as Course
  return typeof course.id === "string" && Array.isArray(course.words)
}

async function writeAtomic(file: string, contents: string): Promise<void> {
  const temp = `${file}.${process.pid}.tmp`
  await writeFile(temp, contents, "utf8")
  await rename(temp, file)
}

export async function listCourses(): Promise<CourseSummary[]> {
  await ensureDir()
  const files = (await readdir(COURSES_DIR)).filter((file) =>
    file.endsWith(".json")
  )
  const courses = await Promise.all(
    files.map(async (file) => {
      try {
        const parsed = JSON.parse(
          await readFile(path.join(COURSES_DIR, file), "utf8")
        )
        if (!isCourse(parsed)) return null
        const { words, ...rest } = parsed
        return { ...rest, wordCount: words.length } satisfies CourseSummary
      } catch {
        return null
      }
    })
  )
  return courses
    .filter((course): course is CourseSummary => course !== null)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
    )
}

export async function getCourse(id: string): Promise<Course | null> {
  await ensureDir()
  try {
    const parsed = JSON.parse(await readFile(fileFor(id), "utf8"))
    return isCourse(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function saveCourse(course: Course): Promise<Course> {
  return enqueue(async () => {
    await ensureDir()
    const next = { ...course, updatedAt: new Date().toISOString() }
    await writeAtomic(fileFor(next.id), `${JSON.stringify(next, null, 2)}\n`)
    return next
  })
}

export async function deleteCourse(id: string): Promise<boolean> {
  return enqueue(async () => {
    try {
      await unlink(fileFor(id))
      return true
    } catch {
      return false
    }
  })
}

/** Read–modify–write under the same queue as `saveCourse`. */
export async function updateCourse(
  id: string,
  mutate: (course: Course) => Course
): Promise<Course | null> {
  return enqueue(async () => {
    await ensureDir()
    let current: Course
    try {
      const parsed = JSON.parse(await readFile(fileFor(id), "utf8"))
      if (!isCourse(parsed)) return null
      current = parsed
    } catch {
      return null
    }
    const next = {
      ...mutate(current),
      id: current.id,
      updatedAt: new Date().toISOString(),
    }
    await writeAtomic(fileFor(id), `${JSON.stringify(next, null, 2)}\n`)
    return next
  })
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

export { COURSES_DIR, DATA_DIR }
