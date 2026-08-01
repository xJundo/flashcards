import { NextResponse } from "next/server"

import { updateCourse } from "@/lib/store"
import type { Word } from "@/lib/types"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string; wordId: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { id, wordId } = await params
  const body = (await request.json().catch(() => ({}))) as Partial<Word>

  let found = false
  const course = await updateCourse(id, (current) => ({
    ...current,
    words: current.words.map((word) => {
      if (word.id !== wordId) return word
      found = true
      // Rebuilt field by field so that clearing `note` drops the key entirely.
      const note = (body.note ?? word.note ?? "").trim()
      return {
        id: word.id,
        korean: (body.korean ?? word.korean).trim(),
        romanization: (body.romanization ?? word.romanization).trim(),
        translation: (body.translation ?? word.translation).trim(),
        ...(note ? { note } : {}),
      }
    }),
  }))

  if (!course)
    return NextResponse.json({ error: "Cours introuvable." }, { status: 404 })
  if (!found)
    return NextResponse.json({ error: "Mot introuvable." }, { status: 404 })
  return NextResponse.json({ course })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id, wordId } = await params

  let found = false
  const course = await updateCourse(id, (current) => {
    const words = current.words.filter((word) => {
      if (word.id === wordId) found = true
      return word.id !== wordId
    })
    return { ...current, words }
  })

  if (!course)
    return NextResponse.json({ error: "Cours introuvable." }, { status: 404 })
  if (!found)
    return NextResponse.json({ error: "Mot introuvable." }, { status: 404 })
  return NextResponse.json({ course })
}
