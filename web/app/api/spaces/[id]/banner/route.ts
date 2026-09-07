import { NextResponse } from "next/server"

import { currentUser } from "@/lib/session"
import { sniffImage } from "@/lib/sniff-image"
import { deleteSpaceBanner, getSpaceBanner, saveSpaceBanner } from "@/lib/store"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

const MAX_SIZE = 5 * 1024 * 1024

/** Public: reading a space's banner needs no account, same as the space itself. */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const banner = await getSpaceBanner(id)
  if (!banner)
    return NextResponse.json(
      { error: "Aucune bannière pour cet espace." },
      { status: 404 }
    )

  return new NextResponse(new Uint8Array(banner.data), {
    headers: {
      "content-type": banner.contentType,
      "content-length": String(banner.size),
      "cache-control": "private, max-age=31536000, immutable",
    },
  })
}

/** Replaces whatever banner the space already had — there is only ever one. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const author = await currentUser()
  if (!author) {
    return NextResponse.json(
      { error: "Connecte-toi pour modifier cet espace." },
      { status: 401 }
    )
  }

  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File))
    return NextResponse.json(
      { error: "Fournis une image sous le champ `file`." },
      { status: 400 }
    )
  if (file.size > MAX_SIZE)
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

  await saveSpaceBanner(id, { contentType, data, size: data.byteLength })
  return NextResponse.json({ ok: true, size: data.byteLength })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const author = await currentUser()
  if (!author) {
    return NextResponse.json(
      { error: "Connecte-toi pour modifier cet espace." },
      { status: 401 }
    )
  }

  await deleteSpaceBanner(id)
  return NextResponse.json({ ok: true })
}
