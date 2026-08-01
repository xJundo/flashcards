import "server-only"

import { NextResponse } from "next/server"

import { currentUser } from "@/lib/session"
import { canWrite } from "@/lib/store"
import type { Author } from "@/lib/types"

/**
 * Resolves the caller's right to change a lesson. Returns either the account,
 * or the response to send back — so a route reads as one `if`.
 *
 * The 404 case is folded into the permission check on purpose: whether a
 * lesson exists is public knowledge here (they are all readable), so there is
 * nothing to hide, but the caller still gets the accurate status.
 */
export async function requireWriteAccess(
  courseId: string
): Promise<{ author: Author } | { denied: NextResponse }> {
  const author = await currentUser()
  if (!author) {
    return {
      denied: NextResponse.json(
        { error: "Connecte-toi pour modifier ce cours." },
        { status: 401 }
      ),
    }
  }

  if (!(await canWrite(courseId, author.id))) {
    return {
      denied: NextResponse.json(
        { error: "Tu n'as pas l'accès en écriture sur ce cours." },
        { status: 403 }
      ),
    }
  }

  return { author }
}
