import { HIGHLIGHT_MARK_CLASS } from "@/lib/colors"
import { parseRichText } from "@/lib/rich-text"
import { cn } from "@/lib/utils"

/** Renders a word's front/back/note, resolving its `**bold**`/`==color:...==` markup. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {parseRichText(text).map((segment, index) => (
        <span
          key={index}
          className={cn(
            segment.bold && "font-bold",
            segment.highlight &&
              cn("rounded px-0.5", HIGHLIGHT_MARK_CLASS[segment.highlight])
          )}
        >
          {segment.text}
        </span>
      ))}
    </>
  )
}
