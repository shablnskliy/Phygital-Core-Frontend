import type { AuthUser, RegisterPayload, ProfilePatch } from "../model/auth-types";

const BASE_URL = "http://localhost:8080/api"; // Твой Java-бэкенд

const getToken = () => localStorage.getItem("jwt_token");
const setToken = (token: string) => localStorage.setItem("jwt_token", token);
const removeToken = () => localStorage.removeItem("jwt_token");

export const authService = {
  async login(email: string, password: string): Promise<AuthUser> {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Неверный email или пароль");
    }

    const data = await response.json();
    setToken(data.token); // Сохраняем JWT токен
    return data.user; // Возвращаем данные юзера
  },

  async register(payload: RegisterPayload): Promise<AuthUser> {
    const response = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Ошибка регистрации");
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
      removeToken(); // Если токен протух, удаляем его
      return null;
    }
    return response.json();
  },

  async logout(): Promise<void> {
    removeToken();
  },

  // Заглушки для админских методов, чтобы TypeScript не ругался
  async adminCreateAccount(payload: RegisterPayload): Promise<AuthUser> {
    throw new Error("Not implemented");
  },
  async adminUpdateAccount(userId: string, patch: Partial<AuthUser>): Promise<AuthUser> {
    throw new Error("Not implemented");
  },
  async adminResetPassword(user: AuthUser): Promise<void> {
    throw new Error("Not implemented");
  },
  async adminDeleteAccount(userId: string): Promise<void> {
    throw new Error("Not implemented");
  },
  async updateProfile(userId: string, patch: ProfilePatch): Promise<AuthUser> {
    throw new Error("Not implemented");
  },
  async changePassword(
    userId: string,
    currentPassword: string,
    nextPassword: string,
  ): Promise<void> {
    throw new Error("Not implemented");
  },
};
