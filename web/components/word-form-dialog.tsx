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
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { api } from "@/lib/api"
import type { Word } from "@/lib/types"

type WordFormDialogProps = {
  courseId: string
  /** Omit to add a new word. */
  word?: Word
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

const EMPTY = { korean: "", romanization: "", translation: "", note: "" }

function toValues(word: Word | undefined) {
  if (!word) return EMPTY
  return {
    korean: word.korean,
    romanization: word.romanization,
    translation: word.translation,
    note: word.note ?? "",
  }
}

export function WordFormDialog({
  courseId,
  word,
  open: controlledOpen,
  onOpenChange,
  children,
}: WordFormDialogProps) {
  const router = useRouter()
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  // The edit dialog is mounted already open with its word, so the initial value
  // is enough there; the "add" dialog is reset each time it is reopened.
  const [values, setValues] = React.useState(() => toValues(word))
  const [pending, setPending] = React.useState(false)
  const koreanRef = React.useRef<HTMLInputElement>(null)

  function handleOpenChange(next: boolean) {
    if (next) setValues(toValues(word))
    setOpen(next)
  }

  async function submit(event: React.FormEvent, keepOpen = false) {
    event.preventDefault()
    setPending(true)
    try {
      if (word) {
        await api(`/api/courses/${courseId}/words/${word.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        })
        toast.add({ title: "Mot mis à jour", type: "success" })
      } else {
        await api(`/api/courses/${courseId}/words`, {
          method: "POST",
          body: JSON.stringify(values),
        })
        toast.add({
          title: `« ${values.korean || values.translation} » ajouté`,
          type: "success",
        })
      }
      router.refresh()
      if (keepOpen) {
        setValues(EMPTY)
        koreanRef.current?.focus()
      } else {
        setOpen(false)
      }
    } catch (error) {
      toast.add({
        title: "Enregistrement impossible",
        description: error instanceof Error ? error.message : undefined,
        type: "error",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children && <DialogTrigger render={children as React.ReactElement} />}
      <DialogContent className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)]">
        <DialogHeader>
          <DialogTitle>
            {word ? "Modifier le mot" : "Ajouter un mot"}
          </DialogTitle>
          <DialogDescription>
            Le mot est enregistré directement dans le JSON du cours.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => submit(event)}
          className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-4"
        >
          {/* Scrolls on short viewports so the footer stays reachable. */}
          <FieldGroup className="-mx-1 overflow-y-auto px-1">
            <Field>
              <FieldLabel htmlFor="word-korean">Coréen</FieldLabel>
              <Input
                id="word-korean"
                ref={koreanRef}
                lang="ko"
                value={values.korean}
                onChange={(event) =>
                  setValues({ ...values, korean: event.target.value })
                }
                placeholder="안녕하세요"
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="word-romanization">Prononciation</FieldLabel>
              <Input
                id="word-romanization"
                value={values.romanization}
                onChange={(event) =>
                  setValues({ ...values, romanization: event.target.value })
                }
                placeholder="annyeonghaseyo"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="word-translation">Traduction</FieldLabel>
              <Input
                id="word-translation"
                value={values.translation}
                onChange={(event) =>
                  setValues({ ...values, translation: event.target.value })
                }
                placeholder="bonjour"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="word-note">Note</FieldLabel>
              <Input
                id="word-note"
                value={values.note}
                onChange={(event) =>
                  setValues({ ...values, note: event.target.value })
                }
                placeholder="Registre poli"
              />
              <FieldDescription>
                Facultatif, affiché sur la carte : de quoi distinguer deux mots
                qui se prononcent pareil, ou rappeler une règle.
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
            {!word && (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={(event) => submit(event, true)}
              >
                Ajouter et continuer
              </Button>
            )}
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              {word ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
