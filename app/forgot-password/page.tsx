import type { Metadata } from "next";

import { ForgotPasswordScreen } from "@/components/auth/forgot-password-screen";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Reset your Campus Security Management System password.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordScreen />;
}
