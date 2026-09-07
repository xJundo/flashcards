import { NextResponse } from "next/server"

import { isColorKey } from "@/lib/colors"
import { currentUser } from "@/lib/session"
import { deleteFolder, getFolder, moveFolder, updateFolder } from "@/lib/store"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const folder = await getFolder(id)
  if (!folder)
    return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 })
  return NextResponse.json(folder)
}

/** Renaming or moving a folder is open to any account, like a course. */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const author = await currentUser()
  if (!author) {
    return NextResponse.json(
      { error: "Connecte-toi pour modifier ce dossier." },
      { status: 401 }
    )
  }

  const body = (await request.json().catch(() => ({}))) as {
    title?: string
    parentId?: string | null
    color?: string | null
  }

  if (body.color != null && !isColorKey(body.color)) {
    return NextResponse.json({ error: "Couleur invalide." }, { status: 422 })
  }

  if (body.title?.trim() || body.color !== undefined) {
    const folder = await updateFolder(id, {
      title: body.title?.trim() ? body.title : undefined,
      color: body.color,
    })
    if (!folder)
      return NextResponse.json(
        { error: "Dossier introuvable." },
        { status: 404 }
      )
    if (body.parentId === undefined) return NextResponse.json(folder)
  }

  if (body.parentId !== undefined) {
    const moved = await moveFolder(id, body.parentId)
    if (moved === "cycle") {
      return NextResponse.json(
        { error: "Impossible de déplacer un dossier dans lui-même." },
        { status: 422 }
      )
    }
    if (!moved)
      return NextResponse.json(
        { error: "Dossier introuvable." },
        { status: 404 }
      )
    return NextResponse.json(moved)
  }

  const folder = await getFolder(id)
  if (!folder)
    return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 })
  return NextResponse.json(folder)
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const author = await currentUser()
  if (!author) {
    return NextResponse.json(
      { error: "Connecte-toi pour supprimer ce dossier." },
      { status: 401 }
    )
  }

  const result = await deleteFolder(id)
  if (result === "not-found")
    return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 })
  if (result === "not-empty") {
    return NextResponse.json(
      {
        error:
          "Ce dossier contient encore des sous-dossiers ou des cours — déplace ou supprime-les d'abord.",
      },
      { status: 409 }
    )
  }
  return NextResponse.json({ ok: true })
}
