import { NextResponse } from "next/server"

import { isColorKey } from "@/lib/colors"
import { currentUser } from "@/lib/session"
import { deleteSpace, getSpace, updateSpace } from "@/lib/store"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const space = await getSpace(id)
  if (!space)
    return NextResponse.json({ error: "Espace introuvable." }, { status: 404 })
  return NextResponse.json(space)
}

/** Renaming a space, like renaming a course, is open to any account. */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const author = await currentUser()
  if (!author) {
    return NextResponse.json(
      { error: "Connecte-toi pour modifier cet espace." },
      { status: 401 }
    )
  }

  const body = (await request.json().catch(() => ({}))) as {
    title?: string
    color?: string | null
  }
  const title = body.title?.trim()
  if (body.title !== undefined && !title) {
    return NextResponse.json(
      { error: "Donne un titre à l'espace." },
      { status: 422 }
    )
  }
  if (body.color != null && !isColorKey(body.color)) {
    return NextResponse.json({ error: "Couleur invalide." }, { status: 422 })
  }
  if (title === undefined && body.color === undefined) {
    return NextResponse.json(
      { error: "Rien à mettre à jour." },
      { status: 422 }
    )
  }

  const space = await updateSpace(id, { title, color: body.color })
  if (!space)
    return NextResponse.json({ error: "Espace introuvable." }, { status: 404 })
  return NextResponse.json(space)
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const author = await currentUser()
  if (!author) {
    return NextResponse.json(
      { error: "Connecte-toi pour supprimer cet espace." },
      { status: 401 }
    )
  }

  const result = await deleteSpace(id)
  if (result === "not-found")
    return NextResponse.json({ error: "Espace introuvable." }, { status: 404 })
  if (result === "not-empty") {
    return NextResponse.json(
      {
        error:
          "Cet espace contient encore des dossiers ou des cours — déplace ou supprime-les d'abord.",
      },
      { status: 409 }
    )
  }
  return NextResponse.json({ ok: true })
}
