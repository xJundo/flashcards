import { NextResponse } from "next/server"

import { getCourseForExport } from "@/lib/store"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/**
 * Downloads the lesson exactly as stored on disk — card images included, as
 * embedded `data:image/...;base64,...` URLs, so re-importing this same file
 * restores them too.
 */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const course = await getCourseForExport(id)
  if (!course)
    return NextResponse.json({ error: "Cours introuvable." }, { status: 404 })

  const slug =
    course.title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "cours"

  return new NextResponse(`${JSON.stringify(course, null, 2)}\n`, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${course.date}-${slug}.json"`,
    },
  })
}
