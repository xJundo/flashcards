import { redirect } from "next/navigation"

import { StatsBoard } from "@/components/stats-board"
import { currentUser } from "@/lib/session"
import { globalStats } from "@/lib/store"

export const dynamic = "force-dynamic"

export const metadata = { title: "Ma progression — Flashcards coréen" }

export default async function StatsPage() {
  const user = await currentUser()
  // Nothing to show without an account: progress is recorded per account, and
  // an anonymous visitor has none.
  if (!user) redirect("/connexion?suite=/stats")

  return <StatsBoard stats={await globalStats(user.id)} />
}
