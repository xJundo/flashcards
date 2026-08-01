import { NextResponse } from "next/server"

import { currentUser } from "@/lib/session"
import {
  findUserByEmail,
  isOwner,
  listEditors,
  listUsers,
  setEditors,
} from "@/lib/store"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/**
 * The share panel: who can already write, and who could be added. Restricted to
 * the owner — the roster of accounts is not something every visitor needs.
 */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const author = await currentUser()
  if (!(await isOwner(id, author?.id))) {
    return NextResponse.json(
      { error: "Seul l'auteur du cours gère les accès." },
      { status: 403 }
    )
  }

  const [editors, users] = await Promise.all([listEditors(id), listUsers()])
  return NextResponse.json({ editors, users })
}

/** Looks up an account by exact email, to add someone not in the list. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const author = await currentUser()
  if (!(await isOwner(id, author?.id))) {
    return NextResponse.json(
      { error: "Seul l'auteur du cours gère les accès." },
      { status: 403 }
    )
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string }
  const email = body.email?.trim()
  if (!email) {
    return NextResponse.json({ error: "Email manquant." }, { status: 400 })
  }

  const found = await findUserByEmail(email)
  if (!found) {
    return NextResponse.json(
      { error: "Aucun compte avec cet email." },
      { status: 404 }
    )
  }
  return NextResponse.json(found)
}

/** Replaces the whole list, which is what the checkbox table submits. */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params
  const author = await currentUser()
  if (!(await isOwner(id, author?.id))) {
    return NextResponse.json(
      { error: "Seul l'auteur du cours gère les accès." },
      { status: 403 }
    )
  }

  const body = (await request.json().catch(() => ({}))) as {
    userIds?: unknown
  }
  if (!Array.isArray(body.userIds)) {
    return NextResponse.json(
      { error: "`userIds` doit être une liste." },
      { status: 400 }
    )
  }

  const editors = await setEditors(
    id,
    body.userIds.filter((value): value is string => typeof value === "string")
  )
  return NextResponse.json({ editors })
}
