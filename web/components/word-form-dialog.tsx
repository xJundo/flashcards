"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { CardImageField } from "@/components/card-image-field"
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
import type { Card } from "@/lib/types"

type WordFormDialogProps = {
  courseId: string
  /** Omit to add a new word. */
  word?: Card
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

const EMPTY = { front: "", phonetic: "", back: "", note: "" }

function toValues(word: Card | undefined) {
  if (!word) return EMPTY
  return {
    front: word.front,
    phonetic: word.phonetic,
    back: word.back,
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
  const frontRef = React.useRef<HTMLInputElement>(null)
  // Only used for a brand new word: it has no id yet to upload an image
  // against, so the file is held here and pushed up once the word is saved.
  const [frontImage, setFrontImage] = React.useState<File | null>(null)
  const [backImage, setBackImage] = React.useState<File | null>(null)

  function handleOpenChange(next: boolean) {
    if (next) {
      setValues(toValues(word))
      setFrontImage(null)
      setBackImage(null)
    }
    setOpen(next)
  }

  async function uploadImage(cardId: string, side: "front" | "back", file: File) {
    const form = new FormData()
    form.append("file", file)
    const response = await fetch(
      `/api/courses/${courseId}/words/${cardId}/image/${side}`,
      { method: "POST", body: form }
    )
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new Error(
        payload && typeof payload === "object" && "error" in payload
          ? String((payload as { error: unknown }).error)
          : `Erreur ${response.status}`
      )
    }
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
        const { added } = await api<{ added: Card[] }>(
          `/api/courses/${courseId}/words`,
          { method: "POST", body: JSON.stringify(values) }
        )
        const created = added[0]
        if (created && frontImage)
          await uploadImage(created.id, "front", frontImage)
        if (created && backImage)
          await uploadImage(created.id, "back", backImage)
        toast.add({
          title: `« ${values.front || values.back} » ajouté`,
          type: "success",
        })
      }
      router.refresh()
      if (keepOpen) {
        setValues(EMPTY)
        setFrontImage(null)
        setBackImage(null)
        frontRef.current?.focus()
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
              <FieldLabel htmlFor="word-front">Recto</FieldLabel>
              <Input
                id="word-front"
                ref={frontRef}
                value={values.front}
                onChange={(event) =>
                  setValues({ ...values, front: event.target.value })
                }
                placeholder="안녕하세요"
                autoFocus
              />
            </Field>
            {word ? (
              <CardImageField
                mode="server"
                courseId={courseId}
                cardId={word.id}
                side="front"
                label="Image au recto"
                hasImage={Boolean(word.frontImage)}
              />
            ) : (
              <CardImageField
                mode="deferred"
                label="Image au recto"
                file={frontImage}
                onFileChange={setFrontImage}
              />
            )}
            <Field>
              <FieldLabel htmlFor="word-phonetic">Indice phonétique</FieldLabel>
              <Input
                id="word-phonetic"
                value={values.phonetic}
                onChange={(event) =>
                  setValues({ ...values, phonetic: event.target.value })
                }
                placeholder="annyeonghaseyo"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="word-back">Verso</FieldLabel>
              <Input
                id="word-back"
                value={values.back}
                onChange={(event) =>
                  setValues({ ...values, back: event.target.value })
                }
                placeholder="bonjour"
              />
            </Field>
            {word ? (
              <CardImageField
                mode="server"
                courseId={courseId}
                cardId={word.id}
                side="back"
                label="Image au verso"
                hasImage={Boolean(word.backImage)}
              />
            ) : (
              <CardImageField
                mode="deferred"
                label="Image au verso"
                file={backImage}
                onFileChange={setBackImage}
              />
            )}
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
