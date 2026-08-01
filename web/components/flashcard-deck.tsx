"use client"

import * as React from "react"
import {
  CheckIcon,
  RepeatIcon,
  RotateCcwIcon,
  ShuffleIcon,
  Volume2Icon,
  XIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useKoreanSpeech } from "@/hooks/use-korean-speech"
import { shuffle } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { FrontSide, Word } from "@/lib/types"

const SETTINGS_KEY = "flashcards:settings"

type Settings = {
  frontSide: FrontSide
  shuffled: boolean
  autoplay: boolean
  romanization: boolean
}

const DEFAULT_SETTINGS: Settings = {
  frontSide: "korean",
  shuffled: true,
  autoplay: false,
  romanization: true,
}

/**
 * Session preferences live in `localStorage`, which is an external store rather
 * than React state — reading it through `useSyncExternalStore` keeps the value
 * available during render (no post-mount effect, no hydration mismatch).
 * The snapshot is memoised because React compares it by identity.
 */
const settingsStore = (() => {
  let snapshot: Settings | null = null
  const listeners = new Set<() => void>()

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    get(): Settings {
      if (snapshot) return snapshot
      let loaded = DEFAULT_SETTINGS
      try {
        const stored = window.localStorage.getItem(SETTINGS_KEY)
        if (stored) loaded = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
      } catch {
        // Corrupted or unavailable storage: the defaults are fine.
      }
      snapshot = loaded
      return loaded
    },
    getServer(): Settings {
      return DEFAULT_SETTINGS
    },
    set(next: Settings) {
      snapshot = next
      try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      } catch {
        // Ignore quota / private-mode failures; the run still uses `next`.
      }
      for (const listener of listeners) listener()
    },
  }
})()

type Side = Exclude<FrontSide, "random">

/** A word plus the side decided for this run (resolved once, so flipping is stable). */
type DeckCard = { word: Word; front: Side }

type Verdict = "known" | "unknown"

/** One pass through a deck. Kept as a single value so a restart is atomic. */
type Run = {
  deck: DeckCard[]
  index: number
  flipped: boolean
  verdicts: Record<string, Verdict>
}

const EMPTY_RUN: Run = { deck: [], index: 0, flipped: false, verdicts: {} }

/** Only takes the settings that shape the draw, so the rest can change freely. */
function buildDeck(
  words: Word[],
  frontSide: FrontSide,
  shuffled: boolean
): DeckCard[] {
  const ordered = shuffled ? shuffle(words) : words
  return ordered.map((word) => ({
    word,
    front:
      frontSide === "random"
        ? Math.random() < 0.5
          ? "korean"
          : "translation"
        : frontSide,
  }))
}

export function FlashcardDeck({ words }: { words: Word[] }) {
  const { speak } = useKoreanSpeech()
  const settings = React.useSyncExternalStore(
    settingsStore.subscribe,
    settingsStore.get,
    settingsStore.getServer
  )
  const [run, setRun] = React.useState<Run>(EMPTY_RUN)
  /** Bumped by "Mélanger" / "Recommencer" to force a fresh draw. */
  const [runId, setRunId] = React.useState(0)

  const { deck, index, flipped, verdicts } = run

  const restart = React.useCallback((pool: Word[], next: Settings) => {
    setRun({
      ...EMPTY_RUN,
      deck: buildDeck(pool, next.frontSide, next.shuffled),
    })
  }, [])

  // The deck is shuffled, so it can only be drawn on the client — hence an
  // effect rather than a render-time computation. It is redrawn when the
  // lesson's words change (import, add, delete), when a setting that affects the
  // draw changes, and on an explicit restart. `autoplay` and `romanization` are
  // left out on purpose: toggling them must not throw away the run in progress.
  const { frontSide, shuffled, autoplay, romanization } = settings
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above: the draw must happen after hydration
    setRun({ ...EMPTY_RUN, deck: buildDeck(words, frontSide, shuffled) })
  }, [frontSide, runId, shuffled, words])

  const current = deck[index]
  const finished = deck.length > 0 && index >= deck.length
  const answered = Object.keys(verdicts).length
  const failed = React.useMemo(
    () =>
      deck
        .filter((card) => verdicts[card.word.id] === "unknown")
        .map((card) => card.word),
    [deck, verdicts]
  )
  const known = answered - failed.length

  // An `audio` front hides the word, so its back is the Korean side too.
  const backSide: Side = current?.front === "korean" ? "translation" : "korean"

  // Autoplay reads the Korean side as soon as it becomes visible. In `audio`
  // mode the sound *is* the prompt, so it plays whatever the setting says.
  React.useEffect(() => {
    if (!current?.word.korean) return
    const koreanVisible = current.front === "korean" ? !flipped : flipped
    const isPrompt = current.front === "audio" && !flipped
    if (isPrompt || (autoplay && koreanVisible)) speak(current.word.korean)
  }, [autoplay, current, flipped, speak])

  const answer = React.useCallback((verdict: Verdict) => {
    setRun((state) => {
      const card = state.deck[state.index]
      if (!card) return state
      return {
        ...state,
        verdicts: { ...state.verdicts, [card.word.id]: verdict },
        flipped: false,
        index: state.index + 1,
      }
    })
  }, [])

  const previous = React.useCallback(() => {
    setRun((state) => ({
      ...state,
      index: Math.max(0, state.index - 1),
      flipped: false,
    }))
  }, [])

  const flip = React.useCallback(() => {
    setRun((state) => ({ ...state, flipped: !state.flipped }))
  }, [])

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === " " || event.key === "Enter") {
        event.preventDefault()
        flip()
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        answer("known")
      } else if (event.key === "ArrowLeft") {
        event.preventDefault()
        answer("unknown")
      } else if (event.key === "Backspace") {
        event.preventDefault()
        previous()
      } else if (event.key.toLowerCase() === "s" && current) {
        event.preventDefault()
        speak(current.word.korean)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [answer, current, flip, previous, speak])

  if (words.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RepeatIcon />
          </EmptyMedia>
          <EmptyTitle>Pas encore de mots</EmptyTitle>
          <EmptyDescription>
            Ajoute des mots depuis la liste plus bas pour lancer une session.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (deck.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-64 w-full rounded-xl sm:h-72" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          value={[frontSide]}
          onValueChange={(value) => {
            const next = (value[0] as FrontSide | undefined) ?? frontSide
            settingsStore.set({ ...settings, frontSide: next })
          }}
          variant="outline"
          spacing={0}
          aria-label="Face visible en premier"
        >
          <ToggleGroupItem value="korean">Coréen</ToggleGroupItem>
          <ToggleGroupItem value="translation">Français</ToggleGroupItem>
          <ToggleGroupItem value="random">Aléatoire</ToggleGroupItem>
          <ToggleGroupItem value="audio">Écoute</ToggleGroupItem>
        </ToggleGroup>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="romanization"
              checked={romanization}
              onCheckedChange={(checked) =>
                settingsStore.set({ ...settings, romanization: checked })
              }
            />
            <Label
              htmlFor="romanization"
              className="text-sm text-muted-foreground"
            >
              Prononciation
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="autoplay"
              checked={autoplay}
              onCheckedChange={(checked) =>
                settingsStore.set({ ...settings, autoplay: checked })
              }
            />
            <Label htmlFor="autoplay" className="text-sm text-muted-foreground">
              Audio auto
            </Label>
          </div>
          <Button
            variant={shuffled ? "secondary" : "outline"}
            onClick={() => {
              settingsStore.set({ ...settings, shuffled: true })
              // Already shuffled? Force a new draw anyway.
              setRunId((value) => value + 1)
            }}
          >
            <ShuffleIcon data-icon="inline-start" />
            Mélanger
          </Button>
          <Button
            variant="outline"
            onClick={() => settingsStore.set({ ...settings, shuffled: false })}
          >
            <RotateCcwIcon data-icon="inline-start" />
            Ordre du cours
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Progress
          value={(Math.min(index, deck.length) / deck.length) * 100}
          className="flex-1"
        />
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {Math.min(index + (finished ? 0 : 1), deck.length)} / {deck.length}
        </span>
      </div>

      {finished ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <h3 className="text-xl font-semibold">Session terminée</h3>
            <div className="flex gap-2">
              <Badge>
                {known} su{known > 1 ? "s" : ""}
              </Badge>
              <Badge variant="secondary">{failed.length} à revoir</Badge>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {failed.length > 0 && (
                <Button onClick={() => restart(failed, settings)}>
                  <RepeatIcon data-icon="inline-start" />
                  Rejouer les {failed.length} échecs
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setRunId((value) => value + 1)}
              >
                <RotateCcwIcon data-icon="inline-start" />
                Recommencer tout
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        current && (
          <>
            <div className="[perspective:1200px]">
              <button
                type="button"
                onClick={flip}
                aria-label={flipped ? "Voir le recto" : "Voir le verso"}
                className={cn(
                  "relative block h-64 w-full rounded-xl transition-transform duration-500 [transform-style:preserve-3d] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:h-72",
                  flipped && "[transform:rotateY(180deg)]"
                )}
              >
                <CardFace
                  word={current.word}
                  side={current.front}
                  romanization={romanization}
                  hint={
                    current.front === "audio"
                      ? "S pour réécouter · Espace pour retourner"
                      : "Clique ou Espace pour retourner"
                  }
                />
                <CardFace
                  word={current.word}
                  side={backSide}
                  romanization={romanization}
                  // Nothing was shown on an `audio` prompt, so the reveal
                  // carries the meaning as well as the word.
                  translation={current.front === "audio"}
                  hint="← à revoir · su →"
                  className="[transform:rotateY(180deg)]"
                />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="outline"
                size="lg"
                className="flex-1 sm:flex-none"
                onClick={() => answer("unknown")}
              >
                <XIcon data-icon="inline-start" />À revoir
              </Button>
              <Button
                variant="outline"
                size="lg"
                aria-label="Écouter en coréen"
                onClick={() => speak(current.word.korean)}
              >
                <Volume2Icon />
              </Button>
              <Button
                size="lg"
                className="flex-1 sm:flex-none"
                onClick={() => answer("known")}
              >
                <CheckIcon data-icon="inline-start" />
                Su
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Espace : retourner · ← : à revoir · → : su · S : écouter · Retour
              arrière : carte précédente
            </p>
          </>
        )
      )}
    </div>
  )
}

const FACE_LABEL: Record<Side, string> = {
  korean: "한국어",
  translation: "Français",
  audio: "Écoute",
}

function CardFace({
  word,
  side,
  romanization,
  translation = false,
  hint,
  className,
}: {
  word: Word
  side: Side
  romanization: boolean
  /** Adds the French meaning under a Korean face. */
  translation?: boolean
  hint: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-6 text-card-foreground shadow-sm [backface-visibility:hidden]",
        className
      )}
    >
      <Badge variant="secondary" className="absolute top-3 left-3">
        {FACE_LABEL[side]}
      </Badge>
      {side === "audio" ? (
        <Volume2Icon className="size-14 text-muted-foreground" />
      ) : (
        <p
          className={cn(
            "text-center font-semibold text-balance",
            side === "korean" ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl"
          )}
          lang={side === "korean" ? "ko" : "fr"}
        >
          {(side === "korean" ? word.korean : word.translation) || "—"}
        </p>
      )}
      {side !== "translation" && romanization && word.romanization && (
        <p className="text-center text-muted-foreground">{word.romanization}</p>
      )}
      {translation && side === "korean" && word.translation && (
        <p className="text-center text-muted-foreground" lang="fr">
          {word.translation}
        </p>
      )}
      {/* The note often spells the word out, so it stays hidden on the prompt. */}
      {side !== "audio" && word.note && (
        <p className="max-w-prose text-center text-sm text-pretty text-muted-foreground">
          {word.note}
        </p>
      )}
      <span className="absolute bottom-3 text-xs text-muted-foreground">
        {hint}
      </span>
    </div>
  )
}
