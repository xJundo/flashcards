import { notFound } from "next/navigation"

import { Breadcrumbs } from "@/components/breadcrumbs"
import { CourseList } from "@/components/course-list"
import { FolderBrowser } from "@/components/folder-browser"
import { currentUser } from "@/lib/session"
import {
  getBreadcrumb,
  getFolder,
  getSpace,
  listCourses,
  listFolderContents,
} from "@/lib/store"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ slug: string; folderId: string }> }

export async function generateMetadata({ params }: Props) {
  const { folderId } = await params
  const folder = await getFolder(folderId)
  return {
    title: folder ? `${folder.title} — Flashcards` : "Dossier introuvable",
  }
}

export default async function FolderPage({ params }: Props) {
  const { slug, folderId } = await params
  const [space, folder] = await Promise.all([
    getSpace(slug),
    getFolder(folderId),
  ])
  if (!space || !folder || folder.spaceId !== space.id) notFound()

  const user = await currentUser()
  const [breadcrumb, subfolders, courses] = await Promise.all([
    getBreadcrumb(space, folder.id),
    listFolderContents(space.id, folder.id),
    listCourses(user?.id, { spaceId: space.id, folderId: folder.id }),
  ])

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={breadcrumb} />
        <h1 className="text-2xl font-semibold tracking-tight">
          {folder.title}
        </h1>
      </div>

      <FolderBrowser
        spaceId={space.id}
        spaceSlug={space.slug}
        parentId={folder.id}
        folders={subfolders}
        signedIn={Boolean(user)}
      />

      <CourseList
        courses={courses}
        signedIn={Boolean(user)}
        spaceId={space.id}
        folderId={folder.id}
      />
    </div>
  )
}
