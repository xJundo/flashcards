"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { BannerImageField } from "@/components/banner-image-field"
import { ColorPicker } from "@/components/color-picker"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { api } from "@/lib/api"
import type { ColorKey } from "@/lib/colors"
import type { Space } from "@/lib/types"

type SpaceFormDialogProps = {
  /** Omit to create a new space. */
  space?: Pick<Space, "id" | "title" | "color" | "hasBanner">
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onCreated?: (space: Space) => void
}

export function SpaceFormDialog({
  space,
  children,
  open: openProp,
  onOpenChange,
  onCreated,
}: SpaceFormDialogProps) {
  const router = useRouter()
  const [selfOpen, setSelfOpen] = React.useState(false)
  const open = openProp ?? selfOpen
  const [pending, setPending] = React.useState(false)
  const [title, setTitle] = React.useState(space?.title ?? "")
  const [color, setColor] = React.useState<ColorKey | null>(
    (space?.color as ColorKey | null) ?? null
  )

  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setTitle(space?.title ?? "")
      setColor((space?.color as ColorKey | null) ?? null)
    }
  }

  function setOpen(next: boolean) {
    onOpenChange?.(next)
    if (openProp === undefined) setSelfOpen(next)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    try {
      if (space) {
        await api(`/api/spaces/${space.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title, color }),
        })
        toast.add({ title: "Espace mis à jour", type: "success" })
        setOpen(false)
        router.refresh()
      } else {
        const { space: created } = await api<{ space: Space }>("/api/spaces", {
          method: "POST",
          body: JSON.stringify({ title, color }),
        })
        toast.add({ title: "Espace créé", type: "success" })
        setOpen(false)
        setTitle("")
        setColor(null)
        if (onCreated) onCreated(created)
        else router.push(`/spaces/${created.slug}`)
      }
    } catch (error) {
      toast.add({
        title: "Échec de l'enregistrement",
        description: error instanceof Error ? error.message : undefined,
        type: "error",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger render={children as React.ReactElement} />}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {space ? "Renommer l'espace" : "Nouvel espace"}
          </DialogTitle>
          <DialogDescription>
            {space
              ? "Change le titre de cet espace."
              : "Une langue, une matière — n'importe quel sujet qui mérite son propre catalogue de cours."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="space-title">Titre</FieldLabel>
              <Input
                id="space-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Coréen, Médecine, Histoire…"
                autoFocus
              />
            </Field>
            <ColorPicker value={color} onChange={setColor} />
            {space && (
              <BannerImageField
                url={`/api/spaces/${space.id}/banner`}
                hasBanner={space.hasBanner}
              />
            )}
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={pending || !title.trim()}>
              {pending && <Spinner data-icon="inline-start" />}
              {space ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
