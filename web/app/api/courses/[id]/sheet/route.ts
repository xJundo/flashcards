import { NextResponse } from "next/server"

import { requireWriteAccess } from "@/lib/guard"
import {
  deleteCourseSheet,
  getCourse,
  getCourseSheet,
  saveCourseSheet,
} from "@/lib/store"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

const MAX_SIZE = 20 * 1024 * 1024
const PDF_MAGIC = Buffer.from("%PDF")

/** Public: reading a lesson's sheet needs no account, same as the lesson itself. */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const sheet = await getCourseSheet(id)
  if (!sheet)
    return NextResponse.json(
      { error: "Aucune fiche pour ce cours." },
      { status: 404 }
    )

  return new NextResponse(new Uint8Array(sheet.data), {
    headers: {
      "content-type": "application/pdf",
      "content-length": String(sheet.size),
      // `inline`, so it renders in a viewer; a plain download link can still
      // force a save with the `download` attribute regardless of this header.
      "content-disposition": `inline; filename="${encodeURIComponent(sheet.filename)}"`,
    },
  })
}

/** Replaces whatever sheet the lesson already had — there is only ever one. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const access = await requireWriteAccess(id)
  if ("denied" in access) return access.denied

  const course = await getCourse(id)
  if (!course)
    return NextResponse.json({ error: "Cours introuvable." }, { status: 404 })

  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File))
    return NextResponse.json(
      { error: "Fournis un fichier PDF sous le champ `file`." },
      { status: 400 }
    )
  if (file.size > MAX_SIZE)
    return NextResponse.json(
      { error: "Le PDF dépasse la taille maximale (20 Mo)." },
      { status: 413 }
    )

  const data = Buffer.from(await file.arrayBuffer())
  if (!data.subarray(0, 4).equals(PDF_MAGIC))
    return NextResponse.json(
      { error: "Le fichier fourni n'est pas un PDF." },
      { status: 400 }
    )

  await saveCourseSheet(id, {
    filename: file.name || "fiche.pdf",
    data,
    size: data.byteLength,
  })
  return NextResponse.json({ ok: true, size: data.byteLength })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const access = await requireWriteAccess(id)
  if ("denied" in access) return access.denied

  await deleteCourseSheet(id)
  return NextResponse.json({ ok: true })
}
