"use client"

import * as React from "react"
import {
  CheckIcon,
  PlayIcon,
  RepeatIcon,
  RotateCcwIcon,
  Volume2Icon,
  XIcon,
} from "lucide-react"

import { Flashcard, type Side } from "@/components/flashcard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useKoreanSpeech } from "@/hooks/use-korean-speech"
import { shuffle } from "@/lib/api"
import { useSettings, type Settings } from "@/lib/settings"
import { KNOWN_STREAK } from "@/lib/types"
import type {
  DeckSource,
  FrontSide,
  RunFront,
  SeriesMode,
  Verdict,
  Word,
} from "@/lib/types"

/** A word plus the side decided for this run (resolved once, so flipping is stable). */
type DeckCard = { word: Word; front: Side }

/** One pass through a deck. Kept as a single value so a restart is atomic. */
type Run = {
  deck: DeckCard[]
  index: number
  flipped: boolean
  verdicts: Record<string, Verdict>
  /** The sense the cards are being shown in right now. */
  frontSide: FrontSide
  /** Set once a card has been answered in a sense the run no longer uses. */
  mixed: boolean
}

/** What a finished — or abandoned — series hands back to the store. */
export type RunReport = {
  known: string[]
  failed: string[]
  size: number
  completed: boolean
  frontSide: RunFront
}

const SOURCE_LABEL: Record<DeckSource, string> = {
  all: "Tout le cours",
  todo: "Pas encore connus",
  review: "À revoir",
}

const SIZES = [10, 20, 50]

/** `random` is decided card by card, so each draw resolves it on its own. */
function faceFor(frontSide: FrontSide): Side {
  if (frontSide !== "random") return frontSide
  return Math.random() < 0.5 ? "korean" : "translation"
}

function buildDeck(
  words: Word[],
  frontSide: FrontSide,
  shuffled: boolean,
  size: number | null
): DeckCard[] {
  const ordered = shuffled ? shuffle(words) : words
  return (size ? ordered.slice(0, size) : ordered).map((word) => ({
    word,
    front: faceFor(frontSide),
  }))
}

/**
 * The whole revision experience, over the page rather than inside it: a launch
 * screen, the cards, then the score. A `series` is recorded when it ends —
 * including when it is closed early; `practice` never writes anything.
 */
export function SeriesDialog({
  open,
  mode,
  words,
  streaks,
  onOpenChange,
  onRecord,
}: {
  open: boolean
  mode: SeriesMode
  words: Word[]
  /** Consecutive successes per word id, to draw from a standing. */
  streaks: Record<string, number>
  onOpenChange: (open: boolean) => void
  onRecord: (report: RunReport) => void
}) {
  const { speak } = useKoreanSpeech()
  const [settings, update] = useSettings()
  /** `null` until the learner starts: the launch screen is the first phase. */
  const [run, setRun] = React.useState<Run | null>(null)

  // Guards the one write each deck is entitled to, whether it comes from
  // reaching the last card or from closing the popup part-way.
  const recorded = React.useRef<DeckCard[] | null>(null)

  const pools = React.useMemo(
    () => ({
      all: words,
      todo: words.filter((word) => (streaks[word.id] ?? 0) < KNOWN_STREAK),
      review: words.filter((word) => streaks[word.id] === 0),
    }),
    [streaks, words]
  )

  const source: DeckSource = pools[settings.source].length
    ? settings.source
    : "all"
  const pool = pools[source]

  const start = React.useCallback(
    (from: Word[], next: Settings, size: number | null) => {
      recorded.current = null
      setRun({
        deck: buildDeck(from, next.frontSide, next.shuffled, size),
        index: 0,
        flipped: false,
        verdicts: {},
        frontSide: next.frontSide,
        mixed: false,
      })
    },
    []
  )

  /**
   * Switching sense mid-run rewrites the cards still to come, and leaves the
   * ones already answered as they were actually played. Nothing is redrawn:
   * the deck, the order and the verdicts all survive.
   */
  const changeFront = React.useCallback(
    (next: FrontSide) => {
      update({ frontSide: next })
      setRun((state) => {
        if (!state || next === state.frontSide) return state
        return {
          ...state,
          frontSide: next,
          // Only a sense some card was *answered* in counts as a change; a
          // switch made before the first verdict just corrects the setup.
          mixed: state.mixed || Object.keys(state.verdicts).length > 0,
          flipped: false,
          deck: state.deck.map((card, position) =>
            position < state.index ? card : { ...card, front: faceFor(next) }
          ),
        }
      })
    },
    [update]
  )

  const record = React.useCallback(
    (state: Run, completed: boolean) => {
      if (mode !== "series") return
      const ids = (verdict: Verdict) =>
        state.deck
          .filter((card) => state.verdicts[card.word.id] === verdict)
          .map((card) => card.word.id)
      onRecord({
        known: ids("known"),
        failed: ids("unknown"),
        size: state.deck.length,
        completed,
        frontSide: state.mixed ? "mixed" : state.frontSide,
      })
    },
    [mode, onRecord]
  )

  const finished = Boolean(run && run.index >= run.deck.length)

  React.useEffect(() => {
    if (!run || !finished || recorded.current === run.deck) return
    recorded.current = run.deck
    record(run, true)
  }, [finished, record, run])

  /** Closing mid-series still counts: what was answered is what gets written. */
  function handleOpenChange(next: boolean) {
    if (!next && run) {
      const answered = Object.keys(run.verdicts).length
      if (answered > 0 && recorded.current !== run.deck) {
        recorded.current = run.deck
        record(run, false)
      }
      setRun(null)
    }
    onOpenChange(next)
  }

  const answer = React.useCallback((verdict: Verdict) => {
    setRun((state) => {
      if (!state) return state
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
    setRun((state) =>
      state
        ? { ...state, index: Math.max(0, state.index - 1), flipped: false }
        : state
    )
  }, [])

  const flip = React.useCallback(() => {
    setRun((state) => (state ? { ...state, flipped: !state.flipped } : state))
  }, [])

  const current = run && !finished ? run.deck[run.index] : undefined

  // Autoplay reads the Korean side as soon as it becomes visible. In `audio`
  // mode the sound *is* the prompt, so it plays whatever the setting says.
  const { autoplay, romanization } = settings
  const flipped = run?.flipped ?? false
  React.useEffect(() => {
    if (!current?.word.korean) return
    const koreanVisible = current.front === "korean" ? !flipped : flipped
    const isPrompt = current.front === "audio" && !flipped
    if (isPrompt || (autoplay && koreanVisible)) speak(current.word.korean)
  }, [autoplay, current, flipped, speak])

  React.useEffect(() => {
    if (!current) return
    const card = current
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target
      const activation = event.key === " " || event.key === "Enter"
      if (target instanceof HTMLElement) {
        if (
          target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
        ) {
          return
        }
        // Space and Enter belong to whatever control has focus — a switch, a
        // button — before they belong to the card. Arrows never do.
        if (
          activation &&
          target.closest(
            "button, a[href], [role='switch'], [role='checkbox'], [role='radio']"
          )
        ) {
          return
        }
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (activation) {
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
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault()
        speak(card.word.korean)
      }
    }
    // Capture phase: the dialog popup stops keydown from reaching `window`,
    // so a listener on the bubble phase would never see a single shortcut.
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [answer, current, flip, previous, speak])

  const failed = React.useMemo(
    () =>
      run
        ? run.deck
            .filter((card) => run.verdicts[card.word.id] === "unknown")
            .map((card) => card.word)
        : [],
    [run]
  )
  const answered = run ? Object.keys(run.verdicts).length : 0
  const known = answered - failed.length
  const title = mode === "series" ? "Série" : "Entraînement libre"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-0 left-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)] gap-0 rounded-none bg-background p-0 ring-0 sm:max-w-none"
      >
        <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <Badge
            variant={mode === "series" ? "default" : "secondary"}
            className="gap-1.5"
          >
            {run && !finished && (
              <span className="size-1.5 animate-pulse rounded-full bg-current" />
            )}
            {run && !finished ? `${title} en cours` : title}
          </Badge>
          <DialogTitle className="sr-only">{title}</DialogTitle>

          {run && (
            <div className="flex min-w-40 flex-1 items-center gap-3">
              <Progress
                value={
                  (Math.min(run.index, run.deck.length) / run.deck.length) * 100
                }
                className="flex-1"
              />
              <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                {Math.min(run.index + (finished ? 0 : 1), run.deck.length)} /{" "}
                {run.deck.length}
              </span>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            aria-label="Quitter"
            onClick={() => handleOpenChange(false)}
          >
            <XIcon />
          </Button>
        </header>

        {!run ? (
          <SetupScreen
            settings={settings}
            source={source}
            pools={pools}
            onChange={update}
            onStart={(size) => start(pool, settings, size)}
          />
        ) : (
          <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-y-auto lg:grid-cols-[minmax(0,1fr)_19rem] lg:grid-rows-1 lg:overflow-hidden">
            <div className="flex min-h-0 flex-col gap-4 p-4">
              {finished ? (
                <Summary
                  known={known}
                  failed={failed}
                  onReplay={() => start(failed, settings, null)}
                  onRestart={() => start(pool, settings, settings.size)}
                  onClose={() => handleOpenChange(false)}
                />
              ) : (
                current && (
                  <>
                    <Flashcard
                      word={current.word}
                      front={current.front}
                      flipped={run.flipped}
                      romanization={romanization}
                      onFlip={flip}
                      className="min-h-56 flex-1"
                    />

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
                        Acquis
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                      <FrontSidePicker
                        value={run.frontSide}
                        onChange={changeFront}
                      />
                      <Toggle
                        id="series-romanization"
                        label="Prononciation"
                        checked={romanization}
                        onChange={(checked) =>
                          update({ romanization: checked })
                        }
                      />
                      <Toggle
                        id="series-autoplay"
                        label="Audio auto"
                        checked={autoplay}
                        onChange={(checked) => update({ autoplay: checked })}
                      />
                    </div>

                    <p className="text-center text-xs text-muted-foreground">
                      Espace : retourner · ← : à revoir · → : acquis · S :
                      écouter · Retour arrière : carte précédente
                    </p>
                  </>
                )
              )}
            </div>

            <aside className="flex min-h-0 flex-col gap-2 border-t p-4 lg:border-t-0 lg:border-l">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">À revoir</h3>
                <Badge variant="secondary">{failed.length}</Badge>
              </div>
              {failed.length === 0 ? (
                <p className="text-sm text-pretty text-muted-foreground">
                  Les mots que tu classes « à revoir » s&apos;affichent ici au
                  fur et à mesure.
                </p>
              ) : (
                <ul className="flex max-h-56 min-h-0 flex-col gap-1 overflow-y-auto lg:max-h-none lg:flex-1">
                  {failed.map((word) => (
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
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Écouter ${word.korean}`}
                        onClick={() => speak(word.korean)}
                      >
                        <Volume2Icon />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {mode === "practice" && (
                <p className="mt-auto text-xs text-pretty text-muted-foreground">
                  Entraînement libre : rien n&apos;est enregistré.
                </p>
              )}
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Which face comes first. Offered on the launch screen *and* during the run —
 * a series that turns out to be too easy one way should be turnable the other
 * way without losing the cards already answered.
 */
function FrontSidePicker({
  value,
  onChange,
}: {
  value: FrontSide
  onChange: (frontSide: FrontSide) => void
}) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(next) =>
        onChange((next[0] as FrontSide | undefined) ?? value)
      }
      variant="outline"
      spacing={0}
      aria-label="Face visible en premier"
    >
      <ToggleGroupItem value="korean">Coréen</ToggleGroupItem>
      <ToggleGroupItem value="translation">Français</ToggleGroupItem>
      <ToggleGroupItem value="random">Aléatoire</ToggleGroupItem>
      <ToggleGroupItem value="audio">Écoute</ToggleGroupItem>
    </ToggleGroup>
  )
}

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </Label>
    </div>
  )
}

/** The launch screen: everything that shapes the draw, decided before the first card. */
function SetupScreen({
  settings,
  source,
  pools,
  onChange,
  onStart,
}: {
  settings: Settings
  source: DeckSource
  pools: Record<DeckSource, Word[]>
  onChange: (patch: Partial<Settings>) => void
  onStart: (size: number | null) => void
}) {
  const available = pools[source].length
  // A count larger than the pool would silently draw fewer cards than it says.
  const sizes = SIZES.filter((size) => size < available)
  const size =
    settings.size && sizes.includes(settings.size) ? settings.size : null

  return (
    <div className="overflow-y-auto p-4">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight">
            Prépare ta série
          </h2>
          <p className="text-sm text-muted-foreground">
            Les réglages sont mémorisés pour la prochaine fois.
          </p>
        </div>

        <Field label="Face visible en premier">
          <FrontSidePicker
            value={settings.frontSide}
            onChange={(frontSide) => onChange({ frontSide })}
          />
        </Field>

        <Field label="Mots">
          <ToggleGroup
            value={[source]}
            // Falling back to the current value keeps the group single-choice:
            // clicking the active item would otherwise clear it and quietly
            // change the draw.
            onValueChange={(value) =>
              onChange({
                source: (value[0] as DeckSource | undefined) ?? source,
              })
            }
            variant="outline"
            spacing={0}
            aria-label="Mots à travailler"
          >
            {(Object.keys(SOURCE_LABEL) as DeckSource[]).map((key) => (
              <ToggleGroupItem
                key={key}
                value={key}
                disabled={pools[key].length === 0}
              >
                {SOURCE_LABEL[key]}
                <span className="ml-1.5 text-muted-foreground tabular-nums">
                  {pools[key].length}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>

        {sizes.length > 0 && (
          <Field label="Nombre de cartes">
            <ToggleGroup
              value={[String(size ?? "all")]}
              onValueChange={(value) => {
                const next = value[0]
                if (!next) return
                onChange({ size: next === "all" ? null : Number(next) })
              }}
              variant="outline"
              spacing={0}
              aria-label="Nombre de cartes"
            >
              {sizes.map((count) => (
                <ToggleGroupItem key={count} value={String(count)}>
                  {count}
                </ToggleGroupItem>
              ))}
              <ToggleGroupItem value="all">Tout ({available})</ToggleGroupItem>
            </ToggleGroup>
          </Field>
        )}

        <div className="flex flex-col gap-3">
          <Toggle
            id="setup-shuffled"
            label="Mélanger les cartes"
            checked={settings.shuffled}
            onChange={(checked) => onChange({ shuffled: checked })}
          />
          <Toggle
            id="setup-romanization"
            label="Afficher la prononciation"
            checked={settings.romanization}
            onChange={(checked) => onChange({ romanization: checked })}
          />
          <Toggle
            id="setup-autoplay"
            label="Lire le coréen automatiquement"
            checked={settings.autoplay}
            onChange={(checked) => onChange({ autoplay: checked })}
          />
        </div>

        <Button
          size="lg"
          disabled={available === 0}
          onClick={() => onStart(size)}
        >
          <PlayIcon data-icon="inline-start" />
          {available === 0
            ? "Aucun mot à travailler"
            : `Démarrer · ${size ?? available} carte${(size ?? available) > 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function Summary({
  known,
  failed,
  onReplay,
  onRestart,
  onClose,
}: {
  known: number
  failed: Word[]
  onReplay: () => void
  onRestart: () => void
  onClose: () => void
}) {
  return (
    <div className="m-auto flex max-w-md flex-col items-center gap-4 py-10 text-center">
      <h3 className="text-xl font-semibold">Série terminée</h3>
      <div className="flex gap-2">
        <Badge>{known} acquis</Badge>
        <Badge variant="secondary">{failed.length} à revoir</Badge>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {failed.length > 0 && (
          <Button onClick={onReplay}>
            <RepeatIcon data-icon="inline-start" />
            Rejouer les {failed.length} échecs
          </Button>
        )}
        <Button variant="outline" onClick={onRestart}>
          <RotateCcwIcon data-icon="inline-start" />
          Nouvelle série
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Fermer
        </Button>
      </div>
    </div>
  )
}
