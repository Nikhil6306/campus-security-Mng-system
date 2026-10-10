import type { Metadata } from "next";

import { LoginScreen } from "@/components/admin/login-screen";

export const metadata: Metadata = {
  title: "Admin Login",
  description: "Sign in to the campus security management console.",
  robots: { index: false, follow: false },
};

/** Administrator portal — the server rejects accounts of any other role here. */
export default function AdminPage() {
  return <LoginScreen expectedRole="admin" />;
}
