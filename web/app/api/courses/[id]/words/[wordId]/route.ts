import { NextResponse } from "next/server"

import { requireWriteAccess } from "@/lib/guard"
import { updateCourse } from "@/lib/store"
import type { Card } from "@/lib/types"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string; wordId: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { id, wordId } = await params
  const access = await requireWriteAccess(id)
  if ("denied" in access) return access.denied

  const body = (await request.json().catch(() => ({}))) as Partial<Card>

  let found = false
  const course = await updateCourse(id, (current) => ({
    ...current,
    cards: current.cards.map((word) => {
      if (word.id !== wordId) return word
      found = true
      // Rebuilt field by field so that clearing `note` drops the key entirely.
      const note = (body.note ?? word.note ?? "").trim()
      return {
        id: word.id,
        front: (body.front ?? word.front).trim(),
        phonetic: (body.phonetic ?? word.phonetic).trim(),
        back: (body.back ?? word.back).trim(),
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
  const access = await requireWriteAccess(id)
  if ("denied" in access) return access.denied

  let found = false
  const course = await updateCourse(id, (current) => {
    const cards = current.cards.filter((word) => {
      if (word.id === wordId) found = true
      return word.id !== wordId
    })
    return { ...current, cards }
  })

  if (!course)
    return NextResponse.json({ error: "Cours introuvable." }, { status: 404 })
  if (!found)
    return NextResponse.json({ error: "Mot introuvable." }, { status: 404 })
  return NextResponse.json({ course })
}
