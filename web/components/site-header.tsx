import Link from "next/link"

import { ThemeToggle } from "@/components/theme-toggle"
import { UserMenu } from "@/components/user-menu"
import { currentUser } from "@/lib/session"

export async function SiteHeader() {
  const user = await currentUser()

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold"
        >
          <span aria-hidden className="text-lg">
            한
          </span>
          {/* The full name wraps to a second line next to the auth buttons on a
              phone, so the qualifier only appears once there is room. */}
          <span className="whitespace-nowrap">
            Flashcards<span className="hidden sm:inline"> coréen</span>
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  )
}
