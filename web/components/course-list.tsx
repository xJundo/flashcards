"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  BookOpenIcon,
  DownloadIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
} from "lucide-react"

import { CourseFormDialog } from "@/components/course-form-dialog"
import { ImportDialog } from "@/components/import-dialog"
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
import { Badge } from "@/components/ui/badge"
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
import { api, formatDate } from "@/lib/api"
import type { CourseSummary } from "@/lib/types"

export function CourseList({ courses }: { courses: CourseSummary[] }) {
  const router = useRouter()
  const [pendingDelete, setPendingDelete] =
    React.useState<CourseSummary | null>(null)

  async function remove(course: CourseSummary) {
    try {
      await api(`/api/courses/${course.id}`, { method: "DELETE" })
      toast.add({ title: `« ${course.title} » supprimé`, type: "success" })
      router.refresh()
    } catch (error) {
      toast.add({
        title: "Suppression impossible",
        description: error instanceof Error ? error.message : undefined,
        type: "error",
      })
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Mes cours</h1>
          <p className="text-sm text-muted-foreground">
            {courses.length === 0
              ? "Aucun cours pour l'instant."
              : `${courses.length} cours · ${courses.reduce((total, course) => total + course.wordCount, 0)} mots`}
          </p>
        </div>
        <div className="flex gap-2">
          <ImportDialog>
            <Button variant="outline">
              <UploadIcon data-icon="inline-start" />
              Importer
            </Button>
          </ImportDialog>
          <CourseFormDialog>
            <Button>
              <PlusIcon data-icon="inline-start" />
              Nouveau cours
            </Button>
          </CourseFormDialog>
        </div>
      </div>

      {courses.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpenIcon />
            </EmptyMedia>
            <EmptyTitle>Commence par importer un cours</EmptyTitle>
            <EmptyDescription>
              Colle le JSON de tes notes (mot / prononciation / traduction), ou
              directement le texte brut copié depuis Google Docs.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <ImportDialog>
              <Button>
                <UploadIcon data-icon="inline-start" />
                Importer des notes
              </Button>
            </ImportDialog>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card
              key={course.id}
              className="group relative transition-colors hover:border-ring"
            >
              <CardHeader>
                <CardDescription>{formatDate(course.date)}</CardDescription>
                <CardTitle className="text-base">
                  <Link
                    href={`/courses/${course.id}`}
                    className="after:absolute after:inset-0"
                  >
                    {course.title}
                  </Link>
                </CardTitle>
                <CardAction>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Actions du cours"
                          className="relative z-10"
                        >
                          <MoreVerticalIcon />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuGroup>
                        <CourseFormDialog course={course}>
                          <DropdownMenuItem closeOnClick={false}>
                            <PencilIcon />
                            Renommer / redater
                          </DropdownMenuItem>
                        </CourseFormDialog>
                        <DropdownMenuItem
                          render={
                            <a
                              href={`/api/courses/${course.id}/export`}
                              download
                            >
                              <DownloadIcon />
                              Exporter le JSON
                            </a>
                          }
                        />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setPendingDelete(course)}
                        >
                          <TrashIcon />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardAction>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary">
                  {course.wordCount} mot{course.wordCount > 1 ? "s" : ""}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce cours ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {pendingDelete?.title} » et ses {pendingDelete?.wordCount} mots
              seront supprimés définitivement du disque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
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
