"use client"

import { Volume2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useSpeech } from "@/hooks/use-speech"
import { cn } from "@/lib/utils"

type SpeakButtonProps = {
  text: string
  /** BCP-47 locale of the course's spoken language, or `null` for none. */
  speechLocale: string | null
  size?: "icon-sm" | "icon" | "icon-lg"
  variant?: "ghost" | "outline" | "secondary"
  className?: string
}

/** Renders nothing for a course with no spoken-language content. */
export function SpeakButton({
  text,
  speechLocale,
  size = "icon-sm",
  variant = "ghost",
  className,
}: SpeakButtonProps) {
  const { speak, speaking } = useSpeech(speechLocale)
  if (!speechLocale) return null

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={variant}
            size={size}
            className={className}
            disabled={!text.trim()}
            aria-label={`Écouter « ${text} »`}
            onClick={(event) => {
              event.stopPropagation()
              speak(text)
            }}
          >
            <Volume2Icon className={cn(speaking && "animate-pulse")} />
          </Button>
        }
      />
      <TooltipContent>Écouter la prononciation</TooltipContent>
    </Tooltip>
  )
}
