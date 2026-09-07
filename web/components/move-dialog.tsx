"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
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
import type { Folder, SpaceSummary } from "@/lib/types"

const ROOT = "__root__"

/** `rootId` itself, plus every folder nested under it, any depth. */
function subtreeIds(folders: Folder[], rootId: string): Set<string> {
  const children = new Map<string, Folder[]>()
  for (const folder of folders) {
    if (!folder.parentId) continue
    const siblings = children.get(folder.parentId) ?? []
    siblings.push(folder)
    children.set(folder.parentId, siblings)
  }
  const ids = new Set<string>([rootId])
  const stack = [rootId]
  while (stack.length > 0) {
    const id = stack.pop()
    for (const child of children.get(id!) ?? []) {
      if (ids.has(child.id)) continue
      ids.add(child.id)
      stack.push(child.id)
    }
  }
  return ids
}

/** Indents each folder under its parent, so the flat list reads as a tree. */
function indentedFolders(folders: Folder[]): { id: string; label: string }[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  function depth(folder: Folder): number {
    let level = 0
    let current = folder.parentId ? byId.get(folder.parentId) : undefined
    while (current) {
      level++
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
    return level
  }
  return folders
    .map((folder) => ({
      id: folder.id,
      label: `${"　".repeat(depth(folder))}${depth(folder) > 0 ? "› " : ""}${folder.title}`,
      sort: `${depth(folder)}-${folder.title}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function MoveDialog({
  open,
  onOpenChange,
  title,
  currentSpaceId,
  currentFolderId,
  /** A folder can only move within its own space; a course can move anywhere. */
  lockSpace = false,
  /** A folder being moved can't go into itself or its own subtree. */
  excludeSubtreeOf,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  currentSpaceId: string
  currentFolderId: string | null
  lockSpace?: boolean
  excludeSubtreeOf?: string
  onConfirm: (target: {
    spaceId: string
    folderId: string | null
  }) => Promise<void>
}) {
  const [spaces, setSpaces] = React.useState<SpaceSummary[] | null>(null)
  const [spaceId, setSpaceId] = React.useState(currentSpaceId)
  // Tagged with the space it was fetched for, so a stale list is never shown
  // as if it were the newly selected space's — no `setFolders(null)` needed
  // to mark it loading in between.
  const [folders, setFolders] = React.useState<{
    spaceId: string
    items: Folder[]
  } | null>(null)
  const [folderId, setFolderId] = React.useState(currentFolderId ?? ROOT)
  const [pending, setPending] = React.useState(false)

  // Refill on open, so a cancelled move is discarded. Done while rendering
  // rather than in an effect, to pick the current course/folder's location
  // before the fetches below fire.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSpaceId(currentSpaceId)
      setFolderId(currentFolderId ?? ROOT)
    }
  }

  React.useEffect(() => {
    if (!open) return
    void api<SpaceSummary[]>("/api/spaces").then(setSpaces)
  }, [open])

  React.useEffect(() => {
    if (!open) return
    void api<Folder[]>(`/api/spaces/${spaceId}/folders`).then((items) =>
      setFolders({ spaceId, items })
    )
  }, [open, spaceId])

  const loadedFolders = folders?.spaceId === spaceId ? folders.items : null
  const excluded =
    excludeSubtreeOf && loadedFolders
      ? subtreeIds(loadedFolders, excludeSubtreeOf)
      : new Set<string>()
  const options = loadedFolders
    ? indentedFolders(
        loadedFolders.filter((folder) => !excluded.has(folder.id))
      )
    : []

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    try {
      await onConfirm({
        spaceId,
        folderId: folderId === ROOT ? null : folderId,
      })
      onOpenChange(false)
    } catch (error) {
      toast.add({
        title: "Déplacement impossible",
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Choisis l&apos;espace, puis éventuellement le dossier de
            destination.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FieldGroup>
            {!lockSpace && (
              <Field>
                <FieldLabel htmlFor="move-space">Espace</FieldLabel>
                <Select
                  value={spaceId}
                  onValueChange={(value) => {
                    setSpaceId(String(value))
                    setFolderId(ROOT)
                  }}
                >
                  <SelectTrigger id="move-space" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(spaces ?? []).map((space) => (
                      <SelectItem key={space.id} value={space.id}>
                        {space.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="move-folder">Dossier</FieldLabel>
              <Select
                value={folderId}
                onValueChange={(value) => setFolderId(String(value))}
                disabled={!loadedFolders}
              >
                <SelectTrigger id="move-folder" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROOT}>Racine de l&apos;espace</SelectItem>
                  {options.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={pending || !spaces}>
              {pending && <Spinner data-icon="inline-start" />}
              Déplacer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
