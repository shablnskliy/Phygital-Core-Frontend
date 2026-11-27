"use client";
import Link from "next/link";
import { useState } from "react";
import { TournamentDetail } from "@/widgets/tournament-detail";
import { TournamentPageEditor } from "@/features/edit-tournament-page";
import { useDemoSandbox } from "@/features/demo-sandbox";
import { getTournamentPageDefaults } from "@/entities/tournament";
import { Button } from "@/shared/ui/Button";

export function DemoTournamentPage({ id }: { id?: string }) {
  const sandbox = useDemoSandbox();
  const [editor, setEditor] = useState(false);
  const targetId = id ?? sandbox.visual.tournament.id;
  const tournament = [...sandbox.store.state.tournaments, ...sandbox.local.tournaments].find(
    (item) => item.id === targetId,
  );
  if (!tournament) {
    return (
      <section className="content-section demo-unavailable">
        <h1>Демо-турнир не найден</h1>
        <p>Он мог быть удалён или создан в другом браузере.</p>
        <Link className="pc-button secondary" href="/admin-demo">
          Открыть демо-админку
        </Link>
      </section>
    );
  }
  const content = sandbox.pageContent.pages[tournament.id] ?? getTournamentPageDefaults(tournament);
  return (
    <>
      <aside className="demo-page-toolbar glass" aria-label="Демонстрационный просмотр">
        <p>Демо-страница · тестовые данные · заявки на сервер не отправляются</p>
        <div>
          <Link href="/admin-demo">Демо-админка</Link>
          <Button type="button" onClick={() => setEditor(true)}>
            Показать редактор
          </Button>
        </div>
      </aside>
      <TournamentDetail
        key={tournament.id}
        id={tournament.id}
        preview={{
          tournament,
          teams: sandbox.visual.teams,
          applications: sandbox.visual.applications.filter(
            (item) => item.tournamentId === tournament.id,
          ),
          content,
        }}
      />
      {editor && (
        <TournamentPageEditor
          key={tournament.id}
          tournament={tournament}
          content={content}
          teams={sandbox.visual.teams}
          close={() => setEditor(false)}
          savePage={(next) => sandbox.savePage(tournament.id, next)}
        />
      )}
    </>
  );
}
