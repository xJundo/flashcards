import Link from "next/link"

import { ThemeToggle } from "@/components/theme-toggle"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span aria-hidden className="text-lg">
            한
          </span>
          Flashcards coréen
        </Link>
        <ThemeToggle />
      </div>
    </header>
  )
}
