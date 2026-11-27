import { notFound } from "next/navigation";
import { DEMO_PAGES_ENABLED } from "@/shared/config";
import { DemoTournamentPage } from "@/pages/demo-tournament";

export const metadata = {
  title: "Пример турнира · Phygital Core",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  if (!DEMO_PAGES_ENABLED) notFound();
  const { id } = await searchParams;
  return <DemoTournamentPage id={typeof id === "string" ? id : undefined} />;
}
