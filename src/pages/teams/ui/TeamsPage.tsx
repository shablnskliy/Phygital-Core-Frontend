"use client";
import { Suspense } from "react";

import { PageHeader } from "@/widgets/page-header";

import { TeamsPageContent } from "@/widgets/teams";
export function TeamsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Соберите состав. Найдите своих."
        title="Команды"
        description="Выходите на арену вместе. Создавайте команды и приглашайте игроков."
        variant="teams"
      />
      <Suspense fallback={<p role="status">Загружаем команды…</p>}>
        <TeamsPageContent />
      </Suspense>
    </>
  );
}
