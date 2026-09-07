"use client"

import type * as React from "react"
import { Volume2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Card, FrontSide } from "@/lib/types"

/** The side a card actually shows, once `random` has been resolved. */
export type Side = Exclude<FrontSide, "random">

const FACE_LABEL: Record<Side, string> = {
  front: "Recto",
  back: "Verso",
  audio: "Écoute",
}

/** An `audio` front hides the word, so its back is the other face too. */
function backOf(front: Side): Side {
  return front === "front" ? "back" : "front"
}

/** The flip card itself: one button, two faces, no state of its own. */
export function Flashcard({
  ref,
  courseId,
  word,
  front,
  flipped,
  romanization,
  speechLocale,
  onFlip,
  className,
}: {
  /** The session anchors focus here, so a keystroke always reaches the card. */
  ref?: React.Ref<HTMLButtonElement>
  /** Needed to build an uploaded face's image URL. */
  courseId: string
  word: Card
  front: Side
  flipped: boolean
  romanization: boolean
  /** BCP-47 locale of the front face's language, or `null` for no spoken hint. */
  speechLocale?: string | null
  onFlip: () => void
  className?: string
}) {
  return (
    <div className={cn("[perspective:1200px]", className)}>
      <button
        ref={ref}
        type="button"
        onClick={onFlip}
        aria-label={flipped ? "Voir le recto" : "Voir le verso"}
        className={cn(
          "relative block h-full w-full rounded-xl transition-transform duration-500 [transform-style:preserve-3d] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          flipped && "[transform:rotateY(180deg)]"
        )}
      >
        <CardFace
          courseId={courseId}
          word={word}
          side={front}
          romanization={romanization}
          speechLocale={speechLocale}
          hint={
            <>
              {/* A phone has no Espace and nothing to click. */}
              <span className="sm:hidden">
                Touche la carte pour la retourner
              </span>
              <span className="max-sm:hidden">
                {front === "audio"
                  ? "S pour réécouter · Espace pour retourner"
                  : "Clique ou Espace pour retourner"}
              </span>
            </>
          }
        />
        <CardFace
          courseId={courseId}
          word={word}
          side={backOf(front)}
          romanization={romanization}
          speechLocale={speechLocale}
          // Nothing was shown on an `audio` prompt, so the reveal carries the
          // meaning as well as the word.
          reveal={front === "audio"}
          // The note is the answer to the prompt, so it only belongs on the
          // flipped face.
          note
          hint={<span className="max-sm:hidden">← à revoir · acquis →</span>}
          className="[transform:rotateY(180deg)]"
        />
      </button>
    </div>
  )
}

function CardFace({
  courseId,
  word,
  side,
  romanization,
  speechLocale,
  reveal = false,
  note = false,
  hint,
  className,
}: {
  courseId: string
  word: Card
  side: Side
  romanization: boolean
  speechLocale?: string | null
  /** Adds the other face's text underneath, on an `audio` prompt's reveal. */
  reveal?: boolean
  /** Shows the additional note — only on the flipped face. */
  note?: boolean
  hint: React.ReactNode
  className?: string
}) {
  const text = side === "front" ? word.front : word.back
  const image = side === "front" ? word.frontImage : word.backImage

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
        <>
          {image && (
            // Served from our own API, not an optimizable static asset.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/courses/${courseId}/words/${word.id}/image/${side}`}
              alt=""
              className="max-h-40 max-w-full rounded-lg object-contain sm:max-h-56"
            />
          )}
          {text && (
            <p
              className={cn(
                "text-center font-semibold text-balance",
                image
                  ? "text-lg sm:text-xl"
                  : side === "front"
                    ? "text-4xl sm:text-5xl lg:text-6xl"
                    : "text-2xl sm:text-3xl lg:text-4xl"
              )}
              lang={side === "front" ? (speechLocale ?? undefined) : undefined}
            >
              {text}
            </p>
          )}
          {!text && !image && (
            <p className="text-center text-4xl font-semibold text-muted-foreground">
              —
            </p>
          )}
        </>
      )}
      {side !== "back" && romanization && word.phonetic && (
        <p className="text-center text-muted-foreground">{word.phonetic}</p>
      )}
      {reveal && side === "front" && word.back && (
        <p className="text-center text-muted-foreground">{word.back}</p>
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
