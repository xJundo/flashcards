import "server-only"

import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import type { Author } from "@/lib/types"

/** The signed-in account, or `null` — most pages are readable either way. */
export async function currentUser(): Promise<Author | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  return session ? { id: session.user.id, name: session.user.name } : null
}
