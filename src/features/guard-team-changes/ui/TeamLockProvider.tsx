"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { PlatformActionsProvider, usePlatformStore } from "@/entities/platform";
import { partnerTournamentService, usePartnerTournaments } from "@/entities/tournament";
import { useAuth } from "@/entities/user";
import { TeamLockContext } from "@/shared/providers";
import { decorateTeamActions } from "../lib/decorateTeamActions";
import { getTeamLockReason } from "../lib/policy";
import { teamLockLedger } from "../model/lockLedger";

export function TeamLockProvider({ children }: { children: ReactNode }) {
  const store = usePlatformStore();
  const { user } = useAuth();
  const partners = usePartnerTournaments();
  const ledger = useSyncExternalStore(
    teamLockLedger.subscribe,
    teamLockLedger.getSnapshot,
    teamLockLedger.getServerSnapshot,
  );
  const pending = useRef(new Set<string>());
  const [, refresh] = useState(0);
  const latest = useRef({ store, partners, ledger, user });
  latest.current = { store, partners, ledger, user };
  useEffect(() => {
    const timer = setInterval(() => refresh((value) => value + 1), 30000);
    return () => clearInterval(timer);
  }, []);
  const reason = (teamId: string) => {
    if (pending.current.has(teamId))
      return "Действие с командой выполняется. Дождитесь завершения перед изменением состава или отправкой заявки.";
    const current = latest.current;
    let local = current.partners;
    try {
      local = { ...partnerTournamentService.getState(), error: null };
    } catch {
      /* Server locks still apply. */
    }
    return getTeamLockReason(
      teamId,
      [...current.store.state.tournamentApplications, ...local.applications],
      [...current.store.state.tournaments, ...local.tournaments],
      teamLockLedger.getSnapshot().locks,
    );
  };
  const actions = useMemo(
    () =>
      decorateTeamActions(
        store,
        reason,
        (lock) => teamLockLedger.save(lock),
        (teamId, tournamentId) => teamLockLedger.release(teamId, tournamentId),
        (teamId, active) => {
          if (active) pending.current.add(teamId);
          else pending.current.delete(teamId);
          refresh((value) => value + 1);
        },
        async (teamId, tournamentId, info) => {
          const current = latest.current;
          const team = current.store.state.teams.find((item) => item.id === teamId);
          if (!team) throw new Error("Команда не найдена");
          await partnerTournamentService.submitApplication(tournamentId, team, info, current.user);
        },
      ),
    [store],
  );
  return (
    <TeamLockContext.Provider value={reason}>
      <PlatformActionsProvider value={actions}>
        {ledger.error && (
          <p className="storage-error" role="alert">
            {ledger.error}
          </p>
        )}
        {children}
      </PlatformActionsProvider>
    </TeamLockContext.Provider>
  );
}
