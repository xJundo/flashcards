import { notFound } from "next/navigation"

import { Breadcrumbs } from "@/components/breadcrumbs"
import { CourseList } from "@/components/course-list"
import { FolderBrowser } from "@/components/folder-browser"
import { currentUser } from "@/lib/session"
import { getSpace, listCourses, listFolderContents } from "@/lib/store"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const space = await getSpace(slug)
  return { title: space ? `${space.title} — Flashcards` : "Espace introuvable" }
}

export default async function SpacePage({ params }: Props) {
  const { slug } = await params
  const space = await getSpace(slug)
  if (!space) notFound()

  const user = await currentUser()
  const [folders, courses] = await Promise.all([
    listFolderContents(space.id, null),
    listCourses(user?.id, { spaceId: space.id, folderId: null }),
  ])

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          items={[
            { id: space.id, title: space.title, href: `/spaces/${space.slug}` },
          ]}
        />
        <h1 className="text-2xl font-semibold tracking-tight">{space.title}</h1>
      </div>

      <FolderBrowser
        spaceId={space.id}
        spaceSlug={space.slug}
        parentId={null}
        folders={folders}
        signedIn={Boolean(user)}
      />

      <CourseList
        courses={courses}
        signedIn={Boolean(user)}
        spaceId={space.id}
        folderId={null}
      />
    </div>
  )
}
