"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "lucide-react"

import { SpeakButton } from "@/components/speak-button"
import { WordFormDialog } from "@/components/word-form-dialog"
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
import type { Word } from "@/lib/types"

export function WordTable({
  courseId,
  words,
}: {
  courseId: string
  words: Word[]
}) {
  const router = useRouter()
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
        <WordFormDialog courseId={courseId}>
          <Button>
            <PlusIcon data-icon="inline-start" />
            Ajouter un mot
          </Button>
        </WordFormDialog>
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
                ? "Ajoute un mot ou importe un JSON pour remplir ce cours."
                : `Rien ne correspond à « ${query} ».`}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Coréen</TableHead>
                <TableHead>Prononciation</TableHead>
                <TableHead>Traduction</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((word) => (
                <TableRow key={word.id}>
                  <TableCell>
                    <SpeakButton text={word.korean} />
                  </TableCell>
                  <TableCell lang="ko" className="font-medium">
                    {word.korean}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {word.romanization}
                  </TableCell>
                  <TableCell>
                    {word.translation}
                    {word.note && (
                      <span className="block text-xs text-muted-foreground">
                        {word.note}
                      </span>
                    )}
                  </TableCell>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
