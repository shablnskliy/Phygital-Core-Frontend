import type { Team } from "./model/types";

const BASE_URL = "http://localhost:8080/api";

const getToken = () => localStorage.getItem("jwt_token");

export const teamApi = {
  // Получить все команды из базы
  async getTeams(): Promise<Team[]> {
    const res = await fetch(`${BASE_URL}/teams`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });
    if (!res.ok) throw new Error("Ошибка загрузки команд");
    return res.json();
  },

  // Создать новую команду
  async createTeam(data: {
    name: string;
    discipline: string;
    members: { name: string; captain: boolean }[];
  }): Promise<Team> {
    const res = await fetch(`${BASE_URL}/teams`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Ошибка создания команды");
    return res.json();
  },
};
