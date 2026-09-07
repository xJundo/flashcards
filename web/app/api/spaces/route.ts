import { NextResponse } from "next/server"

import { isColorKey } from "@/lib/colors"
import { currentUser } from "@/lib/session"
import { createSpace, listSpaces } from "@/lib/store"

export const dynamic = "force-dynamic"

/** Spaces are readable by anyone, signed in or not. */
export async function GET() {
  return NextResponse.json(await listSpaces())
}

/** Creating a space, like creating a course, only needs an account. */
export async function POST(request: Request) {
  const author = await currentUser()
  if (!author) {
    return NextResponse.json(
      { error: "Connecte-toi pour créer un espace." },
      { status: 401 }
    )
  }

  const body = (await request.json().catch(() => ({}))) as {
    title?: string
    color?: string | null
  }
  const title = body.title?.trim()
  if (!title) {
    return NextResponse.json(
      { error: "Donne un titre à l'espace." },
      { status: 422 }
    )
  }
  if (body.color != null && !isColorKey(body.color)) {
    return NextResponse.json({ error: "Couleur invalide." }, { status: 422 })
  }

  const space = await createSpace(title, author.id, body.color)
  return NextResponse.json({ space }, { status: 201 })
}
