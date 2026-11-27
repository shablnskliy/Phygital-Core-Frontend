export interface LockApplication {
  id: string;
  teamId: string;
  tournamentId: string;
  status: string;
}
export interface LockTournament {
  id: string;
  name: string;
  endAt?: string | null;
}
export interface LocalTeamLock {
  teamId: string;
  tournamentId: string;
  tournamentName: string;
  previousApplicationIds: string[];
}

export function getTeamLockReason(
  teamId: string,
  applications: LockApplication[],
  tournaments: LockTournament[],
  localLocks: LocalTeamLock[] = [],
  now = new Date(),
) {
  const unfinished = (id: string) => {
    const tournament = tournaments.find((item) => item.id === id);
    return !tournament?.endAt || new Date(tournament.endAt) >= now;
  };
  const application = applications.find(
    (item) =>
      item.teamId === teamId &&
      ["NEW", "APPROVED"].includes(item.status) &&
      unfinished(item.tournamentId),
  );
  const local = localLocks.find(
    (item) =>
      item.teamId === teamId &&
      unfinished(item.tournamentId) &&
      !applications.some(
        (app) =>
          app.teamId === teamId &&
          app.tournamentId === item.tournamentId &&
          app.status === "REJECTED" &&
          !item.previousApplicationIds.includes(app.id),
      ),
  );
  const name = application
    ? tournaments.find((item) => item.id === application.tournamentId)?.name
    : local?.tournamentName;
  if (!application && !local) return "";
  return `Команда подала заявку${name ? ` на «${name}»` : " на турнир"}. Название, состав и капитан заблокированы до завершения турнира или отклонения заявки.`;
}
