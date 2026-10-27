import { type Team } from "@/entities/team/@x/platform";
import { type PlatformActions } from "../model/types";
import { type ActionContext } from "./actionContext";

export function createTeamActions(
  context: ActionContext,
): Pick<
  PlatformActions,
  | "createTeam"
  | "createCaptainTeam"
  | "updateTeam"
  | "addTeamMember"
  | "removeTeamMember"
  | "leaveTeam"
  | "assignCaptain"
  | "deleteTeam"
> {
  const { state, signedInUser, mutate, withLog, commitAdmin, commitTeam, fullName } = context;

  const getToken = () => localStorage.getItem("jwt_token");

  return {
    // Админское создание (оставляем локально)
    createTeam: (draft) => {
      if (!draft.name.trim()) return Promise.reject(new Error("Введите название команды"));
      if (!draft.playerIds.length)
        return Promise.reject(new Error("Добавьте хотя бы одного игрока"));

      const id = crypto.randomUUID();
      return commitAdmin(
        "Создание",
        "Команда",
        id,
        `Создана команда «${draft.name}»`,
        (previous) => ({
          ...previous,
          teams: [
            ...previous.teams,
            {
              id,
              name: draft.name.trim(),
              discipline: "Фиджитал-спорт",
              createdAt: new Date().toISOString(),
              members: draft.playerIds.map((userId) => {
                const user = previous.users.find((item) => item.id === userId)!;
                return { id: user.id, name: fullName(user), captain: user.id === draft.captainId };
              }),
            },
          ],
        }),
      );
    },

    // Создание игроком (ИДЕТ В БАЗУ)
    createCaptainTeam: async (name) => {
      if (!signedInUser) throw new Error("Войдите в аккаунт, чтобы создать команду");
      if (signedInUser.role === "ADMIN")
        throw new Error("Администратор не может входить в игровой состав");
      if (!name.trim()) throw new Error("Введите название команды");
      if (state.teams.some((team) => team.name.toLowerCase() === name.trim().toLowerCase()))
        throw new Error("Команда с таким названием уже существует");

      const response = await fetch("http://localhost:8080/api/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          discipline: "Фиджитал-спорт",
          members: [{ userId: signedInUser.id, name: fullName(signedInUser), captain: true }], // Передаем userId!
        }),
      });

      if (!response.ok) throw new Error("Ошибка сервера при создании команды");

      const savedTeam = (await response.json()) as any;

      const team: Team = {
        id: savedTeam.id,
        name: savedTeam.name,
        discipline: savedTeam.discipline,
        createdAt: savedTeam.createdAt,
        members: [{ id: signedInUser.id, name: fullName(signedInUser), captain: true }],
      };

      await mutate((previous) =>
        withLog(
          { ...previous, teams: [...previous.teams, team] },
          fullName(signedInUser),
          "Создание",
          "Команда",
          team.id,
          `Создана команда «${team.name}»`,
        ),
      );
      return team;
    },

    // Изменение названия (ИДЕТ В БАЗУ)
    updateTeam: async (id, patch) => {
      const name = patch.name?.trim();
      if (!name) throw new Error("Введите название команды");
      if (name.length > 80) throw new Error("Название не должно превышать 80 символов");

      const currentTeam = state.teams.find((t) => t.id === id);
      if (!currentTeam) throw new Error("Команда не найдена");

      // Отправляем PUT запрос в Java
      const response = await fetch(`http://localhost:8080/api/teams/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          name: name,
          discipline: currentTeam.discipline,
          members: currentTeam.members.map((m) => ({
            userId: m.id,
            name: m.name,
            captain: m.captain,
          })),
        }),
      });

      if (!response.ok) throw new Error("Ошибка сервера при обновлении");

      // Обновляем локально
      return commitTeam(id, "Изменение", "Изменено название команды", (previous) => ({
        ...previous,
        teams: previous.teams.map((team) =>
          team.id === id ? { ...team, name, updatedAt: new Date().toISOString() } : team,
        ),
      }));
    },

    // Удаление (ИДЕТ В БАЗУ)
    deleteTeam: async (id) => {
      const response = await fetch(`http://localhost:8080/api/teams/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!response.ok) throw new Error("Ошибка сервера при удалении");

      return commitTeam(id, "Удаление", "Команда удалена", (previous) => ({
        ...previous,
        teams: previous.teams.filter((team) => team.id !== id),
        invitations: previous.invitations.map((item) =>
          item.teamId === id && item.status === "pending"
            ? { ...item, status: "cancelled", respondedAt: new Date().toISOString() }
            : item,
        ),
        notifications: previous.notifications.map((item) =>
          previous.invitations.some(
            (invite) => invite.teamId === id && invite.id === item.invitationId,
          )
            ? { ...item, read: true }
            : item,
        ),
        tournamentApplications: previous.tournamentApplications.filter(
          (item) => item.teamId !== id,
        ),
      }));
    },

    // --- ОСТАЛЬНЫЕ МЕТОДЫ ПОКА ОСТАВЛЯЕМ ЛОКАЛЬНЫМИ ---

    addTeamMember: (teamId, userId) => {
      const user = state.users.find((item) => item.id === userId),
        team = state.teams.find((item) => item.id === teamId);
      if (!user || !team) return Promise.reject(new Error("Пользователь или команда не найдены"));
      if (team.members.some((member) => member.id === userId))
        return Promise.reject(new Error("Пользователь уже состоит в команде"));
      return commitAdmin(
        "Изменение",
        "Команда",
        teamId,
        `Добавлен участник ${fullName(user)}`,
        (previous) => ({
          ...previous,
          teams: previous.teams.map((item) =>
            item.id === teamId
              ? {
                  ...item,
                  updatedAt: new Date().toISOString(),
                  members: [...item.members, { id: user.id, name: fullName(user) }],
                }
              : item,
          ),
        }),
      );
    },

    removeTeamMember: (teamId, userId) => {
      const member = state.teams
        .find((team) => team.id === teamId)
        ?.members.find((item) => item.id === userId);
      if (!member) return Promise.reject(new Error("Участник не найден"));
      if (member.captain) return Promise.reject(new Error("Сначала назначьте другого капитана"));
      return commitTeam(teamId, "Изменение", `Удалён участник ${member.name}`, (previous) => ({
        ...previous,
        teams: previous.teams.map((team) =>
          team.id === teamId
            ? {
                ...team,
                updatedAt: new Date().toISOString(),
                members: team.members.filter((item) => item.id !== userId),
              }
            : team,
        ),
      }));
    },

    assignCaptain: (teamId, userId) => {
      const member = state.teams
        .find((team) => team.id === teamId)
        ?.members.find((item) => item.id === userId);
      if (!member) return Promise.reject(new Error("Капитан должен быть участником команды"));
      return commitTeam(teamId, "Изменение", `Капитаном назначен ${member.name}`, (previous) => ({
        ...previous,
        teams: previous.teams.map((team) =>
          team.id === teamId
            ? {
                ...team,
                updatedAt: new Date().toISOString(),
                members: team.members.map((item) => ({ ...item, captain: item.id === userId })),
              }
            : team,
        ),
      }));
    },

    leaveTeam: async (teamId) => {
      if (!signedInUser) throw new Error("Войдите в аккаунт");
      await mutate((previous) => {
        const team = previous.teams.find((item) => item.id === teamId);
        if (!team) throw new Error("Команда не найдена");
        const member = team.members.find((item) => item.id === signedInUser.id);
        if (!member) throw new Error("Вы не состоите в этой команде");
        if (member.captain) throw new Error("Сначала передайте права капитана или удалите команду");
        return withLog(
          {
            ...previous,
            teams: previous.teams.map((item) =>
              item.id === teamId
                ? {
                    ...item,
                    members: item.members.filter((player) => player.id !== signedInUser.id),
                    updatedAt: new Date().toISOString(),
                  }
                : item,
            ),
          },
          fullName(signedInUser),
          "Выход",
          "Команда",
          teamId,
          `${fullName(signedInUser)} покинул команду`,
        );
      });
    },
  };
}
