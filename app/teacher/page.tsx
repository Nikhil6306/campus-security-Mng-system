import { redirect } from "next/navigation";

/** The portal's entry point is the dashboard. */
export default function TeacherIndexPage() {
  redirect("/teacher/dashboard");
}
