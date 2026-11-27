import type { Team } from "@/entities/team";
import type { Tournament, TournamentPageContent } from "@/entities/tournament";
import type { TournamentApplication } from "@/entities/tournament-application";

// Fixtures belong only to this sandbox; they never populate real platform data.
export const demoActor = {
  id: "admin-demo-actor",
  role: "ADMIN" as const,
  firstName: "Демо",
  lastName: "Администратор",
};

export const demoTournament: Tournament = {
  id: "admin-demo-example",
  publicNumber: "QA",
  name: "Пример фиджитал-турнира",
  discipline: "CS2 и лазертаг",
  format: "5 × 5",
  city: "Екатеринбург",
  venue: "Кампус КЦТ · актовый зал",
  shortDescription: "Фиджитал-турнир, где виртуальный и реальный мир объединяются в одну игру.",
  description: "Демонстрационное описание турнира.",
  startAt: "2026-12-19T12:00:00",
  endAt: "2026-12-20T19:00:00",
  registrationEndsAt: "",
  rules: ["Команды от пяти игроков", "Соблюдение правил честной игры"],
  imageUrl: "/trophy-arena.webp",
};

export const demoTeams: Team[] = [
  "Cyber Wolves",
  "Новый вектор",
  "Фиолетовый импульс",
  "Digital Force",
  "Команда с длинным названием для проверки переноса текста",
].map((name, index) => ({
  id: `visual-team-${index}`,
  name,
  discipline: "Фиджитал-спорт",
  members: [
    ["Иван Петров", "Алексей Смирнов", "Дмитрий Ковалёв", "Никита Соколов", "Артём Волков"],
    ["Мария Иванова", "Анна Кузнецова", "Екатерина Морозова", "Ольга Фёдорова", "Полина Васильева"],
    ["Максим Орлов", "Даниил Лебедев", "Александр Новиков", "Михаил Попов", "Кирилл Павлов"],
    ["Сергей Никитин", "Андрей Захаров", "Роман Козлов", "Владислав Егоров", "Тимофей Соловьёв"],
    ["Елена Воронова", "София Михайлова", "Виктория Соколова", "Дарья Белова", "Алиса Жукова"],
  ][index].map((playerName, playerIndex) => ({
    id: `visual-player-${index}-${playerIndex}`,
    name: playerName,
    captain: playerIndex === 0,
  })),
}));

export const demoApplications: TournamentApplication[] = demoTeams.map((team, index) => ({
  id: `visual-application-${index}`,
  teamId: team.id,
  tournamentId: demoTournament.id,
  captainName: team.members[0].name,
  additionalInfo: "Демонстрационная заявка",
  status: "APPROVED",
  createdAt: "2026-11-25T12:00:00.000Z",
}));

export const demoPageContent: TournamentPageContent = {
  venue: "Колледж Цифровых Технологий · Кампус / актовый зал",
  teamSize: "5 × 5",
  teamLimit: "Не ограничено",
  organizerName: "Колледж Цифровых Технологий",
  organizerUrl: "https://it-college.ru",
  disciplines: ["CS2", "Лазертаг"],
  about: [
    "DOUBLE FRAG — фиджитал-турнир, в котором команда проявляет себя сразу в двух мирах. Сначала участники встречаются на виртуальной арене, а затем продолжают соревнование на реальной площадке. Общий результат складывается из обоих этапов.",
    "Проверь свои навыки, собери команду и покажи, на что вы способны вместе. Здесь важны точность, взаимопонимание и умение быстро принимать решения. Виртуальная стратегия и физическая активность дополняют друг друга, а каждый участник помогает команде приблизиться к победе.",
    "Организатор может дополнять условия турнира и сохранять подробные пояснения с переносами строк. Размер состава, количество команд и площадка задаются свободным текстом.",
  ].join("\n\n"),
  stages: ["CS2", "Лазертаг", "По сумме обоих этапов"],
  rules: [
    "Команды от пяти игроков. Капитан подаёт заявку от имени всего состава.",
    "Участники должны быть зарегистрированы на сайте и соблюдать правила честной игры.",
    "После подачи заявки состав команды фиксируется до завершения турнира. Организатор заранее сообщает участникам изменения расписания и условий проведения матчей.",
    "Участие одного игрока в нескольких командах этого турнира не допускается.",
  ],
  visualUrl: "/page-objects/tournaments.webp",
  prize: "50 000 ₽\nи специальные номинации",
  historyText:
    "Турнир завершился яркими матчами и отличной командной игрой. Спасибо участникам за атмосферу, поддержку соперников и стремление к победе!\n\nПоздравляем Cyber Wolves. Вместе вы показали сильный результат на виртуальном и реальном этапах.",
  gallery: [
    { url: "/team-together.webp", alt: "Командная игра за компьютерами" },
    { url: "/trophy-arena.webp", alt: "Кубок на фиджитал-арене" },
    { url: "/hero.webp", alt: "Технологическая атмосфера турнира" },
    { url: "/page-objects/tournaments.webp", alt: "Фирменный объект турнира" },
  ],
  winnerTeamId: demoTeams[0].id,
};
