import type { Metadata } from "next";

import { SecurityShell } from "@/components/security/security-shell";

export const metadata: Metadata = {
  title: "Security Desk",
  description: "Gate operations console — verify visitor passes, record entry and exit.",
  robots: { index: false, follow: false },
};

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return <SecurityShell>{children}</SecurityShell>;
}
