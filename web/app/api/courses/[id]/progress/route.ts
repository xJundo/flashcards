import { NextResponse } from "next/server"

import {
  clearRuns,
  deleteRun,
  getProgress,
  markAcquired,
  markForReview,
  recordRun,
} from "@/lib/progress-store"
import { currentUser } from "@/lib/session"
import type { RunFront } from "@/lib/types"

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
  /** A series, finished or closed early. Free practice never sends one. */
  run?: {
    failed?: unknown
    known?: unknown
    size?: unknown
    completed?: unknown
    frontSide?: unknown
  }
  /** Marking one word acquired from the review list. */
  acquired?: string
  /** Sending one acquired word back to the review list. */
  review?: string
  /** Dropping one series from the history. */
  deleteRun?: string
  /** Wiping the series history. */
  clearRuns?: boolean
}

const FRONT_SIDES: RunFront[] = [
  "korean",
  "translation",
  "random",
  "audio",
  "mixed",
]

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
    const failed = ids(body.run.failed)
    const known = ids(body.run.known)
    const frontSide = FRONT_SIDES.find((side) => side === body.run?.frontSide)

    return NextResponse.json(
      await recordRun(userId, id, {
        failed,
        known,
        size:
          typeof body.run.size === "number" && Number.isFinite(body.run.size)
            ? Math.trunc(body.run.size)
            : failed.length + known.length,
        completed: body.run.completed !== false,
        frontSide: frontSide ?? "korean",
      })
    )
  }

  if (body.acquired) await markAcquired(userId, id, body.acquired)
  if (body.review) await markForReview(userId, body.review)
  if (body.deleteRun) await deleteRun(userId, body.deleteRun)
  if (body.clearRuns) await clearRuns(userId, id)

  return NextResponse.json(await getProgress(userId, id))
}
