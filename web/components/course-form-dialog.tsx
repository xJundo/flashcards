"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

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
import type { CourseSummary } from "@/lib/types"

type CourseFormDialogProps = {
  /** Omit to create a new lesson. */
  course?: Pick<CourseSummary, "id" | "title" | "date">
  children: React.ReactNode
}

export function CourseFormDialog({ course, children }: CourseFormDialogProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [title, setTitle] = React.useState(course?.title ?? "")
  const [date, setDate] = React.useState(course?.date ?? "")

  /** Reset on open rather than in an effect, so a cancelled edit is discarded. */
  function handleOpenChange(next: boolean) {
    if (next) {
      setTitle(course?.title ?? "")
      setDate(course?.date ?? new Date().toISOString().slice(0, 10))
    }
    setOpen(next)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    try {
      if (course) {
        await api(`/api/courses/${course.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title, date }),
        })
        toast.add({ title: "Cours mis à jour", type: "success" })
      } else {
        const { courses } = await api<{ courses: CourseSummary[] }>(
          "/api/courses",
          {
            method: "POST",
            body: JSON.stringify({ title, date }),
          }
        )
        toast.add({ title: "Cours créé", type: "success" })
        setOpen(false)
        router.push(`/courses/${courses[0].id}`)
        return
      }
      setOpen(false)
      router.refresh()
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)]">
        <DialogHeader>
          <DialogTitle>
            {course ? "Modifier le cours" : "Nouveau cours"}
          </DialogTitle>
          <DialogDescription>
            {course
              ? "Change le titre ou la date de ce cours."
              : "Crée un cours vide, tu pourras y ajouter des mots ensuite."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={submit}
          className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-4"
        >
          {/* Scrolls on short viewports so the footer stays reachable. */}
          <FieldGroup className="-mx-1 overflow-y-auto px-1">
            <Field>
              <FieldLabel htmlFor="course-title">Titre</FieldLabel>
              <Input
                id="course-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Leçon 3 — la famille"
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="course-date">Date du cours</FieldLabel>
              <Input
                id="course-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              {course ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
