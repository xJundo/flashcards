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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { api } from "@/lib/api"
import { COMMON_LOCALES } from "@/lib/locales"
import type { CourseSummary } from "@/lib/types"

const CUSTOM_LOCALE = "__custom__"
const NO_LOCALE = "__none__"

type CourseFormDialogProps = {
  /** Omit to create a new lesson. */
  course?: Pick<CourseSummary, "id" | "title" | "date" | "speechLocale">
  /** Where a new lesson is filed. Ignored when editing an existing one. */
  spaceId?: string
  folderId?: string | null
  /** The trigger. Omit when the parent drives `open` itself. */
  children?: React.ReactNode
  /** Set to control the dialog from the parent; leave out to self-manage. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/** Whichever preset matches `locale`, or the "other" option for a custom one. */
function localePreset(locale: string | null): string {
  if (!locale) return NO_LOCALE
  return COMMON_LOCALES.some((option) => option.value === locale)
    ? locale
    : CUSTOM_LOCALE
}

export function CourseFormDialog({
  course,
  spaceId,
  folderId = null,
  children,
  open: openProp,
  onOpenChange,
}: CourseFormDialogProps) {
  const router = useRouter()
  const [selfOpen, setSelfOpen] = React.useState(false)
  const open = openProp ?? selfOpen
  const [pending, setPending] = React.useState(false)
  const [title, setTitle] = React.useState(course?.title ?? "")
  const [date, setDate] = React.useState(course?.date ?? "")
  const [preset, setPreset] = React.useState(() =>
    localePreset(course?.speechLocale ?? null)
  )
  const [customLocale, setCustomLocale] = React.useState(
    () => course?.speechLocale ?? ""
  )

  /**
   * Refill on open, so a cancelled edit is discarded. Done while rendering
   * rather than in an effect — the parent may open us without going through
   * `setOpen`, and an effect would paint the stale values first.
   */
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setTitle(course?.title ?? "")
      setDate(course?.date ?? new Date().toISOString().slice(0, 10))
      setPreset(localePreset(course?.speechLocale ?? null))
      setCustomLocale(course?.speechLocale ?? "")
    }
  }

  function setOpen(next: boolean) {
    onOpenChange?.(next)
    if (openProp === undefined) setSelfOpen(next)
  }

  const speechLocale =
    preset === NO_LOCALE
      ? null
      : preset === CUSTOM_LOCALE
        ? customLocale.trim() || null
        : preset

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    try {
      if (course) {
        await api(`/api/courses/${course.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title, date, speechLocale }),
        })
        toast.add({ title: "Cours mis à jour", type: "success" })
      } else {
        const { courses } = await api<{ courses: CourseSummary[] }>(
          "/api/courses",
          {
            method: "POST",
            body: JSON.stringify({
              title,
              date,
              spaceId,
              folderId,
              speechLocale,
            }),
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
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger render={children as React.ReactElement} />}
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
            <Field>
              <FieldLabel htmlFor="course-locale">Langue parlée</FieldLabel>
              <Select
                value={preset}
                onValueChange={(value) => setPreset(String(value))}
              >
                <SelectTrigger id="course-locale" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LOCALE}>Aucune</SelectItem>
                  {COMMON_LOCALES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_LOCALE}>Autre…</SelectItem>
                </SelectContent>
              </Select>
              {preset === CUSTOM_LOCALE && (
                <Input
                  value={customLocale}
                  onChange={(event) => setCustomLocale(event.target.value)}
                  placeholder="nl-NL"
                  className="mt-2"
                />
              )}
              <FieldDescription>
                Active la prononciation audio sur les cartes de ce cours. Laisse
                « Aucune » pour un cours sans langue à prononcer.
              </FieldDescription>
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
