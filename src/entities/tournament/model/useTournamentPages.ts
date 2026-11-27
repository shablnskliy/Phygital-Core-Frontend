"use client";
import { useSyncExternalStore } from "react";
import {
  EMPTY_TOURNAMENT_PAGES,
  getTournamentPagesSnapshot,
  tournamentPageService,
} from "../api/tournamentPageService";

export function useTournamentPages() {
  return useSyncExternalStore(
    tournamentPageService.subscribe,
    getTournamentPagesSnapshot,
    () => EMPTY_TOURNAMENT_PAGES,
  );
}
