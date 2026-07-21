import type { CharacterState } from "../../../core/character/types";
import { SeededRandom } from "../../../core/random/SeededRandom";
import type {
  NpcStatus,
  NpcTemperament,
  RelationshipNpc,
  RelationshipState,
} from "../../../core/relationships/types";
import type { FootballCareerState } from "../career/types";

const COUNSELOR_FIRST = ["Dana", "Morgan", "Leslie", "Renee", "Terry", "Casey"] as const;
const REPORTER_FIRST = ["Avery", "Jordan", "Cameron", "Blake", "Reese", "Taylor"] as const;
const LAST_NAMES = ["Morris", "Bennett", "Dawson", "Price", "Sutton", "Hale", "Vaughn"] as const;

function clampRelationship(value: number): number {
  return Math.max(-100, Math.min(100, Math.round(value)));
}

function baseNpc(
  random: SeededRandom,
  id: string,
  input: Omit<RelationshipNpc, "id" | "seed" | "memories">,
): RelationshipNpc {
  return {
    id,
    seed: `${random.fork(id).integer(100000, 999999)}`,
    memories: [],
    ...input,
    relationship: clampRelationship(input.relationship),
  };
}

function guardianName(character: CharacterState, random: SeededRandom): string {
  const firstNames = character.identity.gender === "male"
    ? (["Angela", "Monica", "Denise", "Patricia", "Nicole", "Tanya"] as const)
    : (["Michael", "Andre", "David", "Terrence", "Robert", "Derrick"] as const);
  return `${random.pick(firstNames)} ${character.identity.lastName}`;
}

function supportRelationship(character: CharacterState): number {
  return {
    supportive: 62,
    demanding: 34,
    "hands-off": 12,
  }[character.origin.familySupport];
}

function coachRelationship(value: number): number {
  return clampRelationship((value - 50) * 1.4 + 18);
}

function chooseTemperament(random: SeededRandom, preferred: readonly NpcTemperament[]): NpcTemperament {
  return random.pick(preferred);
}

function chooseStatus(random: SeededRandom, preferred: readonly NpcStatus[]): NpcStatus {
  return random.pick(preferred);
}

export function createFootballRelationships(
  worldSeed: string,
  character: CharacterState,
  football: FootballCareerState,
): RelationshipState {
  const random = new SeededRandom(worldSeed).fork("relationships-v1");
  const rival = football.roster.find((player) => player.id === football.depthChart.directRival.id)
    ?? football.roster.find((player) => player.position === football.position);
  const teammate = [...football.roster]
    .filter((player) => player.id !== rival?.id && player.status !== "injured")
    .sort((left, right) => right.overall - left.overall)[0];

  if (!rival || !teammate) {
    throw new Error("Cannot create relationship network without a rival and teammate");
  }

  const guardian = baseNpc(random, "npc-guardian", {
    name: guardianName(character, random),
    age: random.integer(38, 54),
    role: "guardian",
    group: "family",
    relationship: supportRelationship(character) + random.integer(-5, 5),
    temperament: chooseTemperament(random, ["warm", "demanding", "direct"]),
    goal: character.origin.familySupport === "demanding"
      ? "Добиться, чтобы спорт не разрушил учёбу и будущее семьи."
      : "Помочь тебе пройти последний школьный год без серьёзного срыва.",
    fear: "Что давление сезона изменит тебя и отдалит от дома.",
    currentSituation: character.origin.familyIncome === "strained"
      ? "Рабочий график тяжёлый, дома внимательно считают расходы."
      : "Следит за сезоном, но ждёт, что ты не выпадешь из семейной жизни.",
    status: character.origin.familyIncome === "strained" ? "under-pressure" : "concerned",
  });

  const headCoach = baseNpc(random, "npc-head-coach", {
    linkedEntityId: football.staff.headCoach.id,
    name: football.staff.headCoach.name,
    age: football.staff.headCoach.age,
    role: "head-coach",
    group: "team",
    relationship: coachRelationship(football.staff.headCoach.relationship),
    temperament: football.staff.headCoach.archetype === "disciplinarian" ? "demanding" : "direct",
    goal: `Вывести ${football.school.shortName} в верхнюю часть региональной таблицы.`,
    fear: "Потерять контроль над раздевалкой и закончить сезон ниже ожиданий программы.",
    currentSituation: football.staff.headCoach.pressure >= 70
      ? "Руководство требует результата уже в этом сезоне."
      : "Формирует основу команды и внимательно смотрит на дисциплину старших игроков.",
    status: football.staff.headCoach.pressure >= 70 ? "under-pressure" : "focused",
  });

  const positionCoach = baseNpc(random, "npc-position-coach", {
    linkedEntityId: football.staff.positionCoach.id,
    name: football.staff.positionCoach.name,
    age: football.staff.positionCoach.age,
    role: "position-coach",
    group: "team",
    relationship: coachRelationship(football.staff.positionCoach.relationship),
    temperament: chooseTemperament(random, ["direct", "reserved", "demanding"]),
    goal: `Сделать группу ${football.position} надёжной частью игровой схемы.`,
    fear: "Что ошибки его игроков будут стоить команде важных матчей.",
    currentSituation: `Распределяет повторения между тобой и ${rival.name}.`,
    status: "focused",
  });

  const directRival = baseNpc(random, "npc-rival", {
    linkedEntityId: rival.id,
    name: rival.name,
    age: rival.year === "Senior" ? 18 : rival.year === "Junior" ? 17 : 16,
    role: "rival",
    group: "team",
    relationship: football.depthChart.rank === 1 ? random.integer(-18, 2) : random.integer(-4, 14),
    temperament: chooseTemperament(random, ["volatile", "reserved", "calculating", "direct"]),
    goal: `Закончить сезон первым номером в группе ${football.position}.`,
    fear: "Потерять игровые повторения перед решающим годом своей карьеры.",
    currentSituation: football.depthChart.rank === 1
      ? "Считает, что ты забрал место, которое должно было принадлежать ему."
      : "Знает, что твой рост может вытеснить его из стартового состава.",
    status: football.depthChart.rank === 1 ? "frustrated" : "focused",
  });

  const teamLeader = baseNpc(random, "npc-teammate", {
    linkedEntityId: teammate.id,
    name: teammate.name,
    age: teammate.year === "Senior" ? 18 : teammate.year === "Junior" ? 17 : 16,
    role: "teammate",
    group: "team",
    relationship: random.integer(18, 34),
    temperament: chooseTemperament(random, ["warm", "direct", "reserved"]),
    goal: "Удержать раздевалку собранной и провести лучший сезон школы за последние годы.",
    fear: "Что личные амбиции игроков развалят команду в середине сезона.",
    currentSituation: "На него смотрят младшие игроки, а тренеры требуют отвечать за атмосферу команды.",
    status: chooseStatus(random, ["steady", "focused", "under-pressure"]),
  });

  const counselor = baseNpc(random, "npc-counselor", {
    name: `${random.pick(COUNSELOR_FIRST)} ${random.pick(LAST_NAMES)}`,
    age: random.integer(31, 58),
    role: "counselor",
    group: "school",
    relationship: random.integer(5, 18),
    temperament: chooseTemperament(random, ["warm", "reserved", "direct"]),
    goal: "Не дать выпускникам потерять eligibility и закрыть себе путь в колледж.",
    fear: "Узнать о проблеме слишком поздно, когда исправить оценки уже невозможно.",
    currentSituation: character.education.eligibilityStatus === "clear"
      ? "Пока не вмешивается, но отслеживает твою посещаемость."
      : "Собирает информацию от преподавателей перед разговором с тобой.",
    status: character.education.eligibilityStatus === "clear" ? "steady" : "concerned",
  });

  const reporter = baseNpc(random, "npc-reporter", {
    name: `${random.pick(REPORTER_FIRST)} ${random.pick(LAST_NAMES)}`,
    age: random.integer(24, 43),
    role: "reporter",
    group: "media",
    relationship: random.integer(-2, 8),
    temperament: chooseTemperament(random, ["calculating", "direct", "reserved"]),
    goal: "Первым найти главную историю школьного сезона в регионе.",
    fear: "Пропустить игрока, о котором все заговорят через месяц.",
    currentSituation: football.recruitment.visibility >= 45
      ? "Уже запросил у школы доступ к тренировке и статистике."
      : "Следит за результатами команды и пока не считает тебя главным сюжетом.",
    status: football.recruitment.visibility >= 45 ? "hopeful" : "steady",
  });

  return {
    moduleVersion: 1,
    npcs: [guardian, headCoach, positionCoach, directRival, teamLeader, counselor, reporter],
    resolvedEvents: [],
    queuedEvents: [],
    lastGeneratedCompletedDay: -1,
  };
}
