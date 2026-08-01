import { NextResponse } from "next/server"

import { requireWriteAccess } from "@/lib/guard"
import { normalizeDate } from "@/lib/normalize"
import { deleteCourse, getCourse, updateCourse } from "@/lib/store"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const course = await getCourse(id)
  if (!course)
    return NextResponse.json({ error: "Cours introuvable." }, { status: 404 })
  return NextResponse.json(course)
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const access = await requireWriteAccess(id)
  if ("denied" in access) return access.denied

  const body = (await request.json().catch(() => ({}))) as {
    title?: string
    date?: string
  }

  const course = await updateCourse(id, (current) => ({
    ...current,
    title: body.title?.trim() || current.title,
    date: body.date ? normalizeDate(body.date) : current.date,
  }))
  if (!course)
    return NextResponse.json({ error: "Cours introuvable." }, { status: 404 })
  return NextResponse.json(course)
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const access = await requireWriteAccess(id)
  if ("denied" in access) return access.denied

  const deleted = await deleteCourse(id)
  if (!deleted)
    return NextResponse.json({ error: "Cours introuvable." }, { status: 404 })
  return NextResponse.json({ ok: true })
}
