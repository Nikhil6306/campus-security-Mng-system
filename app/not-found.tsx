import Link from "next/link";
import { ArrowLeft, CalendarCheck, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/shared/logo";
import { BOOK_PATH, STATUS_PATH, UNIVERSITY } from "@/lib/dsvv";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-16 text-center">
      <LogoMark size="xl" />

      <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Error 404
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Page not found</h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        The page you are looking for does not exist or may have moved. Use one of the links below
        to continue.
      </p>

      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={BOOK_PATH}>
            <CalendarCheck className="h-4 w-4" />
            Pre-Book a Visit
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={STATUS_PATH}>
            <Search className="h-4 w-4" />
            Check Booking Status
          </Link>
        </Button>
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        {UNIVERSITY.name} · {UNIVERSITY.portalName}
      </p>
    </div>
  );
}
