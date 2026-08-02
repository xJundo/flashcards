"use client"

import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  TrendingUpIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { KNOWN_STREAK, standingOf } from "@/lib/types"
import type { Standing, WordStat } from "@/lib/types"

/** The four states a word can be in, including "never answered". */
export type StandingKey = Standing | "new"

/**
 * Green, amber and red are indistinguishable to a deuteranope — so a standing
 * is never colour alone. Every place that paints one also shows its icon and
 * its label, which is what makes the palette legible.
 */
export const STANDING: Record<
  StandingKey,
  {
    label: string
    Icon: typeof CheckCircle2Icon
    /** Tinted pill, in the shape of the built-in `destructive` badge. */
    badge: string
    /** Solid fill, for bars and dots. */
    fill: string
    /** Same fill, aimed at the indicator inside a shadcn `Progress`. */
    bar: string
    /** Ink, for a headline figure or an icon. */
    ink: string
    /** Left rule down a row. */
    edge: string
  }
> = {
  new: {
    label: "Pas encore vu",
    Icon: CircleDashedIcon,
    badge: "bg-muted text-muted-foreground",
    fill: "bg-muted-foreground/25",
    bar: "[&_[data-slot=progress-indicator]]:bg-muted-foreground/25",
    ink: "text-muted-foreground",
    edge: "border-l-border",
  },
  review: {
    label: "À revoir",
    Icon: AlertCircleIcon,
    badge: "bg-destructive/10 text-destructive dark:bg-destructive/20",
    fill: "bg-destructive",
    bar: "[&_[data-slot=progress-indicator]]:bg-destructive",
    ink: "text-destructive",
    edge: "border-l-destructive",
  },
  learning: {
    label: "En cours",
    Icon: TrendingUpIcon,
    badge: "bg-warning/10 text-warning dark:bg-warning/20",
    fill: "bg-warning",
    bar: "[&_[data-slot=progress-indicator]]:bg-warning",
    ink: "text-warning",
    edge: "border-l-warning",
  },
  known: {
    label: "Connu",
    Icon: CheckCircle2Icon,
    badge: "bg-success/10 text-success dark:bg-success/20",
    fill: "bg-success",
    bar: "[&_[data-slot=progress-indicator]]:bg-success",
    ink: "text-success",
    edge: "border-l-success",
  },
}

export function standingKey(stat: WordStat | undefined): StandingKey {
  return standingOf(stat?.streak) ?? "new"
}

/**
 * A score out of 100 in the same three colours, so a series result and a word
 * standing never disagree about what green means.
 */
export function scoreKey(percent: number): StandingKey {
  if (percent >= 80) return "known"
  if (percent >= 50) return "learning"
  return "review"
}

/** The coloured pill: icon, name of the standing, and the streak it stands on. */
export function StandingBadge({
  stat,
  className,
}: {
  stat: WordStat | undefined
  className?: string
}) {
  const key = standingKey(stat)
  const { label, Icon, badge } = STANDING[key]
  return (
    <Badge variant="secondary" className={cn(badge, className)}>
      <Icon data-icon="inline-start" />
      {label}
      {key !== "new" && (
        <span className="tabular-nums opacity-70">
          {Math.min(stat?.streak ?? 0, KNOWN_STREAK)}/{KNOWN_STREAK}
        </span>
      )}
    </Badge>
  )
}

/**
 * The tally under the pill: how far along the streak is, and how often the word
 * fell back. Both are what tells a learner a "connu" word was hard-won.
 */
export function StandingSummary({
  stat,
  className,
}: {
  stat: WordStat | undefined
  className?: string
}) {
  const text = cn("text-xs text-muted-foreground tabular-nums", className)
  if (!stat || (stat.hits === 0 && stat.misses === 0)) {
    return <span className={text}>Jamais révisé</span>
  }

  const streak =
    stat.streak >= KNOWN_STREAK
      ? `${stat.streak} d'affilée`
      : `${stat.streak}/${KNOWN_STREAK} d'affilée`

  return (
    <span
      className={text}
      title={`${stat.hits} réussite${stat.hits > 1 ? "s" : ""} en tout, ${stat.misses} passage${stat.misses > 1 ? "s" : ""} en « à revoir »`}
    >
      {streak}
      {stat.misses > 0 && (
        <>
          {" "}
          · {stat.misses} oubli{stat.misses > 1 ? "s" : ""}
        </>
      )}
    </span>
  )
}
