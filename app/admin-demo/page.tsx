import { notFound } from "next/navigation";
import { DEMO_PAGES_ENABLED } from "@/shared/config";
import { DemoAdminPage } from "@/pages/demo-admin";

export const metadata = {
  title: "Демо-админка · Phygital Core",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (!DEMO_PAGES_ENABLED) notFound();
  return <DemoAdminPage />;
}
