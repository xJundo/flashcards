"use client"

import { TrophyIcon } from "lucide-react"

import { STANDING } from "@/components/word-standing"
import { Card, CardContent } from "@/components/ui/card"
import { formatDate } from "@/lib/api"
import type { Finisher } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * Who acquired every word of the lesson, for everyone to see. This is the one
 * place a learner's progress leaves their account, and it carries the bare
 * fact: the handle and the day, never the streaks or the series behind them.
 */
export function CourseFinishers({
  finishers,
  viewerId,
  wordCount,
}: {
  finishers: Finisher[]
  /** The reader, so their own name reads as theirs. */
  viewerId: string | null
  wordCount: number
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <TrophyIcon className={cn("size-4 shrink-0", STANDING.known.ink)} />
          Ils ont réussi ce cours
          {finishers.length > 0 && (
            <span className="text-muted-foreground tabular-nums">
              ({finishers.length})
            </span>
          )}
        </h3>

        {finishers.length === 0 ? (
          <p className="text-sm text-pretty text-muted-foreground">
            {wordCount === 0
              ? "Ce cours n'a pas encore de mots."
              : `Personne n'a encore les ${wordCount} mots du cours en « connus ». Il y a une place à prendre.`}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
            {finishers.map((finisher) => (
              <li key={finisher.id} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "font-medium",
                    finisher.id === viewerId && STANDING.known.ink
                  )}
                >
                  {finisher.name}
                  {finisher.id === viewerId && " (toi)"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(finisher.completedAt.slice(0, 10))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
