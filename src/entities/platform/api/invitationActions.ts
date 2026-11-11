import { type TeamInvitation } from "@/entities/team-invitation/@x/platform";
import { type AppNotification } from "@/entities/notification/@x/platform";
import { type PlatformActions } from "../model/types";
import { type InvitationStatus } from "@/entities/team-invitation/@x/platform";
import { type ActionContext } from "./actionContext";

export function createInvitationActions(
  context: ActionContext,
): Pick<PlatformActions, "sendInvitation" | "respondInvitation" | "cancelInvitation"> {
  const { state, signedInUser, mutate, withLog, fullName } = context;

  const getToken = () => localStorage.getItem("jwt_token");
  const BASE_URL = "https://phygitalcore.ru/api/v1";

  return {
    // ОТПРАВКА ПРИГЛАШЕНИЯ
    sendInvitation: async (teamId, recipientId) => {
      if (!signedInUser) throw new Error("Требуется авторизация");
      const team = state.teams.find((item) => item.id === teamId),
        recipient = state.users.find((item) => item.id === recipientId);
      if (!team || !recipient) throw new Error("Команда или пользователь не найдены");

      if (!team.members.some((member) => member.id === signedInUser.id && member.captain))
        throw new Error("Приглашения может отправлять только капитан");

      // 1. Создаем приглашение на Java-бэкенде
      const response = await fetch(`${BASE_URL}/invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          teamId,
          senderId: signedInUser.id,
          recipientId,
        }),
      });

      if (!response.ok) throw new Error("Не удалось отправить приглашение");
      const savedInvitation = await response.json();

      // 2. Создаем уведомление на Java-бэкенде
      await fetch(`${BASE_URL}/notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          userId: recipientId,
          type: "team_invitation",
          invitationId: savedInvitation.id,
          title: "Приглашение в команду",
          message: `${fullName(signedInUser)} приглашает вас присоединиться к команде ${team.name}.`,
          read: false,
        }),
      });

      // 3. Обновляем локальное состояние
      const notification: AppNotification = {
        id: crypto.randomUUID(),
        userId: recipientId,
        type: "team_invitation",
        invitationId: savedInvitation.id,
        title: "Приглашение в команду",
        message: `${fullName(signedInUser)} приглашает вас присоединиться к команде ${team.name}.`,
        createdAt: savedInvitation.createdAt,
        read: false,
      };

      await mutate((previous) =>
        withLog(
          {
            ...previous,
            invitations: [savedInvitation, ...previous.invitations],
            notifications: [notification, ...previous.notifications],
          },
          fullName(signedInUser),
          "Приглашение",
          "Команда",
          teamId,
          `Приглашён игрок ${fullName(recipient)}`,
        ),
      );
    },

    // ОТВЕТ НА ПРИГЛАШЕНИЕ (Принять/Отклонить)
    respondInvitation: async (invitationId, response) => {
      if (!signedInUser) throw new Error("Требуется авторизация");
      const invitation = state.invitations.find((item) => item.id === invitationId);
      if (!invitation || invitation.status !== "pending")
        throw new Error("Приглашение уже обработано");

      // 1. Обновляем статус приглашения на Java (и добавляем в команду)
      const res = await fetch(`${BASE_URL}/invitations/${invitationId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ status: response }),
      });

      if (!res.ok) throw new Error("Ошибка ответа на приглашение");

      const team = state.teams.find((item) => item.id === invitation.teamId);
      if (!team) throw new Error("Команда не найдена");

      const now = new Date().toISOString(),
        accepted = response === "accepted";

      // 2. Обновляем локальное состояние
      await mutate((previous) => {
        const teams = accepted
          ? previous.teams.map((item) =>
              item.id === team.id && !item.members.some((member) => member.id === signedInUser.id)
                ? {
                    ...item,
                    updatedAt: now,
                    members: [
                      ...item.members,
                      { id: signedInUser.id, name: fullName(signedInUser) },
                    ],
                  }
                : item,
            )
          : previous.teams;

        const invitations = previous.invitations.map((item) =>
          item.id === invitationId
            ? { ...item, status: response as InvitationStatus, respondedAt: now }
            : item,
        );

        // ВАЖНО: Помечаем связанное уведомление как прочитанное локально
        const notifications = previous.notifications.map((item) =>
          item.invitationId === invitationId ? { ...item, read: true } : item,
        );

        return withLog(
          { ...previous, teams, invitations, notifications },
          fullName(signedInUser),
          accepted ? "Принятие" : "Отклонение",
          "Приглашение",
          invitationId,
          `${accepted ? "Принято" : "Отклонено"} приглашение в «${team.name}»`,
        );
      });

      // 3. Перезагружаем страницу, чтобы подтянуть обновленный состав
      if (accepted) {
        window.location.reload();
      }
    },

    // ОТМЕНА ПРИГЛАШЕНИЯ
    cancelInvitation: async (invitationId) => {
      if (!signedInUser) throw new Error("Требуется авторизация");

      const res = await fetch(`${BASE_URL}/invitations/${invitationId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ status: "cancelled" }),
      });

      if (!res.ok) throw new Error("Ошибка отмены приглашения");

      await mutate((previous) =>
        withLog(
          {
            ...previous,
            invitations: previous.invitations.map((item) =>
              item.id === invitationId
                ? { ...item, status: "cancelled", respondedAt: new Date().toISOString() }
                : item,
            ),
            // Помечаем уведомление как прочитанное при отмене
            notifications: previous.notifications.map((item) =>
              item.invitationId === invitationId ? { ...item, read: true } : item,
            ),
          },
          fullName(signedInUser),
          "Отмена",
          "Приглашение",
          invitationId,
          "Приглашение отменено капитаном",
        ),
      );
    },
  };
}
