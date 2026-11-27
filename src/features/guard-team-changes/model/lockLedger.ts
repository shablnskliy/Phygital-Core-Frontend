import { storageService } from "@/shared/storage/browserStorage";
import type { LocalTeamLock } from "../lib/policy";

export const TEAM_LOCK_STORAGE_KEY = "pc-submitted-team-locks-v1";
const EVENT = "phygital:team-locks-changed";
const EMPTY = Object.freeze({ locks: [] as LocalTeamLock[], error: "" });
let snapshot: { locks: LocalTeamLock[]; error: string } = EMPTY;
let cached: string | null | undefined;
let memory: LocalTeamLock[] = [];

export const teamLockLedger = {
  getSnapshot() {
    if (typeof window === "undefined") return EMPTY;
    try {
      const raw = storageService.get(TEAM_LOCK_STORAGE_KEY);
      if (raw === cached) return snapshot;
      const value: unknown = raw === null ? [] : JSON.parse(raw);
      if (
        !Array.isArray(value) ||
        value.some(
          (item) =>
            !item ||
            typeof item.teamId !== "string" ||
            typeof item.tournamentId !== "string" ||
            typeof item.tournamentName !== "string" ||
            !Array.isArray(item.previousApplicationIds) ||
            item.previousApplicationIds.some((id: unknown) => typeof id !== "string"),
        )
      ) {
        throw new Error("Некорректные локальные данные блокировки команды");
      }
      cached = raw;
      memory = value as LocalTeamLock[];
      snapshot = { locks: memory, error: "" };
    } catch {
      const error =
        "Не удалось прочитать локальную блокировку команд. Данные сервера продолжают учитываться.";
      if (snapshot.error !== error) snapshot = { locks: memory, error };
    }
    return snapshot;
  },
  getServerSnapshot: () => EMPTY,
  subscribe(listener: () => void) {
    const storage = (event: StorageEvent) => {
      if (event.key === TEAM_LOCK_STORAGE_KEY || event.key === null) {
        cached = undefined;
        listener();
      }
    };
    window.addEventListener(EVENT, listener);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(EVENT, listener);
      window.removeEventListener("storage", storage);
    };
  },
  save(lock: LocalTeamLock) {
    const previous = this.getSnapshot();
    this.write([
      ...previous.locks.filter(
        (item) => item.teamId !== lock.teamId || item.tournamentId !== lock.tournamentId,
      ),
      lock,
    ]);
  },
  release(teamId: string, tournamentId: string) {
    const locks = this.getSnapshot().locks;
    if (!locks.some((item) => item.teamId === teamId && item.tournamentId === tournamentId)) return;
    this.write(
      locks.filter((item) => item.teamId !== teamId || item.tournamentId !== tournamentId),
    );
  },
  write(locks: LocalTeamLock[]) {
    const previous = this.getSnapshot();
    memory = locks;
    try {
      // Preserve damaged JSON; a successful API submission stays locked in memory.
      if (previous.error) throw new Error("Storage unavailable");
      const raw = JSON.stringify(locks);
      storageService.set(TEAM_LOCK_STORAGE_KEY, raw);
      cached = raw;
      snapshot = { locks, error: "" };
    } catch {
      snapshot = {
        locks,
        error:
          "Локальная блокировка команды не сохранена. После перезагрузки она будет определяться по заявкам с сервера.",
      };
    }
    window.dispatchEvent(new Event(EVENT));
  },
};
