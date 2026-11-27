"use client";

import { useSyncExternalStore } from "react";
import {
  EMPTY_PARTNER_SNAPSHOT,
  getPartnerTournamentSnapshot,
  partnerTournamentService,
} from "../api/partnerTournamentService";

// Stable snapshots avoid React render loops; subscription also observes other tabs.
export function usePartnerTournaments() {
  return useSyncExternalStore(
    partnerTournamentService.subscribe,
    getPartnerTournamentSnapshot,
    () => EMPTY_PARTNER_SNAPSHOT,
  );
}
