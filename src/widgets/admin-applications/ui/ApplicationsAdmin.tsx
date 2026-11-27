"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { usePlatformStore } from "@/entities/platform";
import { useAuth } from "@/entities/user";
import {
  usePartnerTournaments,
  partnerTournamentService,
  isPartnerApplicationId,
} from "@/entities/tournament";
import { AdminPageHeader } from "@/shared/ui/SectionHeader";
import { Badge } from "@/shared/ui/Badge";
import { DataTable } from "@/shared/ui/DataTable";

import { useAction } from "@/shared/hooks";
import { ActionError } from "@/shared/ui/ActionError";
import { AdminFilters } from "@/features/filter-admin-data";
import { statusText } from "@/entities/tournament-application";
import { statusTone } from "@/entities/tournament-application";
import { ApplicationPanel } from "@/entities/tournament-application";
export function ApplicationsAdmin() {
  const store = usePlatformStore(),
    { busy, error, run } = useAction();
  const { user } = useAuth();
  const local = usePartnerTournaments();
  const allApplications = [...store.state.tournamentApplications, ...local.applications];
  const tournaments = [...store.state.tournaments, ...local.tournaments];
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("ALL"),
    [selected, setSelected] = useState<(typeof store.state.tournamentApplications)[number] | null>(
      null,
    );
  const applications = allApplications.filter((item) => {
    const team = store.state.teams.find((value) => value.id === item.teamId)?.name ?? "";
    const tournament = tournaments.find((value) => value.id === item.tournamentId)?.name ?? "";
    return (
      (status === "ALL" || item.status === status) &&
      `${team} ${tournament} ${item.captainName}`.toLowerCase().includes(search.toLowerCase())
    );
  });
  return (
    <>
      <AdminPageHeader
        title="ЗАЯВКИ НА ТУРНИРЫ"
        description="Просмотр и обработка заявок команд."
      />
      <AdminFilters
        search={search}
        setSearch={setSearch}
        status={status}
        setStatus={setStatus}
        onReset={() => {
          setSearch("");
          setStatus("ALL");
        }}
      />
      <DataTable
        headers={["Команда", "Капитан", "Турнир", "Дата", "Статус", "Просмотр"]}
        rows={applications.map((item) => [
          store.state.teams.find((team) => team.id === item.teamId)?.name ?? "—",
          item.captainName,
          tournaments.find((tournament) => tournament.id === item.tournamentId)?.name ?? "—",
          item.createdAt,
          <Badge key="s" tone={statusTone[item.status]}>
            {statusText[item.status]}
          </Badge>,
          <button
            key="v"
            className="icon-button"
            onClick={() => setSelected(item)}
            aria-label="Просмотреть"
          >
            <Eye />
          </button>,
        ])}
      />
      <ActionError message={error} />
      <ActionError message={local.error ?? ""} />
      {selected && (
        <ApplicationPanel
          title="Заявка на турнир"
          body={
            <>
              <h3>{store.state.teams.find((team) => team.id === selected.teamId)?.name}</h3>
              <p>Капитан: {selected.captainName}</p>
              <p>{selected.additionalInfo || "Дополнительная информация не указана"}</p>
              <Badge
                tone={
                  statusTone[
                    allApplications.find((item) => item.id === selected.id)?.status ??
                      selected.status
                  ]
                }
              >
                {
                  statusText[
                    allApplications.find((item) => item.id === selected.id)?.status ??
                      selected.status
                  ]
                }
              </Badge>
            </>
          }
          close={() => setSelected(null)}
          approve={() =>
            void run(
              "approve",
              () =>
                isPartnerApplicationId(selected.id)
                  ? partnerTournamentService
                      .updateApplicationStatus(selected.id, "APPROVED", user)
                      .then(() => {})
                  : store.updateTournamentApplication(selected.id, "APPROVED"),
              "Заявка одобрена",
            )
          }
          reject={() =>
            void run(
              "reject",
              () =>
                isPartnerApplicationId(selected.id)
                  ? partnerTournamentService
                      .updateApplicationStatus(selected.id, "REJECTED", user)
                      .then(() => {})
                  : store.updateTournamentApplication(selected.id, "REJECTED"),
              "Заявка отклонена",
            )
          }
          busy={Boolean(busy)}
        />
      )}
    </>
  );
}
