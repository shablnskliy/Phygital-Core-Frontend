"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from "lucide-react";
import {
  getTournamentPageDefaults,
  tournamentPageService,
  validateTournamentPage,
  type Tournament,
  type TournamentPageContent,
} from "@/entities/tournament";
import type { Team } from "@/entities/team";
import { useAuth } from "@/entities/user";
import { useAction } from "@/shared/hooks";
import { Modal } from "@/shared/ui/Modal";
import { Button } from "@/shared/ui/Button";
import { ActionError } from "@/shared/ui/ActionError";
import { Confirm } from "@/shared/ui/ConfirmDialog";

const imageTypes = ["image/png", "image/jpeg", "image/webp", "image/avif"];
function readImage(file: File): Promise<string> {
  if (!imageTypes.includes(file.type) || file.size > 5 * 1024 * 1024)
    return Promise.reject(new Error("Выберите PNG, JPG, WebP или AVIF размером до 5 МБ"));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error(`Не удалось прочитать «${file.name}». Попробуйте выбрать файл ещё раз.`));
    reader.readAsDataURL(file);
  });
}

export function TournamentPageEditor({
  tournament,
  content,
  teams,
  close,
  savePage,
}: {
  tournament: Tournament;
  content?: TournamentPageContent;
  teams: Team[];
  close: () => void;
  savePage?: (content: TournamentPageContent) => Promise<void>;
}) {
  const { user } = useAuth();
  const initial = useRef(content ?? getTournamentPageDefaults(tournament));
  const [draft, setDraft] = useState<TournamentPageContent>(() => structuredClone(initial.current));
  const [reading, setReading] = useState(false),
    [fileError, setFileError] = useState("");
  const [confirmation, setConfirmation] = useState<{
    title: string;
    text: string;
    action: () => void;
  } | null>(null);
  const uploadLock = useRef(false);
  const { busy, error, run } = useAction();
  const locked = Boolean(busy) || reading;
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial.current);
  const update = <K extends keyof TournamentPageContent>(key: K, value: TournamentPageContent[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  const askClose = () => {
    if (locked || uploadLock.current) return;
    if (!dirty) return close();
    setConfirmation({
      title: "Закрыть редактор?",
      text: "Несохранённые изменения страницы будут потеряны.",
      action: close,
    });
  };
  const remove = (title: string, action: () => void) =>
    setConfirmation({ title, text: "Изменение вступит в силу после сохранения страницы.", action });
  const upload = async (event: ChangeEvent<HTMLInputElement>, target: "visual" | "gallery") => {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (!files.length || uploadLock.current || busy) return;
    uploadLock.current = true;
    setReading(true);
    setFileError("");
    try {
      const loaded = await Promise.all(
        files.map(async (file) => ({ url: await readImage(file), alt: file.name })),
      );
      if (target === "visual") update("visualUrl", loaded[0].url);
      else setDraft((previous) => ({ ...previous, gallery: [...previous.gallery, ...loaded] }));
    } catch (reason) {
      setFileError(
        reason instanceof Error
          ? reason.message
          : "Не удалось загрузить изображение. Повторите выбор файла.",
      );
    } finally {
      uploadLock.current = false;
      setReading(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (uploadLock.current || locked) return;
    setFileError("");
    void run(
      "page-save",
      async () => {
        const validated = validateTournamentPage(draft);
        if (validated.winnerTeamId && !teams.some((team) => team.id === validated.winnerTeamId))
          throw new Error("Выберите существующую команду-победителя");
        if (savePage) await savePage(validated);
        else await tournamentPageService.save(tournament.id, validated, user);
      },
      "Страница турнира сохранена",
    ).then((ok) => {
      if (ok) close();
    });
  };
  if (confirmation)
    return (
      <Confirm
        title={confirmation.title}
        text={confirmation.text}
        close={() => setConfirmation(null)}
        confirm={() => {
          const action = confirmation.action;
          setConfirmation(null);
          action();
        }}
        busy={false}
      />
    );
  return (
    <Modal
      title={`Страница турнира «${tournament.name}»`}
      subtitle="Дополнительные блоки сохраняются локально в этом браузере. Название, баннер, даты и статус редактируются в основных параметрах турнира."
      onClose={askClose}
      busy={locked}
      className="tournament-page-editor-modal"
    >
      <form className="tournament-page-editor" onSubmit={submit} aria-busy={locked}>
        <fieldset disabled={locked}>
          <section className="tpe-section">
            <h3>Основная информация</h3>
            <label>
              Место проведения{" "}
              <input
                placeholder="Название площадки и адрес"
                value={draft.venue}
                onChange={(event) => update("venue", event.target.value)}
                required
              />
            </label>
            <div className="form-split">
              <label>
                Игроков в команде{" "}
                <input
                  placeholder="Например, 5 × 5"
                  value={draft.teamSize}
                  onChange={(event) => update("teamSize", event.target.value)}
                  required
                />
              </label>
              <label>
                Количество команд{" "}
                <input
                  placeholder="Например, 16 или Не ограничено"
                  value={draft.teamLimit}
                  onChange={(event) => update("teamLimit", event.target.value)}
                  required
                />
              </label>
            </div>
            <label>
              Организаторы{" "}
              <input
                value={draft.organizerName}
                onChange={(event) => update("organizerName", event.target.value)}
                required
              />
            </label>
            <label>
              Сайт организаторов{" "}
              <input
                type="url"
                value={draft.organizerUrl}
                onChange={(event) => update("organizerUrl", event.target.value)}
                required
              />
            </label>
            <label>
              Дисциплины через запятую{" "}
              <input
                value={draft.disciplines.join(",")}
                onChange={(event) => update("disciplines", event.target.value.split(","))}
                required
              />
            </label>
            <p>Каждая дисциплина отобразится отдельным тегом.</p>
          </section>
          <section className="tpe-section">
            <h3>Изображение обложки турнира</h3>
            <p>
              Загрузите фотографию или объект с прозрачным фоном. Фото станет фоном обложки,
              прозрачный объект сохранится целиком. Если изображение не выбрано, используется баннер
              турнира.
            </p>
            {draft.visualUrl && (
              <div className="tpe-visual-preview">
                <img src={draft.visualUrl} alt="Предпросмотр изображения обложки" />
                <Button
                  type="button"
                  variant="danger"
                  onClick={() =>
                    remove("Удалить изображение обложки?", () => update("visualUrl", ""))
                  }
                >
                  <Trash2 />
                  Удалить изображение
                </Button>
              </div>
            )}
            <label className="tpe-upload">
              <ImagePlus /> {draft.visualUrl ? "Заменить изображение" : "Загрузить изображение"}
              <input
                type="file"
                accept={imageTypes.join(",")}
                onChange={(event) => void upload(event, "visual")}
              />
            </label>
            <small>
              PNG, JPG, WebP или AVIF, до 5 МБ. Неудачную загрузку можно повторить, снова выбрав
              файл.
            </small>
          </section>
          <section className="tpe-section">
            <h3>О турнире</h3>
            <label>
              Подробное описание{" "}
              <textarea
                rows={7}
                value={draft.about}
                onChange={(event) => update("about", event.target.value)}
                required
              />
            </label>
            <small>Без ограничения количества символов. Переносы строк сохраняются.</small>
          </section>
          <section className="tpe-section">
            <h3>Как проходит турнир</h3>
            <p>Три постоянные иконки: виртуальный этап, реальный этап и итоговый результат.</p>
            {(["Виртуальный этап", "Реальный этап", "Итоговый результат"] as const).map(
              (label, index) => (
                <label key={label}>
                  {label}
                  <input
                    value={draft.stages[index]}
                    onChange={(event) => {
                      const stages = [...draft.stages] as [string, string, string];
                      stages[index] = event.target.value;
                      update("stages", stages);
                    }}
                    required
                  />
                </label>
              ),
            )}
          </section>
          <section className="tpe-section">
            <h3>Правила участия</h3>
            <p>
              Количество правил регулируется. Ссылка на полный регламент будет вести на общие
              правила турниров.
            </p>
            {draft.rules.map((rule, index) => (
              <div className="tpe-list-row" key={index}>
                <label>
                  Правило {index + 1}
                  <textarea
                    value={rule}
                    onChange={(event) =>
                      update(
                        "rules",
                        draft.rules.map((item, position) =>
                          position === index ? event.target.value : item,
                        ),
                      )
                    }
                    required
                  />
                </label>
                <Button
                  type="button"
                  variant="danger"
                  aria-label={`Удалить правило ${index + 1}`}
                  disabled={draft.rules.length === 1}
                  onClick={() =>
                    remove("Удалить правило участия?", () =>
                      update(
                        "rules",
                        draft.rules.filter((_, position) => position !== index),
                      ),
                    )
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button type="button" onClick={() => update("rules", [...draft.rules, ""])}>
              <Plus />
              Добавить правило
            </Button>
          </section>
          <section className="tpe-section">
            <h3>
              Приз <small>необязательно</small>
            </h3>
            <label>
              Информация о призе{" "}
              <textarea
                value={draft.prize}
                onChange={(event) => update("prize", event.target.value)}
              />
            </label>
            <small>Оставьте пустым, чтобы скрыть блок.</small>
          </section>
          <section className="tpe-section">
            <h3>
              Как это было <small>необязательно</small>
            </h3>
            <label>
              Текст итогов{" "}
              <textarea
                rows={6}
                value={draft.historyText}
                onChange={(event) => update("historyText", event.target.value)}
              />
            </label>
            <small>
              Без ограничения количества символов. Блок появится, когда добавлен текст, фото или
              победитель.
            </small>
            <label>
              Выигравшая команда{" "}
              <select
                value={draft.winnerTeamId}
                onChange={(event) => update("winnerTeamId", event.target.value)}
              >
                <option value="">Не выбрана</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="tpe-upload">
              <ImagePlus />
              Добавить фотографии
              <input
                type="file"
                accept={imageTypes.join(",")}
                multiple
                onChange={(event) => void upload(event, "gallery")}
              />
            </label>
            <div className="tpe-gallery-grid">
              {draft.gallery.map((image, index) => (
                <div className="tpe-gallery-item" key={index}>
                  <img src={image.url} alt={image.alt || `Фото турнира ${index + 1}`} />
                  <label>
                    Описание фото {index + 1}
                    <input
                      value={image.alt}
                      onChange={(event) =>
                        update(
                          "gallery",
                          draft.gallery.map((item, position) =>
                            position === index ? { ...item, alt: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <div className="form-actions">
                    <Button
                      type="button"
                      disabled={index === 0}
                      aria-label={`Переместить фото ${index + 1} раньше`}
                      onClick={() => {
                        const gallery = [...draft.gallery];
                        [gallery[index - 1], gallery[index]] = [gallery[index], gallery[index - 1]];
                        update("gallery", gallery);
                      }}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      disabled={index === draft.gallery.length - 1}
                      aria-label={`Переместить фото ${index + 1} позже`}
                      onClick={() => {
                        const gallery = [...draft.gallery];
                        [gallery[index + 1], gallery[index]] = [gallery[index], gallery[index + 1]];
                        update("gallery", gallery);
                      }}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      aria-label={`Удалить фото ${index + 1}`}
                      onClick={() =>
                        remove("Удалить фото из галереи?", () =>
                          update(
                            "gallery",
                            draft.gallery.filter((_, position) => position !== index),
                          ),
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </fieldset>
        {reading && <p role="status">Чтение изображений…</p>}
        <ActionError message={fileError || error} />
        <div className="form-actions">
          <Button type="button" onClick={askClose} disabled={locked}>
            Отмена
          </Button>
          <Button variant="primary" type="submit" loading={Boolean(busy)} disabled={reading}>
            Сохранить страницу
          </Button>
        </div>
      </form>
    </Modal>
  );
}
