import Link from "next/link"
import { ChevronRightIcon, HomeIcon } from "lucide-react"

import type { Breadcrumb } from "@/lib/types"

/** The trail back to the home page, through the space and any folders. */
export function Breadcrumbs({ items }: { items: Breadcrumb[] }) {
  return (
    <nav
      aria-label="Fil d'Ariane"
      className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
    >
      <Link
        href="/"
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-accent hover:text-foreground"
        aria-label="Accueil"
      >
        <HomeIcon className="size-3.5" />
      </Link>
      {items.map((item, index) => {
        const last = index === items.length - 1
        return (
          <span key={item.id} className="flex items-center gap-1">
            <ChevronRightIcon className="size-3.5 shrink-0" />
            {last ? (
              <span className="truncate px-1.5 py-0.5 text-foreground">
                {item.title}
              </span>
            ) : (
              <Link
                href={item.href}
                className="truncate rounded-md px-1.5 py-0.5 hover:bg-accent hover:text-foreground"
              >
                {item.title}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
