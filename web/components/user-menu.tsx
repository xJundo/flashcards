"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChartColumnIcon, LogOutIcon, UserIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut } from "@/lib/auth-client"
import type { Author } from "@/lib/types"

export function UserMenu({ user }: { user: Author | null }) {
  const router = useRouter()

  if (!user) {
    return (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" render={<Link href="/connexion" />}>
          Connexion
        </Button>
        <Button size="sm" render={<Link href="/inscription" />}>
          S&apos;inscrire
        </Button>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm">
            <UserIcon data-icon="inline-start" />
            {user.name}
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {/* The group is not decoration: `DropdownMenuLabel` is Base UI's
            `Menu.GroupLabel`, which throws outside one — it is what the group
            takes its accessible name from. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            render={
              <Link href="/stats">
                <ChartColumnIcon data-icon="inline-start" />
                Ma progression
              </Link>
            }
          />
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={async () => {
              await signOut()
              router.push("/")
              router.refresh()
            }}
          >
            <LogOutIcon data-icon="inline-start" />
            Se déconnecter
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
