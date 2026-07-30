import { createInitialLifeState } from "../../core/life/createInitialLifeState";
import { createFootballCareerState, createLegacyFootballSetup } from "../../sports/football/career/createFootballCareer";
import type { FootballCareerState } from "../../sports/football/career/types";
import { evaluateDepthChart } from "../../sports/football/team/evaluateDepthChart";
import { createFootballRoster, createTeamDynamics, createTeamStaff } from "../../sports/football/team/generateTeam";
import { rosterUnitForPosition } from "../../sports/football/team/positions";
import type { FootballRosterPlayer } from "../../sports/football/team/types";
import { createInitialTrainingState } from "../../sports/football/training/createTrainingState";
import { createInitialMatchState } from "../../sports/football/matches/createMatchState";
import { generateHighSchoolSeason } from "../../sports/football/season/generateSeason";
import { createFootballRelationships } from "../../sports/football/relationships/createFootballRelationships";
import { createRecruitingState } from "../../sports/football/recruiting/createRecruitingState";
import { createInitialCollegeState } from "../../sports/football/college/createCollegeState";
import { createEmptyProfessionalLeague, createInitialProfessionalState, PROFESSIONAL_SALARY_CAP } from "../../sports/football/pro/createProfessionalState";
import { createHeroFreeAgentOffers, initializeProfessionalLeague } from "../../sports/football/pro/league";
import type { FootballProfessionalState, ProfessionalTeam } from "../../sports/football/pro/types";
import { activateCollegeHeroCareer } from "../../sports/football/college/heroCareer";
import { createFootballEcosystem } from "../../sports/football/ecosystem/createEcosystem";
import { createCareerRegistry } from "../../sports/football/ecosystem/lifecycle";
import { upgradeFootballEcosystemV1, upgradeFootballEcosystemV2, upgradeFootballEcosystemV3, upgradeFootballEcosystemV4, upgradeFootballEcosystemV5, upgradeFootballEcosystemV6, upgradeFootballEcosystemV7, upgradeFootballEcosystemV8, upgradeFootballEcosystemV9, upgradeFootballEcosystemV10, upgradeFootballEcosystemV11, type LegacyFootballEcosystemStateV1, type LegacyFootballEcosystemStateV2, type LegacyFootballEcosystemStateV3, type LegacyFootballEcosystemStateV4, type LegacyFootballEcosystemStateV5, type LegacyFootballEcosystemStateV6, type LegacyFootballEcosystemStateV7, type LegacyFootballEcosystemStateV8, type LegacyFootballEcosystemStateV9, type LegacyFootballEcosystemStateV10 } from "../../sports/football/ecosystem/upgradeEcosystem";
import { applyProfessionalSchemeFit, ensureProfessionalCoaching } from "../../sports/football/pro/coaching";
import type { FootballRecruitingState, RecruitingProgram } from "../../sports/football/recruiting/types";
import { careerSaveSchema, CURRENT_SCHEMA_VERSION, type CareerSave } from "./schema";

export interface MigrationResult {
  save: CareerSave;
  migratedFrom?: number;
}

function synchronizeLocalFootballRoster(save: CareerSave): CareerSave {
  const currentById = new Map<string, FootballRosterPlayer>(
    save.football.roster.map((player: FootballRosterPlayer) => [player.id, player]),
  );
  const roster: FootballRosterPlayer[] = save.world.players
    .filter((player) => player.teamId === save.football.school.id && !player.isHero)
    .sort((left, right) => left.position.localeCompare(right.position) || left.depthRank - right.depthRank || right.overall - left.overall)
    .map((player) => {
      const existing = currentById.get(player.id);
      return {
        id: player.id,
        name: player.name,
        position: player.position,
        unit: rosterUnitForPosition(player.position),
        year: player.classYear,
        overall: player.overall,
        potential: player.potential,
        style: existing?.style ?? player.tactical.archetype.replaceAll("-", " "),
        coachStanding: existing?.coachStanding ?? player.form,
        health: player.health,
        status: player.status,
        depthRank: player.depthRank,
      };
    });
  return careerSaveSchema.parse({
    ...save,
    football: { ...save.football, roster },
  });
}

function migratedResult(save: CareerSave, migratedFrom: number): MigrationResult {
  return { save: synchronizeLocalFootballRoster(save), migratedFrom };
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

interface LegacyRosterPlanningSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 17 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: FootballCareerState;
  relationships: CareerSave["relationships"];
  world: LegacyFootballEcosystemStateV6;
  history: HistoryEntry[];
}

interface LegacyUnifiedMarketSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 18 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: FootballCareerState;
  relationships: CareerSave["relationships"];
  world: LegacyFootballEcosystemStateV7;
  history: HistoryEntry[];
}

interface LegacyTacticalSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 19 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: FootballCareerState;
  relationships: CareerSave["relationships"];
  world: LegacyFootballEcosystemStateV8;
  history: HistoryEntry[];
}


type LegacyFootballWithoutProfessional = Omit<FootballCareerState, "professional">;

interface LegacyFullRosterSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 24 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: LegacyProfessionalFootball;
  relationships: CareerSave["relationships"];
  world: LegacyFootballEcosystemStateV10;
  history: HistoryEntry[];
}

interface LegacyFivePositionCareerSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 25 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: LegacyProfessionalFootball;
  relationships: CareerSave["relationships"];
  world: CareerSave["world"];
  history: HistoryEntry[];
}

type LegacyProfessionalTeamV1 = Omit<ProfessionalTeam, "salaryCap" | "payroll" | "deadCap" | "rosterSize">;
type LegacyProfessionalStateV1 = Omit<FootballProfessionalState, "version" | "status" | "teams" | "league" | "heroCareer"> & {
  version: 1;
  status: Exclude<FootballProfessionalState["status"], "free-agent">;
  teams: LegacyProfessionalTeamV1[];
};
type LegacyProfessionalFootball = Omit<CareerSave["football"], "professional"> & { professional: LegacyProfessionalStateV1 };

interface LegacyProfessionalLeagueSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 27 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: LegacyProfessionalFootball;
  relationships: CareerSave["relationships"];
  world: CareerSave["world"];
  history: HistoryEntry[];
}

type LegacyWorldWithoutCareerRegistry = Omit<CareerSave["world"], "careerRegistry"> & { careerRegistry?: CareerSave["world"]["careerRegistry"] };
type LegacyMatchWithHeroControl = CareerSave["football"]["match"] & { heroControlMode: "assisted" | "manual" | "spectator" };
type LegacyFootballWithHeroControl = Omit<CareerSave["football"], "match"> & { match: LegacyMatchWithHeroControl };


interface LegacyTacticalStaffSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 31 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: unknown;
  relationships: CareerSave["relationships"];
  world: unknown;
  history: HistoryEntry[];
}

interface LegacyPerformanceSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 30 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: CareerSave["football"];
  relationships: CareerSave["relationships"];
  world: CareerSave["world"];
  history: HistoryEntry[];
}

interface LegacyHeroControlSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 29 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: LegacyFootballWithHeroControl;
  relationships: CareerSave["relationships"];
  world: LegacyWorldWithoutCareerRegistry;
  history: HistoryEntry[];
}

interface LegacyPreControlSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 28 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: CareerSave["football"];
  relationships: CareerSave["relationships"];
  world: LegacyWorldWithoutCareerRegistry;
  history: HistoryEntry[];
}

interface LegacyMatchExperienceSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 26 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: LegacyProfessionalFootball;
  relationships: CareerSave["relationships"];
  world: CareerSave["world"];
  history: HistoryEntry[];
}

interface LegacyProfessionalSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 23 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: LegacyFootballWithoutProfessional;
  relationships: CareerSave["relationships"];
  world: CareerSave["world"];
  history: HistoryEntry[];
}

interface LegacyHeroGameplaySave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 22 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: Omit<FootballCareerState, "college"> & {
    college: Omit<FootballCareerState["college"], "heroCareer"> & { heroCareer?: Record<string, unknown> };
  };
  relationships: CareerSave["relationships"];
  world: CareerSave["world"];
  history: HistoryEntry[];
}

interface LegacySocialSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 21 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: FootballCareerState;
  relationships: CareerSave["relationships"];
  world: CareerSave["world"];
  history: HistoryEntry[];
}

interface LegacyCompetitionSave {
  meta: Omit<CareerSave["meta"], "schemaVersion"> & { schemaVersion: 20 };
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: FootballCareerState;
  relationships: CareerSave["relationships"];
  world: LegacyFootballEcosystemStateV9;
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


function withProfessionalState<T extends { position: FootballCareerState["position"] }>(
  football: T,
  worldSeed: string,
  draftYear: number,
): T & Pick<FootballCareerState, "professional"> {
  if ("professional" in football && football.professional) {
    return football as T & Pick<FootballCareerState, "professional">;
  }
  return { ...football, professional: createInitialProfessionalState(worldSeed, football.position, draftYear) };
}

function parseMigratedSave(input: {
  meta: CareerSave["meta"];
  character: CareerSave["character"];
  life: CareerSave["life"];
  football: FootballCareerState;
  history: HistoryEntry[];
  relationships?: CareerSave["relationships"];
  world?: CareerSave["world"] | LegacyWorldWithoutCareerRegistry;
}): CareerSave {
  const football = withProfessionalState(input.football, input.meta.worldSeed, input.meta.currentDate.year + 4);
  const sourceWorld = input.world ?? createFootballEcosystem(
    input.meta.worldSeed,
    input.character,
    football,
    input.meta.currentDate,
    input.life.completedDays,
  );
  const world = sourceWorld.careerRegistry?.records.length
    ? sourceWorld
    : { ...sourceWorld, careerRegistry: createCareerRegistry(sourceWorld.players, sourceWorld.teams, sourceWorld.seasonYear) };
  return careerSaveSchema.parse({
    ...input,
    football,
    relationships: input.relationships ?? createFootballRelationships(input.meta.worldSeed, input.character, football),
    world,
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
    professional: createInitialProfessionalState(worldSeed, football.position),
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


function upgradeProfessionalVersionOne(state: LegacyProfessionalStateV1, worldSeed: string, position: CareerSave["football"]["position"]): FootballProfessionalState {
  const base = createInitialProfessionalState(worldSeed, position, state.draftYear);
  const teams = state.teams.map((team, index) => {
    const fallback = base.teams[index] ?? base.teams[0]!;
    const capSpace = team.capSpace < 1_000_000 ? team.capSpace * 1_000_000 : team.capSpace;
    const deadCap = fallback.deadCap;
    const payroll = Math.max(0, PROFESSIONAL_SALARY_CAP - capSpace - deadCap);
    return {
      ...fallback,
      ...team,
      salaryCap: PROFESSIONAL_SALARY_CAP,
      payroll,
      deadCap,
      capSpace: Math.max(0, PROFESSIONAL_SALARY_CAP - payroll - deadCap),
      rosterSize: 0,
    };
  });
  return {
    ...base,
    ...state,
    version: 2,
    teams,
    league: createEmptyProfessionalLeague(state.draftYear),
  };
}



function migrateVersionThirtyOne(input: LegacyTacticalStaffSave): CareerSave {
  const world = upgradeFootballEcosystemV11(input.world, input.meta.currentDate);
  const football = input.football as CareerSave["football"];
  const teams = ensureProfessionalCoaching(football.professional.teams, `${input.meta.worldSeed}:professional-coaching:v32`);
  const league = {
    ...football.professional.league,
    roster: applyProfessionalSchemeFit(teams, football.professional.league.roster.map((player) => ({ ...player, schemeFit: player.schemeFit ?? 60 }))),
    freeAgents: football.professional.league.freeAgents.map((player) => ({ ...player, schemeFit: 60 })),
  };
  return parseMigratedSave({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    world,
    football: {
      ...football,
      professional: { ...football.professional, teams, league },
    },
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v32`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Тренерские штабы подключены",
        description: "Команды получили координаторов, контракты, тактические тенденции и адаптацию по ходу матча.",
      },
    ],
  });
}

function migrateVersionThirty(input: LegacyPerformanceSave): CareerSave {
  return parseMigratedSave({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v31`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Оценка исполнения подключена",
        description: "Каждый снэп и матч получили позиционные критерии, числовую оценку и тренерский разбор.",
      },
    ],
  });
}

function migrateVersionTwentyNine(input: LegacyHeroControlSave): CareerSave {
  const { heroControlMode: _legacyMode, ...match } = input.football.match;
  return parseMigratedSave({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    football: { ...input.football, match },
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v30`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Управление стало бесшовным",
        description: "Режимы удалены: персонаж действует автоматически, а любое движение джойстика временно передаёт управление игроку.",
      },
    ],
  });
}

function migrateVersionTwentyEight(input: LegacyPreControlSave): CareerSave {
  return parseMigratedSave({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v30`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Единая история игроков создана",
        description: "Школьные, университетские и профессиональные этапы связаны постоянными идентификаторами и карьерным архивом.",
      },
    ],
  });
}

function migrateVersionTwentySeven(input: LegacyProfessionalLeagueSave): CareerSave {
  let migrated = parseMigratedSave({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    football: {
      ...input.football,
      professional: upgradeProfessionalVersionOne(input.football.professional, input.meta.worldSeed, input.football.position),
    },
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v28`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Профессиональная лига запущена",
        description: "Сохранение получило ростеры, salary cap, свободных агентов, календарь и профессиональный сезон.",
      },
    ],
  });
  if (migrated.meta.phase === "professional-career" && ["roster", "practice-squad", "cut"].includes(migrated.football.professional.status)) {
    const released = migrated.football.professional.status === "cut";
    if (released) migrated = { ...migrated, football: { ...migrated.football, professional: { ...migrated.football.professional, status: "free-agent" } } };
    let initialized = initializeProfessionalLeague(migrated);
    if (released) {
      initialized = {
        ...initialized,
        football: {
          ...initialized.football,
          professional: {
            ...initialized.football.professional,
            campInvites: createHeroFreeAgentOffers(initialized),
            lastSummary: "Старое отчисление перенесено в новый рынок свободных агентов.",
          },
        },
      };
    }
    return initialized;
  }
  return migrated;
}

function moveMigrationEventLast(save: CareerSave, eventId: string): CareerSave {
  const event = save.history.find((item) => item.id === eventId);
  if (!event) return save;
  return { ...save, history: [...save.history.filter((item) => item.id !== eventId), event] };
}

function migrateVersionTwentySix(input: LegacyMatchExperienceSave): CareerSave {
  const eventId = `migration-${input.meta.id}-v27`;
  const migrated = migrateVersionTwentySeven({
    ...input,
    meta: { ...input.meta, schemaVersion: 27 },
    history: [
      ...input.history,
      {
        id: eventId,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Матчевый опыт обновлён",
        description: "Сохранение получило режимы участия, анализ решений, плавное воспроизведение и точную фиксацию результата розыгрыша.",
      },
    ],
  });
  return moveMigrationEventLast(migrated, eventId);
}

function migrateVersionTwentyFive(input: LegacyFivePositionCareerSave): CareerSave {
  const eventId = `migration-${input.meta.id}-v26`;
  const migrated = migrateVersionTwentySix({
    ...input,
    meta: { ...input.meta, schemaVersion: 26 },
    history: [
      ...input.history,
      {
        id: eventId,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Карьера всех позиций подключена",
        description: "Сохранение получило единый каталог из четырнадцати позиций и расширенную матчевую статистику.",
      },
    ],
  });
  return moveMigrationEventLast(migrated, eventId);
}

function migrateVersionTwentyFour(input: LegacyFullRosterSave): CareerSave {
  return migrateVersionTwentyFive({
    ...input,
    meta: { ...input.meta, schemaVersion: 25 },
    world: upgradeFootballEcosystemV10(input.world, input.meta.currentDate),
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v25`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Составы расширены до полного футбольного ростера",
        description: "Добавлены линии атаки и защиты, тайт-энды, сэйфти и спецкоманды. Старые игроки и история мира сохранены.",
      },
    ],
  });
}

function migrateVersionTwentyThree(input: LegacyProfessionalSave): CareerSave {
  return careerSaveSchema.parse({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    football: withProfessionalState(input.football, input.meta.worldSeed, input.world.seasonYear + 1),
    world: upgradeFootballEcosystemV10(input.world as unknown as LegacyFootballEcosystemStateV10, input.meta.currentDate),
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v24`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Профессиональный рынок открыт",
        description: "Добавлены автономные профессиональные клубы, агенты, Combine, драфт, rookie contracts и тренировочный лагерь.",
      },
    ],
  });
}

function migrateVersionTwentyTwo(input: LegacyHeroGameplaySave): CareerSave {
  const hero = input.world.players.find((player) => player.isHero);
  const oldCareer = input.football.college.heroCareer as Record<string, unknown> | undefined;
  const heroCareer = oldCareer ? {
    ...oldCareer,
    version: 2 as const,
    status: "active" as const,
    classYear: hero?.classYear ?? "Freshman",
    eligibilityYears: hero?.eligibilityYears ?? 4,
    careerSnaps: 0,
    careerGames: 0,
    careerStarts: 0,
    seasonOverallStart: input.football.ratings.overall,
    transferOffers: [],
    seasonHistory: [],
  } : undefined;
  return careerSaveSchema.parse({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    football: {
      ...input.football,
      professional: createInitialProfessionalState(input.meta.worldSeed, input.football.position, input.world.seasonYear + 1),
      college: {
        ...input.football.college,
        ...(heroCareer ? { heroCareer } : {}),
      },
    },
    world: upgradeFootballEcosystemV10(input.world as unknown as LegacyFootballEcosystemStateV10, input.meta.currentDate),
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v23`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Университетская карьера стала многолетней",
        description: "Добавлены интерактивные матчи колледжа, сезонный архив, eligibility, redshirt и реальные трансферные назначения.",
      },
    ],
  });
}

function migrateVersionTwentyOne(input: LegacySocialSave): CareerSave {
  const upgraded = {
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    football: withProfessionalState(input.football, input.meta.worldSeed, input.world.seasonYear + 1),
    world: upgradeFootballEcosystemV10(input.world as unknown as LegacyFootballEcosystemStateV10, input.meta.currentDate),
  } as CareerSave;
  const activated = upgraded.meta.phase === "college-orientation"
    && upgraded.football.college.status === "orientation"
    && Boolean(upgraded.football.college.onboardingPriority)
    ? activateCollegeHeroCareer(upgraded)
    : upgraded;
  return careerSaveSchema.parse({
    ...activated,
    history: [
      ...activated.history,
      {
        id: `migration-${input.meta.id}-v22`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Герой вернулся в живой мир",
        description: "Колледж получил активный недельный цикл, реальные depth chart, игровые роли, обещания штаба, решения и трансферное давление.",
      },
    ],
  });
}

function migrateVersionTwenty(input: LegacyCompetitionSave): CareerSave {
  return careerSaveSchema.parse({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    football: withProfessionalState(input.football, input.meta.worldSeed, input.meta.currentDate.year + 4),
    world: upgradeFootballEcosystemV9(input.world, input.meta.currentDate),
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v21`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Мир получил социальную память",
        description: "Добавлены отношения игроков и тренеров, культура раздевалок, лидерство, конфликты, наставничество и последствия обещаний.",
      },
    ],
  });
}

function migrateVersionNineteen(input: LegacyTacticalSave): CareerSave {
  return careerSaveSchema.parse({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    football: withProfessionalState(input.football, input.meta.worldSeed, input.meta.currentDate.year + 4),
    world: upgradeFootballEcosystemV8(input.world, input.meta.currentDate),
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v20`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Соревнования стали полноценной системой",
        description: "Добавлены национальные рейтинги, сила расписания, rivalry, конференционные финалы, плей-офф, награды и историческая репутация программ.",
      },
    ],
  });
}

function migrateVersionEighteen(input: LegacyUnifiedMarketSave): CareerSave {
  return careerSaveSchema.parse({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    football: withProfessionalState(input.football, input.meta.worldSeed, input.meta.currentDate.year + 4),
    world: upgradeFootballEcosystemV7(input.world, input.meta.currentDate),
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v19`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Программы получили тактическую идентичность",
        description: "Схемы, позиционные роли, освоение playbook и соответствие игроков теперь влияют на развитие, depth chart, рекрутинг и результаты.",
      },
    ],
  });
}

function migrateVersionSeventeen(input: LegacyRosterPlanningSave): CareerSave {
  return careerSaveSchema.parse({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    football: withProfessionalState(input.football, input.meta.worldSeed, input.meta.currentDate.year + 4),
    world: upgradeFootballEcosystemV6(input.world, input.meta.currentDate),
    history: [
      ...input.history,
      {
        id: `migration-${input.meta.id}-v18`,
        occurredAt: input.meta.updatedAt,
        type: "save-migrated",
        title: "Рынки движения объединены",
        description: "Школьные рекруты, JUCO, walk-on, трансферы и тренерские вакансии теперь конкурируют за общие места, стипендии, NIL и кадровые бюджеты.",
      },
    ],
  });
}

function migrateVersionSixteen(input: LegacyAnnualTalentSave): CareerSave {
  return careerSaveSchema.parse({
    ...input,
    meta: { ...input.meta, schemaVersion: CURRENT_SCHEMA_VERSION },
    football: withProfessionalState(input.football, input.meta.worldSeed, input.meta.currentDate.year + 4),
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
    football: withProfessionalState(input.football, input.meta.worldSeed, input.meta.currentDate.year + 4),
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
    football: withProfessionalState(input.football, input.meta.worldSeed, input.meta.currentDate.year + 4),
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
    football: withProfessionalState(input.football, input.meta.worldSeed, input.meta.currentDate.year + 4),
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
    football: withProfessionalState(input.football, input.meta.worldSeed, input.meta.currentDate.year + 4),
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
    football: { ...input.football, college: createInitialCollegeState(), professional: createInitialProfessionalState(input.meta.worldSeed, input.football.position) },
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
    professional: createInitialProfessionalState(input.meta.worldSeed, input.football.position),
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
    professional: createInitialProfessionalState(worldSeed, football.position),
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
    professional: createInitialProfessionalState(worldSeed, football.position),
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
    professional: createInitialProfessionalState(worldSeed, football.position),
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
    professional: createInitialProfessionalState(input.meta.worldSeed, input.football.position),
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
  if (schemaVersion === 31) return migratedResult(migrateVersionThirtyOne(input as LegacyTacticalStaffSave), 31);
  if (schemaVersion === 30) return migratedResult(migrateVersionThirty(input as LegacyPerformanceSave), 30);
  if (schemaVersion === 29) return migratedResult(migrateVersionTwentyNine(input as LegacyHeroControlSave), 29);
  if (schemaVersion === 28) return migratedResult(migrateVersionTwentyEight(input as LegacyPreControlSave), 28);
  if (schemaVersion === 27) return migratedResult(migrateVersionTwentySeven(input as LegacyProfessionalLeagueSave), 27);
  if (schemaVersion === 26) return migratedResult(migrateVersionTwentySix(input as LegacyMatchExperienceSave), 26);
  if (schemaVersion === 25) return migratedResult(migrateVersionTwentyFive(input as LegacyFivePositionCareerSave), 25);
  if (schemaVersion === 24) return migratedResult(migrateVersionTwentyFour(input as LegacyFullRosterSave), 24);
  if (schemaVersion === 23) return migratedResult(migrateVersionTwentyThree(input as LegacyProfessionalSave), 23);
  if (schemaVersion === 22) return migratedResult(migrateVersionTwentyTwo(input as LegacyHeroGameplaySave), 22);
  if (schemaVersion === 21) return migratedResult(migrateVersionTwentyOne(input as LegacySocialSave), 21);
  if (schemaVersion === 20) return migratedResult(migrateVersionTwenty(input as LegacyCompetitionSave), 20);
  if (schemaVersion === 19) return migratedResult(migrateVersionNineteen(input as LegacyTacticalSave), 19);
  if (schemaVersion === 18) return migratedResult(migrateVersionEighteen(input as LegacyUnifiedMarketSave), 18);
  if (schemaVersion === 17) return migratedResult(migrateVersionSeventeen(input as LegacyRosterPlanningSave), 17);
  if (schemaVersion === 16) return migratedResult(migrateVersionSixteen(input as LegacyAnnualTalentSave), 16);
  if (schemaVersion === 15) return migratedResult(migrateVersionFifteen(input as LegacyFiniteResourcesSave), 15);
  if (schemaVersion === 14) return migratedResult(migrateVersionFourteen(input as LegacyWorldConstitutionSave), 14);
  if (schemaVersion === 13) return migratedResult(migrateVersionThirteen(input as LegacyContinuitySave), 13);
  if (schemaVersion === 12) return migratedResult(migrateVersionTwelve(input as LegacyEcosystemSave), 12);
  if (schemaVersion === 11) return migratedResult(migrateVersionEleven(input as LegacyCollegeTransitionSave), 11);
  if (schemaVersion === 10) return migratedResult(migrateVersionTen(input as LegacyDecisionSave), 10);
  if (schemaVersion === 9) return migratedResult(migrateVersionNine(input as LegacyRecruitingSave), 9);
  if (schemaVersion === 8) return migratedResult(migrateVersionEight(input as LegacyRelationshipsSave), 8);
  if (schemaVersion === 7) return migratedResult(migrateVersionSeven(input as LegacySeasonSave), 7);
  if (schemaVersion === 6) return migratedResult(migrateVersionSix(input as LegacyMatchSave), 6);
  if (schemaVersion === 5) return migratedResult(migrateVersionFive(input as LegacyTrainingHealthSave), 5);
  if (schemaVersion === 4) return migratedResult(migrateVersionFour(input as LegacyTeamWorldSave), 4);
  if (schemaVersion === 3) return migratedResult(migrateVersionThree(input as LegacyWeeklyLoopSave), 3);
  if (schemaVersion === 2) return migratedResult(migrateVersionTwo(input as LegacyPlayerCreationSave), 2);
  if (schemaVersion === 1) return migratedResult(migrateVersionOne(input as LegacyFoundationSave), 1);
  if (typeof schemaVersion !== "number") throw new Error("Save has no schema version");
  if (schemaVersion > CURRENT_SCHEMA_VERSION) throw new Error("Save was created by a newer PROSPECT version");
  throw new Error(`No migration path from schema ${schemaVersion}`);
}
