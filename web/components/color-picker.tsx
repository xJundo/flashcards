"use client"

import { CheckIcon } from "lucide-react"

import { COLOR_KEYS, COLOR_SWATCH, type ColorKey } from "@/lib/colors"
import { FieldLabel } from "@/components/ui/field"
import { cn } from "@/lib/utils"

export function ColorPicker({
  value,
  onChange,
}: {
  value: ColorKey | null
  onChange: (color: ColorKey | null) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel>Couleur</FieldLabel>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-label="Aucune couleur"
          onClick={() => onChange(null)}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed text-muted-foreground transition-transform hover:scale-110",
            value === null && "ring-2 ring-ring ring-offset-2 ring-offset-background"
          )}
        >
          {value === null && <CheckIcon className="size-3.5" />}
        </button>
        {COLOR_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-label={key}
            onClick={() => onChange(key)}
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110",
              COLOR_SWATCH[key],
              value === key && "ring-2 ring-ring ring-offset-2 ring-offset-background"
            )}
          >
            {value === key && (
              <CheckIcon className="size-3.5 text-white mix-blend-difference" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
