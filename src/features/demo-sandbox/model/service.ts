import type { TournamentDraft } from "@/entities/platform";
import {
  getTournamentPageDefaults,
  isPageImageUrl,
  validateTournamentPage,
  type Tournament,
  type TournamentPageContent,
} from "@/entities/tournament";
import { DEMO_PAGES_ENABLED } from "@/shared/config";
import { demoActor, demoPageContent, demoTournament, demoTeams } from "./fixtures";
import type { DemoDocument, DemoSnapshot } from "./types";

// This key is deliberately independent of auth, platform, partner and page data.
export const DEMO_KEY = "pc-admin-demo-v1";
const CHANGED_EVENT = "phygital:admin-demo-changed";
const isDemoId = (id: string) =>
  id.startsWith("admin-demo-") || id.startsWith("local-partner-admin-demo-");
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

function freezeSnapshot(value: DemoSnapshot): DemoSnapshot {
  value.tournaments.forEach((tournament) => {
    Object.freeze(tournament.rules);
    Object.freeze(tournament);
  });
  Object.values(value.pages).forEach((content) => {
    Object.freeze(content.disciplines);
    Object.freeze(content.stages);
    Object.freeze(content.rules);
    content.gallery.forEach(Object.freeze);
    Object.freeze(content.gallery);
    Object.freeze(content);
  });
  Object.freeze(value.tournaments);
  Object.freeze(value.pages);
  return Object.freeze(value);
}

const INITIAL = freezeSnapshot({
  version: 1,
  tournaments: [{ ...demoTournament, rules: [...demoTournament.rules] }],
  pages: { [demoTournament.id]: validateTournamentPage(demoPageContent) },
  error: null,
});
const DISABLED = freezeSnapshot({ version: 1, tournaments: [], pages: {}, error: null });
let cachedRaw: string | null | undefined;
let snapshot = INITIAL;
let writeQueue: Promise<unknown> = Promise.resolve();

function ensureEnabled(): void {
  if (!DEMO_PAGES_ENABLED) throw new Error("Демонстрационный режим отключён");
}

function validatedDraft(draft: TournamentDraft) {
  if (!draft.name.trim() || !draft.shortDescription.trim() || !draft.city.trim())
    throw new Error("Заполните обязательные поля");
  if (draft.shortDescription.length > 500) throw new Error("Краткое описание — до 500 символов");
  if (
    !Number.isFinite(Date.parse(draft.startAt)) ||
    (draft.endAt &&
      (!Number.isFinite(Date.parse(draft.endAt)) ||
        new Date(draft.endAt) <= new Date(draft.startAt)))
  )
    throw new Error("Проверьте даты турнира");
  if (draft.imageUrl && !isPageImageUrl(draft.imageUrl))
    throw new Error("Некорректное изображение турнира");
  return {
    name: draft.name.trim(),
    shortDescription: draft.shortDescription.trim(),
    city: draft.city.trim(),
    startAt: draft.startAt,
    endAt: draft.endAt || "",
  };
}

function validatedContent(value: unknown): TournamentPageContent {
  const content = validateTournamentPage(value);
  if (content.winnerTeamId && !demoTeams.some((team) => team.id === content.winnerTeamId))
    throw new Error("Выберите победителя среди демонстрационных команд");
  return content;
}

function parseDocument(raw: string | null): DemoSnapshot {
  if (raw === null) return INITIAL;
  const document: unknown = JSON.parse(raw);
  if (
    !isRecord(document) ||
    document.version !== 1 ||
    !Array.isArray(document.tournaments) ||
    !isRecord(document.pages)
  )
    throw new Error("Повреждены демонстрационные данные");
  const tournaments: Tournament[] = document.tournaments.map((value: unknown) => {
    const fields = [
      "id",
      "name",
      "publicNumber",
      "discipline",
      "format",
      "venue",
      "city",
      "shortDescription",
      "description",
      "startAt",
      "endAt",
      "registrationEndsAt",
    ];
    if (
      !isRecord(value) ||
      fields.some((field) => typeof value[field] !== "string") ||
      !isDemoId(value.id as string) ||
      !Array.isArray(value.rules) ||
      value.rules.some((rule) => typeof rule !== "string") ||
      (value.imageName !== undefined && typeof value.imageName !== "string") ||
      (value.imageUrl !== undefined && typeof value.imageUrl !== "string")
    )
      throw new Error("Повреждены демонстрационные данные турнира");
    const tournament = value as unknown as Tournament;
    validatedDraft(tournament);
    return { ...tournament, rules: [...tournament.rules] };
  });
  const ids = new Set(tournaments.map((item) => item.id));
  if (ids.size !== tournaments.length) throw new Error("Повторяющиеся ID демо-турниров");
  const pages: Record<string, TournamentPageContent> = {};
  for (const [id, content] of Object.entries(document.pages)) {
    if (!isDemoId(id) || !ids.has(id)) throw new Error("Страница демо-турнира не найдена");
    pages[id] = validatedContent(content);
  }
  return freezeSnapshot({ version: 1, tournaments, pages, error: null });
}

export function getDemoServerSnapshot(): DemoSnapshot {
  return DEMO_PAGES_ENABLED ? INITIAL : DISABLED;
}

export function getDemoSnapshot(): DemoSnapshot {
  if (!DEMO_PAGES_ENABLED) return DISABLED;
  if (typeof window === "undefined") return INITIAL;
  try {
    const raw = window.localStorage.getItem(DEMO_KEY);
    if (raw === cachedRaw && !snapshot.error) return snapshot;
    const next = parseDocument(raw);
    cachedRaw = raw;
    snapshot = next;
  } catch (reason) {
    const error = reason instanceof Error ? reason.message : "Не удалось прочитать демо-данные";
    // One changed snapshot exposes the error; repeated failures remain stable.
    if (snapshot.error !== error) snapshot = Object.freeze({ ...snapshot, error });
  }
  return snapshot;
}

export function subscribeDemo(listener: () => void): () => void {
  if (!DEMO_PAGES_ENABLED || typeof window === "undefined") return () => {};
  const storage = (event: StorageEvent) => {
    if (event.key === DEMO_KEY || event.key === null) listener();
  };
  window.addEventListener(CHANGED_EVENT, listener);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(CHANGED_EVENT, listener);
    window.removeEventListener("storage", storage);
  };
}

function mutate<T>(
  change: (before: DemoSnapshot) => { document: DemoDocument; result: T },
): Promise<T> {
  const perform = () => {
    ensureEnabled();
    if (typeof window === "undefined") throw new Error("Демо-хранилище недоступно на сервере");
    const before = getDemoSnapshot();
    if (before.error) throw new Error(before.error);
    const { document, result } = change(before);
    const next = freezeSnapshot({ ...document, error: null });
    const raw = JSON.stringify(document);
    window.localStorage.setItem(DEMO_KEY, raw);
    cachedRaw = raw;
    snapshot = next;
    window.dispatchEvent(new Event(CHANGED_EVENT));
    return result;
  };
  const task = writeQueue.then(perform);
  writeQueue = task.catch(() => {});
  return task;
}

export const demoSandboxService = {
  async saveVenue(
    id: string,
    venue: string,
    actor: typeof demoActor | null = demoActor,
  ): Promise<void> {
    ensureEnabled();
    if (actor?.id !== demoActor.id || actor.role !== "ADMIN")
      throw new Error("Сохранение доступно только для демо-турниров");
    const normalized = venue.trim();
    if (!normalized) throw new Error("Укажите место проведения");
    return mutate((before) => {
      const tournament = before.tournaments.find((item) => item.id === id);
      if (!tournament || !isDemoId(id)) throw new Error("Демо-турнир не найден");
      const partner = id.startsWith("local-partner-");
      return {
        document: {
          version: 1,
          tournaments: partner
            ? before.tournaments.map((item) =>
                item.id === id ? { ...item, venue: normalized } : item,
              )
            : before.tournaments,
          pages: partner
            ? before.pages
            : {
                ...before.pages,
                [id]: validatedContent({
                  ...(before.pages[id] ?? getTournamentPageDefaults(tournament)),
                  venue: normalized,
                }),
              },
        },
        result: undefined,
      };
    });
  },
  async createTournament(draft: TournamentDraft, partner = false): Promise<Tournament> {
    ensureEnabled();
    const normalized = validatedDraft(draft);
    return mutate((before) => {
      const tournament: Tournament = {
        id: `${partner ? "local-partner-admin-demo-" : "admin-demo-"}${crypto.randomUUID()}`,
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
        document: {
          version: 1,
          tournaments: [...before.tournaments, tournament],
          pages: before.pages,
        },
        result: tournament,
      };
    });
  },
  async updateTournament(id: string, patch: Partial<Tournament>): Promise<Tournament> {
    ensureEnabled();
    return mutate((before) => {
      const current = before.tournaments.find((item) => item.id === id);
      if (!current || !isDemoId(id)) throw new Error("Демо-турнир не найден");
      const candidate = { ...current, ...patch };
      const normalized = validatedDraft(candidate);
      const next: Tournament = {
        ...current,
        ...normalized,
        description: candidate.description.trim() || normalized.shortDescription,
        imageName: candidate.imageName,
        imageUrl: candidate.imageUrl,
      };
      return {
        document: {
          version: 1,
          tournaments: before.tournaments.map((item) => (item.id === id ? next : item)),
          pages: before.pages,
        },
        result: next,
      };
    });
  },
  async deleteTournament(id: string): Promise<void> {
    ensureEnabled();
    return mutate((before) => {
      if (!isDemoId(id) || !before.tournaments.some((item) => item.id === id))
        throw new Error("Демо-турнир не найден");
      return {
        document: {
          version: 1,
          tournaments: before.tournaments.filter((item) => item.id !== id),
          pages: Object.fromEntries(Object.entries(before.pages).filter(([key]) => key !== id)),
        },
        result: undefined,
      };
    });
  },
  async savePage(
    id: string,
    content: TournamentPageContent,
    actor: typeof demoActor | null = demoActor,
  ): Promise<void> {
    ensureEnabled();
    if (actor?.id !== demoActor.id || actor.role !== "ADMIN")
      throw new Error("Сохранение доступно только для демо-турниров");
    const validated = validatedContent(content);
    return mutate((before) => {
      if (!isDemoId(id) || !before.tournaments.some((item) => item.id === id))
        throw new Error("Сохранение доступно только для демо-турниров");
      return {
        document: {
          version: 1,
          tournaments: before.tournaments,
          pages: { ...before.pages, [id]: validated },
        },
        result: undefined,
      };
    });
  },
};
