import { NextResponse } from "next/server"

import {
  clearReviewWord,
  clearRuns,
  getProgress,
  recordRun,
} from "@/lib/progress-store"
import { currentUser } from "@/lib/session"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/** Progress belongs to one account; there is no anonymous variant to serve. */
async function requireAccount() {
  const author = await currentUser()
  return author
    ? { author }
    : {
        denied: NextResponse.json(
          { error: "Connecte-toi pour suivre ta progression." },
          { status: 401 }
        ),
      }
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const session = await requireAccount()
  if ("denied" in session) return session.denied

  return NextResponse.json(await getProgress(session.author.id, id))
}

type Body = {
  /** A finished series. */
  run?: { failed?: unknown; known?: unknown }
  /** Marking one word acquired from the review list. */
  acquired?: string
  /** Wiping the series history. */
  clearRuns?: boolean
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const session = await requireAccount()
  if ("denied" in session) return session.denied

  const body = (await request.json().catch(() => ({}))) as Body
  const userId = session.author.id

  if (body.run) {
    const ids = (value: unknown) =>
      Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : []
    return NextResponse.json(
      await recordRun(userId, id, {
        failed: ids(body.run.failed),
        known: ids(body.run.known),
      })
    )
  }

  if (body.acquired) await clearReviewWord(userId, body.acquired)
  if (body.clearRuns) await clearRuns(userId, id)

  return NextResponse.json(await getProgress(userId, id))
}
