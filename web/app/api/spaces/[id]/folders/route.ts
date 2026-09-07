import { NextResponse } from "next/server"

import { getSpace, listAllFolders } from "@/lib/store"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/** The whole folder tree of a space, flat — used to build the "move to…" picker. */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const space = await getSpace(id)
  if (!space)
    return NextResponse.json({ error: "Espace introuvable." }, { status: 404 })
  return NextResponse.json(await listAllFolders(space.id))
}
