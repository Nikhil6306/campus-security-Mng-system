import { redirect } from "next/navigation";

export default function GuardIndexPage() {
  redirect("/security/dashboard");
}
