import type { Tournament } from "./types";

export interface TournamentPageContent {
  venue: string;
  teamSize: string;
  teamLimit: string;
  organizerName: string;
  organizerUrl: string;
  disciplines: string[];
  about: string;
  stages: [string, string, string];
  rules: string[];
  visualUrl: string;
  prize: string;
  historyText: string;
  gallery: { url: string; alt: string }[];
  winnerTeamId: string;
}

export interface TournamentPagesSnapshot {
  pages: Record<string, TournamentPageContent>;
  error: string | null;
}

export function getTournamentPageDefaults(tournament: Tournament): TournamentPageContent {
  return {
    venue: tournament.venue?.trim() || "Площадка уточняется",
    teamSize: tournament.format?.trim() || "Уточняется",
    teamLimit: "Уточняется",
    organizerName: "Колледж Цифровых технологий",
    organizerUrl: "https://it-college.ru",
    disciplines: tournament.discipline?.trim() ? [tournament.discipline.trim()] : ["Уточняются"],
    about:
      tournament.description?.trim() ||
      tournament.shortDescription?.trim() ||
      "Информация уточняется организаторами.",
    stages: ["Дисциплина уточняется", "Дисциплина уточняется", "По сумме обоих этапов"],
    rules: tournament.rules?.length
      ? [...tournament.rules]
      : ["Условия участия уточняются организаторами."],
    visualUrl: "",
    prize: "",
    historyText: "",
    gallery: [],
    winnerTeamId: "",
  };
}

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

export function isPageImageUrl(value: string): boolean {
  if (!value) return true;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  if (/^data:image\/(png|jpeg|webp|avif);base64,[A-Za-z0-9+/=]+$/.test(value)) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function validateTournamentPage(value: unknown): TournamentPageContent {
  const textFields = [
    "venue",
    "teamSize",
    "teamLimit",
    "organizerName",
    "organizerUrl",
    "about",
    "visualUrl",
    "prize",
    "historyText",
    "winnerTeamId",
  ] as const;
  if (!record(value) || textFields.some((field) => typeof value[field] !== "string"))
    throw new Error("Некорректные данные страницы турнира");
  if (
    ["venue", "teamSize", "teamLimit", "organizerName", "about"].some(
      (field) => !(value[field] as string).trim(),
    )
  )
    throw new Error(
      "Заполните площадку, размер состава, количество команд, организаторов и блок «О турнире»",
    );
  try {
    if (!["http:", "https:"].includes(new URL(value.organizerUrl as string).protocol))
      throw new Error();
  } catch {
    throw new Error("Укажите корректную http/https-ссылку организаторов");
  }
  for (const field of ["disciplines", "stages", "rules"] as const) {
    if (
      !Array.isArray(value[field]) ||
      !value[field].length ||
      value[field].some((item: unknown) => typeof item !== "string" || !item.trim())
    )
      throw new Error("Заполните дисциплины, три этапа и хотя бы одно правило участия");
  }
  if ((value.stages as unknown[]).length !== 3)
    throw new Error("В блоке «Как проходит турнир» должно быть три этапа");
  if (!isPageImageUrl(value.visualUrl as string))
    throw new Error("Некорректное изображение верхнего блока");
  if (
    !Array.isArray(value.gallery) ||
    value.gallery.some(
      (image: unknown) =>
        !record(image) ||
        typeof image.url !== "string" ||
        !image.url ||
        !isPageImageUrl(image.url) ||
        typeof image.alt !== "string",
    )
  )
    throw new Error("Некорректное изображение галереи");
  const content = Object.fromEntries(
    textFields.map((field) => [field, (value[field] as string).trim()]),
  );
  return {
    ...content,
    disciplines: (value.disciplines as string[]).map((item) => item.trim()),
    stages: (value.stages as string[]).map((item) => item.trim()) as [string, string, string],
    rules: (value.rules as string[]).map((item) => item.trim()),
    gallery: value.gallery.map((image) => ({ url: image.url.trim(), alt: image.alt.trim() })),
  } as TournamentPageContent;
}
