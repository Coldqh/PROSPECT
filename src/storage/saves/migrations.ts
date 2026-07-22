import { createInitialLifeState } from "../../core/life/createInitialLifeState";
import { createFootballCareerState, createLegacyFootballSetup } from "../../sports/football/career/createFootballCareer";
import type { FootballCareerState } from "../../sports/football/career/types";
import { evaluateDepthChart } from "../../sports/football/team/evaluateDepthChart";
import { createFootballRoster, createTeamDynamics, createTeamStaff } from "../../sports/football/team/generateTeam";
import { createInitialTrainingState } from "../../sports/football/training/createTrainingState";
import { createInitialMatchState } from "../../sports/football/matches/createMatchState";
import { generateHighSchoolSeason } from "../../sports/football/season/generateSeason";
import { createFootballRelationships } from "../../sports/football/relationships/createFootballRelationships";
import { createRecruitingState } from "../../sports/football/recruiting/createRecruitingState";
import { createInitialCollegeState } from "../../sports/football/college/createCollegeState";
import { createFootballEcosystem } from "../../sports/football/ecosystem/createEcosystem";
import { upgradeFootballEcosystemV1, upgradeFootballEcosystemV2, upgradeFootballEcosystemV3, upgradeFootballEcosystemV4, upgradeFootballEcosystemV5, type LegacyFootballEcosystemStateV1, type LegacyFootballEcosystemStateV2, type LegacyFootballEcosystemStateV3, type LegacyFootballEcosystemStateV4, type LegacyFootballEcosystemStateV5 } from "../../sports/football/ecosystem/upgradeEcosystem";
import type { FootballRecruitingState, RecruitingProgram } from "../../sports/football/recruiting/types";
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


interface LegacyRecruitment {
  visibility: number;
  interestedPrograms: number;
  offers: number;
  regionalRankLabel: string;
}

type LegacyRecruitingFootball = Omit<FootballCareerState, "moduleVersion" | "recruitment" | "college"> & {
  moduleVersion: 6;
  recruitment: LegacyRecruitment;
};



type LegacyRecruitingV1Program = Omit<
  RecruitingProgram,
  "contactQuality" | "roleClarity" | "staffTrust" | "visitStatus" | "officialVisit" | "promises" | "playerRead"
>;

type LegacyRecruitingV1State = Omit<
  FootballRecruitingState,
  "moduleVersion" | "decommitments" | "commitment" | "programs"
> & {
  moduleVersion: 1;
  programs: LegacyRecruitingV1Program[];
};

type LegacyRecruitingV1Football = Omit<FootballCareerState, "moduleVersion" | "recruitment" | "college"> & {
  moduleVersion: 7;
  recruitment: LegacyRecruitingV1State;
};

interface LegacyRecruitingSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 9 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: LegacyRecruitingV1Football;
  relationships: CareerSave["relationships"];
  history: HistoryEntry[];
}

type LegacyVersionTenFootball = Omit<FootballCareerState, "college">;

interface LegacyEcosystemSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 12 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: FootballCareerState;
  relationships: CareerSave["relationships"];
  world: LegacyFootballEcosystemStateV1;
  history: HistoryEntry[];
}

interface LegacyContinuitySave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 13 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: FootballCareerState;
  relationships: CareerSave["relationships"];
  world: LegacyFootballEcosystemStateV2;
  history: HistoryEntry[];
}

interface LegacyWorldConstitutionSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 14 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: FootballCareerState;
  relationships: CareerSave["relationships"];
  world: LegacyFootballEcosystemStateV3;
  history: HistoryEntry[];
}

interface LegacyAnnualTalentSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 16 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: FootballCareerState;
  relationships: CareerSave["relationships"];
  world: LegacyFootballEcosystemStateV5;
  history: HistoryEntry[];
}

interface LegacyFiniteResourcesSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 15 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: FootballCareerState;
  relationships: CareerSave["relationships"];
  world: LegacyFootballEcosystemStateV4;
  history: HistoryEntry[];
}

interface LegacyCollegeTransitionSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 11 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: FootballCareerState;
  relationships: CareerSave["relationships"];
  history: HistoryEntry[];
}

interface LegacyDecisionSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 10; phase: "high-school-preseason" };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: LegacyVersionTenFootball;
  relationships: CareerSave["relationships"];
  history: HistoryEntry[];
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
  "moduleVersion" | "staff" | "roster" | "teamDynamics" | "training" | "match" | "depthChart" | "recruitment" | "college"
> & {
  moduleVersion: 2;
  recruitment: LegacyRecruitment;
  depthChart: Omit<FootballCareerState["depthChart"], "evaluation" | "lastDecision">;
};

type LegacyTeamFootball = Omit<FootballCareerState, "moduleVersion" | "training" | "match" | "recruitment" | "college"> & {
  moduleVersion: 3;
  recruitment: LegacyRecruitment;
};

type LegacyTrainingFootball = Omit<FootballCareerState, "moduleVersion" | "match" | "recruitment" | "college"> & {
  moduleVersion: 4;
  recruitment: LegacyRecruitment;
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

type LegacyMatchFootball = Omit<FootballCareerState, "moduleVersion" | "season" | "recruitment" | "college"> & {
  moduleVersion: 5;
  recruitment: LegacyRecruitment;
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
  football: LegacyRecruitingFootball;
  history: HistoryEntry[];
}

interface LegacyRelationshipsSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 8 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: LegacyRecruitingFootball;
  relationships: CareerSave["relationships"];
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
  world?: CareerSave["world"];
}): CareerSave {
  return careerSaveSchema.parse({
    ...input,
    relationships: input.relationships ?? createFootballRelationships(input.meta.worldSeed, input.character, input.football),
    world: input.world ?? createFootballEcosystem(
      input.meta.worldSeed,
      input.character,
      input.football,
      input.meta.currentDate,
      input.life.completedDays,
    ),
  });
}

function addRecruitingToFootball(
  football: LegacyRecruitingFootball,
  character: CareerSave["character"],
  worldSeed: string,
): FootballCareerState {
  const base = {
    ...football,
    moduleVersion: 8 as const,
    recruitment: undefined as never,
    college: createInitialCollegeState(),
  };
  return {
    ...base,
    recruitment: createRecruitingState(worldSeed, character, base),
  };
}

function upgradeRecruitingVersionOne(state: LegacyRecruitingV1State): FootballRecruitingState {
  return {
    ...state,
    moduleVersion: 2,
    decommitments: 0,
    programs: state.programs.map((program) => ({
      ...program,
      contactQuality: ["contact", "priority", "offered"].includes(program.stage) ? Math.min(100, 24 + program.scoutingConfidence * 0.25) : 0,
      roleClarity: Math.min(100, 16 + program.positionNeed * 0.16 + (100 - program.depthCompetition) * 0.08),
      staffTrust: Math.min(100, 18 + program.interest * 0.18),
      visitStatus: "none" as const,
      promises: [],
      playerRead: "Программа ещё не проверена личным разговором и официальным визитом.",
    })),
  };
}

function migrateVersionSixteen(input: LegacyAnnualTalentSave): CareerSave {
  return careerSaveSchema.parse({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    world: upgradeFootballEcosystemV5(input.world, input.meta.currentDate),
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v17`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Штабы начали планировать составы",
        description: "Добавлены трёхлетние прогнозы ростера, распределение стипендий, developmental/redshirt-планы и смены позиций под будущие потребности.",
      },
    ],
  });
}

function migrateVersionFifteen(input: LegacyFiniteResourcesSave): CareerSave {
  return careerSaveSchema.parse({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    world: upgradeFootballEcosystemV4(input.world, input.meta.currentDate),
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v16`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Мир получил ежегодный поток талантов",
        description: "Добавлены региональные поколения, лагеря, позднее раскрытие, JUCO и walk-on маршруты. Выпускники больше не исчезают после одного цикла.",
      },
    ],
  });
}

function migrateVersionFourteen(input: LegacyWorldConstitutionSave): CareerSave {
  return careerSaveSchema.parse({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    world: upgradeFootballEcosystemV3(input.world, input.meta.currentDate),
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v15`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Ресурсы программ стали конечными",
        description: "Команды получили реальные бюджеты, NIL-ёмкость, медицину, инфраструктуру, донорское давление и стоимость кадровых решений.",
      },
    ],
  });
}

function migrateVersionThirteen(input: LegacyContinuitySave): CareerSave {
  return careerSaveSchema.parse({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    world: upgradeFootballEcosystemV2(input.world, input.meta.currentDate),
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v14`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Правила мира унифицированы",
        description: "Карьера получила единый календарь, eligibility, академический допуск и реальные лимиты составов и стипендий.",
      },
    ],
  });
}

function migrateVersionTwelve(input: LegacyEcosystemSave): CareerSave {
  return careerSaveSchema.parse({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    world: upgradeFootballEcosystemV1(input.world, input.character, input.football, input.meta.currentDate),
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v13`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Экосистема получила непрерывную историю",
        description: "Колледжи объединены в конференции, сезоны архивируются, игроки переходят, а тренеры реально меняют работу.",
      },
    ],
  });
}

function migrateVersionEleven(input: LegacyCollegeTransitionSave): CareerSave {
  return parseMigratedSave({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v12`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Спортивный мир запущен",
        description: "Карьера получила автономные команды, игроков, тренеров, рекрутинговый рынок и независимую историю мира.",
      },
    ],
  });
}

function migrateVersionTen(input: LegacyDecisionSave): CareerSave {
  return parseMigratedSave({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    football: { ...input.football, college: createInitialCollegeState() },
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v11`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Переход в колледж подготовлен",
        description: "Карьера получила формальное подписание, выпускное межсезонье и первый день университетской программы.",
      },
    ],
  });
}

function migrateVersionNine(input: LegacyRecruitingSave): CareerSave {
  const football: FootballCareerState = {
    ...input.football,
    moduleVersion: 8,
    recruitment: upgradeRecruitingVersionOne(input.football.recruitment),
    college: createInitialCollegeState(),
  };
  return parseMigratedSave({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    football,
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v10`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Рекрутинг получил решения",
        description: "Карьера получила разговоры с рекрутерами, официальные визиты, сравнение предложений и устный выбор колледжа.",
      },
    ],
  });
}

function migrateVersionEight(input: LegacyRelationshipsSave): CareerSave {
  return parseMigratedSave({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    football: addRecruitingToFootball(input.football, input.character, input.meta.worldSeed),
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v9`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Рекрутинг стал системным",
        description: "Карьера получила 24 программы, отдельные скаутские оценки, контакты, академические проверки и реальные предложения.",
      },
    ],
  });
}

function migrateVersionSeven(input: LegacySeasonSave): CareerSave {
  const football = addRecruitingToFootball(input.football, input.character, input.meta.worldSeed);
  return parseMigratedSave({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    football,
    relationships: createFootballRelationships(input.meta.worldSeed, input.character, football),
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v8`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Люди получили память",
        description: "Карьера получила постоянных персонажей, одну шкалу отношений и контекстные жизненные события.",
      },
      {
        id: `migration-${input.meta.id}-v9`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Рекрутинг стал системным",
        description: "Карьера получила колледжи, скаутские стадии и академические проверки.",
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
    moduleVersion: 8,
    recruitment: undefined as never,
    college: createInitialCollegeState(),
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
  return {
    ...enriched,
    recruitment: createRecruitingState(worldSeed, character, enriched),
  };
}

function addTraining(
  football: LegacyTeamFootball,
  character: CareerSave["character"],
  worldSeed: string,
  currentDate: CareerSave["meta"]["currentDate"],
  dayIndex: number,
): FootballCareerState {
  const season = seasonForMigration(football, worldSeed, currentDate);
  const base: FootballCareerState = {
    ...football,
    moduleVersion: 8,
    recruitment: undefined as never,
    college: createInitialCollegeState(),
    season,
    training: createInitialTrainingState(worldSeed, football.position, character, football.ratings),
    match: createInitialMatchState(worldSeed, football.position, season, currentDate, dayIndex),
  };
  return { ...base, recruitment: createRecruitingState(worldSeed, character, base) };
}

function addMatch(
  football: LegacyTrainingFootball,
  character: CareerSave["character"],
  worldSeed: string,
  currentDate: CareerSave["meta"]["currentDate"],
  dayIndex: number,
): FootballCareerState {
  const season = seasonForMigration(football, worldSeed, currentDate);
  const base: FootballCareerState = {
    ...football,
    moduleVersion: 8,
    recruitment: undefined as never,
    college: createInitialCollegeState(),
    season,
    match: createInitialMatchState(worldSeed, football.position, season, currentDate, dayIndex),
  };
  return { ...base, recruitment: createRecruitingState(worldSeed, character, base) };
}

function migrateVersionSix(input: LegacyMatchSave): CareerSave {
  const season = seasonForMigration(input.football, input.meta.worldSeed, input.meta.currentDate);
  const footballBase: FootballCareerState = {
    ...input.football,
    moduleVersion: 8,
    recruitment: undefined as never,
    college: createInitialCollegeState(),
    season,
    match: createInitialMatchState(
      input.meta.worldSeed,
      input.football.position,
      season,
      input.meta.currentDate,
      input.life.dayIndex,
    ),
  };
  const football: FootballCareerState = {
    ...footballBase,
    recruitment: createRecruitingState(input.meta.worldSeed, input.character, footballBase),
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
    football: addMatch(input.football, input.character, input.meta.worldSeed, input.meta.currentDate, input.life.dayIndex),
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
  if (schemaVersion === 16) return { save: migrateVersionSixteen(input as LegacyAnnualTalentSave), migratedFrom: 16 };
  if (schemaVersion === 15) return { save: migrateVersionFifteen(input as LegacyFiniteResourcesSave), migratedFrom: 15 };
  if (schemaVersion === 14) return { save: migrateVersionFourteen(input as LegacyWorldConstitutionSave), migratedFrom: 14 };
  if (schemaVersion === 13) return { save: migrateVersionThirteen(input as LegacyContinuitySave), migratedFrom: 13 };
  if (schemaVersion === 12) return { save: migrateVersionTwelve(input as LegacyEcosystemSave), migratedFrom: 12 };
  if (schemaVersion === 11) return { save: migrateVersionEleven(input as LegacyCollegeTransitionSave), migratedFrom: 11 };
  if (schemaVersion === 10) return { save: migrateVersionTen(input as LegacyDecisionSave), migratedFrom: 10 };
  if (schemaVersion === 9) return { save: migrateVersionNine(input as LegacyRecruitingSave), migratedFrom: 9 };
  if (schemaVersion === 8) return { save: migrateVersionEight(input as LegacyRelationshipsSave), migratedFrom: 8 };
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
