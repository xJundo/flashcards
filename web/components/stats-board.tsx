"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { BookOpenIcon, CompassIcon, StarIcon, TrophyIcon } from "lucide-react"

import { StandingBar } from "@/components/course-meter"
import {
  STANDING,
  scoreKey,
  type StandingKey,
} from "@/components/word-standing"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { KNOWN_STREAK, percentOf } from "@/lib/types"
import type { GlobalStats } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * Where the learner stands, every lesson merged. The same meter as a lesson's
 * own, one rung up: the denominator is the whole catalogue, so "jamais vus"
 * counts the words waiting in lessons never opened.
 */
export function StatsBoard({ stats }: { stats: GlobalStats }) {
  const { words, courses } = stats
  const percent = percentOf(words.known, words.total)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Ma progression
        </h1>
        <p className="text-sm text-muted-foreground">
          Tous les cours confondus. Rien de tout ceci n&apos;est visible par les
          autres — seuls les cours réussis le sont.
        </p>
      </div>

      {words.total === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 text-sm text-pretty text-muted-foreground">
            Aucun cours ne contient encore de mots : il n&apos;y a rien à
            mesurer.
            <Button render={<Link href="/" />}>Voir les cours</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold">Mots appris</h2>
                <span
                  className={cn(
                    "text-3xl leading-none font-semibold tabular-nums",
                    STANDING[scoreKey(percent)].ink
                  )}
                >
                  {percent}%
                </span>
              </div>

              <StandingBar
                standing={{
                  known: words.known,
                  learning: words.learning,
                  review: words.review,
                  untouched: words.untouched,
                  completedAt: null,
                }}
                total={words.total}
              />

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <Count standing="known" value={words.known} label="connus" />
                <Count
                  standing="learning"
                  value={words.learning}
                  label="en cours"
                />
                <Count
                  standing="review"
                  value={words.review}
                  label="à revoir"
                />
                <Count
                  standing="new"
                  value={words.untouched}
                  label="jamais vus"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Sur les {words.total} mots publiés. Un mot devient vert après{" "}
                {KNOWN_STREAK} séries réussies d&apos;affilée.
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Tile
              icon={<BookOpenIcon />}
              value={courses.tracked}
              label={courses.tracked > 1 ? "cours suivis" : "cours suivi"}
              hint="au moins un mot répondu"
            />
            <Tile
              icon={<TrophyIcon />}
              value={courses.completed}
              label={courses.completed > 1 ? "cours réussis" : "cours réussi"}
              hint="tous les mots connus"
              ink={courses.completed > 0 ? STANDING.known.ink : undefined}
            />
            <Tile
              icon={<StarIcon />}
              value={courses.favorites}
              label="en favori"
              hint="ta liste de côté"
            />
            <Tile
              icon={<CompassIcon />}
              value={Math.max(courses.total - courses.tracked, 0)}
              label="à découvrir"
              hint={`sur ${courses.total} cours publiés`}
            />
          </div>

          {courses.tracked === 0 && (
            <Card>
              <CardContent className="flex flex-col items-start gap-3 text-sm text-pretty text-muted-foreground">
                Tu n&apos;as encore lancé aucune série. Ouvre un cours et
                lances-en une : les chiffres ci-dessus bougeront tout seuls.
                <Button render={<Link href="/" />}>Choisir un cours</Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
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

/** One headline number, with the sentence that says what it counts. */
function Tile({
  icon,
  value,
  label,
  hint,
  ink,
}: {
  icon: ReactNode
  value: number
  label: string
  hint: string
  ink?: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <span
          className={cn(
            "flex items-center gap-1.5 text-muted-foreground [&_svg]:size-4",
            ink
          )}
        >
          {icon}
        </span>
        <span
          className={cn(
            "text-2xl leading-none font-semibold tabular-nums",
            ink
          )}
        >
          {value}
        </span>
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </CardContent>
    </Card>
  )
}
