"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ImageIcon, Trash2Icon, UploadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

type Side = "front" | "back"

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]

type CardImageFieldProps = { label: string } & (
  | {
      /** Card already exists: each pick uploads straight to the server. */
      mode: "server"
      courseId: string
      cardId: string
      side: Side
      hasImage: boolean
    }
  | {
      /** Card not created yet: just hold the file until the form submits. */
      mode: "deferred"
      file: File | null
      onFileChange: (file: File | null) => void
    }
)

export function CardImageField(props: CardImageFieldProps) {
  const { label } = props
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  const [dragOver, setDragOver] = React.useState(false)
  // Bumped after each upload/removal so the `<img>` src changes and the
  // browser actually re-fetches — the URL is otherwise stable even though
  // the image behind it just changed.
  const [version, setVersion] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const deferredFile = props.mode === "deferred" ? props.file : null
  const previewUrl = React.useMemo(
    () => (deferredFile ? URL.createObjectURL(deferredFile) : null),
    [deferredFile]
  )
  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const serverUrl =
    props.mode === "server"
      ? `/api/courses/${props.courseId}/words/${props.cardId}/image/${props.side}`
      : null
  const hasImage = props.mode === "server" ? props.hasImage : Boolean(props.file)
  const imageSrc =
    props.mode === "server" ? (serverUrl ? `${serverUrl}?v=${version}` : null) : previewUrl

  async function upload(file: File | undefined) {
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.add({
        title: "Format d'image non reconnu (PNG, JPEG, WEBP ou GIF attendu).",
        type: "error",
      })
      return
    }
    if (props.mode === "deferred") {
      props.onFileChange(file)
      return
    }
    setBusy(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const response = await fetch(serverUrl!, { method: "POST", body: form })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: unknown }).error)
            : `Erreur ${response.status}`
        )
      }
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

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const item = Array.from(event.clipboardData.items).find((entry) =>
      entry.type.startsWith("image/")
    )
    const file = item?.getAsFile()
    if (!file) return
    event.preventDefault()
    void upload(file)
  }

  async function remove() {
    if (props.mode === "deferred") {
      props.onFileChange(null)
      return
    }
    setBusy(true)
    try {
      await fetch(serverUrl!, { method: "DELETE" })
      setVersion((v) => v + 1)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div
        // Focusable so a click-then-Ctrl+V paste has somewhere to land —
        // the paste event only fires on (or under) whatever's focused.
        tabIndex={0}
        role="group"
        aria-label={`${label} : glisse-dépose, colle ou choisis une image`}
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-md outline-2 outline-transparent outline-offset-4 transition-colors focus-visible:outline-dashed focus-visible:outline-ring",
          dragOver && "outline-dashed outline-primary"
        )}
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onPaste={handlePaste}
      >
        {imageSrc ? (
          // Served from our own API (or a local object URL), not an
          // optimizable static asset.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt=""
            draggable={false}
            className="size-14 shrink-0 rounded-md border object-cover"
          />
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground">
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
            {hasImage ? "Remplacer" : "Ajouter une image"}
          </Button>
          {hasImage && (
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
      {!hasImage && (
        <p className="text-xs text-muted-foreground">
          Glisse-dépose une image, ou clique ici et fais Ctrl+V pour coller.
        </p>
      )}
    </div>
  )
}
