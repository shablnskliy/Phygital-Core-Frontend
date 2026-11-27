"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRef, useState } from "react";
import {
  CalendarDays,
  MapPin,
  UsersRound,
  ShieldCheck,
  Monitor,
  Activity,
  Trophy,
  Building2,
  Gamepad2,
  ChevronLeft,
  ChevronRight,
  Check,
  ImageIcon,
  ZoomIn,
} from "lucide-react";
import { usePlatformStore, usePlatformLoading } from "@/entities/platform";
import { useAuth } from "@/entities/user";
import {
  getTournamentPageDefaults,
  useTournamentPages,
  tournamentStatus,
  type Tournament,
  type TournamentPageContent,
} from "@/entities/tournament";
import { TeamRoster, initials, participants, type Team } from "@/entities/team";
import type { TournamentApplication } from "@/entities/tournament-application";
import { useApp } from "@/shared/providers";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Modal } from "@/shared/ui/Modal";
import { TelegramIcon } from "@/shared/ui/SocialIcon";
import { RegisterTeamModal } from "@/features/register-team-for-tournament";
import { CreateTeamModal } from "@/features/create-team";
import { useAuthModal } from "@/features/auth";
import { NoTeamHelp } from "@/features/team-help";
import { detectHeroImageKind, type HeroImageKind } from "../lib/imagePresentation";

const statusNames = { upcoming: "Предстоящий", active: "Идёт", completed: "Завершён" } as const;
const dateTime = (value: string) =>
  new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export interface TournamentDetailPreview {
  tournament: Tournament;
  teams: Team[];
  applications: TournamentApplication[];
  content: TournamentPageContent;
}

export function TournamentDetail({
  id,
  preview,
}: {
  id: string;
  preview?: TournamentDetailPreview;
}) {
  const store = usePlatformStore();
  const { user } = useAuth();
  const loading = usePlatformLoading();
  const local = useTournamentPages();
  const { notify } = useApp();
  const { openAuth } = useAuthModal();
  const [applying, setApplying] = useState(false);
  const [allTeams, setAllTeams] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const tournament = preview
    ? preview.tournament
    : store.state.tournaments.find((item) => item.id === id);
  const teams = preview ? preview.teams : store.state.teams;
  const applications = preview ? preview.applications : store.state.tournamentApplications;
  const selectedTeam = teams.find((team) => team.id === selectedTeamId);
  if (!tournament)
    return (
      <section className="td-shell td-empty content-section" aria-live="polite">
        <Link href="/tournaments">Назад к турнирам</Link>
        <h1>{loading ? "Загружаем турнир…" : "Турнир пока недоступен"}</h1>
        {!loading && (
          <>
            <p>Проверьте ссылку или обновите данные страницы.</p>
            <Button onClick={() => window.location.reload()}>Обновить</Button>
          </>
        )}
      </section>
    );
  const content = preview
    ? preview.content
    : (local.pages[id] ?? getTournamentPageDefaults(tournament));
  const status = tournamentStatus(tournament);
  const registrations = [
    ...new Set(
        applications
            .filter((item) => item.tournamentId === tournament.id && item.status === "APPROVED")
            .map((item) => item.teamId),
    ),
  ];
  const winner = teams.find((team) => team.id === content.winnerTeamId);
  const hasHistory = Boolean(content.historyText || content.gallery.length || content.winnerTeamId);
  const showTeam = (teamId: string) => {
    setAllTeams(false);
    setSelectedTeamId(teamId);
  };
  const teamList = (ids: string[]) => (
    <ul className="td-team-list">
      {ids.map((teamId) => {
        const team = teams.find((item) => item.id === teamId);
        return (
          <li key={teamId}>
            <UsersRound aria-hidden="true" />
            <Button
              type="button"
              className="td-team-link"
              onClick={() => showTeam(teamId)}
              disabled={!team}
            >
              {team?.name ?? "Команда недоступна"}
            </Button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <article className="td-shell">
      <Link className="td-back" href="/tournaments">
        <ChevronLeft aria-hidden="true" />
        Назад к турнирам
      </Link>
      {!preview && local.error && (
        <p className="form-error" role="alert">
          {local.error}
        </p>
      )}
      <header className="td-hero glass">
        <TournamentHeroVisual
          key={JSON.stringify([content.visualUrl, tournament.imageUrl])}
          url={content.visualUrl}
          bannerUrl={tournament.imageUrl}
        />
        <div className="td-hero-copy">
          <Badge tone={status === "completed" ? "red" : status === "active" ? "green" : "blue"}>
            {statusNames[status]}
          </Badge>
          <h1>{tournament.name}</h1>
          <p className="td-lead">{tournament.shortDescription}</p>
          <div className="td-facts">
            <div className="td-hero-fact">
              <CalendarDays aria-hidden="true" />
              <div>
                <span className="td-fact-label">Даты проведения</span>
                <span>
                  {dateTime(tournament.startAt)}
                  {tournament.endAt && <> — {dateTime(tournament.endAt)}</>}
                </span>
              </div>
            </div>
            <div className="td-hero-fact">
              <MapPin aria-hidden="true" />
              <div>
                <span className="td-fact-label">Место проведения</span>
                <span>{content.venue || "Площадка уточняется"}</span>
              </div>
            </div>
          </div>
          {status !== "completed" && (
            <Button variant="primary" onClick={() => setApplying(true)}>
              Зарегистрироваться
            </Button>
          )}
        </div>
      </header>
      <dl className="td-summary glass" aria-label="Основная информация о турнире">
        <div className="td-summary-item">
          <dt>
            <span className="td-summary-icon">
              <UsersRound aria-hidden="true" />
            </span>
            <span>В команде</span>
          </dt>
          <dd className="td-summary-value">{content.teamSize}</dd>
        </div>
        <div className="td-summary-item">
          <dt>
            <span className="td-summary-icon">
              <ShieldCheck aria-hidden="true" />
            </span>
            <span>Количество команд</span>
          </dt>
          <dd className="td-summary-value">{content.teamLimit}</dd>
        </div>
        <div className="td-summary-item td-summary-organizer">
          <dt>
            <span className="td-summary-icon">
              <Building2 aria-hidden="true" />
            </span>
            <span>Организаторы</span>
          </dt>
          <dd>
            <a href={content.organizerUrl} target="_blank" rel="noopener noreferrer">
              {content.organizerName}
            </a>
          </dd>
        </div>
        <div className="td-summary-item td-disciplines">
          <dt>
            <span className="td-summary-icon">
              <Gamepad2 aria-hidden="true" />
            </span>
            <span>Дисциплины</span>
          </dt>
          <dd>
            {content.disciplines.map((item, index) => (
              <span key={index}>{item}</span>
            ))}
          </dd>
        </div>
      </dl>
      <aside className="td-telegram glass" aria-labelledby="td-telegram-title">
        <span className="td-telegram-icon" aria-hidden="true">
          <TelegramIcon />
        </span>
        <div>
          <h2 id="td-telegram-title">Вся актуальная информация — в Telegram</h2>
          <p>
            Следите за новостями, расписанием, результатами и важными объявлениями в нашем
            Telegram-канале.
          </p>
        </div>
        <a
          className="pc-button secondary td-telegram-link"
          href="https://t.me/phygitalcore"
          target="_blank"
          rel="noopener noreferrer"
        >
          Перейти в канал
        </a>
      </aside>
      <section className="td-block td-about glass">
        <h2>О турнире</h2>
        <p className="td-prose">
          {content.about || "Подробная информация появится после публикации организатором."}
        </p>
      </section>
      <section className="td-block td-stages glass">
        <h2>Как проходит турнир</h2>
        <ol>
          {[Monitor, Activity, Trophy].map((Icon, index) => (
            <li key={index}>
              <Icon aria-hidden="true" />
              <h3>{["Виртуальный этап", "Реальный этап", "Итоговый результат"][index]}</h3>
              <p>{content.stages[index]}</p>
            </li>
          ))}
        </ol>
        {content.prize && (
          <section className="td-prize" aria-labelledby="td-prize-title">
            <span className="td-prize-icon" aria-hidden="true">
              <Trophy />
            </span>
            <div>
              <h3 id="td-prize-title">Приз</h3>
              <p className="td-prose">{content.prize}</p>
            </div>
          </section>
        )}
      </section>
      <section className="td-block td-rules glass">
        <h2>Правила участия</h2>
        <ul>
          {content.rules.map((rule, index) => (
            <li key={index}>
              <Check aria-hidden="true" />
              <span>{rule}</span>
            </li>
          ))}
        </ul>
        <Link href="/rules">Ознакомиться с полным регламентом</Link>
      </section>
      <section className="td-block td-teams glass">
        <div className="td-block-heading">
          <h2>Команды</h2>
          <span className="td-count">
            {registrations.length || preview || user ? registrations.length : "—"}
          </span>
          {registrations.length > 3 && (
            <Button className="td-teams-all" onClick={() => setAllTeams(true)}>
              Все команды ({registrations.length})
            </Button>
          )}
        </div>
        <p className="td-muted">Зарегистрировано на турнир</p>
        {registrations.length ? (
          teamList(registrations.slice(0, 3))
        ) : (
          <p>
            {preview || user
              ? "Зарегистрированных команд пока нет."
              : "Войдите, чтобы посмотреть список зарегистрированных команд."}
          </p>
        )}
        <div className="td-help">
          <NoTeamHelp />
        </div>
      </section>
      {hasHistory && (
        <section className="td-block td-history glass">
          <h2>Как это было</h2>
          {(content.gallery.length > 0 || content.winnerTeamId) && (
            <div
              className={`td-recap-media ${content.gallery.length && content.winnerTeamId ? "td-recap-media--paired" : content.gallery.length ? "td-recap-media--gallery" : "td-recap-media--winner"}`}
            >
              {content.gallery.length > 0 && (
                <TournamentGallery key={JSON.stringify(content.gallery)} images={content.gallery} />
              )}
              {content.winnerTeamId && (
                <section className="td-winner" aria-label="Победитель турнира">
                  <div className="td-winner-emblem" aria-hidden="true">
                    <span>{winner ? initials(winner.name) : <Trophy />}</span>
                    <Trophy className="td-winner-cup" />
                  </div>
                  <div className="td-winner-copy">
                    <span className="td-winner-label">Победитель турнира</span>
                    {winner ? (
                      <Button
                        type="button"
                        className="td-team-link td-winner-name"
                        onClick={() => showTeam(winner.id)}
                      >
                        {winner.name}
                      </Button>
                    ) : (
                      <p>Команда-победитель сейчас недоступна</p>
                    )}
                  </div>
                  {winner && (
                    <Button
                      type="button"
                      className="td-winner-roster"
                      onClick={() => showTeam(winner.id)}
                    >
                      <UsersRound aria-hidden="true" />
                      Состав команды
                    </Button>
                  )}
                </section>
              )}
            </div>
          )}
          {content.historyText && <p className="td-prose td-history-copy">{content.historyText}</p>}
        </section>
      )}
      {allTeams && (
        <Modal
          title={`Команды турнира · ${registrations.length}`}
          onClose={() => setAllTeams(false)}
        >
          {teamList(registrations)}
          <Button onClick={() => setAllTeams(false)}>Закрыть</Button>
        </Modal>
      )}
      {selectedTeamId !== null && (
        <Modal
          title={selectedTeam?.name ?? "Команда недоступна"}
          subtitle={selectedTeam ? participants(selectedTeam.members.length) : undefined}
          onClose={() => setSelectedTeamId(null)}
        >
          {selectedTeam ? (
            <>
              <div className="team-profile-summary">
                <span className="team-monogram">{initials(selectedTeam.name)}</span>
                <div>
                  <span className="eyebrow">СОСТАВ КОМАНДЫ</span>
                  <p>Одна команда. Общая цель.</p>
                </div>
              </div>
              <TeamRoster members={selectedTeam.members} />
            </>
          ) : (
            <p>Команда больше недоступна. Закройте окно, чтобы вернуться к турниру.</p>
          )}
          <Button className="td-roster-close" type="button" onClick={() => setSelectedTeamId(null)}>
            Закрыть
          </Button>
        </Modal>
      )}
      {applying && preview && (
        <Modal title="Демонстрация регистрации" onClose={() => setApplying(false)}>
          <p>
            Это пример страницы турнира. В демонстрационном режиме заявки не отправляются, а
            авторизация не требуется.
          </p>
          <Button type="button" onClick={() => setApplying(false)}>
            Понятно
          </Button>
        </Modal>
      )}
      {applying && !preview && (
        <RegisterTeamModal
          tournament={tournament}
          close={() => setApplying(false)}
          onLogin={() => openAuth("login", `/tournaments/${encodeURIComponent(id)}`)}
          renderCreateTeam={(close, create) => <CreateTeamModal close={close} create={create} />}
          success={() => {
            setApplying(false);
            notify("Заявка отправлена. Изменения команды заблокированы до завершения турнира.");
          }}
        />
      )}
    </article>
  );
}

function TournamentHeroVisual({ url, bannerUrl }: { url: string; bannerUrl?: string }) {
  const candidates: { url: string; kind: HeroImageKind }[] = [
    { url, kind: "artwork" as const },
    { url: bannerUrl || "", kind: "photo" as const },
    { url: "/page-objects/tournaments.webp", kind: "artwork" as const },
  ].filter(
    (candidate, index, entries) =>
      candidate.url && entries.findIndex((item) => item.url === candidate.url) === index,
  );
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [kind, setKind] = useState<HeroImageKind>(candidates[0].kind);
  const candidate = candidates[attempt];
  const reveal = (image: HTMLImageElement) => {
    setKind(detectHeroImageKind(image, candidate.kind));
    setLoaded(true);
  };
  return (
    <div
      className={`td-hero-media td-hero-media--${kind}${loaded ? " is-loaded" : ""}${failed ? " is-empty" : ""}`}
      aria-hidden="true"
    >
      {!failed ? (
        <img
          ref={(image) => {
            if (!loaded && image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0)
              reveal(image);
          }}
          className="td-visual-image"
          src={candidate.url}
          alt=""
          decoding="async"
          fetchPriority="high"
          onLoad={(event) => reveal(event.currentTarget)}
          onError={() => {
            setLoaded(false);
            if (attempt < candidates.length - 1) {
              setAttempt(attempt + 1);
              setKind(candidates[attempt + 1].kind);
            } else {
              setFailed(true);
              setKind("artwork");
            }
          }}
        />
      ) : (
        <Trophy className="td-visual-placeholder" />
      )}
    </div>
  );
}

function TournamentGallery({ images }: { images: { url: string; alt: string }[] }) {
  const [current, setCurrent] = useState(0);
  const [opened, setOpened] = useState(false);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const track = useRef<HTMLDivElement>(null);
  const select = (index: number) => {
    setCurrent(index);
    const thumbnail = track.current?.querySelector<HTMLButtonElement>(
      `[data-photo-index="${index}"]`,
    );
    if (track.current && thumbnail)
      track.current.scrollTo({ left: thumbnail.offsetLeft, behavior: "instant" });
  };
  const move = (step: number) => select((current + step + images.length) % images.length);
  const controls = (
    <div className="td-gallery-controls">
      <Button
        type="button"
        aria-label="Предыдущее фото"
        disabled={images.length < 2}
        onClick={() => move(-1)}
      >
        <ChevronLeft />
      </Button>
      <span aria-live="polite">
        {current + 1} / {images.length}
      </span>
      <Button
        type="button"
        aria-label="Следующее фото"
        disabled={images.length < 2}
        onClick={() => move(1)}
      >
        <ChevronRight />
      </Button>
    </div>
  );
  return (
    <div className="td-gallery" aria-label="Галерея турнира">
      <button
        type="button"
        className="td-gallery-feature"
        onClick={() => setOpened(true)}
        aria-label={`Открыть фото ${current + 1} из ${images.length}`}
      >
        {failed[current] ? (
          <span className="td-gallery-error">
            <ImageIcon aria-hidden="true" />
            Фото недоступно
          </span>
        ) : (
          <img
            className="td-gallery-feature-image"
            src={images[current].url}
            alt={images[current].alt || `Фото турнира ${current + 1}`}
            onError={() => setFailed((value) => ({ ...value, [current]: true }))}
          />
        )}
        <span className="td-gallery-zoom" aria-hidden="true">
          <ZoomIn />
        </span>
      </button>
      <div className="td-gallery-footer">
        <div className="td-gallery-thumbs" ref={track}>
          {images.map((image, index) => (
            <button
              className="td-gallery-thumb"
              key={index}
              type="button"
              data-photo-index={index}
              onClick={() => select(index)}
              aria-label={`Показать фото ${index + 1}`}
              aria-pressed={index === current}
            >
              {failed[index] ? (
                <ImageIcon aria-hidden="true" />
              ) : (
                <img
                  src={image.url}
                  alt=""
                  loading="lazy"
                  onError={() => setFailed((value) => ({ ...value, [index]: true }))}
                />
              )}
            </button>
          ))}
        </div>
        {controls}
      </div>
      {opened && (
        <Modal
          title={images[current].alt || `Фото турнира ${current + 1}`}
          subtitle={`${current + 1} / ${images.length}`}
          className="td-gallery-viewer"
          onClose={() => {
            setOpened(false);
            track.current
              ?.querySelector<HTMLButtonElement>(`[data-photo-index="${current}"]`)
              ?.focus({ preventScroll: true });
          }}
        >
          {failed[current] ? (
            <div className="td-gallery-error">
              <ImageIcon aria-hidden="true" />
              <p>Изображение недоступно</p>
            </div>
          ) : (
            <img
              className="td-gallery-full-image"
              src={images[current].url}
              alt={images[current].alt || `Фото турнира ${current + 1}`}
              onError={() => setFailed((value) => ({ ...value, [current]: true }))}
            />
          )}
          {controls}
        </Modal>
      )}
    </div>
  );
}
