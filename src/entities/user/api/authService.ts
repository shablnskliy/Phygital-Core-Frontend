import type { AuthUser, RegisterPayload, ProfilePatch } from "../model/auth-types";

const BASE_URL = "https://phygitalcore.ru/api/v1"; // Обновили путь на v1

const getToken = () => localStorage.getItem("jwt_token");
const setToken = (token: string) => localStorage.setItem("jwt_token", token);
const removeToken = () => localStorage.removeItem("jwt_token");

// Вспомогательная функция для безопасного чтения ошибок
async function handleError(response: Response, defaultMessage: string) {
  const text = await response.text();
  try {
    if (text) {
      const error = JSON.parse(text);
      throw new Error(error.message || defaultMessage);
    }
  } catch (e) {
    // Если это не JSON, просто выкидываем дефолтную ошибку
  }
  throw new Error(`${defaultMessage} (Код: ${response.status})`);
}

export const authService = {
  async login(email: string, password: string): Promise<AuthUser> {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      await handleError(response, "Неверный email или пароль");
    }

    const data = await response.json();
    setToken(data.token);
    return data.user;
  },

  async register(payload: RegisterPayload): Promise<AuthUser> {
    const response = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      await handleError(response, "Ошибка регистрации");
    }

    const data = await response.json();
    setToken(data.token);
    return data.user;
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    const token = getToken();
    if (!token) return null;

    const response = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      removeToken();
      return null;
    }
    return response.json();
  },

  async logout(): Promise<void> {
    removeToken();
  },

  // Заглушки для админских методов (чтобы TypeScript не ругался,
  // так как реальная логика теперь в userActions.ts)
  async adminCreateAccount(payload: RegisterPayload): Promise<AuthUser> {
    throw new Error("Используйте панель администратора");
  },
  async adminUpdateAccount(userId: string, patch: Partial<AuthUser>): Promise<AuthUser> {
    throw new Error("Используйте панель администратора");
  },
  async adminResetPassword(user: AuthUser): Promise<void> {
    throw new Error("Используйте панель администратора");
  },
  async adminDeleteAccount(userId: string): Promise<void> {
    throw new Error("Используйте панель администратора");
  },
  async updateProfile(userId: string, patch: ProfilePatch): Promise<AuthUser> {
    const response = await fetch(`${BASE_URL}/auth/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(patch),
    });

    if (!response.ok) {
      const text = await response.text();
      try {
        if (text) {
          const error = JSON.parse(text);
          throw new Error(error.message || "Ошибка сохранения профиля");
        }
      } catch (e) {
        /* ignore */
      }
      throw new Error(`Ошибка сервера (${response.status})`);
    }

    return response.json();
  },
  async changePassword(
    userId: string,
    currentPassword: string,
    nextPassword: string,
  ): Promise<void> {
    const response = await fetch(`${BASE_URL}/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        currentPassword: currentPassword,
        newPassword: nextPassword,
      }),
    });

    if (!response.ok) {
      // Безопасное чтение ошибки (как мы делали для логина)
      const text = await response.text();
      try {
        if (text) {
          const error = JSON.parse(text);
          throw new Error(error.message || "Ошибка смены пароля");
        }
      } catch (e) {
        /* ignore */
      }
      throw new Error(`Ошибка сервера (${response.status})`);
    }
  },
};
