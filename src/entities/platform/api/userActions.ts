import { type PlatformActions } from "../model/types";
import { type ActionContext } from "./actionContext";

export function createUserActions(
  context: ActionContext,
): Pick<PlatformActions, "createUser" | "updateUser" | "resetPassword" | "deleteUser"> {
  const { state, signedInUser, requireAdmin, commitAdmin, fullName } = context;

  const getToken = () => localStorage.getItem("jwt_token");

  return {
    createUser: async (payload) => {
      requireAdmin();
      if (payload.password.length < 8)
        throw new Error("Пароль должен содержать не менее 8 символов");

      const response = await fetch("http://localhost:8080/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Ошибка создания пользователя");
      }

      const account = await response.json();

      await commitAdmin(
        "Создание",
        "Пользователь",
        account.id,
        `Создан пользователь ${fullName(account)}`,
        (previous) => ({
          ...previous,
          users: [
            ...previous.users.filter((item) => item.id !== account.id),
            { ...account, createdAt: new Date().toISOString() },
          ],
        }),
      );
    },

    updateUser: async (id, patch) => {
      requireAdmin();
      const existing = state.users.find((user) => user.id === id);
      if (!existing) throw new Error("Пользователь не найден");

      const response = await fetch(`http://localhost:8080/api/users/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ ...existing, ...patch }),
      });

      if (!response.ok) throw new Error("Ошибка обновления пользователя");

      await commitAdmin(
        "Изменение",
        "Пользователь",
        id,
        "Обновлены данные пользователя",
        (previous) => ({
          ...previous,
          users: previous.users.map((user) => (user.id === id ? { ...user, ...patch } : user)),
        }),
      );
    },

    resetPassword: async (id) => {
      requireAdmin();
      const existing = state.users.find((user) => user.id === id);
      if (!existing) throw new Error("Пользователь не найден");

      const response = await fetch(`http://localhost:8080/api/users/${id}/reset-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!response.ok) throw new Error("Ошибка сброса пароля");

      await commitAdmin(
        "Сброс пароля",
        "Пользователь",
        id,
        "Пароль пользователя заменён на 12345678",
        (previous) => previous,
      );
    },

    deleteUser: async (id) => {
      requireAdmin();
      if (id === signedInUser?.id) throw new Error("Нельзя удалить текущий аккаунт");

      if (
        state.teams.some((team) =>
          team.members.some((member) => member.id === id && member.captain),
        )
      )
        throw new Error("Сначала назначьте другого капитана в командах пользователя");

      const response = await fetch(`http://localhost:8080/api/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!response.ok) throw new Error("Ошибка удаления пользователя");

      await commitAdmin("Удаление", "Пользователь", id, "Пользователь удалён", (previous) => ({
        ...previous,
        users: previous.users.filter((user) => user.id !== id),
        teams: previous.teams.map((team) => ({
          ...team,
          members: team.members.filter((member) => member.id !== id),
        })),
        invitations: previous.invitations.filter(
          (item) => item.recipientId !== id && item.senderId !== id,
        ),
        notifications: previous.notifications.filter((item) => item.userId !== id),
      }));
    },
  };
}
