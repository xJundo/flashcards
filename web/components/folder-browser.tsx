"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  FolderIcon,
  FolderInputIcon,
  FolderPlusIcon,
  MoreVerticalIcon,
  PencilIcon,
  TrashIcon,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { BannerImageField } from "@/components/banner-image-field"
import { ColorPicker } from "@/components/color-picker"
import { MoveDialog } from "@/components/move-dialog"
import { api } from "@/lib/api"
import { COLOR_COVER, type ColorKey } from "@/lib/colors"
import type { Folder } from "@/lib/types"

/**
 * The subfolders directly inside a space or one of its folders, with the
 * create/rename/delete actions. The courses at this level are rendered
 * separately, by `CourseList` — this only handles the folder layer.
 */
export function FolderBrowser({
  spaceId,
  spaceSlug,
  parentId,
  folders,
  signedIn,
}: {
  spaceId: string
  spaceSlug: string
  /** `null` at a space's root. */
  parentId: string | null
  folders: Folder[]
  signedIn: boolean
}) {
  const router = useRouter()
  const [creating, setCreating] = React.useState(false)
  const [editing, setEditing] = React.useState<Folder | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<Folder | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [moving, setMoving] = React.useState<Folder | null>(null)

  async function remove(folder: Folder) {
    setDeleting(true)
    try {
      await api(`/api/folders/${folder.id}`, { method: "DELETE" })
      toast.add({ title: `« ${folder.title} » supprimé`, type: "success" })
      setPendingDelete(null)
      router.refresh()
    } catch (error) {
      toast.add({
        title: "Suppression impossible",
        description: error instanceof Error ? error.message : undefined,
        type: "error",
      })
    } finally {
      setDeleting(false)
    }
  }

  if (folders.length === 0 && !signedIn) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Dossiers</h2>
        {signedIn && (
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
            <FolderPlusIcon data-icon="inline-start" />
            Nouveau dossier
          </Button>
        )}
      </div>

      {folders.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {folders.map((folder) => (
            <Card
              key={folder.id}
              className="group relative pt-0 transition-colors hover:border-ring"
            >
              {folder.hasBanner ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/folders/${folder.id}/banner`}
                  alt=""
                  className="h-16 w-full object-cover"
                />
              ) : (
                <div
                  className={`h-8 w-full rounded-t-xl bg-gradient-to-br ${
                    folder.color
                      ? COLOR_COVER[folder.color as ColorKey]
                      : "from-muted to-muted/60"
                  }`}
                />
              )}
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                  <Link
                    href={`/spaces/${spaceSlug}/folders/${folder.id}`}
                    className="truncate after:absolute after:inset-0"
                  >
                    {folder.title}
                  </Link>
                </CardTitle>
                {signedIn && (
                  <CardAction className="relative z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Actions du dossier"
                          >
                            <MoreVerticalIcon />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem onClick={() => setEditing(folder)}>
                            <PencilIcon />
                            Renommer
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setMoving(folder)}>
                            <FolderInputIcon />
                            Déplacer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setPendingDelete(folder)}
                          >
                            <TrashIcon />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardAction>
                )}
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <FolderFormDialog
        spaceId={spaceId}
        parentId={parentId}
        open={creating}
        onOpenChange={setCreating}
      />
      <FolderFormDialog
        spaceId={spaceId}
        parentId={parentId}
        folder={editing ?? undefined}
        open={editing !== null}
        onOpenChange={(next) => !next && setEditing(null)}
      />

      {moving && (
        <MoveDialog
          open
          onOpenChange={(next) => !next && setMoving(null)}
          title={`Déplacer « ${moving.title} »`}
          currentSpaceId={spaceId}
          currentFolderId={moving.parentId}
          lockSpace
          excludeSubtreeOf={moving.id}
          onConfirm={async (target) => {
            await api(`/api/folders/${moving.id}`, {
              method: "PATCH",
              body: JSON.stringify({ parentId: target.folderId }),
            })
            toast.add({ title: "Dossier déplacé", type: "success" })
            router.refresh()
          }}
        />
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce dossier ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {pendingDelete?.title} » ne peut être supprimé que s&apos;il ne
              contient plus aucun sous-dossier ni cours.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={() => pendingDelete && remove(pendingDelete)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function FolderFormDialog({
  spaceId,
  parentId,
  folder,
  open,
  onOpenChange,
}: {
  spaceId: string
  parentId: string | null
  /** Omit to create a new folder. */
  folder?: Folder
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [title, setTitle] = React.useState(folder?.title ?? "")
  const [color, setColor] = React.useState<ColorKey | null>(
    (folder?.color as ColorKey | null) ?? null
  )

  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setTitle(folder?.title ?? "")
      setColor((folder?.color as ColorKey | null) ?? null)
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    try {
      if (folder) {
        await api(`/api/folders/${folder.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title, color }),
        })
        toast.add({ title: "Dossier renommé", type: "success" })
      } else {
        await api("/api/folders", {
          method: "POST",
          body: JSON.stringify({ spaceId, parentId, title, color }),
        })
        toast.add({ title: "Dossier créé", type: "success" })
      }
      onOpenChange(false)
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {folder ? "Renommer le dossier" : "Nouveau dossier"}
          </DialogTitle>
          <DialogDescription>
            {folder
              ? "Change le titre de ce dossier."
              : "Range des cours ensemble — un dossier peut aussi contenir d'autres dossiers."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="folder-title">Titre</FieldLabel>
              <Input
                id="folder-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Grammaire, Vocabulaire, Chapitre 1…"
                autoFocus
              />
            </Field>
            <ColorPicker value={color} onChange={setColor} />
            {folder && (
              <BannerImageField
                url={`/api/folders/${folder.id}/banner`}
                hasBanner={folder.hasBanner}
              />
            )}
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={pending || !title.trim()}>
              {pending && <Spinner data-icon="inline-start" />}
              {folder ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
