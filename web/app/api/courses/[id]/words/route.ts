import { NextResponse } from "next/server"

import { requireWriteAccess } from "@/lib/guard"
import { normalizeWords } from "@/lib/normalize"
import { createWord, updateCourse } from "@/lib/store"
import type { Word } from "@/lib/types"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/** Adds one word (`{ korean, ... }`) or many (`{ words: [...] }`). */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const access = await requireWriteAccess(id)
  if ("denied" in access) return access.denied

  const body = (await request.json().catch(() => null)) as
    (Partial<Word> & { words?: unknown }) | null
  if (!body)
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 }
    )

  const added: Word[] =
    body.words !== undefined
      ? normalizeWords(body.words)
      : [createWord({ ...body, id: undefined })]

  const usable = added.filter((word) => word.korean || word.translation)
  if (usable.length === 0) {
    return NextResponse.json(
      { error: "Renseigne au moins le mot coréen ou sa traduction." },
      { status: 422 }
    )
  }

  const course = await updateCourse(id, (current) => ({
    ...current,
    words: [...current.words, ...usable],
  }))
  if (!course)
    return NextResponse.json({ error: "Cours introuvable." }, { status: 404 })
  return NextResponse.json({ course, added: usable }, { status: 201 })
}
