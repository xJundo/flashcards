"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ImageIcon, Trash2Icon, UploadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]

/** Uploads the cover banner for an already-created space or folder. */
export function BannerImageField({
  url,
  hasBanner,
}: {
  /** e.g. `/api/spaces/{id}/banner` */
  url: string
  hasBanner: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  const [dragOver, setDragOver] = React.useState(false)
  // Bumped after each upload/removal so the `<img>` src changes and the
  // browser actually re-fetches — the URL is otherwise stable even though
  // the image behind it just changed.
  const [version, setVersion] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const [everHadImage, setEverHadImage] = React.useState(hasBanner)
  const imageSrc = everHadImage ? `${url}?v=${version}` : null

  async function upload(file: File | undefined) {
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.add({
        title: "Format d'image non reconnu (PNG, JPEG, WEBP ou GIF attendu).",
        type: "error",
      })
      return
    }
    setBusy(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const response = await fetch(url, { method: "POST", body: form })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: unknown }).error)
            : `Erreur ${response.status}`
        )
      }
      setEverHadImage(true)
      setVersion((v) => v + 1)
      router.refresh()
    } catch (error) {
      toast.add({
        title: "Import de l'image impossible",
        description: error instanceof Error ? error.message : undefined,
        type: "error",
      })
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOver(false)
    void upload(event.dataTransfer.files[0])
  }

  async function remove() {
    setBusy(true)
    try {
      await fetch(url, { method: "DELETE" })
      setEverHadImage(false)
      setVersion((v) => v + 1)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <FieldLabel>Bannière</FieldLabel>
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-md outline-2 outline-transparent outline-offset-4 transition-colors",
          dragOver && "outline-dashed outline-primary"
        )}
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt=""
            draggable={false}
            className="h-14 w-24 shrink-0 rounded-md border object-cover"
          />
        ) : (
          <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground">
            <ImageIcon className="size-5" />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(event) => void upload(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <UploadIcon data-icon="inline-start" />
            )}
            {everHadImage ? "Remplacer" : "Ajouter une image"}
          </Button>
          {everHadImage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void remove()}
            >
              <Trash2Icon data-icon="inline-start" />
              Retirer
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
