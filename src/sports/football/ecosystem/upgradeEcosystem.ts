import type { GameDate } from "../../../core/calendar/types";
import type { CharacterState } from "../../../core/character/types";
import type { FootballCareerState } from "../career/types";
import { assignCollegeConferences } from "./createEcosystem";
import type {
  EcosystemCoach,
  EcosystemPlayer,
  EcosystemTeam,
  FootballEcosystemState,
} from "./types";
import { createPlayerEligibility, createTeamCompliance, createWorldConstitution, refreshTeamCompliance, resolveWorldCycle } from "./constitution";
import { SeededRandom } from "../../../core/random/SeededRandom";
import { createProgramResources } from "./resources";
import { createTalentPipeline, createTalentProfile } from "./talent";

type LegacyTeam = Omit<
  EcosystemTeam,
  "conferenceId" | "conferenceWins" | "conferenceLosses" | "championships" | "compliance" | "resources"
>;

type LegacyPlayer = Omit<
  EcosystemPlayer,
  "eligibilityYears" | "seasonsPlayed" | "transferStatus" | "previousTeamIds" | "isHero" | "talent"
>;

type LegacyCoach = Omit<
  EcosystemCoach,
  "tenureYears" | "careerWins" | "careerLosses" | "previousTeamIds"
>;

type LegacyV2Team = Omit<EcosystemTeam, "compliance" | "resources">;
type LegacyV2Player = Omit<EcosystemPlayer, "eligibility" | "talent">;
type LegacyV2Market = Omit<
  FootballEcosystemState["market"],
  "totalRecruitingBudget" | "totalNilCapacity" | "programsUnderFinancialPressure" | "annualProspects" | "jucoProspects" | "walkOnProspects" | "nationallyExposedProspects"
>;

export interface LegacyFootballEcosystemStateV2 extends Omit<
  FootballEcosystemState,
  "moduleVersion" | "constitution" | "cycle" | "teams" | "players" | "market" | "talentPipeline"
> {
  moduleVersion: 2;
  teams: LegacyV2Team[];
  players: LegacyV2Player[];
  market: LegacyV2Market;
}

type LegacyV3Team = Omit<EcosystemTeam, "resources">;
type LegacyV3Player = Omit<EcosystemPlayer, "talent">;
type LegacyV3Market = Omit<
  FootballEcosystemState["market"],
  "totalRecruitingBudget" | "totalNilCapacity" | "programsUnderFinancialPressure" | "annualProspects" | "jucoProspects" | "walkOnProspects" | "nationallyExposedProspects"
>;

export interface LegacyFootballEcosystemStateV3 extends Omit<
  FootballEcosystemState,
  "moduleVersion" | "teams" | "players" | "market" | "talentPipeline"
> {
  moduleVersion: 3;
  teams: LegacyV3Team[];
  players: LegacyV3Player[];
  market: LegacyV3Market;
}

type LegacyV4Player = Omit<EcosystemPlayer, "talent">;
type LegacyV4Market = Omit<
  FootballEcosystemState["market"],
  "annualProspects" | "jucoProspects" | "walkOnProspects" | "nationallyExposedProspects"
>;

export interface LegacyFootballEcosystemStateV4 extends Omit<
  FootballEcosystemState,
  "moduleVersion" | "players" | "market" | "talentPipeline"
> {
  moduleVersion: 4;
  players: LegacyV4Player[];
  market: LegacyV4Market;
}

export interface LegacyFootballEcosystemStateV1 {
  moduleVersion: 1;
  lastSimulatedDay: number;
  currentWeek: number;
  lastUpdatedOn: GameDate;
  teams: LegacyTeam[];
  players: LegacyPlayer[];
  coaches: LegacyCoach[];
  stories: FootballEcosystemState["stories"];
  digest: string[];
  market: {
    openScholarships: number;
    activeRecruitments: number;
    committedPlayers: number;
    coachingHotSeats: number;
  };
}

const CLASS_INDEX = { Freshman: 0, Sophomore: 1, Junior: 2, Senior: 3 } as const;

function currentSeasonYear(football: FootballCareerState): number {
  return football.college.arrivalDate?.year ?? football.season.year;
}

function heroPlayer(
  character: CharacterState,
  football: FootballCareerState,
): EcosystemPlayer {
  return {
    id: "hero",
    seed: `${football.worldSeed}:hero`,
    name: character.identity.fullName,
    teamId: football.college.status === "orientation" && football.college.signedProgramId
      ? football.college.signedProgramId
      : football.school.id,
    level: football.college.status === "orientation" ? "college" : "high-school",
    age: character.identity.age,
    classYear: football.college.status === "orientation" ? "Freshman" : "Senior",
    position: football.position,
    overall: football.ratings.overall,
    potential: Math.max(football.ratings.overall, football.ratings.overall + 8),
    health: character.condition.health,
    form: football.depthChart.coachTrust,
    status: football.depthChart.rank === 1 ? "starter" : football.depthChart.rank === 2 ? "rotation" : "backup",
    depthRank: football.college.depthRank ?? football.depthChart.rank,
    trajectory: football.depthChart.evaluation.trend === "rising"
      ? "surging"
      : football.depthChart.evaluation.trend === "falling"
        ? "slipping"
        : "steady",
    nationalRank: football.ratings.overall >= 82 ? 120 : football.ratings.overall >= 74 ? 420 : 1100,
    recruitingStage: football.recruitment.commitment ? "committed" : football.recruitment.offers > 0 ? "offered" : "tracked",
    ...(football.college.signedProgramId ? { committedTeamId: football.college.signedProgramId } : {}),
    eligibilityYears: 4,
    seasonsPlayed: 0,
    transferStatus: "none",
    previousTeamIds: football.college.status === "orientation" ? [football.school.id] : [],
    isHero: true,
    eligibility: createPlayerEligibility(football.college.status === "orientation" ? "college" : "high-school", character.identity.age, football.college.status === "orientation" ? "Freshman" : "Senior", currentSeasonYear(football), new SeededRandom(`${football.worldSeed}:hero:eligibility`), football.college.entryRoute === "preferred-walk-on" ? "none" : "full"),
    talent: createTalentProfile({ level: football.college.status === "orientation" ? "college" : "high-school", classYear: football.college.status === "orientation" ? "Freshman" : "Senior", overall: football.ratings.overall, potential: Math.max(football.ratings.overall, football.ratings.overall + 8), nationalRank: football.ratings.overall >= 82 ? 120 : football.ratings.overall >= 74 ? 420 : 1100, isHero: true }, football.school.stateCode, currentSeasonYear(football), new SeededRandom(`${football.worldSeed}:hero:talent:v16`)),
  };
}

export function upgradeFootballEcosystemV1(
  input: LegacyFootballEcosystemStateV1,
  character: CharacterState,
  football: FootballCareerState,
  currentDate: GameDate,
): FootballEcosystemState {
  const teams: EcosystemTeam[] = input.teams.map((team) => ({
    ...team,
    conferenceWins: 0,
    conferenceLosses: 0,
    championships: 0,
    compliance: createTeamCompliance(team, team.rosterIds.length, new SeededRandom(`${team.seed}:compliance:v14`)),
    resources: createProgramResources(team, new SeededRandom(`${team.seed}:resources:v15`), currentDate.year),
  }));
  const conferenceSetup = assignCollegeConferences(teams);
  const players: EcosystemPlayer[] = input.players
    .filter((player) => player.id !== "hero")
    .map((player) => ({
      ...player,
      eligibilityYears: player.level === "college" ? Math.max(1, 4 - CLASS_INDEX[player.classYear]) : 4,
      seasonsPlayed: player.level === "college" ? CLASS_INDEX[player.classYear] : 0,
      transferStatus: "none",
      previousTeamIds: [],
      isHero: false,
      eligibility: createPlayerEligibility(player.level, player.age, player.classYear, currentDate.year, new SeededRandom(`${player.seed}:eligibility:v14`)),
      talent: createTalentProfile({ level: player.level, classYear: player.classYear, overall: player.overall, potential: player.potential, nationalRank: player.nationalRank, isHero: false }, teams.find((team) => team.id === player.teamId)?.stateCode ?? football.school.stateCode, currentDate.year, new SeededRandom(`${player.seed}:talent:v16`)),
    }));
  players.push(heroPlayer(character, football));
  const coaches: EcosystemCoach[] = input.coaches.map((coach) => ({
    ...coach,
    tenureYears: 1,
    careerWins: 0,
    careerLosses: 0,
    previousTeamIds: [],
  }));
  const hero = players.find((player) => player.isHero);
  const updatedTeams = conferenceSetup.teams.map((team) => {
    if (!hero) return team;
    if (team.id === hero.teamId && !team.rosterIds.includes(hero.id)) {
      return { ...team, rosterIds: [...team.rosterIds, hero.id] };
    }
    if (team.id !== hero.teamId && team.rosterIds.includes(hero.id)) {
      return { ...team, rosterIds: team.rosterIds.filter((id) => id !== hero.id) };
    }
    return team;
  });
  const constitution = createWorldConstitution();
  const compliantTeams = updatedTeams.map((team) => ({
    ...team,
    compliance: refreshTeamCompliance(team, players, new SeededRandom(`${team.seed}:compliance:upgrade`), constitution),
  }));
  return {
    moduleVersion: 5,
    constitution,
    cycle: resolveWorldCycle(currentDate),
    lastSimulatedDay: input.lastSimulatedDay,
    currentWeek: input.currentWeek,
    lastUpdatedOn: input.lastUpdatedOn,
    seasonYear: currentDate.year,
    seasonWeek: Math.max(1, Math.min(10, input.currentWeek)),
    phase: "regular-season",
    lastOffseasonYear: currentDate.year - 1,
    conferences: conferenceSetup.conferences,
    teams: compliantTeams,
    players,
    coaches,
    stories: input.stories,
    digest: input.digest,
    market: {
      ...input.market,
      portalPlayers: 0,
      coachOpenings: 0,
      totalRecruitingBudget: compliantTeams.filter((team) => team.level === "college").reduce((sum, team) => sum + team.resources.recruitingBudget, 0),
      totalNilCapacity: compliantTeams.filter((team) => team.level === "college").reduce((sum, team) => sum + team.resources.nilCapacity, 0),
      programsUnderFinancialPressure: compliantTeams.filter((team) => team.level === "college" && team.resources.financialPressure >= 65).length,
      annualProspects: players.filter((player) => player.level === "high-school").length,
      jucoProspects: 0,
      walkOnProspects: 0,
      nationallyExposedProspects: players.filter((player) => player.level === "high-school" && player.talent.exposure === "national").length,
    },
    teamHistory: [],
    transactions: [],
    talentPipeline: createTalentPipeline(players, currentDate.year),
  };
}


export function upgradeFootballEcosystemV2(
  input: LegacyFootballEcosystemStateV2,
  currentDate: GameDate,
): FootballEcosystemState {
  const constitution = createWorldConstitution();
  const players: EcosystemPlayer[] = input.players.map((player) => ({
    ...player,
    eligibility: createPlayerEligibility(
      player.level,
      player.age,
      player.classYear,
      input.seasonYear,
      new SeededRandom(`${player.seed}:eligibility:v14`),
      player.level === "college" && player.recruitingStage === "committed" ? "full" : undefined,
    ),
    talent: createTalentProfile({ level: player.level, classYear: player.classYear, overall: player.overall, potential: player.potential, nationalRank: player.nationalRank, isHero: player.isHero }, input.teams.find((team) => team.id === player.teamId)?.stateCode ?? "TX", input.seasonYear, new SeededRandom(`${player.seed}:talent:v16`)),
  }));
  const teams: EcosystemTeam[] = input.teams.map((team) => {
    const withCompliance: EcosystemTeam = {
      ...team,
      compliance: createTeamCompliance(team, team.rosterIds.length, new SeededRandom(`${team.seed}:compliance:v14`), constitution),
      resources: createProgramResources(team, new SeededRandom(`${team.seed}:resources:v15`), input.seasonYear),
    };
    return {
      ...withCompliance,
      compliance: refreshTeamCompliance(withCompliance, players, new SeededRandom(`${team.seed}:compliance:final:v14`), constitution),
    };
  });
  return {
    ...input,
    moduleVersion: 5,
    constitution,
    cycle: resolveWorldCycle(currentDate),
    teams,
    players,
    market: {
      ...input.market,
      totalRecruitingBudget: teams.filter((team) => team.level === "college").reduce((sum, team) => sum + team.resources.recruitingBudget, 0),
      totalNilCapacity: teams.filter((team) => team.level === "college").reduce((sum, team) => sum + team.resources.nilCapacity, 0),
      programsUnderFinancialPressure: teams.filter((team) => team.level === "college" && team.resources.financialPressure >= 65).length,
      annualProspects: players.filter((player) => player.level === "high-school").length,
      jucoProspects: 0,
      walkOnProspects: 0,
      nationallyExposedProspects: players.filter((player) => player.level === "high-school" && player.talent.exposure === "national").length,
    },
    talentPipeline: createTalentPipeline(players, input.seasonYear),
  };
}


export function upgradeFootballEcosystemV3(
  input: LegacyFootballEcosystemStateV3,
  currentDate: GameDate,
): FootballEcosystemState {
  const players: EcosystemPlayer[] = input.players.map((player) => ({
    ...player,
    talent: createTalentProfile(
      { level: player.level, classYear: player.classYear, overall: player.overall, potential: player.potential, nationalRank: player.nationalRank, isHero: player.isHero },
      input.teams.find((team) => team.id === player.teamId)?.stateCode ?? "TX",
      input.seasonYear,
      new SeededRandom(`${player.seed}:talent:v16`),
    ),
  }));
  const teams: EcosystemTeam[] = input.teams.map((team) => ({
    ...team,
    resources: createProgramResources(
      team,
      new SeededRandom(`${team.seed}:resources:v15`),
      input.seasonYear,
    ),
  }));
  const talentPipeline = createTalentPipeline(players, input.seasonYear);
  return {
    ...input,
    moduleVersion: 5,
    cycle: resolveWorldCycle(currentDate),
    teams,
    players,
    market: {
      ...input.market,
      totalRecruitingBudget: teams.filter((team) => team.level === "college").reduce((sum, team) => sum + team.resources.recruitingBudget, 0),
      totalNilCapacity: teams.filter((team) => team.level === "college").reduce((sum, team) => sum + team.resources.nilCapacity, 0),
      programsUnderFinancialPressure: teams.filter((team) => team.level === "college" && team.resources.financialPressure >= 65).length,
      annualProspects: players.filter((player) => player.level === "high-school").length,
      jucoProspects: 0,
      walkOnProspects: 0,
      nationallyExposedProspects: players.filter((player) => player.level === "high-school" && player.talent.exposure === "national").length,
    },
    talentPipeline,
  };
}

export function upgradeFootballEcosystemV4(
  input: LegacyFootballEcosystemStateV4,
  currentDate: GameDate,
): FootballEcosystemState {
  const players: EcosystemPlayer[] = input.players.map((player) => ({
    ...player,
    talent: createTalentProfile(
      { level: player.level, classYear: player.classYear, overall: player.overall, potential: player.potential, nationalRank: player.nationalRank, isHero: player.isHero },
      input.teams.find((team) => team.id === player.teamId)?.stateCode ?? "TX",
      input.seasonYear,
      new SeededRandom(`${player.seed}:talent:v16`),
    ),
  }));
  const talentPipeline = createTalentPipeline(players, input.seasonYear);
  return {
    ...input,
    moduleVersion: 5,
    cycle: resolveWorldCycle(currentDate),
    players,
    market: {
      ...input.market,
      annualProspects: players.filter((player) => player.level === "high-school").length,
      jucoProspects: 0,
      walkOnProspects: 0,
      nationallyExposedProspects: players.filter((player) => player.level === "high-school" && player.talent.exposure === "national").length,
    },
    talentPipeline,
  };
}
