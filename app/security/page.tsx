import { redirect } from "next/navigation";

/** `/security` is an alias for the gate console. */
export default function SecurityIndexPage() {
  redirect("/security/dashboard");
}
