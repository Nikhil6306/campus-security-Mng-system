import { redirect } from "next/navigation";

export default function GuardDashboardPage() {
  redirect("/security/dashboard");
}
