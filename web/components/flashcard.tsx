"use client"

import { Volume2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { FrontSide, Word } from "@/lib/types"

/** The side a card actually shows, once `random` has been resolved. */
export type Side = Exclude<FrontSide, "random">

const FACE_LABEL: Record<Side, string> = {
  korean: "한국어",
  translation: "Français",
  audio: "Écoute",
}

/** An `audio` front hides the word, so its back is the Korean side too. */
function backOf(front: Side): Side {
  return front === "korean" ? "translation" : "korean"
}

/** The flip card itself: one button, two faces, no state of its own. */
export function Flashcard({
  word,
  front,
  flipped,
  romanization,
  onFlip,
  className,
}: {
  word: Word
  front: Side
  flipped: boolean
  romanization: boolean
  onFlip: () => void
  className?: string
}) {
  return (
    <div className={cn("[perspective:1200px]", className)}>
      <button
        type="button"
        onClick={onFlip}
        aria-label={flipped ? "Voir le recto" : "Voir le verso"}
        className={cn(
          "relative block h-full w-full rounded-xl transition-transform duration-500 [transform-style:preserve-3d] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          flipped && "[transform:rotateY(180deg)]"
        )}
      >
        <CardFace
          word={word}
          side={front}
          romanization={romanization}
          hint={
            front === "audio"
              ? "S pour réécouter · Espace pour retourner"
              : "Clique ou Espace pour retourner"
          }
        />
        <CardFace
          word={word}
          side={backOf(front)}
          romanization={romanization}
          // Nothing was shown on an `audio` prompt, so the reveal carries the
          // meaning as well as the word.
          translation={front === "audio"}
          // The note is the answer to the prompt, so it only belongs on the
          // flipped face.
          note
          hint="← à revoir · acquis →"
          className="[transform:rotateY(180deg)]"
        />
      </button>
    </div>
  )
}

function CardFace({
  word,
  side,
  romanization,
  translation = false,
  note = false,
  hint,
  className,
}: {
  word: Word
  side: Side
  romanization: boolean
  /** Adds the French meaning under a Korean face. */
  translation?: boolean
  /** Shows the additional note — only on the flipped face. */
  note?: boolean
  hint: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto rounded-xl border bg-card p-6 text-card-foreground shadow-sm [backface-visibility:hidden]",
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
            side === "korean"
              ? "text-4xl sm:text-5xl lg:text-6xl"
              : "text-2xl sm:text-3xl lg:text-4xl"
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
      {note && word.note && (
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
