import { redirect } from "next/navigation";

import { BOOK_PATH } from "@/lib/dsvv";

/** Superseded by `/pre-book-visit`; kept so existing links keep working. */
export default function LegacyBookVisitPage() {
  redirect(BOOK_PATH);
}
