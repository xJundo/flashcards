import { CourseList } from "@/components/course-list"
import { listCourses } from "@/lib/store"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const courses = await listCourses()
  return <CourseList courses={courses} />
}
