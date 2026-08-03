import { NextResponse } from "next/server"

import { currentUser } from "@/lib/session"
import { setFavorite } from "@/lib/store"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/**
 * A bookmark is the learner's own shortlist, so it needs an account but no
 * permission on the lesson itself — every lesson is readable by everyone.
 */
async function requireAccount() {
  const author = await currentUser()
  return author
    ? { author }
    : {
        denied: NextResponse.json(
          { error: "Connecte-toi pour mettre un cours en favori." },
          { status: 401 }
        ),
      }
}

export async function PUT(_request: Request, { params }: Params) {
  const { id } = await params
  const session = await requireAccount()
  if ("denied" in session) return session.denied

  const favorite = await setFavorite(session.author.id, id, true)
  if (!favorite) {
    return NextResponse.json({ error: "Cours introuvable." }, { status: 404 })
  }
  return NextResponse.json({ favorite })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const session = await requireAccount()
  if ("denied" in session) return session.denied

  await setFavorite(session.author.id, id, false)
  return NextResponse.json({ favorite: false })
}
