"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { signIn, signUp } from "@/lib/auth-client"

/** Both screens are the same form with one extra field, so they share a file. */
export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const isSignup = mode === "signup"
  /** Where the user was headed before being asked to sign in. */
  const next = params.get("suite") || "/"

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    const data = new FormData(event.currentTarget)
    const email = String(data.get("email") ?? "").trim()
    const password = String(data.get("password") ?? "")
    const name = String(data.get("name") ?? "").trim()

    const result = isSignup
      ? await signUp.email({ email, password, name })
      : await signIn.email({ email, password })

    setPending(false)
    if (result.error) {
      setError(result.error.message ?? "Connexion impossible.")
      return
    }

    toast.add({
      title: isSignup ? "Compte créé" : "Content de te revoir",
      type: "success",
    })
    router.push(next)
    router.refresh()
  }

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>{isSignup ? "Créer un compte" : "Connexion"}</CardTitle>
        <CardDescription>
          {isSignup
            ? "Ton pseudo est ce que les autres voient ; ton email reste privé."
            : "Retrouve tes cours et ta progression."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit}>
          <FieldGroup>
            {isSignup && (
              <Field>
                <FieldLabel htmlFor="name">Pseudo</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  required
                  maxLength={40}
                  autoComplete="nickname"
                  placeholder="Gianni"
                  autoFocus
                />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                autoFocus={!isSignup}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete={isSignup ? "new-password" : "current-password"}
              />
              {isSignup && (
                <p className="text-xs text-muted-foreground">
                  8 caractères minimum.
                </p>
              )}
            </Field>

            {error && (
              <p role="alert" className="text-sm text-pretty text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              {isSignup ? "Créer mon compte" : "Se connecter"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {isSignup ? "Déjà un compte ? " : "Pas encore de compte ? "}
              <Link
                href={isSignup ? "/connexion" : "/inscription"}
                className="underline underline-offset-4"
              >
                {isSignup ? "Se connecter" : "S'inscrire"}
              </Link>
            </p>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
