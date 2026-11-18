import { redirect } from "next/navigation";

/**
 * Administrator portal index — redirects to the admin dashboard.
 * Unauthenticated users are routed to /admin/login by middleware / shell.
 */
export default function AdminPage() {
  redirect("/admin/dashboard");
}
