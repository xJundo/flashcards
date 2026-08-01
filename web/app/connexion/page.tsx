import { Suspense } from "react"
import { redirect } from "next/navigation"

import { AuthForm } from "@/components/auth-form"
import { currentUser } from "@/lib/session"

export const metadata = { title: "Connexion — Flashcards coréen" }

export default async function SignInPage() {
  if (await currentUser()) redirect("/")
  return (
    <Suspense>
      <AuthForm mode="signin" />
    </Suspense>
  )
}
