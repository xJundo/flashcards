"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronsUpDownIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "lucide-react"

import { RichText } from "@/components/rich-text"
import { SpeakButton } from "@/components/speak-button"
import { WordFormDialog } from "@/components/word-form-dialog"
import {
  STANDING,
  StandingBadge,
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
import type { Card, WordStat } from "@/lib/types"

/** Columns a learner can order the list by. */
type SortKey = "front" | "phonetic" | "back" | "standing"

type Sort = { key: SortKey; dir: "asc" | "desc" }

/**
 * Where a column starts when it is first clicked. Words are read from A, but a
 * progression is read from what is left to learn — so the first click brings up
 * the words needing work, and the acquired ones are one click further.
 */
const FIRST_DIR: Record<SortKey, "asc" | "desc"> = {
  front: "asc",
  phonetic: "asc",
  back: "asc",
  standing: "asc",
}

/** Ascending: never seen, then to review, then in progress, then acquired. */
const STANDING_RANK = { new: 0, review: 1, learning: 2, known: 3 }

export function WordTable({
  courseId,
  words,
  editable,
  tracked,
  speechLocale,
}: {
  courseId: string
  words: Card[]
  /** Read-only for visitors without write access on this lesson. */
  editable: boolean
  /** Signed out, no word has a standing — the whole column would be empty. */
  tracked: boolean
  /** BCP-47 locale of the course's spoken language, or `null` for none. */
  speechLocale: string | null
}) {
  const router = useRouter()
  const { progress } = useCourseProgress()
  const [query, setQuery] = React.useState("")
  const [sort, setSort] = React.useState<Sort | null>(null)
  const [editing, setEditing] = React.useState<Card | null>(null)
  const [deleting, setDeleting] = React.useState<string | null>(null)

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return words
    return words.filter((word) =>
      [word.front, word.phonetic, word.back, word.note ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    )
  }, [query, words])

  // Unsorted means the lesson's own order, which is an order too — it is what
  // the third click on a header goes back to.
  const rows = React.useMemo(() => {
    if (!sort) return filtered
    const stats = progress.stats
    const sign = sort.dir === "asc" ? 1 : -1
    // `sort` is stable, and `filtered` is in lesson order: equal figures keep it.
    return [...filtered].sort(
      (a, b) => sign * compare(sort.key, a, b, stats[a.id], stats[b.id])
    )
  }, [filtered, progress.stats, sort])

  // Three clicks make a round trip: chosen direction, the other one, then off.
  function toggleSort(key: SortKey) {
    setSort((current) => {
      if (current?.key !== key) return { key, dir: FIRST_DIR[key] }
      if (current.dir === FIRST_DIR[key]) {
        return { key, dir: FIRST_DIR[key] === "asc" ? "desc" : "asc" }
      }
      return null
    })
  }

  async function remove(word: Card) {
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

      {rows.length === 0 ? (
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
            {rows.map((word) => (
              <li
                key={word.id}
                className={cn(
                  "flex items-start gap-2 p-3",
                  tracked &&
                    `border-l-2 ${STANDING[standingKey(progress.stats[word.id])].edge}`
                )}
              >
                <SpeakButton
                  text={word.front}
                  speechLocale={speechLocale}
                  size="icon"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium break-words">
                    <RichText text={word.front} />
                  </span>
                  {word.phonetic && (
                    <span className="text-sm break-words text-muted-foreground">
                      {word.phonetic}
                    </span>
                  )}
                  <span className="text-sm break-words">
                    <RichText text={word.back} />
                  </span>
                  {word.note && (
                    <span className="mt-1 text-xs break-words text-muted-foreground">
                      <RichText text={word.note} />
                    </span>
                  )}
                  {tracked && (
                    <StandingBadge
                      stat={progress.stats[word.id]}
                      className="mt-2 self-start"
                    />
                  )}
                </div>
                {editable && (
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Modifier ${word.front}`}
                      onClick={() => setEditing(word)}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Supprimer ${word.front}`}
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
                  <SortHead
                    label="Recto"
                    sortKey="front"
                    sort={sort}
                    onSort={toggleSort}
                    className="w-[18%]"
                  />
                  <SortHead
                    label="Indice phonétique"
                    sortKey="phonetic"
                    sort={sort}
                    onSort={toggleSort}
                    className="w-[18%]"
                  />
                  <SortHead
                    label="Verso"
                    sortKey="back"
                    sort={sort}
                    onSort={toggleSort}
                  />
                  {tracked && (
                    <SortHead
                      label="Progression"
                      hint="Où en est le mot, et la série de réussites en cours"
                      sortKey="standing"
                      sort={sort}
                      onSort={toggleSort}
                      className="w-[22%]"
                    />
                  )}
                  {editable && (
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((word) => (
                  <TableRow key={word.id}>
                    <TableCell
                      className={cn(
                        tracked &&
                          `border-l-2 ${STANDING[standingKey(progress.stats[word.id])].edge}`
                      )}
                    >
                      <SpeakButton
                        text={word.front}
                        speechLocale={speechLocale}
                      />
                    </TableCell>
                    <TableCell className="font-medium break-words">
                      <RichText text={word.front} />
                    </TableCell>
                    <TableCell className="break-words text-muted-foreground">
                      {word.phonetic}
                    </TableCell>
                    <TableCell className="break-words">
                      <RichText text={word.back} />
                      {word.note && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          <RichText text={word.note} />
                        </span>
                      )}
                    </TableCell>
                    {tracked && (
                      <TableCell>
                        <StandingBadge stat={progress.stats[word.id]} />
                      </TableCell>
                    )}
                    {editable && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Modifier ${word.front}`}
                            onClick={() => setEditing(word)}
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Supprimer ${word.front}`}
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

function compare(
  key: SortKey,
  a: Card,
  b: Card,
  statA: WordStat | undefined,
  statB: WordStat | undefined
): number {
  switch (key) {
    case "front":
      return a.front.localeCompare(b.front)
    case "phonetic":
      return a.phonetic.localeCompare(b.phonetic)
    case "back":
      return a.back.localeCompare(b.back)
    case "standing": {
      const rank =
        STANDING_RANK[standingKey(statA)] - STANDING_RANK[standingKey(statB)]
      // Inside "en cours", the word closest to being acquired comes first.
      return rank !== 0 ? rank : (statA?.streak ?? 0) - (statB?.streak ?? 0)
    }
  }
}

/** A column header that orders the list, and says which way it is ordered. */
function SortHead({
  label,
  hint,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string
  hint?: string
  sortKey: SortKey
  sort: Sort | null
  onSort: (key: SortKey) => void
  className?: string
}) {
  const active = sort?.key === sortKey
  const Arrow = !active
    ? ChevronsUpDownIcon
    : sort.dir === "asc"
      ? ChevronUpIcon
      : ChevronDownIcon

  return (
    <TableHead
      className={cn("p-0", className)}
      aria-sort={
        active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={hint ? `${hint} — cliquer pour trier` : "Cliquer pour trier"}
        className={cn(
          "flex h-10 w-full items-center gap-1 px-2 text-left transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
          !active && "text-muted-foreground"
        )}
      >
        <span className="truncate">{label}</span>
        <Arrow className={cn("size-3.5 shrink-0", !active && "opacity-40")} />
      </button>
    </TableHead>
  )
}
