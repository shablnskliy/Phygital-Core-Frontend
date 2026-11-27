import { storageService } from "@/shared/storage/browserStorage";
import type {
  Status,
  TournamentApplication,
} from "@/entities/tournament-application/@x/tournament";
import type { Tournament } from "../model/types";
import type {
  PartnerActor,
  PartnerTeam,
  PartnerTournamentDraft,
  PartnerTournamentSnapshot,
  PartnerTournamentState,
} from "../model/partner-types";

export const PARTNER_TOURNAMENTS_STORAGE_KEY = "pc-partner-tournaments-v1";
const CHANGED_EVENT = "phygital:partner-tournaments-changed";
const LOCAL_ID_PREFIX = "local-partner-";
const APPLICATION_ID_PREFIX = `${LOCAL_ID_PREFIX}application-`;

export const isPartnerApplicationId = (id: string): boolean => id.startsWith(APPLICATION_ID_PREFIX);
export const isPartnerTournamentId = (id: string): boolean =>
  id.startsWith(LOCAL_ID_PREFIX) && !isPartnerApplicationId(id);

function freezeState(state: PartnerTournamentState): PartnerTournamentState {
  state.tournaments.forEach((tournament) => {
    Object.freeze(tournament.rules);
    Object.freeze(tournament);
  });
  state.applications.forEach(Object.freeze);
  Object.freeze(state.tournaments);
  Object.freeze(state.applications);
  return Object.freeze(state);
}

export const EMPTY_PARTNER_TOURNAMENTS = freezeState({ tournaments: [], applications: [] });
export const EMPTY_PARTNER_SNAPSHOT: PartnerTournamentSnapshot = Object.freeze({
  ...EMPTY_PARTNER_TOURNAMENTS,
  error: null,
});

let cachedRaw: string | null | undefined;
let cachedState = EMPTY_PARTNER_TOURNAMENTS;
let cachedSnapshot = EMPTY_PARTNER_SNAPSHOT;
let cachedError: Error | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

function parseState(raw: string | null): PartnerTournamentState {
  if (raw === null) return EMPTY_PARTNER_TOURNAMENTS;
  const document: unknown = JSON.parse(raw);
  if (
    !isRecord(document) ||
    document.version !== 1 ||
    !Array.isArray(document.tournaments) ||
    !Array.isArray(document.applications)
  )
    throw new Error("Некорректный формат локальных данных партнёрских турниров");

  const tournaments: Tournament[] = document.tournaments.map((value: unknown) => {
    const fields = [
      "id",
      "publicNumber",
      "name",
      "discipline",
      "format",
      "city",
      "venue",
      "shortDescription",
      "description",
      "startAt",
      "endAt",
      "registrationEndsAt",
    ];
    if (
      !isRecord(value) ||
      fields.some((field) => typeof value[field] !== "string") ||
      !isPartnerTournamentId(value.id as string) ||
      !Array.isArray(value.rules) ||
      value.rules.some((rule) => typeof rule !== "string") ||
      (value.imageName !== undefined && typeof value.imageName !== "string") ||
      (value.imageUrl !== undefined && typeof value.imageUrl !== "string") ||
      !Number.isFinite(Date.parse(value.startAt as string)) ||
      Boolean(
        value.endAt &&
        (!Number.isFinite(Date.parse(value.endAt as string)) ||
          new Date(value.endAt as string) <= new Date(value.startAt as string)),
      )
    )
      throw new Error("Повреждены локальные данные партнёрского турнира");
    return { ...value, rules: [...value.rules] } as unknown as Tournament;
  });
  const tournamentIds = new Set(tournaments.map((item) => item.id));
  if (tournamentIds.size !== tournaments.length)
    throw new Error("Повторяющиеся ID локальных партнёрских турниров");

  const applications: TournamentApplication[] = document.applications.map((value: unknown) => {
    const fields = ["id", "teamId", "tournamentId", "captainName", "additionalInfo", "createdAt"];
    if (
      !isRecord(value) ||
      fields.some((field) => typeof value[field] !== "string") ||
      !isPartnerApplicationId(value.id as string) ||
      !tournamentIds.has(value.tournamentId as string) ||
      !["NEW", "APPROVED", "REJECTED"].includes(String(value.status)) ||
      !Number.isFinite(Date.parse(value.createdAt as string)) ||
      (value.additionalInfo as string).length > 500
    )
      throw new Error("Повреждены локальные заявки на партнёрские турниры");
    return { ...value } as unknown as TournamentApplication;
  });
  if (new Set(applications.map((item) => item.id)).size !== applications.length)
    throw new Error("Повторяющиеся ID локальных заявок на партнёрские турниры");
  return freezeState({ tournaments, applications });
}

function refreshCache(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = storageService.get(PARTNER_TOURNAMENTS_STORAGE_KEY);
    if (raw === cachedRaw && !cachedError) return;
    cachedRaw = raw;
    cachedState = parseState(raw);
    cachedError = null;
    cachedSnapshot =
      raw === null ? EMPTY_PARTNER_SNAPSHOT : Object.freeze({ ...cachedState, error: null });
  } catch (reason) {
    cachedError = new Error(
      reason instanceof SyntaxError
        ? "Не удалось прочитать локальные партнёрские турниры: повреждён JSON"
        : reason instanceof Error
          ? reason.message
          : "Локальное хранилище партнёрских турниров недоступно",
    );
    if (cachedSnapshot.error !== cachedError.message) {
      cachedSnapshot = Object.freeze({ ...EMPTY_PARTNER_TOURNAMENTS, error: cachedError.message });
    }
  }
}

function getState(): PartnerTournamentState {
  if (typeof window === "undefined") return EMPTY_PARTNER_TOURNAMENTS;
  refreshCache();
  if (cachedError) throw cachedError;
  return cachedState;
}

export function getPartnerTournamentSnapshot(): PartnerTournamentSnapshot {
  if (typeof window === "undefined") return EMPTY_PARTNER_SNAPSHOT;
  refreshCache();
  return cachedSnapshot;
}

function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === PARTNER_TOURNAMENTS_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener(CHANGED_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGED_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

function requireAdmin(actor: PartnerActor | null): void {
  if (actor?.role !== "ADMIN")
    throw new Error("Управлять партнёрскими турнирами может только администратор");
}

function normalizedDraft(draft: PartnerTournamentDraft) {
  const name = draft.name.trim(),
    shortDescription = draft.shortDescription.trim(),
    city = draft.city.trim();
  if (!name || !shortDescription || !city || !draft.startAt)
    throw new Error("Заполните обязательные поля");
  if (draft.shortDescription.length > 500)
    throw new Error("Краткое описание не должно превышать 500 символов");
  const startAt = draft.startAt.includes("T") ? draft.startAt : `${draft.startAt}T00:00:00`;
  const endAt = draft.endAt
    ? draft.endAt.includes("T")
      ? draft.endAt
      : `${draft.endAt}T23:59:59`
    : "";
  if (!Number.isFinite(Date.parse(startAt)) || (endAt && !Number.isFinite(Date.parse(endAt))))
    throw new Error("Укажите корректные даты");
  if (endAt && new Date(endAt) <= new Date(startAt))
    throw new Error("Окончание должно быть позднее начала");
  return { name, shortDescription, city, startAt, endAt };
}

// This document is deliberately isolated from jwt_token, API calls and the old
// platform document. A failed write never publishes a successful UI update.
function mutate<T>(
  change: (previous: PartnerTournamentState) => { state: PartnerTournamentState; result: T },
): Promise<T> {
  const perform = () => {
    if (typeof window === "undefined") throw new Error("Локальное хранилище недоступно на сервере");
    const { state, result } = change(getState());
    const serialized = JSON.stringify({ version: 1, ...state });
    storageService.set(PARTNER_TOURNAMENTS_STORAGE_KEY, serialized);
    cachedRaw = undefined;
    getState();
    window.dispatchEvent(new Event(CHANGED_EVENT));
    return result;
  };
  const scheduled = writeQueue.then(() => {
    if (typeof navigator !== "undefined" && navigator.locks?.request) {
      return navigator.locks.request(PARTNER_TOURNAMENTS_STORAGE_KEY, perform);
    }
    return perform();
  });
  writeQueue = scheduled.catch(() => {});
  return scheduled;
}

export const partnerTournamentService = {
  getState,
  subscribe,
  async updateVenue(id: string, venue: string, actor: PartnerActor | null): Promise<void> {
    requireAdmin(actor);
    const normalized = venue.trim();
    if (!normalized) throw new Error("Укажите место проведения");
    return mutate((previous) => {
      if (!previous.tournaments.some((item) => item.id === id))
        throw new Error("Партнёрский турнир не найден");
      return {
        state: {
          ...previous,
          tournaments: previous.tournaments.map((item) =>
            item.id === id ? { ...item, venue: normalized } : item,
          ),
        },
        result: undefined,
      };
    });
  },
  async createTournament(
    draft: PartnerTournamentDraft,
    actor: PartnerActor | null,
  ): Promise<Tournament> {
    requireAdmin(actor);
    const normalized = normalizedDraft(draft);
    return mutate((previous) => {
      const tournament: Tournament = {
        id: `${LOCAL_ID_PREFIX}${crypto.randomUUID()}`,
        publicNumber: "",
        discipline: "",
        format: "",
        venue: "",
        registrationEndsAt: "",
        rules: [],
        ...normalized,
        description: draft.fullDescription?.trim() || normalized.shortDescription,
        imageName: draft.imageName,
        imageUrl: draft.imageUrl,
      };
      return {
        state: { ...previous, tournaments: [...previous.tournaments, tournament] },
        result: tournament,
      };
    });
  },
  async updateTournament(
    id: string,
    patch: Partial<Tournament>,
    actor: PartnerActor | null,
  ): Promise<Tournament> {
    requireAdmin(actor);
    return mutate((previous) => {
      const current = previous.tournaments.find((item) => item.id === id);
      if (!current) throw new Error("Партнёрский турнир не найден");
      const candidate = { ...current, ...patch };
      const normalized = normalizedDraft({ ...candidate, fullDescription: candidate.description });
      // IDs and all hidden tournament fields remain owned by this local record.
      const next: Tournament = {
        ...current,
        ...normalized,
        description: candidate.description?.trim() || normalized.shortDescription,
        imageName: candidate.imageName,
        imageUrl: candidate.imageUrl,
      };
      return {
        state: {
          ...previous,
          tournaments: previous.tournaments.map((item) => (item.id === id ? next : item)),
        },
        result: next,
      };
    });
  },
  async deleteTournament(id: string, actor: PartnerActor | null): Promise<void> {
    requireAdmin(actor);
    return mutate((previous) => {
      if (!previous.tournaments.some((item) => item.id === id))
        throw new Error("Партнёрский турнир не найден");
      return {
        state: {
          tournaments: previous.tournaments.filter((item) => item.id !== id),
          applications: previous.applications.filter((item) => item.tournamentId !== id),
        },
        result: undefined,
      };
    });
  },
  async submitApplication(
    tournamentId: string,
    team: PartnerTeam,
    additionalInfo: string,
    actor: PartnerActor | null,
  ): Promise<TournamentApplication> {
    if (!actor) throw new Error("Требуется авторизация");
    if (!team.members.some((member) => member.id === actor.id && member.captain))
      throw new Error("Подать заявку может только капитан команды");
    if (additionalInfo.length > 500)
      throw new Error("Дополнительная информация не должна превышать 500 символов");
    return mutate((previous) => {
      if (!previous.tournaments.some((item) => item.id === tournamentId))
        throw new Error("Партнёрский турнир не найден");
      if (
        previous.applications.some(
          (item) =>
            item.teamId === team.id &&
            item.tournamentId === tournamentId &&
            item.status !== "REJECTED",
        )
      )
        throw new Error("Заявка этой команды уже отправлена");
      const application: TournamentApplication = {
        id: `${APPLICATION_ID_PREFIX}${crypto.randomUUID()}`,
        teamId: team.id,
        tournamentId,
        captainName: `${actor.firstName} ${actor.lastName}`.trim(),
        additionalInfo: additionalInfo.trim(),
        status: "NEW",
        createdAt: new Date().toISOString(),
      };
      return {
        state: { ...previous, applications: [application, ...previous.applications] },
        result: application,
      };
    });
  },
  async updateApplicationStatus(
    id: string,
    status: Status,
    actor: PartnerActor | null,
  ): Promise<TournamentApplication> {
    requireAdmin(actor);
    if (status !== "APPROVED" && status !== "REJECTED")
      throw new Error("Выберите одобрение или отклонение заявки");
    return mutate((previous) => {
      const current = previous.applications.find((item) => item.id === id);
      if (!current) throw new Error("Локальная заявка не найдена");
      const updated = { ...current, status };
      return {
        state: {
          ...previous,
          applications: previous.applications.map((item) => (item.id === id ? updated : item)),
        },
        result: updated,
      };
    });
  },
};
