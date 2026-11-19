import type { Metadata } from "next";

import { LoginScreen } from "@/components/admin/login-screen";

export const metadata: Metadata = {
  title: "Admin Login | Dev Sanskriti Vishwavidyalaya",
  description: "Sign in to the campus security operations console.",
  robots: { index: false, follow: false },
};

/** Operations Admin portal — the server rejects accounts of any other role here. */
export default function AdminLoginPage() {
  return (
    <LoginScreen
      expectedRole="admin"
      title="Admin Login"
      subtitle="Access the campus security operational dashboard, approvals and reports."
    />
  );
}
