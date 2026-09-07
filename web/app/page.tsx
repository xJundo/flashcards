import { SpaceList } from "@/components/space-list"
import { currentUser } from "@/lib/session"
import { listSpaces } from "@/lib/store"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const user = await currentUser()
  const spaces = await listSpaces()
  return <SpaceList spaces={spaces} signedIn={Boolean(user)} />
}
