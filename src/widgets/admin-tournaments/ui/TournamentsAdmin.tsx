"use client";

import { Button } from "@/shared/ui/Button";
import Link from "next/link";
import { useState } from "react";
import { Eye, FileText, PenLine, Plus, Trash2 } from "lucide-react";
import {
  tournamentStatus,
  type Tournament,
  usePartnerTournaments,
  partnerTournamentService,
  isPartnerTournamentId,
  useTournamentPages,
  getTournamentPageDefaults,
  tournamentPageService,
  type PartnerActor,
  type TournamentPageContent,
} from "@/entities/tournament";
import type { Team } from "@/entities/team";
import type { TournamentApplication } from "@/entities/tournament-application";
import { useAuth } from "@/entities/user";
import { usePlatformStore, type TournamentDraft } from "@/entities/platform";
import { AdminPageHeader } from "@/shared/ui/SectionHeader";
import { Badge } from "@/shared/ui/Badge";
import { DataTable } from "@/shared/ui/DataTable";
import { GlowButton } from "@/shared/ui/Button";

import { useAction } from "@/shared/hooks";
import { ActionError } from "@/shared/ui/ActionError";
import { Confirm } from "@/shared/ui/ConfirmDialog";
import { AdminFilters } from "@/features/filter-admin-data";
import { TournamentForm } from "@/features/manage-tournament";
import { TournamentPageEditor } from "@/features/edit-tournament-page";
export interface TournamentsAdminSandbox {
  store: {
    state: { tournaments: Tournament[]; teams: Team[] };
    createTournament: (draft: TournamentDraft) => Promise<unknown>;
    updateTournament: (id: string, patch: Partial<Tournament>) => Promise<unknown>;
    deleteTournament: (id: string) => Promise<unknown>;
  };
  user: PartnerActor;
  local: { tournaments: Tournament[]; applications: TournamentApplication[]; error: string | null };
  pageContent: { pages: Record<string, TournamentPageContent>; error: string | null };
  partnerService: Pick<
    typeof partnerTournamentService,
    "createTournament" | "updateTournament" | "deleteTournament"
  >;
  savePage: (id: string, content: TournamentPageContent) => Promise<void>;
  saveVenue: (id: string, venue: string) => Promise<void>;
  previewHref?: (id: string) => string;
}

const editorDateTime = (value: string | null | undefined, end = false) =>
  value ? `${value.slice(0, 10)}T${value.slice(11, 16) || (end ? "23:59" : "00:00")}` : "";

function hasCoreChanges(draft: TournamentDraft, current: Tournament) {
  return [
    [draft.name.trim(), current.name.trim()],
    [draft.shortDescription.trim(), current.shortDescription.trim()],
    [(draft.fullDescription ?? "").trim(), current.description.trim()],
    [draft.city.trim(), current.city.trim()],
    [editorDateTime(draft.startAt), editorDateTime(current.startAt)],
    [editorDateTime(draft.endAt, true), editorDateTime(current.endAt, true)],
    [draft.imageName ?? "", current.imageName ?? ""],
    [draft.imageUrl ?? "", current.imageUrl ?? ""],
  ].some(([next, previous]) => next !== previous);
}

export function TournamentsAdmin({ sandbox }: { sandbox?: TournamentsAdminSandbox } = {}) {
  const realStore = usePlatformStore();
  const { busy, error, run } = useAction();
  const auth = useAuth();
  const realLocal = usePartnerTournaments();
  const realPageContent = useTournamentPages();
  const store = sandbox ? sandbox.store : realStore;
  const user = sandbox ? sandbox.user : auth.user;
  const local = sandbox ? sandbox.local : realLocal;
  const pageContent = sandbox ? sandbox.pageContent : realPageContent;
  const partnerService = sandbox ? sandbox.partnerService : partnerTournamentService;
  const tournaments = [...store.state.tournaments, ...local.tournaments];
  const venueFor = (tournament: Tournament) =>
    isPartnerTournamentId(tournament.id)
      ? tournament.venue.trim() || "Площадка уточняется"
      : (pageContent.pages[tournament.id]?.venue ?? getTournamentPageDefaults(tournament).venue);
  const [search, setSearch] = useState(""),
    [city, setCity] = useState("ALL"),
    [date, setDate] = useState(""),
    [create, setCreate] = useState(false),
    [selected, setSelected] = useState<Tournament | null>(null),
    [editing, setEditing] = useState<Tournament | null>(null),
    [pageEditing, setPageEditing] = useState<Tournament | null>(null),
    [confirm, setConfirm] = useState(false);
  const cities = [...new Set(tournaments.map((item) => item.city))],
    filtered = tournaments.filter(
      (item) =>
        item.name.toLowerCase().includes(search.toLowerCase()) &&
        (city === "ALL" || item.city === city) &&
        (!date || item.startAt.slice(0, 10) === date),
    );
  return (
    <>
      <AdminPageHeader
        title="ТУРНИРЫ"
        description="Создание и редактирование турниров; статус рассчитывается по датам. После создания ФИДЖИТАЛ-турнира откройте его и выберите «Страница турнира» для настройки блоков."
        actions={
          <GlowButton onClick={() => setCreate(true)}>
            <Plus /> Создать турнир
          </GlowButton>
        }
      />
      <AdminFilters
        search={search}
        setSearch={setSearch}
        onReset={() => {
          setSearch("");
          setCity("ALL");
          setDate("");
        }}
        extra={
          <>
            <select
              aria-label="Фильтр города"
              value={city}
              onChange={(event) => setCity(event.target.value)}
            >
              <option value="ALL">Все города</option>
              {cities.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <input
              aria-label="Фильтр даты"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </>
        }
      />
      <DataTable
        headers={["Турнир", "Дата", "Город", "Статус", "Действия"]}
        rows={filtered.map((item) => [
          <span key="name">
            {item.name}
            {isPartnerTournamentId(item.id) && (
              <small className="partner-local-label">ОТ ПАРТНЕРОВ · локально</small>
            )}
          </span>,
          new Date(item.startAt).toLocaleString("ru-RU"),
          item.city,
          <Badge
            key="s"
            tone={
              tournamentStatus(item) === "completed"
                ? "red"
                : tournamentStatus(item) === "active"
                  ? "green"
                  : "blue"
            }
          >
            {tournamentStatus(item) === "completed"
              ? "Завершён"
              : tournamentStatus(item) === "active"
                ? "Идёт"
                : "Предстоящий"}
          </Badge>,
          <button
            className="icon-button"
            key="v"
            onClick={() => setSelected(item)}
            aria-label="Просмотреть"
          >
            <Eye />
          </button>,
        ])}
      />
      <ActionError message={error} />
      <ActionError message={local.error ?? ""} />
      <ActionError message={pageContent.error ?? ""} />
      {pageEditing && (
        <TournamentPageEditor
          key={pageEditing.id}
          tournament={pageEditing}
          content={pageContent.pages[pageEditing.id]}
          teams={store.state.teams}
          savePage={sandbox ? (content) => sandbox.savePage(pageEditing.id, content) : undefined}
          close={() => setPageEditing(null)}
        />
      )}
      {(create || editing) && (
        <TournamentForm
          tournament={editing}
          venue={editing ? venueFor(editing) : undefined}
          saveError={error}
          destination={editing && isPartnerTournamentId(editing.id) ? "PARTNER" : "PHYGITAL"}
          close={() => {
            setCreate(false);
            setEditing(null);
          }}
          save={(draft, destination, venue) =>
            void run(
              "tournament-save",
              async () => {
                if (editing) {
                  const current = tournaments.find((item) => item.id === editing.id);
                  if (!current) throw new Error("Турнир больше недоступен");
                  const normalizedVenue = venue?.trim();
                  if (venue !== undefined && user?.role !== "ADMIN")
                    throw new Error("Изменять место проведения может только администратор");
                  if (venue !== undefined && !normalizedVenue)
                    throw new Error("Укажите место проведения");
                  const venueChanged =
                    normalizedVenue !== undefined && normalizedVenue !== venueFor(current);
                  if (venueChanged && !isPartnerTournamentId(current.id) && pageContent.error)
                    throw new Error(pageContent.error);
                  const patch = {
                    name: draft.name,
                    shortDescription: draft.shortDescription,
                    description: draft.fullDescription?.trim() || draft.shortDescription,
                    city: draft.city,
                    startAt: draft.startAt,
                    endAt: draft.endAt ?? "",
                    imageName: draft.imageName,
                    imageUrl: draft.imageUrl,
                  };
                  let coreSaved = false;
                  try {
                    if (venue === undefined || hasCoreChanges(draft, current)) {
                      if (isPartnerTournamentId(editing.id)) {
                        await partnerService.updateTournament(editing.id, patch, user);
                      } else {
                        await store.updateTournament(editing.id, patch);
                      }
                      coreSaved = true;
                    }
                    if (venueChanged) {
                      if (sandbox) await sandbox.saveVenue(current.id, normalizedVenue);
                      else if (isPartnerTournamentId(current.id))
                        await partnerTournamentService.updateVenue(
                          current.id,
                          normalizedVenue,
                          user,
                        );
                      else await tournamentPageService.saveVenue(current, normalizedVenue, user);
                    }
                  } catch (reason) {
                    if (coreSaved && venueChanged)
                      throw new Error(
                        `Основные параметры сохранены, но место проведения не сохранено. ${reason instanceof Error ? reason.message : "Попробуйте ещё раз."}`,
                      );
                    throw reason;
                  }
                } else if (destination === "PARTNER") {
                  await partnerService.createTournament(draft, user);
                } else {
                  await store.createTournament(draft);
                }
              },
              editing ? "Турнир обновлён" : "Турнир создан",
            ).then((ok) => {
              if (!ok) return;
              setCreate(false);
              setEditing(null);
            })
          }
          busy={busy === "tournament-save"}
        />
      )}{" "}
      {selected && (
        <aside className="side-panel glass">
          <button onClick={() => setSelected(null)} aria-label="Закрыть">
            ×
          </button>
          <h2>{selected.name}</h2>
          <Badge>{selected.city}</Badge>
          <p>{selected.shortDescription}</p>
          <p>
            {new Date(selected.startAt).toLocaleString("ru-RU")}
            {selected.endAt ? ` — ${new Date(selected.endAt).toLocaleString("ru-RU")}` : ""}
          </p>
          {sandbox?.previewHref && !isPartnerTournamentId(selected.id) && (
            <Link className="pc-button secondary" href={sandbox.previewHref(selected.id)}>
              Посмотреть демо-страницу
            </Link>
          )}
          <GlowButton
            onClick={() => {
              setEditing(selected);
              setSelected(null);
            }}
          >
            <PenLine /> Редактировать
          </GlowButton>
          {!isPartnerTournamentId(selected.id) && (
            <Button
              onClick={() => {
                setPageEditing(selected);
                setSelected(null);
              }}
            >
              <FileText /> Страница турнира
            </Button>
          )}
          <Button variant="danger" className="danger" onClick={() => setConfirm(true)}>
            <Trash2 /> Удалить турнир
          </Button>
        </aside>
      )}
      {confirm && selected && (
        <Confirm
          title="Удалить турнир?"
          text="Турнир исчезнет из списка и публичной части."
          close={() => setConfirm(false)}
          confirm={() =>
            void run(
              "delete-tournament",
              () =>
                isPartnerTournamentId(selected.id)
                  ? partnerService.deleteTournament(selected.id, user)
                  : store.deleteTournament(selected.id).then(() => {}),
              "Турнир удалён",
            ).then((ok) => {
              if (!ok) return;
              setConfirm(false);
              setSelected(null);
            })
          }
          busy={busy === "delete-tournament"}
        />
      )}
    </>
  );
}
