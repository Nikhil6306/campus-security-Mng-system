import type { Metadata } from "next";

import { LoginScreen } from "@/components/admin/login-screen";

export const metadata: Metadata = {
  title: "Security Guard Login",
  description: "Sign in to the campus security gate operations and patrol console.",
  robots: { index: false, follow: false },
};

/** Security Guard Portal — only authorized security personnel can log in here. */
export default function SecurityLoginPage() {
  return (
    <LoginScreen
      expectedRole="security"
      title="Security Guard Login"
      subtitle="Gate operations console — verification, check-in, check-out and patrol dispatch."
    />
  );
}
