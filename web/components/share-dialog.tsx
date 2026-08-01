"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { api } from "@/lib/api"
import type { Author } from "@/lib/types"

type Roster = { editors: Author[]; users: Author[] }

/**
 * Two ways in, as asked: tick an existing account, or type the email of someone
 * you know. The email lookup only ever returns a handle, so the roster of
 * accounts stays a list of pseudonyms.
 */
export function ShareDialog({
  courseId,
  owner,
  children,
}: {
  courseId: string
  owner: Author | null
  children: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [users, setUsers] = React.useState<Author[]>([])
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [email, setEmail] = React.useState("")
  const [adding, setAdding] = React.useState(false)

  async function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) return

    setLoading(true)
    try {
      const roster = await api<Roster>(`/api/courses/${courseId}/editors`)
      setUsers(roster.users)
      setSelected(new Set(roster.editors.map((editor) => editor.id)))
      setEmail("")
    } catch (error) {
      toast.add({
        title: "Impossible de charger les accès",
        description: error instanceof Error ? error.message : undefined,
        type: "error",
      })
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  function toggle(id: string) {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** Resolves an email to an account and ticks it, without saving yet. */
  async function addByEmail(event: React.FormEvent) {
    event.preventDefault()
    if (!email.trim()) return

    setAdding(true)
    try {
      const found = await api<Author>(`/api/courses/${courseId}/editors`, {
        method: "POST",
        body: JSON.stringify({ email }),
      })
      setUsers((previous) =>
        previous.some((user) => user.id === found.id)
          ? previous
          : [...previous, found]
      )
      setSelected((previous) => new Set(previous).add(found.id))
      setEmail("")
    } catch (error) {
      toast.add({
        title: "Compte introuvable",
        description: error instanceof Error ? error.message : undefined,
        type: "error",
      })
    } finally {
      setAdding(false)
    }
  }

  async function save() {
    setSaving(true)
    try {
      await api(`/api/courses/${courseId}/editors`, {
        method: "PUT",
        body: JSON.stringify({ userIds: [...selected] }),
      })
      toast.add({ title: "Accès mis à jour", type: "success" })
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.add({
        title: "Échec de l'enregistrement",
        description: error instanceof Error ? error.message : undefined,
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  // The owner always has write access, so their row is shown ticked and locked
  // rather than hidden — otherwise the list looks like it is missing someone.
  const others = users.filter((user) => user.id !== owner?.id)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader>
          <DialogTitle>Accès en écriture</DialogTitle>
          <DialogDescription>
            Tout le monde peut lire ce cours. Coche qui peut aussi le modifier.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="flex min-h-0 flex-col gap-3">
            <ul className="-mx-1 flex min-h-0 flex-col overflow-y-auto px-1">
              {owner && (
                <li className="flex items-center gap-3 py-2">
                  <Checkbox checked disabled />
                  <span className="flex-1 text-sm">{owner.name}</span>
                  <span className="text-xs text-muted-foreground">auteur</span>
                </li>
              )}
              {others.map((user) => (
                <li key={user.id} className="flex items-center gap-3 py-2">
                  <Checkbox
                    id={`editor-${user.id}`}
                    checked={selected.has(user.id)}
                    onCheckedChange={() => toggle(user.id)}
                  />
                  <Label
                    htmlFor={`editor-${user.id}`}
                    className="flex-1 text-sm font-normal"
                  >
                    {user.name}
                  </Label>
                </li>
              ))}
              {others.length === 0 && (
                <li className="py-2 text-sm text-pretty text-muted-foreground">
                  Aucun autre compte pour le moment. Ajoute quelqu&apos;un par
                  son email.
                </li>
              )}
            </ul>

            <form onSubmit={addByEmail} className="flex gap-2">
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ajouter par email"
                aria-label="Ajouter un compte par email"
              />
              <Button type="submit" variant="outline" disabled={adding}>
                {adding ? <Spinner /> : <PlusIcon />}
              </Button>
            </form>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Spinner data-icon="inline-start" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
