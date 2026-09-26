import { redirect } from "next/navigation";

/** The visitor portal landing page is now the site home page. */
export default function LegacyVisitorPortalPage() {
  redirect("/");
}
