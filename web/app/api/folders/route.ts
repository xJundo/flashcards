import { NextResponse } from "next/server"

import { isColorKey } from "@/lib/colors"
import { currentUser } from "@/lib/session"
import { createFolder, getSpace } from "@/lib/store"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const author = await currentUser()
  if (!author) {
    return NextResponse.json(
      { error: "Connecte-toi pour créer un dossier." },
      { status: 401 }
    )
  }

  const body = (await request.json().catch(() => ({}))) as {
    spaceId?: string
    parentId?: string | null
    title?: string
    color?: string | null
  }
  const title = body.title?.trim()
  if (!body.spaceId || !title) {
    return NextResponse.json(
      { error: "Espace et titre requis." },
      { status: 422 }
    )
  }
  if (body.color != null && !isColorKey(body.color)) {
    return NextResponse.json({ error: "Couleur invalide." }, { status: 422 })
  }
  const space = await getSpace(body.spaceId)
  if (!space)
    return NextResponse.json({ error: "Espace introuvable." }, { status: 404 })

  const folder = await createFolder(
    space.id,
    body.parentId ?? null,
    title,
    body.color
  )
  return NextResponse.json({ folder }, { status: 201 })
}
