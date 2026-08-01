"use client"

import { Volume2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useKoreanSpeech } from "@/hooks/use-korean-speech"
import { cn } from "@/lib/utils"

type SpeakButtonProps = {
  text: string
  size?: "icon-sm" | "icon" | "icon-lg"
  variant?: "ghost" | "outline" | "secondary"
  className?: string
}

export function SpeakButton({
  text,
  size = "icon-sm",
  variant = "ghost",
  className,
}: SpeakButtonProps) {
  const { speak, speaking } = useKoreanSpeech()

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
      <TooltipContent>Écouter en coréen</TooltipContent>
    </Tooltip>
  )
}
