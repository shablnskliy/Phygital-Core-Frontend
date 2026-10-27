import { type PlatformActions } from "../model/types";
import { type ActionContext } from "./actionContext";

export function createTournamentActions(
  context: ActionContext,
): Pick<
  PlatformActions,
  | "submitTournamentApplication"
  | "createTournament"
  | "updateTournament"
  | "deleteTournament"
  | "updateTournamentApplication"
> {
  const { state, signedInUser, mutate, withLog, commitAdmin, fullName } = context;

  const getToken = () => localStorage.getItem("jwt_token");

  return {
    // ПОДАЧА ЗАЯВКИ (ИДЕТ В БАЗУ)
    submitTournamentApplication: async (teamId, tournamentId, additionalInfo) => {
      if (!signedInUser) throw new Error("Требуется авторизация");
      const team = state.teams.find((item) => item.id === teamId),
        tournament = state.tournaments.find((item) => item.id === tournamentId);
      if (!team || !tournament) throw new Error("Команда или турнир не найдены");

      if (
        state.tournamentApplications.some(
          (item) =>
            item.teamId === teamId &&
            item.tournamentId === tournamentId &&
            item.status !== "REJECTED",
        )
      )
        throw new Error("Заявка этой команды уже отправлена");

      const response = await fetch("http://localhost:8080/api/tournament-applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          teamId,
          tournamentId,
          captainName: fullName(signedInUser),
          additionalInfo: additionalInfo.trim(),
          status: "NEW",
        }),
      });

      if (!response.ok) throw new Error("Ошибка отправки заявки");
      const savedApp = await response.json();

      await mutate((previous) =>
        withLog(
          {
            ...previous,
            tournamentApplications: [savedApp, ...previous.tournamentApplications],
          },
          fullName(signedInUser),
          "Создание",
          "Заявка на турнир",
          savedApp.id,
          `Подана заявка команды «${team.name}» на «${tournament.name}»`,
        ),
      );
    },

    // СОЗДАНИЕ ТУРНИРА (ИДЕТ В БАЗУ)
    createTournament: async (draft) => {
      if (
        !draft.name.trim() ||
        !draft.shortDescription.trim() ||
        !draft.city.trim() ||
        !draft.startAt ||
        !draft.endAt
      )
        throw new Error("Заполните обязательные поля");
      if (draft.shortDescription.length > 500)
        throw new Error("Краткое описание не должно превышать 500 символов");
      if (new Date(draft.endAt) <= new Date(draft.startAt))
        throw new Error("Окончание должно быть позднее начала");

      const response = await fetch("http://localhost:8080/api/tournaments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          name: draft.name.trim(),
          shortDescription: draft.shortDescription.trim(),
          city: draft.city.trim(),
          startAt: draft.startAt,
          endAt: draft.endAt,
          registrationEndsAt: draft.startAt,
          description: draft.fullDescription?.trim() || draft.shortDescription.trim(),
          discipline: "",
          format: "",
          venue: "",
          publicNumber: "",
          rules: [],
          imageName: draft.imageName,
          imageUrl: draft.imageUrl,
        }),
      });

      if (!response.ok) throw new Error("Ошибка сервера при создании турнира");
      const savedTournament = await response.json();

      await commitAdmin(
        "Создание",
        "Турнир",
        savedTournament.id,
        `Создан турнир «${savedTournament.name}»`,
        (previous) => ({
          ...previous,
          tournaments: [...previous.tournaments, savedTournament],
        }),
      );
    },

    // ОБНОВЛЕНИЕ ТУРНИРА (ИДЕТ В БАЗУ)
    updateTournament: async (id, patch) => {
      const existing = state.tournaments.find((item) => item.id === id);
      if (!existing) throw new Error("Турнир не найден");
      const next = { ...existing, ...patch };

      if (
        !next.name.trim() ||
        !next.shortDescription.trim() ||
        !next.city.trim() ||
        !next.startAt ||
        !next.endAt
      )
        throw new Error("Заполните обязательные поля");
      if (new Date(next.endAt) <= new Date(next.startAt))
        throw new Error("Окончание должно быть позднее начала");

      const response = await fetch(`http://localhost:8080/api/tournaments/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          name: next.name.trim(),
          shortDescription: next.shortDescription.trim(),
          city: next.city.trim(),
          startAt: next.startAt,
          endAt: next.endAt,
          registrationEndsAt: next.registrationEndsAt || next.startAt,
          description: next.description,
          discipline: next.discipline,
          format: next.format,
          venue: next.venue,
          publicNumber: next.publicNumber,
          rules: next.rules,
          imageName: next.imageName,
          imageUrl: next.imageUrl,
        }),
      });

      if (!response.ok) throw new Error("Ошибка сервера при обновлении турнира");

      await commitAdmin("Изменение", "Турнир", id, "Обновлены данные турнира", (previous) => ({
        ...previous,
        tournaments: previous.tournaments.map((item) =>
          item.id === id
            ? {
                ...next,
                name: next.name.trim(),
                city: next.city.trim(),
                shortDescription: next.shortDescription.trim(),
              }
            : item,
        ),
      }));
    },

    // УДАЛЕНИЕ ТУРНИРА (ИДЕТ В БАЗУ)
    deleteTournament: async (id) => {
      const response = await fetch(`http://localhost:8080/api/tournaments/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!response.ok) throw new Error("Ошибка сервера при удалении турнира");

      await commitAdmin(
        "Удаление",
        "Турнир",
        id,
        "Турнир и связанные заявки удалены",
        (previous) => ({
          ...previous,
          tournaments: previous.tournaments.filter((tournament) => tournament.id !== id),
          tournamentApplications: previous.tournamentApplications.filter(
            (item) => item.tournamentId !== id,
          ),
        }),
      );
    },

    // ОБНОВЛЕНИЕ СТАТУСА ЗАЯВКИ (ИДЕТ В БАЗУ)
    updateTournamentApplication: async (id, status) => {
      const response = await fetch(
        `http://localhost:8080/api/tournament-applications/${id}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ status }),
        },
      );

      if (!response.ok) throw new Error("Ошибка обновления статуса заявки");

      await commitAdmin(
        status === "APPROVED" ? "Одобрение" : "Отклонение",
        "Заявка на турнир",
        id,
        `Статус заявки изменён на ${status}`,
        (previous) => ({
          ...previous,
          tournamentApplications: previous.tournamentApplications.map((application) =>
            application.id === id ? { ...application, status } : application,
          ),
        }),
      );
    },
  };
}
