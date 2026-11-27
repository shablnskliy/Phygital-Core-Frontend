import { storageService } from "@/shared/storage/browserStorage";
import {
  getTournamentPageDefaults,
  validateTournamentPage,
  type TournamentPageContent,
  type TournamentPagesSnapshot,
} from "../model/page-content";
import type { Tournament } from "../model/types";

export const TOURNAMENT_PAGES_STORAGE_KEY = "pc-tournament-pages-v1";
const EVENT = "phygital:tournament-pages-changed";
const emptyPages = Object.freeze({});
export const EMPTY_TOURNAMENT_PAGES: TournamentPagesSnapshot = Object.freeze({
  pages: emptyPages,
  error: null,
});
let rawCache: string | null | undefined;
let snapshot = EMPTY_TOURNAMENT_PAGES;
let readError: Error | null = null;
let queue: Promise<unknown> = Promise.resolve();

function freezePage(content: TournamentPageContent) {
  Object.freeze(content.disciplines);
  Object.freeze(content.stages);
  Object.freeze(content.rules);
  content.gallery.forEach(Object.freeze);
  Object.freeze(content.gallery);
  return Object.freeze(content);
}

export function getTournamentPagesSnapshot(): TournamentPagesSnapshot {
  if (typeof window === "undefined") return EMPTY_TOURNAMENT_PAGES;
  try {
    const raw = storageService.get(TOURNAMENT_PAGES_STORAGE_KEY);
    if (raw === rawCache && !readError) return snapshot;
    const document = raw === null ? { version: 1, pages: {} } : JSON.parse(raw);
    if (
      !document ||
      document.version !== 1 ||
      !document.pages ||
      typeof document.pages !== "object" ||
      Array.isArray(document.pages)
    )
      throw new Error("Некорректный формат локальных страниц турниров");
    const pages: Record<string, TournamentPageContent> = Object.create(null);
    for (const [id, content] of Object.entries(document.pages)) {
      if (!id || id.startsWith("local-partner-"))
        throw new Error("Некорректный ID фиджитал-турнира");
      pages[id] = freezePage(validateTournamentPage(content));
    }
    rawCache = raw;
    readError = null;
    snapshot =
      raw === null
        ? EMPTY_TOURNAMENT_PAGES
        : Object.freeze({ pages: Object.freeze(pages), error: null });
  } catch (reason) {
    const message =
      reason instanceof SyntaxError
        ? "Не удалось прочитать страницы турниров: повреждён JSON"
        : reason instanceof Error
          ? reason.message
          : "Не удалось прочитать локальные страницы турниров";
    readError = new Error(message);
    if (snapshot.error !== message) snapshot = Object.freeze({ pages: emptyPages, error: message });
  }
  return snapshot;
}

function subscribe(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === TOURNAMENT_PAGES_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

type Actor = { id: string; role: string } | null;
function requireAdmin(actor: Actor, id: string) {
  if (actor?.role !== "ADMIN" || !actor.id)
    throw new Error("Редактировать страницу турнира может только администратор");
  if (!id.trim() || id.startsWith("local-partner-"))
    throw new Error("Шаблон страницы доступен только для фиджитал-турниров");
}

function mutate(
  change: (pages: Record<string, TournamentPageContent>) => Record<string, TournamentPageContent>,
) {
  const perform = () => {
    if (typeof window === "undefined") throw new Error("Локальное хранилище недоступно на сервере");
    const state = getTournamentPagesSnapshot();
    if (readError) throw readError;
    const pages = change(state.pages);
    storageService.set(TOURNAMENT_PAGES_STORAGE_KEY, JSON.stringify({ version: 1, pages }));
    rawCache = undefined;
    getTournamentPagesSnapshot();
    window.dispatchEvent(new Event(EVENT));
  };
  const scheduled = queue.then(() =>
    typeof navigator !== "undefined" && navigator.locks?.request
      ? navigator.locks.request(TOURNAMENT_PAGES_STORAGE_KEY, perform)
      : perform(),
  );
  queue = scheduled.catch(() => {});
  return scheduled;
}

export const tournamentPageService = {
  subscribe,
  async saveVenue(tournament: Tournament, venue: string, actor: Actor): Promise<void> {
    requireAdmin(actor, tournament.id);
    const normalized = venue.trim();
    if (!normalized) throw new Error("Укажите место проведения");
    return mutate((pages) => ({
      ...pages,
      [tournament.id]: validateTournamentPage({
        ...(pages[tournament.id] ?? getTournamentPageDefaults(tournament)),
        venue: normalized,
      }),
    }));
  },
  async save(id: string, content: TournamentPageContent, actor: Actor): Promise<void> {
    requireAdmin(actor, id);
    const normalized = validateTournamentPage(content);
    return mutate((pages) => ({ ...pages, [id]: normalized }));
  },
  async remove(id: string, actor: Actor): Promise<void> {
    requireAdmin(actor, id);
    return mutate((pages) =>
      Object.fromEntries(Object.entries(pages).filter(([key]) => key !== id)),
    );
  },
};
