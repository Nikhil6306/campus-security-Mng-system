import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { VisitorPassView } from "@/components/visitor/visitor-pass";
import { InlineLoader } from "@/components/shared/states";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Visitor Pass ${decodeURIComponent(id)}`,
    description: "Digital campus visitor pass — present this at the security gate.",
    robots: { index: false, follow: false },
  };
}

export default async function VisitorPassPage({ params }: PageProps) {
  const { id } = await params;
  const bookingId = decodeURIComponent(id);

  return (
    <div className="border-b border-border bg-muted/30 py-8 sm:py-12">
      <div className="container">
        <nav aria-label="Breadcrumb" className="no-print mb-6">
          <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <li>
              <Link href="/" className="transition-colors hover:text-foreground">
                Home
              </Link>
            </li>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <li className="font-medium text-foreground" aria-current="page">
              Visitor Pass
            </li>
          </ol>
        </nav>

        <div className="no-print mx-auto mb-8 max-w-lg space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Your Visitor Pass</h1>
          <p className="text-sm text-muted-foreground">
            Show this pass at the gate, or print it and carry a copy with your photo ID.
          </p>
        </div>

        <Suspense fallback={<InlineLoader label="Loading visitor pass…" />}>
          <VisitorPassView bookingId={bookingId} />
        </Suspense>
      </div>
    </div>
  );
}
