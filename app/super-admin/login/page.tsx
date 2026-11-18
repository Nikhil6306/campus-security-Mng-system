import type { Metadata } from "next";

import { LoginScreen } from "@/components/admin/login-screen";

export const metadata: Metadata = {
  title: "Super Admin Login",
  description: "Sign in to the campus security master oversight console.",
  robots: { index: false, follow: false },
};

/** Super Administrator portal — only users with super_admin database role can sign in here. */
export default function SuperAdminLoginPage() {
  return (
    <LoginScreen
      expectedRole="super_admin"
      title="Super Admin Login"
      subtitle="Master oversight console for Campus Security Directors and Super Administrators."
    />
  );
}
