import type { PlatformActions } from "@/entities/platform";
import type { LocalTeamLock } from "./policy";

export function decorateTeamActions(
  store: PlatformActions,
  reason: (teamId: string) => string,
  onSubmitted: (lock: LocalTeamLock) => void,
  onRelease: (teamId: string, tournamentId: string) => void,
  submitting: (teamId: string, pending: boolean) => void,
  localSubmit?: (teamId: string, tournamentId: string, info: string) => Promise<void>,
): PlatformActions {
  const assertEditable = (teamId: string) => {
    const message = reason(teamId);
    if (message) throw new Error(message);
  };
  const guardMany = async <T>(ids: string[], action: () => Promise<T>) => {
    ids.forEach(assertEditable);
    ids.forEach((id) => submitting(id, true));
    try {
      return await action();
    } finally {
      ids.forEach((id) => submitting(id, false));
    }
  };
  const guard = <T>(id: string, action: () => Promise<T>) => guardMany([id], action);
  return {
    ...store,
    updateTeam: (id, patch) => guard(id, () => store.updateTeam(id, patch)),
    addTeamMember: (id, userId) => guard(id, () => store.addTeamMember(id, userId)),
    removeTeamMember: (id, userId) => guard(id, () => store.removeTeamMember(id, userId)),
    leaveTeam: (id) => guard(id, () => store.leaveTeam(id)),
    assignCaptain: (id, userId) => guard(id, () => store.assignCaptain(id, userId)),
    deleteTeam: (id) => guard(id, () => store.deleteTeam(id)),
    sendInvitation: (id, recipientId) => guard(id, () => store.sendInvitation(id, recipientId)),
    cancelInvitation: async (id) => {
      const invitation = store.state.invitations.find((item) => item.id === id);
      if (invitation) return guard(invitation.teamId, () => store.cancelInvitation(id));
      return store.cancelInvitation(id);
    },
    deleteUser: async (id) => {
      const ids = store.state.teams
        .filter((team) => team.members.some((member) => member.id === id))
        .map((team) => team.id);
      return guardMany(ids, () => store.deleteUser(id));
    },
    respondInvitation: async (id, response) => {
      const invitation = store.state.invitations.find((item) => item.id === id);
      if (response === "accepted") {
        if (!invitation) throw new Error("Приглашение не найдено. Обновите уведомления.");
        return guard(invitation.teamId, () => store.respondInvitation(id, response));
      }
      return store.respondInvitation(id, response);
    },
    submitTournamentApplication: async (teamId, tournamentId, info) => {
      const pendingMessage = reason(teamId);
      if (pendingMessage.startsWith("Действие с командой выполняется."))
        throw new Error(pendingMessage);
      const tournament = store.state.tournaments.find((item) => item.id === tournamentId);
      const previousApplicationIds = store.state.tournamentApplications
        .filter((item) => item.teamId === teamId && item.tournamentId === tournamentId)
        .map((item) => item.id);
      submitting(teamId, true);
      try {
        // Reserved local IDs must never fall through to a backend handler.
        if (tournamentId.startsWith("local-partner-")) {
          if (!localSubmit) throw new Error("Локальная отправка заявки недоступна");
          await localSubmit(teamId, tournamentId, info);
        } else {
          await store.submitTournamentApplication(teamId, tournamentId, info);
          onSubmitted({
            teamId,
            tournamentId,
            tournamentName: tournament?.name ?? "",
            previousApplicationIds,
          });
        }
      } finally {
        submitting(teamId, false);
      }
    },
    updateTournamentApplication: async (id, status) => {
      await store.updateTournamentApplication(id, status);
      if (status === "REJECTED") {
        const app = store.state.tournamentApplications.find((item) => item.id === id);
        if (app) onRelease(app.teamId, app.tournamentId);
      }
    },
    deleteTournament: async (id) => {
      await store.deleteTournament(id);
      for (const team of store.state.teams) onRelease(team.id, id);
    },
  };
}
