const BASE_URL = "http://localhost:8080/api";

export const apiClient = {
  async get(endpoint: string) {
    const token = localStorage.getItem("jwt_token");
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error(`Ошибка запроса: ${res.status}`);
    return res.json();
  },

  async post(endpoint: string, body: any) {
    const token = localStorage.getItem("jwt_token");
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `Ошибка запроса: ${res.status}`);
    }
    return res.json();
  },

  async delete(endpoint: string) {
    const token = localStorage.getItem("jwt_token");
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: "DELETE",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error(`Ошибка удаления: ${res.status}`);
    return true;
  },
};
