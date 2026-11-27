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
  const BASE_URL = "https://phygitalcore.ru/api/v1"; // <-- Единый адрес

  return {
    // 1. СОЗДАНИЕ КОМАНДЫ АДМИНОМ
    createTeam: async (draft) => {
      if (!draft.name.trim()) throw new Error("Введите название команды");
      if (!draft.playerIds.length) throw new Error("Добавьте хотя бы одного игрока");

      const members = draft.playerIds.map((id) => {
        const user = state.users.find((item) => item.id === id);
        if (!user) throw new Error("Один из выбранных игроков не найден");
        return {
          userId: user.id,
          name: fullName(user),
          captain: user.id === draft.captainId,
        };
      });

      const response = await fetch(`${BASE_URL}/teams`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          name: draft.name.trim(),
          discipline: "Фиджитал-спорт",
          members: members,
        }),
      });

      if (!response.ok) throw new Error("Ошибка сервера при создании команды");

      const savedTeam = await response.json();

      await commitAdmin(
        "Создание",
        "Команда",
        savedTeam.id,
        `Создана команда «${savedTeam.name}»`,
        (previous) => ({
          ...previous,
          teams: [...previous.teams, savedTeam],
        }),
      );
    },

    // 2. СОЗДАНИЕ КОМАНДЫ ИГРОКОМ
    createCaptainTeam: async (name) => {
      if (!signedInUser) throw new Error("Войдите в аккаунт, чтобы создать команду");
      if (signedInUser.role === "ADMIN")
        throw new Error("Администратор не может входить в игровой состав");
      if (!name.trim()) throw new Error("Введите название команды");
      if (state.teams.some((team) => team.name.toLowerCase() === name.trim().toLowerCase()))
        throw new Error("Команда с таким названием уже существует");

      const response = await fetch(`${BASE_URL}/teams`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          discipline: "Фиджитал-спорт",
          members: [{ userId: signedInUser.id, name: fullName(signedInUser), captain: true }],
        }),
      });

      if (!response.ok) throw new Error("Ошибка сервера при создании команды");

      const savedTeam = await response.json();

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

    // 3. ОБНОВЛЕНИЕ НАЗВАНИЯ
    updateTeam: async (id, patch) => {
      const name = patch.name?.trim();
      if (!name) throw new Error("Введите название команды");

      const currentTeam = state.teams.find((t) => t.id === id);
      if (!currentTeam) throw new Error("Команда не найдена");

      const response = await fetch(`${BASE_URL}/teams/${id}`, {
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

      return commitTeam(id, "Изменение", "Изменено название команды", (previous) => ({
        ...previous,
        teams: previous.teams.map((team) =>
          team.id === id ? { ...team, name, updatedAt: new Date().toISOString() } : team,
        ),
      }));
    },

    // 4. УДАЛЕНИЕ КОМАНДЫ
    deleteTeam: async (id) => {
      const response = await fetch(`${BASE_URL}/teams/${id}`, {
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

    // 5. ВЫХОД ИЗ КОМАНДЫ
    leaveTeam: async (teamId) => {
      if (!signedInUser) throw new Error("Войдите в аккаунт");

      const response = await fetch(`${BASE_URL}/teams/${teamId}/members/${signedInUser.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!response.ok) throw new Error("Ошибка выхода из команды");

      await mutate((previous) => {
        const team = previous.teams.find((item) => item.id === teamId);
        if (!team) throw new Error("Команда не найдена");

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

      window.location.reload();
    },

    // 6. УДАЛЕНИЕ УЧАСТНИКА
    removeTeamMember: async (teamId, userId) => {
      const member = state.teams
        .find((team) => team.id === teamId)
        ?.members.find((item) => item.id === userId);
      if (!member) throw new Error("Участник не найден");

      const response = await fetch(`${BASE_URL}/teams/${teamId}/members/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!response.ok) throw new Error("Ошибка удаления участника");

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

    // 7. ДОБАВЛЕНИЕ УЧАСТНИКА
    addTeamMember: async (teamId, userId) => {
      const user = state.users.find((item) => item.id === userId);
      if (!user) throw new Error("Пользователь не найден");

      const response = await fetch(`${BASE_URL}/teams/${teamId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) throw new Error("Ошибка добавления участника");

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

    // 8. НАЗНАЧЕНИЕ КАПИТАНА
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
  };
}
