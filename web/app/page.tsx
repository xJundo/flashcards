import { CourseList } from "@/components/course-list"
import { currentUser } from "@/lib/session"
import { listCourses } from "@/lib/store"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const user = await currentUser()
  const courses = await listCourses(user?.id)
  return <CourseList courses={courses} signedIn={Boolean(user)} />
}
