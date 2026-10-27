import { type AdminLog } from "@/entities/admin-log/@x/feedback";
import { type User } from "@/entities/user/@x/feedback";
import { FEEDBACK_TOPICS, type Feedback, type FeedbackDraft, type FeedbackStatus } from "./model";

const API_URL = "http://localhost:8080/api";

function requireAdmin(actor: User | null) {
  if (actor?.role !== "ADMIN")
    throw new Error("Просматривать и обрабатывать обращения может только администратор");
  return actor;
}

function validate(draft: FeedbackDraft) {
  const cleaned = {
    name: draft.name.trim(),
    email: draft.email.trim().toLowerCase(),
    topic: draft.topic,
    message: draft.message.trim(),
  };
  if (cleaned.name.length < 2 || cleaned.name.length > 100)
    throw new Error("Имя должно содержать от 2 до 100 символов");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned.email) || cleaned.email.length > 254)
    throw new Error("Укажите корректный email");
  if (!(FEEDBACK_TOPICS as readonly string[]).includes(cleaned.topic))
    throw new Error("Выберите тему обращения");
  if (!cleaned.message || cleaned.message.length > 500)
    throw new Error("Сообщение должно содержать от 1 до 500 символов");
  return cleaned;
}

const getToken = () => localStorage.getItem("jwt_token");

export const feedbackService = {
  // Создать обращение (форма на сайте)
  async createFeedback(draft: FeedbackDraft): Promise<Feedback> {
    const validData = validate(draft);

    const response = await fetch(`${API_URL}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        ...validData,
        status: "new",
      }),
    });

    if (!response.ok) throw new Error("Ошибка отправки обращения");
    return response.json();
  },

  // Получить список (для админки)
  async getFeedbackList(actor: User | null): Promise<Feedback[]> {
    requireAdmin(actor);
    const response = await fetch(`${API_URL}/feedback`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!response.ok) throw new Error("Ошибка загрузки обращений");
    return response.json();
  },

  async getFeedbackById(id: string, actor: User | null): Promise<Feedback> {
    const feedback = (await this.getFeedbackList(actor)).find((item) => item.id === id);
    if (!feedback) throw new Error("Обращение не найдено");
    return feedback;
  },

  // Отметить просмотренным
  async markViewed(id: string, actor: User | null): Promise<void> {
    requireAdmin(actor);
    await fetch(`${API_URL}/feedback/${id}/viewed`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
  },

  // Обновить статус (Новое -> В работе -> Закрыто)
  async updateFeedbackStatus(
    id: string,
    status: FeedbackStatus,
    actor: User | null,
  ): Promise<void> {
    const admin = requireAdmin(actor);
    if (!["new", "in_progress", "closed"].includes(status)) throw new Error("Некорректный статус");

    // 1. Обновляем статус в базе
    const response = await fetch(`${API_URL}/feedback/${id}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) throw new Error("Ошибка обновления статуса");

    // 2. Пишем лог в базу
    await fetch(`${API_URL}/admin-logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        date: new Date().toISOString(),
        admin: `${admin.firstName} ${admin.lastName}`,
        action: "Изменение",
        entityType: "Обращение",
        entityId: id,
        details: `Статус обращения изменён на ${status}`,
      }),
    });
  },
};
