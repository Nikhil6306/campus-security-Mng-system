import type { Metadata } from "next";

import { LoginScreen } from "@/components/admin/login-screen";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to the Campus Security Management System — admin, security, staff and student access.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <LoginScreen />;
}
