"use client"

import { TrophyIcon } from "lucide-react"

import {
  STANDING,
  scoreKey,
  type StandingKey,
} from "@/components/word-standing"
import { Card, CardContent } from "@/components/ui/card"
import { formatDate } from "@/lib/api"
import { KNOWN_STREAK, percentOf } from "@/lib/types"
import type { CourseStanding } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * The four standings of a lesson, side by side, acquired first: the bar fills
 * from the left and turns green as the lesson is learnt. A meter, not a chart —
 * the numbers live in the legend, and the 2px gaps keep two adjacent colours
 * from reading as one block.
 */
export function StandingBar({
  standing,
  total,
  className,
}: {
  standing: CourseStanding
  total: number
  className?: string
}) {
  const parts: [StandingKey, number][] = [
    ["known", standing.known],
    ["learning", standing.learning],
    ["review", standing.review],
    ["new", standing.untouched],
  ]
  const known = standing.known

  return (
    <div
      className={cn("flex h-2.5 w-full gap-0.5", className)}
      role="img"
      aria-label={`${known} mot${known > 1 ? "s" : ""} connu${known > 1 ? "s" : ""} sur ${total}, soit ${percentOf(known, total)}%`}
    >
      {parts.map(([key, count]) =>
        count > 0 ? (
          <div
            key={key}
            className={cn("h-full rounded-full", STANDING[key].fill)}
            style={{ width: `${(count / total) * 100}%` }}
          />
        ) : null
      )}
    </div>
  )
}

/**
 * The lesson at a glance: the share acquired, in the colour that share earns.
 * A lesson finished keeps its trophy even once the meter falls back — the date
 * is the day every word was acquired at once, and nothing takes it away.
 */
export function CourseMeter({
  standing,
  total,
}: {
  standing: CourseStanding
  total: number
}) {
  const percent = percentOf(standing.known, total)

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold">Progression du cours</h3>
          <span
            className={cn(
              "text-2xl leading-none font-semibold tabular-nums",
              STANDING[scoreKey(percent)].ink
            )}
          >
            {percent}%
          </span>
        </div>

        {standing.completedAt && (
          <p
            className={cn(
              "flex items-center gap-1.5 text-sm font-medium",
              STANDING.known.ink
            )}
          >
            <TrophyIcon className="size-4 shrink-0" />
            Cours réussi le {formatDate(standing.completedAt.slice(0, 10))}
          </p>
        )}

        <StandingBar standing={standing} total={total} />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <Count standing="known" value={standing.known} label="connus" />
          <Count
            standing="learning"
            value={standing.learning}
            label="en cours"
          />
          <Count standing="review" value={standing.review} label="à revoir" />
          <Count standing="new" value={standing.untouched} label="jamais vus" />
        </div>
        <p className="text-xs text-muted-foreground">
          Un mot devient vert après {KNOWN_STREAK} séries réussies
          d&apos;affilée
          {standing.completedAt
            ? "."
            : ", et le cours est réussi quand ils le sont tous."}
        </p>
      </CardContent>
    </Card>
  )
}

function Count({
  standing,
  value,
  label,
}: {
  standing: StandingKey
  value: number
  label: string
}) {
  const { Icon, ink } = STANDING[standing]
  return (
    <span className="flex items-center gap-1.5">
      <Icon className={cn("size-4 shrink-0", ink)} />
      <span className="font-semibold text-foreground tabular-nums">
        {value}
      </span>
      {label}
    </span>
  )
}
