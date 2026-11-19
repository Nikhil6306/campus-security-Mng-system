import type { Metadata } from "next";

import { LoginScreen } from "@/components/admin/login-screen";

export const metadata: Metadata = {
  title: "Administrator Login | Dev Sanskriti Vishwavidyalaya",
  description: "Executive Administrator access for Campus Security Directors and University Authorities.",
  robots: { index: false, follow: false },
};

export default function AdministratorLoginPage() {
  return (
    <LoginScreen
      expectedRole="super_admin"
      title="Administrator Login"
      subtitle="Master executive console for Campus Security Directors and University Administrators."
    />
  );
}
