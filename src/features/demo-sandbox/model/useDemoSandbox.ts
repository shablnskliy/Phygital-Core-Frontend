"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { TournamentDraft } from "@/entities/platform";
import {
  getTournamentPageDefaults,
  type Tournament,
  type TournamentPageContent,
  type partnerTournamentService,
} from "@/entities/tournament";
import type { TournamentApplication } from "@/entities/tournament-application";
import { demoActor, demoApplications, demoTeams, demoTournament } from "./fixtures";
import {
  demoSandboxService,
  getDemoServerSnapshot,
  getDemoSnapshot,
  subscribeDemo,
} from "./service";

const storeActions = {
  createTournament: async (draft: TournamentDraft) => {
    await demoSandboxService.createTournament(draft);
  },
  updateTournament: async (id: string, patch: Partial<Tournament>) => {
    await demoSandboxService.updateTournament(id, patch);
  },
  deleteTournament: demoSandboxService.deleteTournament,
};
const partnerService: Pick<
  typeof partnerTournamentService,
  "createTournament" | "updateTournament" | "deleteTournament"
> = {
  createTournament: (draft) =>
    demoSandboxService.createTournament({ ...draft, endAt: draft.endAt ?? undefined }, true),
  updateTournament: demoSandboxService.updateTournament,
  deleteTournament: demoSandboxService.deleteTournament,
};
const savePage = (id: string, content: TournamentPageContent) =>
  demoSandboxService.savePage(id, content);

export function useDemoSandbox() {
  const snapshot = useSyncExternalStore(subscribeDemo, getDemoSnapshot, getDemoServerSnapshot);
  return useMemo(() => {
    const tournament =
      snapshot.tournaments.find((item) => item.id === demoTournament.id) ?? demoTournament;
    return {
      store: {
        state: {
          tournaments: snapshot.tournaments.filter((item) => !item.id.startsWith("local-partner-")),
          teams: demoTeams,
        },
        ...storeActions,
      },
      user: demoActor,
      local: {
        tournaments: snapshot.tournaments.filter((item) => item.id.startsWith("local-partner-")),
        applications: [] as TournamentApplication[],
        error: snapshot.error,
      },
      pageContent: { pages: snapshot.pages, error: snapshot.error },
      partnerService,
      savePage,
      saveVenue: demoSandboxService.saveVenue,
      visual: {
        tournament,
        teams: demoTeams,
        applications: demoApplications,
        content: snapshot.pages[demoTournament.id] ?? getTournamentPageDefaults(tournament),
      },
      error: snapshot.error,
    };
  }, [snapshot]);
}

export type DemoSandbox = ReturnType<typeof useDemoSandbox>;
