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
  StarIcon,
  TrashIcon,
  TrophyIcon,
  UploadIcon,
} from "lucide-react"

import { CourseFormDialog } from "@/components/course-form-dialog"
import { StandingBar } from "@/components/course-meter"
import { FavoriteButton } from "@/components/favorite-button"
import { ImportDialog } from "@/components/import-dialog"
import { STANDING, scoreKey } from "@/components/word-standing"
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
import { percentOf } from "@/lib/types"
import type { CourseSummary } from "@/lib/types"
import { cn } from "@/lib/utils"

export function CourseList({
  courses,
  signedIn,
}: {
  courses: CourseSummary[]
  signedIn: boolean
}) {
  const router = useRouter()
  const [pendingDelete, setPendingDelete] =
    React.useState<CourseSummary | null>(null)
  // `editing` outlives `editOpen` so the closing dialog keeps its title
  // through the fade-out instead of flashing the "new lesson" wording.
  const [editing, setEditing] = React.useState<CourseSummary | null>(null)
  const [editOpen, setEditOpen] = React.useState(false)

  // Bookmarked lessons are lifted out rather than copied, so no card appears
  // twice — which is also why the second heading is not "tous les cours".
  const favorites = courses.filter((course) => course.favorite)
  const others = courses.filter((course) => !course.favorite)

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
          <h1 className="text-2xl font-semibold tracking-tight">Les cours</h1>
          <p className="text-sm text-muted-foreground">
            {courses.length === 0
              ? "Aucun cours pour l'instant."
              : `${courses.length} cours · ${courses.reduce((total, course) => total + course.wordCount, 0)} mots`}
          </p>
        </div>
        {signedIn ? (
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
        ) : (
          <Button render={<Link href="/inscription" />}>
            Créer un compte pour publier
          </Button>
        )}
      </div>

      {courses.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpenIcon />
            </EmptyMedia>
            <EmptyTitle>Aucun cours publié</EmptyTitle>
            <EmptyDescription>
              {signedIn
                ? "Colle le JSON de tes notes (mot / prononciation / traduction), ou directement le texte brut copié depuis Google Docs."
                : "Crée un compte pour publier tes propres cours."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {signedIn ? (
              <ImportDialog>
                <Button>
                  <UploadIcon data-icon="inline-start" />
                  Importer des notes
                </Button>
              </ImportDialog>
            ) : (
              <Button render={<Link href="/inscription" />}>
                Créer un compte
              </Button>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-8">
          {favorites.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <StarIcon className="size-4 shrink-0 fill-warning text-warning" />
                Mes favoris
              </h2>
              <CourseGrid
                courses={favorites}
                signedIn={signedIn}
                onEdit={(course) => {
                  setEditing(course)
                  setEditOpen(true)
                }}
                onDelete={setPendingDelete}
              />
            </section>
          )}

          <section className="flex flex-col gap-4">
            {favorites.length > 0 && (
              <h2 className="text-lg font-semibold tracking-tight">
                Les autres cours
              </h2>
            )}
            {others.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tous les cours sont dans tes favoris.
              </p>
            ) : (
              <CourseGrid
                courses={others}
                signedIn={signedIn}
                onEdit={(course) => {
                  setEditing(course)
                  setEditOpen(true)
                }}
                onDelete={setPendingDelete}
              />
            )}
          </section>
        </div>
      )}

      {/* Lives outside the dropdown on purpose: a menu left open behind the
          dialog keeps its own typeahead, which swallows every letter typed
          into the title field. */}
      <CourseFormDialog
        course={editing ?? undefined}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce cours ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {pendingDelete?.title} » et ses {pendingDelete?.wordCount} mots
              seront supprimés définitivement.
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

type CardActions = {
  onEdit: (course: CourseSummary) => void
  onDelete: (course: CourseSummary) => void
}

function CourseGrid({
  courses,
  signedIn,
  onEdit,
  onDelete,
}: { courses: CourseSummary[]; signedIn: boolean } & CardActions) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((course) => (
        <CourseCard
          key={course.id}
          course={course}
          signedIn={signedIn}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

/**
 * One lesson, at the distance the home page reads it from: who wrote it, how
 * long it is, and — signed in — how far along the viewer is with it.
 */
function CourseCard({
  course,
  signedIn,
  onEdit,
  onDelete,
}: { course: CourseSummary; signedIn: boolean } & CardActions) {
  const { standing, wordCount } = course
  const percent = standing ? percentOf(standing.known, wordCount) : 0

  return (
    <Card className="group relative transition-colors hover:border-ring">
      <CardHeader>
        <CardDescription>
          {formatDate(course.date)}
          {course.owner && <> · {course.owner.name}</>}
        </CardDescription>
        <CardTitle className="text-base">
          <Link
            href={`/courses/${course.id}`}
            className="after:absolute after:inset-0"
          >
            {course.title}
          </Link>
        </CardTitle>
        {/* Above the title's overlay, or the link would swallow both. */}
        <CardAction className="relative z-10 flex items-center gap-0.5">
          {signedIn && (
            <FavoriteButton
              courseId={course.id}
              favorite={course.favorite}
              title={course.title}
            />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Actions du cours"
                >
                  <MoreVerticalIcon />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                {course.editable && (
                  <DropdownMenuItem onClick={() => onEdit(course)}>
                    <PencilIcon />
                    Renommer / redater
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  render={
                    <a href={`/api/courses/${course.id}/export`} download>
                      <DownloadIcon />
                      Exporter le JSON
                    </a>
                  }
                />
                {course.editable && (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onDelete(course)}
                  >
                    <TrashIcon />
                    Supprimer
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {standing && wordCount > 0 && (
          <StandingBar
            standing={standing}
            total={wordCount}
            className="h-1.5"
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {wordCount} mot{wordCount > 1 ? "s" : ""}
          </Badge>
          {standing?.completedAt && (
            <Badge variant="secondary" className={STANDING.known.badge}>
              <TrophyIcon data-icon="inline-start" />
              Réussi
            </Badge>
          )}
          {standing && wordCount > 0 && (
            <span
              className={cn(
                "ml-auto text-sm font-semibold tabular-nums",
                STANDING[scoreKey(percent)].ink
              )}
            >
              {percent}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
