import { NextResponse } from "next/server"

import { requireWriteAccess } from "@/lib/guard"
import { normalizeWords } from "@/lib/normalize"
import { createWord, updateCourse } from "@/lib/store"
import type { Card } from "@/lib/types"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/** Adds one card (`{ front, ... }`) or many (`{ words: [...] }`). */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const access = await requireWriteAccess(id)
  if ("denied" in access) return access.denied

  const body = (await request.json().catch(() => null)) as
    (Partial<Card> & { words?: unknown }) | null
  if (!body)
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 }
    )

  // A bulk import drops blank rows (parsing noise); a single card added by
  // hand is kept even blank — that's exactly how an image-only card starts,
  // since the image itself can only be attached once the card exists.
  const added: Card[] =
    body.words !== undefined
      ? normalizeWords(body.words).filter((word) => word.front || word.back)
      : [createWord({ ...body, id: undefined })]

  if (added.length === 0) {
    return NextResponse.json(
      { error: "Renseigne au moins le recto ou le verso." },
      { status: 422 }
    )
  }

  const course = await updateCourse(id, (current) => ({
    ...current,
    cards: [...current.cards, ...added],
  }))
  if (!course)
    return NextResponse.json({ error: "Cours introuvable." }, { status: 404 })
  return NextResponse.json({ course, added }, { status: 201 })
}
