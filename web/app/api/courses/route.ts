import { NextResponse } from "next/server"

import { normalizeImportedCourses, toCourse, today } from "@/lib/normalize"
import { parseNotes } from "@/lib/parse-notes"
import { currentUser } from "@/lib/session"
import { getSpace, listCourses, saveCourse } from "@/lib/store"

export const dynamic = "force-dynamic"

/** Lessons are readable by anyone, signed in or not. */
export async function GET() {
  return NextResponse.json(await listCourses())
}

type CreateBody = {
  title?: string
  date?: string
  /** Raw JSON string, already-parsed JSON, or plain-text notes. */
  json?: unknown
  text?: string
  spaceId?: string
  folderId?: string | null
  speechLocale?: string | null
}

export async function POST(request: Request) {
  const author = await currentUser()
  if (!author) {
    return NextResponse.json(
      { error: "Connecte-toi pour créer un cours." },
      { status: 401 }
    )
  }

  let body: CreateBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Corps de requête JSON invalide." },
      { status: 400 }
    )
  }

  if (!body.spaceId?.trim()) {
    return NextResponse.json(
      { error: "Choisis l'espace où ranger ce cours." },
      { status: 422 }
    )
  }
  // Accepts the space's id or its readable slug — the CLI importer and the
  // UI's picker both go through here, and only the UI already has the id.
  const space = await getSpace(body.spaceId)
  if (!space) {
    return NextResponse.json({ error: "Espace introuvable." }, { status: 404 })
  }
  const location = {
    spaceId: space.id,
    folderId: body.folderId ?? null,
    speechLocale: body.speechLocale ?? null,
  }

  const fallbackTitle =
    body.title?.trim() || `Cours du ${body.date?.trim() || today()}`

  if (typeof body.text === "string" && body.text.trim()) {
    const parsed = parseNotes(body.text)
    if (parsed.words.length === 0) {
      return NextResponse.json(
        { error: "Aucun mot n'a pu être extrait de ce texte." },
        { status: 422 }
      )
    }
    const course = await saveCourse(
      {
        ...toCourse(
          {
            ...parsed,
            title: body.title?.trim() || parsed.title,
            date: body.date?.trim() || parsed.date,
          },
          fallbackTitle
        ),
        ...location,
      },
      author.id
    )
    return NextResponse.json(
      { courses: [course], skipped: parsed.skipped },
      { status: 201 }
    )
  }

  if (body.json !== undefined) {
    let payload = body.json
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload)
      } catch {
        return NextResponse.json(
          { error: "Le JSON fourni est invalide." },
          { status: 400 }
        )
      }
    }
    const parsedCourses = normalizeImportedCourses(payload)
    if (parsedCourses.length === 0) {
      return NextResponse.json(
        {
          error:
            "Aucun mot trouvé. Attendu : recto / indice phonétique / verso.",
        },
        { status: 422 }
      )
    }
    const courses = []
    for (const [index, parsed] of parsedCourses.entries()) {
      courses.push(
        await saveCourse(
          {
            ...toCourse(
              {
                ...parsed,
                title:
                  parsedCourses.length === 1
                    ? body.title?.trim() || parsed.title
                    : parsed.title,
                date:
                  parsedCourses.length === 1
                    ? body.date?.trim() || parsed.date
                    : parsed.date,
              },
              parsedCourses.length === 1
                ? fallbackTitle
                : `${fallbackTitle} (${index + 1})`
            ),
            ...location,
          },
          author.id
        )
      )
    }
    return NextResponse.json({ courses }, { status: 201 })
  }

  // No payload: an empty lesson to fill in by hand.
  const course = await saveCourse(
    {
      ...toCourse(
        { title: body.title, date: body.date, words: [] },
        fallbackTitle
      ),
      ...location,
    },
    author.id
  )
  return NextResponse.json({ courses: [course] }, { status: 201 })
}
