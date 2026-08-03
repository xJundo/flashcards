"use client"

import * as React from "react"
import Link from "next/link"
import {
  CheckIcon,
  DumbbellIcon,
  PlayIcon,
  RotateCcwIcon,
  Trash2Icon,
  Volume2Icon,
  XIcon,
} from "lucide-react"

import { SeriesDialog, type RunReport } from "@/components/series-dialog"
import {
  STANDING,
  scoreKey,
  type StandingKey,
} from "@/components/word-standing"
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useKoreanSpeech } from "@/hooks/use-korean-speech"
import { useCourseProgress } from "@/lib/progress"
import { KNOWN_STREAK } from "@/lib/types"
import { cn } from "@/lib/utils"
import type { RunResult, SeriesMode, Word, WordStat } from "@/lib/types"

const FRONT_LABEL: Record<string, string> = {
  korean: "coréen → français",
  translation: "français → coréen",
  random: "sens aléatoire",
  audio: "à l'écoute",
  mixed: "sens changé en cours de route",
}

/**
 * Everything a learner does with a lesson, outside the lesson's own word list:
 * launching a series, seeing where each word stands, and reading back what
 * happened. The revision itself happens over the page, in {@link SeriesDialog}.
 */
export function CoursePractice({
  words,
  signedIn,
}: {
  words: Word[]
  /** Progress is only recorded for an account; anonymous revision is untracked. */
  signedIn: boolean
}) {
  const { speak } = useKoreanSpeech()
  const { progress, send } = useCourseProgress()
  const [mode, setMode] = React.useState<SeriesMode | null>(null)

  const byId = React.useMemo(
    () => new Map(words.map((word) => [word.id, word])),
    [words]
  )

  // The lesson's order, not the order the runs happened to visit the words in.
  const { review, known, learning } = React.useMemo(() => {
    const stats = progress.stats
    return {
      review: words.filter((word) => stats[word.id]?.streak === 0),
      known: words.filter(
        (word) => (stats[word.id]?.streak ?? 0) >= KNOWN_STREAK
      ),
      learning: words.filter((word) => {
        const streak = stats[word.id]?.streak
        return streak !== undefined && streak > 0 && streak < KNOWN_STREAK
      }),
    }
  }, [progress.stats, words])

  // The two moves a learner can make by hand, shared by the panels that offer
  // them: "à revoir" only goes up, "connus" only goes down, "en cours" both.
  const acquire: PanelAction = {
    icon: <CheckIcon />,
    label: (word) => `Marquer ${word.korean} comme connu`,
    run: (id) => void send({ acquired: id }),
  }
  const sendBack: PanelAction = {
    icon: <RotateCcwIcon />,
    label: (word) => `Remettre ${word.korean} à revoir`,
    run: (id) => void send({ review: id }),
  }

  if (words.length === 0) {
    return (
      <Card>
        <CardContent className="text-sm text-pretty text-muted-foreground">
          Ajoute des mots depuis la liste plus bas pour lancer une série.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {signedIn && (
          <Button size="lg" onClick={() => setMode("series")}>
            <PlayIcon data-icon="inline-start" />
            Lancer une série
          </Button>
        )}
        <Button
          variant={signedIn ? "outline" : "default"}
          size="lg"
          onClick={() => setMode("practice")}
        >
          <DumbbellIcon data-icon="inline-start" />
          Entraînement libre
        </Button>
      </div>

      {signedIn ? (
        <>
          <CourseMeter
            known={known.length}
            learning={learning.length}
            review={review.length}
            total={words.length}
          />

          <div className="grid gap-4 lg:grid-cols-3">
            <WordPanel
              standing="review"
              title="À revoir"
              words={review}
              empty="Les mots ratés en série arrivent ici, jusqu'à ce que tu les réussisses à nouveau."
              onSpeak={speak}
              stats={progress.stats}
              actions={[acquire]}
            />
            {/* Between the two: a word in progress can go either way, so it gets
                both moves rather than the one the outer panels need. */}
            <WordPanel
              standing="learning"
              title="En cours"
              words={learning}
              empty="Un mot réussi au moins une fois, mais pas encore assez souvent d'affilée, attend ici."
              onSpeak={speak}
              stats={progress.stats}
              actions={[acquire, sendBack]}
            />
            <WordPanel
              standing="known"
              title="Connus"
              words={known}
              empty={`Réussis un mot ${KNOWN_STREAK} séries de suite pour le voir arriver ici.`}
              onSpeak={speak}
              stats={progress.stats}
              actions={[sendBack]}
            />
          </div>

          <RunHistory
            runs={progress.runs}
            byId={byId}
            onDelete={(id) => void send({ deleteRun: id })}
            onReset={() => void send({ clearRuns: true })}
          />
        </>
      ) : (
        <Card>
          <CardContent className="text-sm text-pretty text-muted-foreground">
            <Link href="/connexion" className="underline underline-offset-4">
              Connecte-toi
            </Link>{" "}
            pour lancer des séries, garder tes mots à revoir et relire tes
            scores. Sans compte, l&apos;entraînement libre reste disponible mais
            rien n&apos;est enregistré.
          </CardContent>
        </Card>
      )}

      <SeriesDialog
        open={mode !== null}
        mode={mode ?? "practice"}
        words={words}
        stats={progress.stats}
        onOpenChange={(open) => setMode(open ? mode : null)}
        onRecord={(report: RunReport) => void send({ run: report })}
      />
    </div>
  )
}

/**
 * The lesson at a glance. Segments run acquired → in progress → to review →
 * untouched, so the bar fills from the left and turns green as the lesson is
 * learnt. The figure is the share acquired, in the colour that share earns.
 */
function CourseMeter({
  known,
  learning,
  review,
  total,
}: {
  known: number
  learning: number
  review: number
  total: number
}) {
  const percent = total ? Math.round((known / total) * 100) : 0
  const untouched = total - known - learning - review
  const parts: [StandingKey, number][] = [
    ["known", known],
    ["learning", learning],
    ["review", review],
    ["new", untouched],
  ]

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

        {/* A meter, not a chart: the legend below carries the numbers, and the
            2px gaps keep two adjacent colours from reading as one block. */}
        <div
          className="flex h-2.5 w-full gap-0.5"
          role="img"
          aria-label={`${known} mot${known > 1 ? "s" : ""} connu${known > 1 ? "s" : ""} sur ${total}, soit ${percent}%`}
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

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <Count standing="known" value={known} label="connus" />
          <Count standing="learning" value={learning} label="en cours" />
          <Count standing="review" value={review} label="à revoir" />
          <Count standing="new" value={untouched} label="jamais vus" />
        </div>
        <p className="text-xs text-muted-foreground">
          Un mot devient vert après {KNOWN_STREAK} séries réussies
          d&apos;affilée.
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

/** A move a learner can make on a word by hand, from a panel. */
type PanelAction = {
  icon: React.ReactNode
  label: (word: Word) => string
  run: (id: string) => void
}

/** One standing — the words in it, and the moves out of it. */
function WordPanel({
  standing,
  title,
  words,
  empty,
  onSpeak,
  stats,
  actions,
}: {
  standing: StandingKey
  title: string
  words: Word[]
  empty: string
  onSpeak: (text: string) => void
  stats: Record<string, WordStat>
  actions: PanelAction[]
}) {
  const { Icon, ink, badge } = STANDING[standing]
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Icon className={cn("size-4 shrink-0", ink)} />
            {title}
          </h3>
          <Badge variant="secondary" className={badge}>
            {words.length}
          </Badge>
        </div>
        {words.length === 0 ? (
          <p className="text-sm text-pretty text-muted-foreground">{empty}</p>
        ) : (
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {words.map((word) => (
              <li
                key={word.id}
                className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-accent"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm" lang="ko">
                    {word.korean}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {word.translation}
                  </span>
                </div>
                {/* Only "en cours" has a distance left to run: on the other two
                    panels the standing already says where the streak stands. */}
                {standing === "learning" && (
                  <span
                    className={cn("text-xs tabular-nums", ink)}
                    title={`${stats[word.id]?.streak ?? 0} réussite(s) d'affilée sur les ${KNOWN_STREAK} qu'il faut`}
                  >
                    {stats[word.id]?.streak ?? 0}/{KNOWN_STREAK}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Écouter ${word.korean}`}
                  onClick={() => onSpeak(word.korean)}
                >
                  <Volume2Icon />
                </Button>
                {actions.map((action, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    size="icon-sm"
                    aria-label={action.label(word)}
                    onClick={() => action.run(word.id)}
                  >
                    {action.icon}
                  </Button>
                ))}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/** Each recorded series, newest first, unfolding into what was answered. */
function RunHistory({
  runs,
  byId,
  onDelete,
  onReset,
}: {
  runs: RunResult[]
  byId: Map<string, Word>
  onDelete: (id: string) => void
  onReset: () => void
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Historique des séries</h3>
          {runs.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onReset}>
              Tout effacer
            </Button>
          )}
        </div>
        {runs.length === 0 ? (
          <p className="text-sm text-pretty text-muted-foreground">
            Termine une série pour la retrouver ici, avec le détail des mots.
          </p>
        ) : (
          <Accordion className="flex flex-col">
            {runs.map((run) => {
              const answered = run.known.length + run.failed.length
              const percent = answered
                ? Math.round((run.known.length / answered) * 100)
                : 0
              return (
                <AccordionItem key={run.id} value={run.id}>
                  <AccordionTrigger
                    action={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Supprimer la série du ${formatRunDate(run.at)}`}
                        onClick={() => onDelete(run.id)}
                      >
                        <Trash2Icon />
                      </Button>
                    }
                  >
                    <span className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                      <span>{formatRunDate(run.at)}</span>
                      {!run.completed && (
                        <Badge variant="secondary">interrompue</Badge>
                      )}
                      <span className="ml-auto text-muted-foreground tabular-nums">
                        {run.known.length} / {answered}
                      </span>
                      <span
                        className={cn(
                          "w-10 text-right font-medium tabular-nums",
                          STANDING[scoreKey(percent)].ink
                        )}
                      >
                        {percent}%
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionPanel className="flex flex-col gap-3">
                    {/* The indicator's colour is the score's, without forking
                        the shadcn component to accept one. */}
                    <Progress
                      value={percent}
                      className={cn("h-1.5", STANDING[scoreKey(percent)].bar)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {FRONT_LABEL[run.frontSide] ?? run.frontSide} · {run.size}{" "}
                      carte{run.size > 1 ? "s" : ""} tirée
                      {run.size > 1 ? "s" : ""}
                      {answered < run.size &&
                        ` · ${run.size - answered} non répondue${run.size - answered > 1 ? "s" : ""}`}
                    </p>
                    <RunWords
                      title="Acquis"
                      tone="known"
                      ids={run.known}
                      byId={byId}
                    />
                    <RunWords
                      title="À revoir"
                      tone="failed"
                      ids={run.failed}
                      byId={byId}
                    />
                  </AccordionPanel>
                </AccordionItem>
              )
            })}
          </Accordion>
        )}
      </CardContent>
    </Card>
  )
}

function RunWords({
  title,
  tone,
  ids,
  byId,
}: {
  title: string
  tone: "known" | "failed"
  ids: string[]
  byId: Map<string, Word>
}) {
  // A word deleted from the lesson since the series was played leaves a hole.
  const words = ids
    .map((id) => byId.get(id))
    .filter((word): word is Word => Boolean(word))
  if (words.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-xs font-medium">
        {tone === "known" ? (
          <CheckIcon className="size-3.5 text-muted-foreground" />
        ) : (
          <XIcon className="size-3.5 text-muted-foreground" />
        )}
        {title} ({words.length})
      </span>
      <ul className="flex flex-wrap gap-1.5">
        {words.map((word) => (
          <li key={word.id}>
            <Badge variant={tone === "known" ? "secondary" : "outline"}>
              <span lang="ko">{word.korean}</span>
              {word.translation && (
                <span className="text-muted-foreground">
                  {word.translation}
                </span>
              )}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  )
}

function formatRunDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("fr-FR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
}
