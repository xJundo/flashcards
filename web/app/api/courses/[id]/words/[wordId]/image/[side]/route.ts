import { NextResponse } from "next/server"

import { requireWriteAccess } from "@/lib/guard"
import { sniffImage } from "@/lib/sniff-image"
import {
  cardBelongsToCourse,
  deleteCardImage,
  getCardImage,
  MAX_CARD_IMAGE_SIZE,
  saveCardImage,
} from "@/lib/store"
import type { CardSide } from "@/lib/store"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string; wordId: string; side: string }> }

function parseSide(value: string): CardSide | null {
  return value === "front" || value === "back" ? value : null
}

/** Public: reading a card's image needs no account, same as the card itself. */
export async function GET(_request: Request, { params }: Params) {
  const { wordId, side } = await params
  const parsedSide = parseSide(side)
  if (!parsedSide)
    return NextResponse.json({ error: "Face invalide." }, { status: 400 })

  const image = await getCardImage(wordId, parsedSide)
  if (!image)
    return NextResponse.json(
      { error: "Aucune image pour cette face." },
      { status: 404 }
    )

  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      "content-type": image.contentType,
      "content-length": String(image.size),
      "cache-control": "private, max-age=31536000, immutable",
    },
  })
}

/** Replaces whatever image that face already had — there is only ever one. */
export async function POST(request: Request, { params }: Params) {
  const { id, wordId, side } = await params
  const parsedSide = parseSide(side)
  if (!parsedSide)
    return NextResponse.json({ error: "Face invalide." }, { status: 400 })

  const access = await requireWriteAccess(id)
  if ("denied" in access) return access.denied

  if (!(await cardBelongsToCourse(wordId, id)))
    return NextResponse.json({ error: "Carte introuvable." }, { status: 404 })

  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File))
    return NextResponse.json(
      { error: "Fournis une image sous le champ `file`." },
      { status: 400 }
    )
  if (file.size > MAX_CARD_IMAGE_SIZE)
    return NextResponse.json(
      { error: "L'image dépasse la taille maximale (5 Mo)." },
      { status: 413 }
    )

  const data = Buffer.from(await file.arrayBuffer())
  const contentType = sniffImage(data)
  if (!contentType)
    return NextResponse.json(
      { error: "Format d'image non reconnu (PNG, JPEG, WEBP ou GIF attendu)." },
      { status: 400 }
    )

  await saveCardImage(wordId, parsedSide, {
    contentType,
    data,
    size: data.byteLength,
  })
  return NextResponse.json({ ok: true, size: data.byteLength })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id, wordId, side } = await params
  const parsedSide = parseSide(side)
  if (!parsedSide)
    return NextResponse.json({ error: "Face invalide." }, { status: 400 })

  const access = await requireWriteAccess(id)
  if ("denied" in access) return access.denied

  if (!(await cardBelongsToCourse(wordId, id)))
    return NextResponse.json({ error: "Carte introuvable." }, { status: 404 })

  await deleteCardImage(wordId, parsedSide)
  return NextResponse.json({ ok: true })
}
