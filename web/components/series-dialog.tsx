"use client"

import * as React from "react"
import {
  BookOpenIcon,
  CheckIcon,
  PlayIcon,
  RepeatIcon,
  RotateCcwIcon,
  Volume2Icon,
  XIcon,
} from "lucide-react"

import { CourseSheetDrawer } from "@/components/course-sheet"
import { Flashcard, type Side } from "@/components/flashcard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useSpeech } from "@/hooks/use-speech"
import { shuffle } from "@/lib/api"
import { useSettings, type Settings } from "@/lib/settings"
import { KNOWN_STREAK } from "@/lib/types"
import type {
  DeckSource,
  FrontSide,
  RunFront,
  SeriesMode,
  Verdict,
  Card,
  WordStat,
} from "@/lib/types"

/** A word plus the side decided for this run (resolved once, so flipping is stable). */
type DeckCard = { word: Card; front: Side }

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
  all: "Tout",
  todo: "Pas encore connus",
  review: "À revoir",
}

const SIZES = [10, 20, 50]

/** `random` is decided card by card, so each draw resolves it on its own. */
function faceFor(frontSide: FrontSide): Side {
  if (frontSide !== "random") return frontSide
  return Math.random() < 0.5 ? "front" : "back"
}

function buildDeck(
  words: Card[],
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
  courseId,
  hasSheet,
  words,
  stats,
  speechLocale,
  onOpenChange,
  onRecord,
}: {
  open: boolean
  mode: SeriesMode
  courseId: string
  /** Whether the lesson has a revision sheet to open from the header. */
  hasSheet: boolean
  words: Card[]
  /** Where each word stands, to draw a deck from one standing. */
  stats: Record<string, WordStat>
  /** BCP-47 locale of the course's spoken language, or `null` for none. */
  speechLocale: string | null
  onOpenChange: (open: boolean) => void
  onRecord: (report: RunReport) => void
}) {
  const { speak } = useSpeech(speechLocale)
  const [settings, update] = useSettings()
  /** `null` until the learner starts: the launch screen is the first phase. */
  const [run, setRun] = React.useState<Run | null>(null)
  /** Open, the card shortcuts must yield — Space/arrows read the sheet instead. */
  const [sheetOpen, setSheetOpen] = React.useState(false)

  // Guards the one write each deck is entitled to, whether it comes from
  // reaching the last card or from closing the popup part-way.
  const recorded = React.useRef<DeckCard[] | null>(null)
  const cardRef = React.useRef<HTMLButtonElement>(null)

  const pools = React.useMemo(
    () => ({
      all: words,
      todo: words.filter(
        (word) => (stats[word.id]?.streak ?? 0) < KNOWN_STREAK
      ),
      review: words.filter((word) => stats[word.id]?.streak === 0),
    }),
    [stats, words]
  )

  const source: DeckSource = pools[settings.source].length
    ? settings.source
    : "all"
  const pool = pools[source]

  const start = React.useCallback(
    (from: Card[], next: Settings, size: number | null) => {
      recorded.current = null
      // A course with no spoken language can't honour a leftover "Écoute"
      // preference from a different course — read out loud, it would be dead
      // silence.
      const frontSide =
        !speechLocale && next.frontSide === "audio" ? "front" : next.frontSide
      setRun({
        deck: buildDeck(from, frontSide, next.shuffled, size),
        index: 0,
        flipped: false,
        verdicts: {},
        frontSide,
        mixed: false,
      })
    },
    [speechLocale]
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

  // Every new card takes the focus back. Clicking « Acquis » or « Écouter »
  // leaves that button focused, and the browser would then hand it the next
  // Espace; anchoring on the card keeps the shortcuts meaning the same thing
  // whatever was pressed or clicked before. Switching the face mid-run is not
  // a new card, so it leaves the picker alone.
  const cardKey = current ? `${run?.index}:${current.word.id}` : null
  React.useEffect(() => {
    if (!cardKey) return
    cardRef.current?.focus({ preventScroll: true })
  }, [cardKey])

  // Autoplay reads the Korean side as soon as it becomes visible. In `audio`
  // mode the sound *is* the prompt, so it plays whatever the setting says.
  const { autoplay, romanization } = settings
  const flipped = run?.flipped ?? false
  React.useEffect(() => {
    if (!current?.word.front) return
    const frontVisible = current.front === "front" ? !flipped : flipped
    const isPrompt = current.front === "audio" && !flipped
    if (isPrompt || (autoplay && frontVisible)) speak(current.word.front)
  }, [autoplay, current, flipped, speak])

  React.useEffect(() => {
    if (!current || sheetOpen) return
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
        // Space and Enter belong to a control that *consumes* them — a switch,
        // a toggle — before they belong to the card. A plain button keeps the
        // focus it took when it was clicked or when a shortcut fired, so
        // deferring to it would turn the next Espace into a repeat of that
        // button — replaying the audio, re-answering the card — instead of a
        // flip. Arrows never belong to a control.
        if (
          activation &&
          target.closest(
            "a[href], [role='switch'], [role='checkbox'], [role='radio'], [aria-pressed]"
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
        speak(card.word.front)
      }
    }
    // Capture phase: the dialog popup stops keydown from reaching `window`,
    // so a listener on the bubble phase would never see a single shortcut.
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [answer, current, flip, previous, sheetOpen, speak])

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
        <header className="flex items-center gap-3 border-b px-4 py-3">
          <Badge
            variant={mode === "series" ? "default" : "secondary"}
            className="shrink-0 gap-1.5"
          >
            {run && !finished && (
              <span className="size-1.5 animate-pulse rounded-full bg-current" />
            )}
            {title}
            {/* The pulsing dot already says « en cours »; on a phone the words
                push the close button onto a second line. */}
            {run && !finished && (
              <span className="max-sm:hidden">en cours</span>
            )}
          </Badge>
          <DialogTitle className="sr-only">{title}</DialogTitle>

          {hasSheet && (
            <CourseSheetDrawer
              courseId={courseId}
              open={sheetOpen}
              onOpenChange={setSheetOpen}
            >
              <Button variant="outline" size="sm" className="shrink-0">
                <BookOpenIcon data-icon="inline-start" />
                <span className="max-sm:hidden">Voir le cours</span>
              </Button>
            </CourseSheetDrawer>
          )}

          {run && (
            <div className="flex min-w-28 flex-1 items-center gap-3 sm:min-w-40">
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
            speechLocale={speechLocale}
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
                      ref={cardRef}
                      courseId={courseId}
                      word={current.word}
                      front={current.front}
                      flipped={run.flipped}
                      romanization={romanization}
                      speechLocale={speechLocale}
                      onFlip={flip}
                      className="min-h-56 flex-1"
                    />

                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="lg"
                        className="h-11 flex-1 sm:h-9 sm:flex-none"
                        onClick={() => answer("unknown")}
                      >
                        <XIcon data-icon="inline-start" />À revoir
                      </Button>
                      {speechLocale && (
                        <Button
                          variant="outline"
                          size="lg"
                          className="h-11 w-11 sm:h-9 sm:w-auto"
                          aria-label="Écouter la prononciation"
                          onClick={() => speak(current.word.front)}
                        >
                          <Volume2Icon />
                        </Button>
                      )}
                      <Button
                        size="lg"
                        className="h-11 flex-1 sm:h-9 sm:flex-none"
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
                        showAudio={Boolean(speechLocale)}
                      />
                      <Toggle
                        id="series-romanization"
                        label="Prononciation"
                        checked={romanization}
                        onChange={(checked) =>
                          update({ romanization: checked })
                        }
                      />
                      {speechLocale && (
                        <Toggle
                          id="series-autoplay"
                          label="Audio auto"
                          checked={autoplay}
                          onChange={(checked) => update({ autoplay: checked })}
                        />
                      )}
                    </div>

                    {/* Keyboard-only: on a phone the shortcuts have nothing
                        to press, and the line eats a card's worth of height. */}
                    <p className="hidden text-center text-xs text-muted-foreground sm:block">
                      Espace : retourner · ← : à revoir · → : acquis
                      {speechLocale && " · S : écouter"} · Retour arrière :
                      carte précédente
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
                        <span className="truncate text-sm">{word.front}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {word.back}
                        </span>
                      </div>
                      {speechLocale && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Écouter ${word.front}`}
                          onClick={() => speak(word.front)}
                        >
                          <Volume2Icon />
                        </Button>
                      )}
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
  showAudio,
}: {
  value: FrontSide
  onChange: (frontSide: FrontSide) => void
  /** `false` for a course with no spoken language — nothing to listen to. */
  showAudio: boolean
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
      // Segmented items never shrink, so a narrow screen scrolls the group
      // itself rather than pushing the layout past the viewport.
      className="max-w-full overflow-x-auto"
    >
      <ToggleGroupItem value="front">Recto</ToggleGroupItem>
      <ToggleGroupItem value="back">Verso</ToggleGroupItem>
      <ToggleGroupItem value="random">Aléatoire</ToggleGroupItem>
      {showAudio && <ToggleGroupItem value="audio">Écoute</ToggleGroupItem>}
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
  speechLocale,
  onChange,
  onStart,
}: {
  settings: Settings
  source: DeckSource
  pools: Record<DeckSource, Card[]>
  /** BCP-47 locale of the course's spoken language, or `null` for none. */
  speechLocale: string | null
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
            showAudio={Boolean(speechLocale)}
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
            className="max-w-full overflow-x-auto"
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
              className="max-w-full overflow-x-auto"
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
            label="Afficher l'indice phonétique"
            checked={settings.romanization}
            onChange={(checked) => onChange({ romanization: checked })}
          />
          {speechLocale && (
            <Toggle
              id="setup-autoplay"
              label="Lire le recto automatiquement"
              checked={settings.autoplay}
              onChange={(checked) => onChange({ autoplay: checked })}
            />
          )}
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
  failed: Card[]
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
