"use client"

import type * as React from "react"
import { Volume2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { RichText } from "@/components/rich-text"
import { cn } from "@/lib/utils"
import type { Card, FrontSide, TextAlign } from "@/lib/types"

const ALIGN_CLASS: Record<TextAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
  justify: "text-justify",
}

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
  // The recto is always a short word or phrase — it stays centered no
  // matter what alignment the word's back/note are set to.
  const textAlign: TextAlign = side === "front" ? "center" : (word.align ?? "center")
  const noteAlign: TextAlign = word.align ?? "center"

  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm [backface-visibility:hidden]",
        className
      )}
    >
      <div
        // `safe center` falls back to top-alignment once content overflows,
        // so a tall image never gets centered half off-screen, unreachable
        // by scrolling, and hidden behind the badge above it.
        // Chrome/Firefox stop culling the parent's backface once a
        // scrollable descendant exists inside it, so the other face bleeds
        // through (mirrored) mid-flip unless this is hidden too.
        className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto p-6 pt-10 [backface-visibility:hidden] [justify-content:safe_center]"
      >
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
                className="max-h-72 max-w-full rounded-lg object-contain sm:max-h-96 lg:max-h-[28rem]"
              />
            )}
            {text && (
              <p
                className={cn(
                  "w-full font-semibold whitespace-pre-line",
                  ALIGN_CLASS[textAlign],
                  // `text-balance` only makes sense for short, centered text —
                  // a justified or side-aligned paragraph wraps normally.
                  textAlign === "center" && "text-balance",
                  image
                    ? "text-sm sm:text-base"
                    : side === "front"
                      ? "text-4xl sm:text-5xl lg:text-6xl"
                      : textAlign === "center"
                        ? "text-2xl sm:text-3xl lg:text-4xl"
                        : // A long, side-aligned answer reads as a wall of
                          // text at the same size as a short centered one —
                          // keep it close to the image case's small size.
                          "text-base sm:text-lg"
                )}
                lang={side === "front" ? (speechLocale ?? undefined) : undefined}
              >
                <RichText text={text} />
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
          <p className="text-center text-muted-foreground">
            <RichText text={word.back} />
          </p>
        )}
        {note && word.note && (
          <p
            className={cn(
              "w-full text-sm whitespace-pre-line text-muted-foreground",
              // A justified or side-aligned note reads better filling the
              // card's width — a narrower column stretches justified spaces
              // into ugly gaps. Centered notes keep a prose-width column.
              noteAlign === "center" && "max-w-prose",
              ALIGN_CLASS[noteAlign],
              noteAlign === "center" && "text-pretty"
            )}
          >
            <RichText text={word.note} />
          </p>
        )}
      </div>
      {/* After the scrollable content in DOM, not `z-10`, so it paints on
          top without a z-index — which breaks backface culling on a
          flipped 3D element in Chrome/Firefox. */}
      <Badge variant="secondary" className="absolute top-3 left-3">
        {FACE_LABEL[side]}
      </Badge>
      <span className="shrink-0 pb-3 text-center text-xs text-muted-foreground">
        {hint}
      </span>
    </div>
  )
}
