import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeftIcon,
  DownloadIcon,
  PencilIcon,
  UsersIcon,
} from "lucide-react"

import { CourseFinishers } from "@/components/course-finishers"
import { CourseFormDialog } from "@/components/course-form-dialog"
import { CoursePractice } from "@/components/course-practice"
import { FavoriteButton } from "@/components/favorite-button"
import { ShareDialog } from "@/components/share-dialog"
import { WordTable } from "@/components/word-table"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { formatDate } from "@/lib/api"
import { ProgressProvider } from "@/lib/progress"
import { currentUser } from "@/lib/session"
import { canWrite, getCourse, getViewerState, listFinishers } from "@/lib/store"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const course = await getCourse(id)
  return {
    title: course ? `${course.title} — Flashcards coréen` : "Cours introuvable",
  }
}

export default async function CoursePage({ params }: Props) {
  const { id } = await params
  const [course, user] = await Promise.all([getCourse(id), currentUser()])
  if (!course) notFound()

  const [editable, viewer, finishers] = await Promise.all([
    canWrite(course.id, user?.id),
    getViewerState(course.id, user?.id),
    listFinishers(course.id),
  ])
  const owns = Boolean(user && course.owner?.id === user.id)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/" />}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Tous les cours
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm text-muted-foreground">
              {formatDate(course.date)}
              {course.owner && <> · publié par {course.owner.name}</>}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight break-words">
              {course.title}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {user && (
              <FavoriteButton
                courseId={course.id}
                favorite={viewer.favorite}
                title={course.title}
                labelled
              />
            )}
            <Button
              variant="outline"
              render={<a href={`/api/courses/${course.id}/export`} download />}
            >
              <DownloadIcon data-icon="inline-start" />
              Exporter
            </Button>
            {owns && (
              <ShareDialog courseId={course.id} owner={course.owner}>
                <Button variant="outline">
                  <UsersIcon data-icon="inline-start" />
                  Partager
                </Button>
              </ShareDialog>
            )}
            {editable && (
              <CourseFormDialog
                course={{
                  id: course.id,
                  title: course.title,
                  date: course.date,
                }}
              >
                <Button variant="outline">
                  <PencilIcon data-icon="inline-start" />
                  Modifier
                </Button>
              </CourseFormDialog>
            )}
          </div>
        </div>
      </div>

      {/* Both sections read the same standings, so they share one copy of
          them: a finished series recolours the word list on the spot. */}
      <ProgressProvider courseId={course.id} signedIn={Boolean(user)}>
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold tracking-tight">Réviser</h2>
          <CoursePractice
            words={course.words}
            signedIn={Boolean(user)}
            completedAt={viewer.completedAt}
          />
          {/* Public, so it shows for a signed-out reader too — it is the one
              thing about anyone's progress that everyone gets to see. */}
          <CourseFinishers
            finishers={finishers}
            viewerId={user?.id ?? null}
            wordCount={course.words.length}
          />
        </section>

        <Separator />

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-tight">
              Tous les mots du cours
            </h2>
            <p className="text-sm text-muted-foreground">
              {course.words.length} mot{course.words.length > 1 ? "s" : ""},
              dans l&apos;ordre de la note.
            </p>
          </div>
          <WordTable
            courseId={course.id}
            words={course.words}
            editable={editable}
            tracked={Boolean(user)}
          />
        </section>
      </ProgressProvider>
    </div>
  )
}
