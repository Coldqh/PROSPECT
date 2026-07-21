import { createInitialLifeState } from "../../core/life/createInitialLifeState";
import { createFootballCareerState, createLegacyFootballSetup } from "../../sports/football/career/createFootballCareer";
import type { FootballCareerState } from "../../sports/football/career/types";
import { evaluateDepthChart } from "../../sports/football/team/evaluateDepthChart";
import { createFootballRoster, createTeamDynamics, createTeamStaff } from "../../sports/football/team/generateTeam";
import { createInitialTrainingState } from "../../sports/football/training/createTrainingState";
import { createInitialMatchState } from "../../sports/football/matches/createMatchState";
import { generateHighSchoolSeason } from "../../sports/football/season/generateSeason";
import { createFootballRelationships } from "../../sports/football/relationships/createFootballRelationships";
import { careerSaveSchema, CURRENT_SCHEMA_VERSION, type CareerSave } from "./schema";

export interface MigrationResult {
  save: CareerSave;
  migratedFrom?: number;
}

interface HistoryEntry {
  id: string;
  occurredAt: string;
  type: string;
  title: string;
  description: string;
}

interface LegacyFoundationSave {
  meta: {
    id: string;
    schemaVersion: 1;
    sport: "american-football";
    worldSeed: string;
    createdAt: string;
    updatedAt: string;
    currentDate: { year: number; month: number; day: number };
    phase: "foundation";
    revision: number;
  };
  history: HistoryEntry[];
}

type LegacyFootball = Omit<
  FootballCareerState,
  "moduleVersion" | "staff" | "roster" | "teamDynamics" | "training" | "match" | "depthChart"
> & {
  moduleVersion: 2;
  depthChart: Omit<FootballCareerState["depthChart"], "evaluation" | "lastDecision">;
};

type LegacyTeamFootball = Omit<FootballCareerState, "moduleVersion" | "training" | "match"> & {
  moduleVersion: 3;
};

type LegacyTrainingFootball = Omit<FootballCareerState, "moduleVersion" | "match"> & {
  moduleVersion: 4;
};

interface LegacyPlayerCreationSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 2 };
  character: CareerSave["character"];
  football: LegacyFootball;
  history: HistoryEntry[];
}

interface LegacyWeeklyLoopSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 3 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: LegacyFootball;
  history: HistoryEntry[];
}

interface LegacyTeamWorldSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 4 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: LegacyTeamFootball;
  history: HistoryEntry[];
}

interface LegacyTrainingHealthSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 5 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: LegacyTrainingFootball;
  history: HistoryEntry[];
}

type LegacyMatchFootball = Omit<FootballCareerState, "moduleVersion" | "season"> & {
  moduleVersion: 5;
  season: {
    year: number;
    phase: "preseason";
    week: number;
    wins: number;
    losses: number;
    nextOpponent: { id: string; name: string; record: string; threat: string };
  };
};


interface LegacySeasonSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 7 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: FootballCareerState;
  history: HistoryEntry[];
}

interface LegacyMatchSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 6 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: LegacyMatchFootball;
  history: HistoryEntry[];
}


function parseMigratedSave(input: {
  meta: CareerSave["meta"];
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: FootballCareerState;
  history: HistoryEntry[];
  relationships?: CareerSave["relationships"];
}): CareerSave {
  return careerSaveSchema.parse({
    ...input,
    relationships: input.relationships ?? createFootballRelationships(input.meta.worldSeed, input.character, input.football),
  });
}

function migrateVersionSeven(input: LegacySeasonSave): CareerSave {
  return parseMigratedSave({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v8`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Люди получили память",
        description: "Карьера получила постоянных персонажей, одну шкалу отношений и контекстные жизненные события.",
      },
    ],
  });
}

function seasonForMigration(
  football: { school: FootballCareerState["school"] },
  worldSeed: string,
  currentDate: CareerSave["meta"]["currentDate"],
) {
  return generateHighSchoolSeason(worldSeed, football.school, currentDate);
}

function enrichFootball(
  football: LegacyFootball,
  character: CareerSave["character"],
  worldSeed: string,
  currentDate: CareerSave["meta"]["currentDate"],
): FootballCareerState {
  const roster = createFootballRoster(worldSeed, football.school, football.position);
  const staff = createTeamStaff(worldSeed, football.school, football.position, football.depthChart.coachTrust);
  const teamDynamics = createTeamDynamics(worldSeed, football.school);
  const firstRoomPlayer = roster.find((player) => player.position === football.position);
  if (!firstRoomPlayer) throw new Error("Cannot migrate career without a position room");

  const season = seasonForMigration(football, worldSeed, currentDate);
  let enriched: FootballCareerState = {
    ...football,
    moduleVersion: 6,
    school: {
      ...football.school,
      primaryColor: "#d7192d",
      secondaryColor: "#08090b",
    },
    staff,
    roster,
    teamDynamics,
    training: createInitialTrainingState(worldSeed, football.position, character, football.ratings),
    season,
    match: createInitialMatchState(worldSeed, football.position, season, currentDate),
    depthChart: {
      ...football.depthChart,
      playersAtPosition: roster.filter((player) => player.position === football.position).length + 1,
      directRival: {
        id: firstRoomPlayer.id,
        name: firstRoomPlayer.name,
        year: firstRoomPlayer.year,
        overall: firstRoomPlayer.overall,
        style: firstRoomPlayer.style,
      },
      evaluation: {
        heroScore: 0,
        comparisonScore: 0,
        gap: 0,
        trend: "stable",
        summary: "Штаб обновляет позиционную оценку.",
        reasons: ["Состав восстановлен из постоянного seed карьеры."],
        updatedOn: `${currentDate.year}-${currentDate.month}-${currentDate.day}`,
      },
      lastDecision: {
        type: "held",
        title: "Состав восстановлен",
        description: "Команда и тренерский штаб созданы без изменения истории героя.",
        occurredOn: `${currentDate.year}-${currentDate.month}-${currentDate.day}`,
      },
    },
  };

  const evaluation = evaluateDepthChart(enriched, character, currentDate);
  enriched = {
    ...enriched,
    depthChart: {
      ...enriched.depthChart,
      ...evaluation,
      lastDecision: {
        ...evaluation.lastDecision,
        title: "Команда сформирована",
        description: "Новый depth chart рассчитан по текущей форме, здоровью и доверию штаба.",
      },
    },
  };
  return enriched;
}

function addTraining(
  football: LegacyTeamFootball,
  character: CareerSave["character"],
  worldSeed: string,
  currentDate: CareerSave["meta"]["currentDate"],
  dayIndex: number,
): FootballCareerState {
  const season = seasonForMigration(football, worldSeed, currentDate);
  return {
    ...football,
    moduleVersion: 6,
    season,
    training: createInitialTrainingState(worldSeed, football.position, character, football.ratings),
    match: createInitialMatchState(worldSeed, football.position, season, currentDate, dayIndex),
  };
}

function addMatch(
  football: LegacyTrainingFootball,
  worldSeed: string,
  currentDate: CareerSave["meta"]["currentDate"],
  dayIndex: number,
): FootballCareerState {
  const season = seasonForMigration(football, worldSeed, currentDate);
  return {
    ...football,
    moduleVersion: 6,
    season,
    match: createInitialMatchState(worldSeed, football.position, season, currentDate, dayIndex),
  };
}

function migrateVersionSix(input: LegacyMatchSave): CareerSave {
  const season = seasonForMigration(input.football, input.meta.worldSeed, input.meta.currentDate);
  const football: FootballCareerState = {
    ...input.football,
    moduleVersion: 6,
    season,
    match: createInitialMatchState(
      input.meta.worldSeed,
      input.football.position,
      season,
      input.meta.currentDate,
      input.life.dayIndex,
    ),
  };
  return parseMigratedSave({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    football,
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v7`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Школьный сезон сформирован",
        description: "Карьера получила расписание, региональную таблицу, историю матчей и сезонную статистику.",
      },
    ],
  });
}

function migrateVersionFive(input: LegacyTrainingHealthSave): CareerSave {
  return parseMigratedSave({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    football: addMatch(input.football, input.meta.worldSeed, input.meta.currentDate, input.life.dayIndex),
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v6`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Матчевый модуль подключён",
        description: "Карьера получила ключевые игровые эпизоды для атаки и защиты, статистику матча и оценку штаба.",
      },
    ],
  });
}

function migrateVersionFour(input: LegacyTeamWorldSave): CareerSave {
  return parseMigratedSave({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    football: addTraining(input.football, input.character, input.meta.worldSeed, input.meta.currentDate, input.life.dayIndex),
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v5`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Тренировочный штаб подключён",
        description: "Карьера получила тренировочные направления, готовность тела, нагрузку, медицинский допуск и риск травмы.",
      },
    ],
  });
}

function migrateVersionThree(input: LegacyWeeklyLoopSave): CareerSave {
  return parseMigratedSave({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    football: enrichFootball(input.football, input.character, input.meta.worldSeed, input.meta.currentDate),
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v5`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Команда и тренировки сформированы",
        description: "Карьера получила полный состав, штаб, динамический depth chart и системную подготовку тела.",
      },
    ],
  });
}

function migrateVersionTwo(input: LegacyPlayerCreationSave): CareerSave {
  const versionThree: LegacyWeeklyLoopSave = {
    ...input,
    meta: { ...input.meta, schemaVersion: 3 },
    life: createInitialLifeState(),
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v3`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Недельный цикл открыт",
        description: "Карьера получила календарь, недельный план и детерминированную симуляцию режима.",
      },
    ],
  };
  return migrateVersionThree(versionThree);
}

function migrateVersionOne(input: LegacyFoundationSave): CareerSave {
  const setup = createLegacyFootballSetup(input.meta.worldSeed);
  const generated = createFootballCareerState(input.meta.worldSeed, setup);
  return parseMigratedSave({
    meta: {
      ...input.meta,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      phase: "high-school-preseason",
    },
    character: generated.character,
    life: createInitialLifeState(),
    football: generated.football,
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v5`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Карьера обновлена",
        description: "Техническое сохранение получило спортсмена, жизненный цикл, команду и тренировочную систему.",
      },
    ],
  });
}

export function migrateCareerSave(input: unknown): MigrationResult {
  if (!input || typeof input !== "object") throw new Error("Save payload is not an object");
  const schemaVersion = (input as { meta?: { schemaVersion?: unknown } }).meta?.schemaVersion;

  if (schemaVersion === CURRENT_SCHEMA_VERSION) return { save: careerSaveSchema.parse(input) };
  if (schemaVersion === 7) return { save: migrateVersionSeven(input as LegacySeasonSave), migratedFrom: 7 };
  if (schemaVersion === 6) return { save: migrateVersionSix(input as LegacyMatchSave), migratedFrom: 6 };
  if (schemaVersion === 5) return { save: migrateVersionFive(input as LegacyTrainingHealthSave), migratedFrom: 5 };
  if (schemaVersion === 4) return { save: migrateVersionFour(input as LegacyTeamWorldSave), migratedFrom: 4 };
  if (schemaVersion === 3) return { save: migrateVersionThree(input as LegacyWeeklyLoopSave), migratedFrom: 3 };
  if (schemaVersion === 2) return { save: migrateVersionTwo(input as LegacyPlayerCreationSave), migratedFrom: 2 };
  if (schemaVersion === 1) return { save: migrateVersionOne(input as LegacyFoundationSave), migratedFrom: 1 };
  if (typeof schemaVersion !== "number") throw new Error("Save has no schema version");
  if (schemaVersion > CURRENT_SCHEMA_VERSION) throw new Error("Save was created by a newer PROSPECT version");
  throw new Error(`No migration path from schema ${schemaVersion}`);
}
