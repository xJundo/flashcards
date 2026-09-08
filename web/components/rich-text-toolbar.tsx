"use client"

import * as React from "react"
import { BoldIcon, HighlighterIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { HIGHLIGHT_KEYS, HIGHLIGHT_SWATCH } from "@/lib/colors"
import { applyMarker } from "@/lib/rich-text"
import { cn } from "@/lib/utils"

/**
 * Bold + highlight controls for a word's front/back/note. Operates on the
 * current text selection of the given input, the same way a markdown
 * toolbar wraps selected text — no WYSIWYG editing, the field stays a plain
 * `**bold**` / `==color:text==` string underneath.
 */
export function RichTextToolbar({
  inputRef,
  value,
  onChange,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  value: string
  onChange: (value: string) => void
}) {
  function apply(kind: Parameters<typeof applyMarker>[3]) {
    const input = inputRef.current
    if (!input) return
    const start = input.selectionStart ?? value.length
    const end = input.selectionEnd ?? value.length
    const result = applyMarker(value, start, end, kind)
    onChange(result.value)
    // The value prop update re-renders before this runs, but the DOM value
    // hasn't caught up yet on the next tick without it — focus first, then
    // restore the selection once React has flushed the new value.
    requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(result.start, result.end)
    })
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Gras"
        onClick={() => apply("bold")}
      >
        <BoldIcon />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Surligner"
            >
              <HighlighterIcon />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="flex w-auto gap-1.5 p-1.5">
          {HIGHLIGHT_KEYS.map((key) => (
            <DropdownMenuItem
              key={key}
              aria-label={key}
              onClick={() => apply(key)}
              className={cn(
                "size-6 shrink-0 justify-center rounded-full p-0 transition-transform hover:scale-110",
                HIGHLIGHT_SWATCH[key]
              )}
            />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
