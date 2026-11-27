"use client";
import Link from "next/link";
import { TournamentsAdmin } from "@/widgets/admin-tournaments";
import { useDemoSandbox } from "@/features/demo-sandbox";

export function DemoAdminPage() {
  const sandbox = useDemoSandbox();
  return (
    <main className="demo-workspace">
      <header className="demo-banner glass">
        <p className="eyebrow">ЛОКАЛЬНЫЙ ДЕМО-РЕЖИМ</p>
        <h1>Демо-админка · Создание турниров</h1>
        <p>
          Можно создавать, редактировать и удалять демонстрационные турниры и заполнять их страницы.
          Изменения сохраняются отдельно в этом браузере и не отправляются на сервер.
        </p>
        <p>Нажмите «Создать турнир». После создания: «Просмотреть» → «Страница турнира».</p>
        <nav aria-label="Демо-страницы">
          <Link href="/visual-check">Заполненный пример турнира</Link>
          <Link href="/">Главная страница</Link>
          <Link href="/admin/tournaments">Реальная админка — вход с аккаунтом администратора</Link>
        </nav>
      </header>
      <TournamentsAdmin
        sandbox={{ ...sandbox, previewHref: (id) => `/visual-check?id=${encodeURIComponent(id)}` }}
      />
    </main>
  );
}
