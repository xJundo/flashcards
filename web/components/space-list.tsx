"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  FolderIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react"

import { SpaceFormDialog } from "@/components/space-form-dialog"
import { Badge } from "@/components/ui/badge"
import { COLOR_COVER, type ColorKey } from "@/lib/colors"
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
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { toast } from "@/components/ui/toast"
import { api } from "@/lib/api"
import type { SpaceSummary } from "@/lib/types"

export function SpaceList({
  spaces,
  signedIn,
}: {
  spaces: SpaceSummary[]
  signedIn: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = React.useState<SpaceSummary | null>(null)
  const [editOpen, setEditOpen] = React.useState(false)
  const [pendingDelete, setPendingDelete] = React.useState<SpaceSummary | null>(
    null
  )
  const [deleting, setDeleting] = React.useState(false)

  async function remove(space: SpaceSummary) {
    setDeleting(true)
    try {
      await api(`/api/spaces/${space.id}`, { method: "DELETE" })
      toast.add({ title: `« ${space.title} » supprimé`, type: "success" })
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Espaces</h1>
          <p className="text-sm text-muted-foreground">
            {spaces.length === 0
              ? "Aucun espace pour l'instant."
              : `${spaces.length} espace${spaces.length > 1 ? "s" : ""}`}
          </p>
        </div>
        {signedIn ? (
          <SpaceFormDialog>
            <Button>
              <PlusIcon data-icon="inline-start" />
              Nouvel espace
            </Button>
          </SpaceFormDialog>
        ) : (
          <Button render={<Link href="/inscription" />}>
            Créer un compte pour publier
          </Button>
        )}
      </div>

      {spaces.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderIcon />
            </EmptyMedia>
            <EmptyTitle>Aucun espace</EmptyTitle>
            <EmptyDescription>
              {signedIn
                ? "Crée un espace pour une langue, une matière — n'importe quel sujet à ranger."
                : "Crée un compte pour publier tes propres espaces."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {signedIn ? (
              <SpaceFormDialog>
                <Button>
                  <PlusIcon data-icon="inline-start" />
                  Nouvel espace
                </Button>
              </SpaceFormDialog>
            ) : (
              <Button render={<Link href="/inscription" />}>
                Créer un compte
              </Button>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((space) => (
            <Card
              key={space.id}
              className="group relative pt-0 transition-colors hover:border-ring"
            >
              {space.hasBanner ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/spaces/${space.id}/banner`}
                  alt=""
                  className="h-24 w-full object-cover"
                />
              ) : (
                <div
                  className={`h-12 w-full rounded-t-xl bg-gradient-to-br ${
                    space.color
                      ? COLOR_COVER[space.color as ColorKey]
                      : "from-muted to-muted/60"
                  }`}
                />
              )}
              <CardHeader>
                <CardDescription>
                  {space.owner && `Créé par ${space.owner.name}`}
                </CardDescription>
                <CardTitle className="text-base">
                  <Link
                    href={`/spaces/${space.slug}`}
                    className="after:absolute after:inset-0"
                  >
                    {space.title}
                  </Link>
                </CardTitle>
                <CardAction className="relative z-10">
                  {signedIn && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Actions de l'espace"
                          >
                            <MoreVerticalIcon />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(space)
                              setEditOpen(true)
                            }}
                          >
                            <PencilIcon />
                            Renommer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setPendingDelete(space)}
                          >
                            <TrashIcon />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </CardAction>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary">{space.courseCount} cours</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SpaceFormDialog
        space={editing ?? undefined}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet espace ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {pendingDelete?.title} » ne peut être supprimé que s&apos;il ne
              contient plus aucun dossier ni cours.
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
