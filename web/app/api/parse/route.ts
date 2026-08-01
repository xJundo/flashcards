import { NextResponse } from "next/server"

import { normalizeImportedCourses } from "@/lib/normalize"
import { parseNotes } from "@/lib/parse-notes"

export const dynamic = "force-dynamic"

/**
 * Dry-run of the importers: returns what *would* be created, without writing.
 * Used by the import dialog's preview and by `scripts/import-notes.mjs --dry-run`.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    text?: string
    json?: unknown
  } | null
  if (!body)
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 }
    )

  if (typeof body.text === "string" && body.text.trim()) {
    const { words, skipped, title, date } = parseNotes(body.text)
    return NextResponse.json({ courses: [{ title, date, words }], skipped })
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
    return NextResponse.json({
      courses: normalizeImportedCourses(payload),
      skipped: [],
    })
  }

  return NextResponse.json(
    { error: "Fournis `text` ou `json`." },
    { status: 400 }
  )
}
