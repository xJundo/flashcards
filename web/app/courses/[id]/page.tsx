import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon, DownloadIcon, PencilIcon } from "lucide-react"

import { CourseFormDialog } from "@/components/course-form-dialog"
import { FlashcardDeck } from "@/components/flashcard-deck"
import { WordTable } from "@/components/word-table"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { formatDate } from "@/lib/api"
import { getCourse } from "@/lib/store"

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
  const course = await getCourse(id)
  if (!course) notFound()

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
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">
              {formatDate(course.date)}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {course.title}
            </h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              render={<a href={`/api/courses/${course.id}/export`} download />}
            >
              <DownloadIcon data-icon="inline-start" />
              Exporter
            </Button>
            <CourseFormDialog
              course={{ id: course.id, title: course.title, date: course.date }}
            >
              <Button variant="outline">
                <PencilIcon data-icon="inline-start" />
                Modifier
              </Button>
            </CourseFormDialog>
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Flashcards</h2>
        <FlashcardDeck words={course.words} />
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">
            Tous les mots du cours
          </h2>
          <p className="text-sm text-muted-foreground">
            {course.words.length} mot{course.words.length > 1 ? "s" : ""}, dans
            l&apos;ordre de la note.
          </p>
        </div>
        <WordTable courseId={course.id} words={course.words} />
      </section>
    </div>
  )
}
