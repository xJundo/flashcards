"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "lucide-react"

import { SpeakButton } from "@/components/speak-button"
import { WordFormDialog } from "@/components/word-form-dialog"
import {
  STANDING,
  StandingBadge,
  StandingSummary,
  standingKey,
} from "@/components/word-standing"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { api } from "@/lib/api"
import { useCourseProgress } from "@/lib/progress"
import { cn } from "@/lib/utils"
import type { Word } from "@/lib/types"

export function WordTable({
  courseId,
  words,
  editable,
  tracked,
}: {
  courseId: string
  words: Word[]
  /** Read-only for visitors without write access on this lesson. */
  editable: boolean
  /** Signed out, no word has a standing — the whole column would be empty. */
  tracked: boolean
}) {
  const router = useRouter()
  const { progress } = useCourseProgress()
  const [query, setQuery] = React.useState("")
  const [editing, setEditing] = React.useState<Word | null>(null)
  const [deleting, setDeleting] = React.useState<string | null>(null)

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return words
    return words.filter((word) =>
      [word.korean, word.romanization, word.translation, word.note ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    )
  }, [query, words])

  async function remove(word: Word) {
    setDeleting(word.id)
    try {
      await api(`/api/courses/${courseId}/words/${word.id}`, {
        method: "DELETE",
      })
      toast.add({ title: "Mot supprimé", type: "success" })
      router.refresh()
    } catch (error) {
      toast.add({
        title: "Suppression impossible",
        description: error instanceof Error ? error.message : undefined,
        type: "error",
      })
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un mot…"
            className="pl-8"
            aria-label="Rechercher un mot"
          />
        </div>
        {editable && (
          <WordFormDialog courseId={courseId}>
            <Button className="w-full sm:w-auto">
              <PlusIcon data-icon="inline-start" />
              Ajouter un mot
            </Button>
          </WordFormDialog>
        )}
      </div>

      {filtered.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon />
            </EmptyMedia>
            <EmptyTitle>
              {words.length === 0 ? "Aucun mot" : "Aucun résultat"}
            </EmptyTitle>
            <EmptyDescription>
              {words.length === 0
                ? editable
                  ? "Ajoute un mot ou importe un JSON pour remplir ce cours."
                  : "Ce cours ne contient pas encore de mots."
                : `Rien ne correspond à « ${query} ».`}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {/* Four columns never fit a phone, so a word becomes a block there. */}
          <ul className="flex flex-col divide-y rounded-xl border sm:hidden">
            {filtered.map((word) => (
              <li
                key={word.id}
                className={cn(
                  "flex items-start gap-2 p-3",
                  tracked &&
                    `border-l-2 ${STANDING[standingKey(progress.stats[word.id])].edge}`
                )}
              >
                <SpeakButton text={word.korean} size="icon" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span lang="ko" className="font-medium break-words">
                    {word.korean}
                  </span>
                  {word.romanization && (
                    <span className="text-sm break-words text-muted-foreground">
                      {word.romanization}
                    </span>
                  )}
                  <span className="text-sm break-words">
                    {word.translation}
                  </span>
                  {word.note && (
                    <span className="mt-1 text-xs break-words text-muted-foreground">
                      {word.note}
                    </span>
                  )}
                  {tracked && (
                    <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <StandingBadge stat={progress.stats[word.id]} />
                      <StandingSummary stat={progress.stats[word.id]} />
                    </span>
                  )}
                </div>
                {editable && (
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Modifier ${word.korean}`}
                      onClick={() => setEditing(word)}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Supprimer ${word.korean}`}
                      disabled={deleting === word.id}
                      onClick={() => remove(word)}
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="hidden rounded-xl border sm:block">
            {/* Fixed columns and wrapping cells keep a long note inside the
                page instead of stretching the table past it. */}
            <Table className="table-fixed [&_td]:whitespace-normal">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12" />
                  <TableHead className="w-[22%]">Coréen</TableHead>
                  <TableHead className="w-[18%]">Prononciation</TableHead>
                  <TableHead>Traduction</TableHead>
                  {tracked && (
                    <TableHead className="w-[22%]">Progression</TableHead>
                  )}
                  {editable && (
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((word) => (
                  <TableRow key={word.id}>
                    <TableCell
                      className={cn(
                        tracked &&
                          `border-l-2 ${STANDING[standingKey(progress.stats[word.id])].edge}`
                      )}
                    >
                      <SpeakButton text={word.korean} />
                    </TableCell>
                    <TableCell lang="ko" className="font-medium break-words">
                      {word.korean}
                    </TableCell>
                    <TableCell className="break-words text-muted-foreground">
                      {word.romanization}
                    </TableCell>
                    <TableCell className="break-words">
                      {word.translation}
                      {word.note && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {word.note}
                        </span>
                      )}
                    </TableCell>
                    {tracked && (
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <StandingBadge stat={progress.stats[word.id]} />
                          <StandingSummary stat={progress.stats[word.id]} />
                        </div>
                      </TableCell>
                    )}
                    {editable && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Modifier ${word.korean}`}
                            onClick={() => setEditing(word)}
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Supprimer ${word.korean}`}
                            disabled={deleting === word.id}
                            onClick={() => remove(word)}
                          >
                            <TrashIcon />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {editing && (
        <WordFormDialog
          courseId={courseId}
          word={editing}
          open
          onOpenChange={(next) => !next && setEditing(null)}
        />
      )}
    </div>
  )
}
