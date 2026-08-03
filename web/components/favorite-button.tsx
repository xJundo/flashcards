"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { StarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

/**
 * The bookmark, as a toggle. The star flips before the round trip: a shortlist
 * is the learner's own business, and nothing downstream depends on it being
 * right this instant — a failure puts it back and says so.
 */
export function FavoriteButton({
  courseId,
  favorite,
  title,
  labelled = false,
  className,
}: {
  courseId: string
  favorite: boolean
  /** The lesson's name, for the label a screen reader reads out. */
  title: string
  /** Spell the action out next to the star, for the lesson's own page. */
  labelled?: boolean
  className?: string
}) {
  const router = useRouter()
  // The star holds its new state until the refreshed page comes back with the
  // server's answer, then defers to it — including when the same lesson is
  // starred from the other place it appears on screen.
  const [on, setOn] = React.useOptimistic(favorite)
  const [, startTransition] = React.useTransition()

  function toggle() {
    const next = !on
    startTransition(async () => {
      setOn(next)
      try {
        await api(`/api/courses/${courseId}/favorite`, {
          method: next ? "PUT" : "DELETE",
        })
        router.refresh()
      } catch (error) {
        toast.add({
          title: next ? "Ajout en favori impossible" : "Retrait impossible",
          description: error instanceof Error ? error.message : undefined,
          type: "error",
        })
      }
    })
  }

  const label = on
    ? `Retirer « ${title} » des favoris`
    : `Mettre « ${title} » en favori`

  return (
    <Button
      variant={labelled ? "outline" : "ghost"}
      size={labelled ? undefined : "icon-sm"}
      aria-pressed={on}
      aria-label={labelled ? undefined : label}
      title={labelled ? undefined : label}
      onClick={toggle}
      className={className}
    >
      <StarIcon
        data-icon={labelled ? "inline-start" : undefined}
        className={cn(on && "fill-warning text-warning")}
      />
      {labelled && (on ? "En favori" : "Mettre en favori")}
    </Button>
  )
}
