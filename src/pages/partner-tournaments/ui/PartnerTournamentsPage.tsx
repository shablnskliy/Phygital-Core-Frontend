"use client";

import { PageHeader } from "@/widgets/page-header";
import { TournamentsPageContent } from "@/widgets/tournaments";

export function PartnerTournamentsPage() {
  return (
    <>
      <PageHeader
        eyebrow="СОБЫТИЯ ПАРТНЕРОВ"
        title="ОТ ПАРТНЕРОВ"
        description=""
        variant="tournaments"
      />
      <TournamentsPageContent partner />
    </>
  );
}
