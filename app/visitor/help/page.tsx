import { redirect } from "next/navigation";

/** Visitor help now lives in the visitor guide. */
export default function LegacyVisitorHelpPage() {
  redirect("/visitor-guide");
}
