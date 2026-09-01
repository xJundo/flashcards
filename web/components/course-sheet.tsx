"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  DownloadIcon,
  FileTextIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

async function uploadSheet(courseId: string, file: File) {
  const form = new FormData()
  form.append("file", file)
  const response = await fetch(`/api/courses/${courseId}/sheet`, {
    method: "POST",
    body: form,
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Erreur ${response.status}`
    throw new Error(message)
  }
}

/** The PDF itself: embedded so it reads in place, with a plain download escape hatch. */
export function CourseSheetViewer({
  courseId,
  className,
}: {
  courseId: string
  className?: string
}) {
  const src = `/api/courses/${courseId}/sheet`
  return (
    <div className={className}>
      <iframe
        src={src}
        title="Fiche de révision"
        className="h-full min-h-[60vh] w-full rounded-lg border bg-white"
      />
      <a
        href={src}
        download
        className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        <DownloadIcon className="size-3.5" />
        La fiche ne s&apos;affiche pas ? La télécharger.
      </a>
    </div>
  )
}

/**
 * The bottom sheet used wherever the course must stay reachable without
 * leaving the surrounding context — the home page list, and a series or
 * practice run. `Drawer`'s default `swipeDirection="down"` is exactly the
 * "comes up from the bottom" popup asked for; it layers over whatever
 * dialog is already open rather than replacing it.
 */
export function CourseSheetDrawer({
  courseId,
  title,
  children,
  open: openProp,
  onOpenChange,
}: {
  courseId: string
  /** Appended to the drawer's title when known, e.g. from the home page card. */
  title?: string
  children: React.ReactElement
  /**
   * Set to control the drawer from the parent — the series dialog needs to
   * know it's open, so it can stop its own keyboard shortcuts from firing
   * underneath. Leave both out to self-manage.
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [selfOpen, setSelfOpen] = React.useState(false)
  const open = openProp ?? selfOpen
  function setOpen(next: boolean) {
    onOpenChange?.(next)
    if (openProp === undefined) setSelfOpen(next)
  }
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger render={children} />
      <DrawerContent className="h-[88dvh]">
        <DrawerHeader>
          <DrawerTitle>Fiche de révision{title && <> — {title}</>}</DrawerTitle>
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col p-4 pt-2">
          {open && (
            <CourseSheetViewer
              courseId={courseId}
              className="flex min-h-0 flex-1 flex-col"
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

/**
 * The course page's own section: the sheet shown in place when there is one,
 * plus — for whoever can edit the lesson — the upload that puts it there.
 * Nothing to manage means nothing to show a random visitor, so this renders
 * `null` for a lesson with no sheet that the viewer can't fill in either.
 */
export function CourseSheetSection({
  courseId,
  hasSheet,
  editable,
}: {
  courseId: string
  hasSheet: boolean
  editable: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const dragCounter = React.useRef(0)

  // Safety net for the enter/leave counter below: it can get out of sync
  // when the drag passes over the sheet's <iframe> (a separate browsing
  // context that doesn't bubble drag events), so force-reset on any drop or
  // drag end anywhere on the page rather than leaving the highlight stuck on.
  React.useEffect(() => {
    function reset() {
      dragCounter.current = 0
      setIsDragging(false)
    }
    window.addEventListener("dragend", reset)
    window.addEventListener("drop", reset)
    return () => {
      window.removeEventListener("dragend", reset)
      window.removeEventListener("drop", reset)
    }
  }, [])

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (file.type !== "application/pdf") {
      toast.add({
        title: "Import impossible",
        description: "Seuls les fichiers PDF sont acceptés.",
        type: "error",
      })
      return
    }
    setPending(true)
    try {
      await uploadSheet(courseId, file)
      toast.add({ title: "Fiche mise à jour", type: "success" })
      router.refresh()
    } catch (error) {
      toast.add({
        title: "Import impossible",
        description: error instanceof Error ? error.message : undefined,
        type: "error",
      })
    } finally {
      setPending(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  function onDragEnter(event: React.DragEvent<HTMLElement>) {
    if (!editable || pending) return
    if (!event.dataTransfer.types.includes("Files")) return
    event.preventDefault()
    dragCounter.current += 1
    setIsDragging(true)
  }

  function onDragOver(event: React.DragEvent<HTMLElement>) {
    if (!editable || pending) return
    if (!event.dataTransfer.types.includes("Files")) return
    event.preventDefault()
  }

  function onDragLeave(event: React.DragEvent<HTMLElement>) {
    if (!editable || pending) return
    event.preventDefault()
    dragCounter.current = Math.max(0, dragCounter.current - 1)
    if (dragCounter.current === 0) setIsDragging(false)
  }

  function onDrop(event: React.DragEvent<HTMLElement>) {
    if (!editable || pending) return
    event.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    void handleFile(event.dataTransfer.files?.[0])
  }

  async function remove() {
    setPending(true)
    try {
      await fetch(`/api/courses/${courseId}/sheet`, { method: "DELETE" })
      toast.add({ title: "Fiche supprimée", type: "success" })
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  if (!hasSheet && !editable) return null

  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-lg transition-colors",
        editable && "outline-2 outline-offset-8 outline-transparent",
        isDragging && "outline-dashed outline-primary bg-primary/5",
      )}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <FileTextIcon className="size-4.5 shrink-0 text-muted-foreground" />
          Fiche de révision
        </h2>
        {editable && (
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <UploadIcon data-icon="inline-start" />
              )}
              {hasSheet ? "Remplacer le PDF" : "Importer le PDF"}
            </Button>
            {hasSheet && (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => void remove()}
              >
                <Trash2Icon data-icon="inline-start" />
                Supprimer
              </Button>
            )}
          </div>
        )}
      </div>
      {hasSheet ? (
        <CourseSheetViewer courseId={courseId} className="flex flex-col" />
      ) : (
        <p className="text-sm text-pretty text-muted-foreground">
          Aucune fiche pour l&apos;instant. Génère-la avec le skill « fiche de
          révision », puis importe le PDF ici, ou glisse-dépose-le directement
          sur cette zone.
        </p>
      )}
      {editable && isDragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/60">
          <div className="rounded-lg border-2 border-dashed border-primary bg-background px-6 py-4 text-sm font-medium text-primary shadow-lg">
            Dépose le PDF pour {hasSheet ? "remplacer" : "importer"} la fiche
          </div>
        </div>
      )}
    </section>
  )
}
