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
import { createEmptyRosterPlan, reviewRosterManagement } from "./rosterManagement";
import { createUnifiedMovementMarket } from "./movementMarket";
import { createPlayerTacticalProfile, createTacticalIdentity } from "./tactics";
import { createCompetitionState } from "./competition";
import { createSocialEcosystem } from "./social";

type LegacyTeam = Omit<
  EcosystemTeam,
  "conferenceId" | "conferenceWins" | "conferenceLosses" | "championships" | "compliance" | "resources" | "rosterPlan" | "tactical"
>;

type LegacyPlayer = Omit<
  EcosystemPlayer,
  "eligibilityYears" | "seasonsPlayed" | "transferStatus" | "previousTeamIds" | "isHero" | "talent" | "usagePlan" | "positionHistory" | "tactical"
>;

type LegacyCoach = Omit<
  EcosystemCoach,
  "tenureYears" | "careerWins" | "careerLosses" | "previousTeamIds"
>;

type LegacyV2Team = Omit<EcosystemTeam, "compliance" | "resources" | "rosterPlan" | "tactical">;
type LegacyV2Player = Omit<EcosystemPlayer, "eligibility" | "talent" | "usagePlan" | "positionHistory" | "tactical">;
type LegacyV2Market = Omit<
  FootballEcosystemState["market"],
  "totalRecruitingBudget" | "totalNilCapacity" | "programsUnderFinancialPressure" | "annualProspects" | "jucoProspects" | "walkOnProspects" | "nationallyExposedProspects" | "plannedClassSpots" | "developmentalPlayers" | "plannedPositionChanges" | "activeNegotiations" | "withdrawnOffers" | "transferCandidates" | "lowSchemeFitPlayers" | "programsInstallingNewSystems"
>;

export interface LegacyFootballEcosystemStateV2 extends Omit<
  FootballEcosystemState,
  "moduleVersion" | "constitution" | "cycle" | "teams" | "players" | "market" | "talentPipeline" | "competition" | "social"
> {
  moduleVersion: 2;
  teams: LegacyV2Team[];
  players: LegacyV2Player[];
  market: LegacyV2Market;
}

type LegacyV3Team = Omit<EcosystemTeam, "resources" | "rosterPlan" | "tactical">;
type LegacyV3Player = Omit<EcosystemPlayer, "talent" | "usagePlan" | "positionHistory" | "tactical">;
type LegacyV3Market = Omit<
  FootballEcosystemState["market"],
  "totalRecruitingBudget" | "totalNilCapacity" | "programsUnderFinancialPressure" | "annualProspects" | "jucoProspects" | "walkOnProspects" | "nationallyExposedProspects" | "plannedClassSpots" | "developmentalPlayers" | "plannedPositionChanges" | "activeNegotiations" | "withdrawnOffers" | "transferCandidates" | "lowSchemeFitPlayers" | "programsInstallingNewSystems"
>;

export interface LegacyFootballEcosystemStateV3 extends Omit<
  FootballEcosystemState,
  "moduleVersion" | "teams" | "players" | "market" | "talentPipeline" | "competition" | "social"
> {
  moduleVersion: 3;
  teams: LegacyV3Team[];
  players: LegacyV3Player[];
  market: LegacyV3Market;
}

type LegacyV4Team = Omit<EcosystemTeam, "rosterPlan" | "tactical">;
type LegacyV4Player = Omit<EcosystemPlayer, "talent" | "usagePlan" | "positionHistory" | "tactical">;
type LegacyV4Market = Omit<
  FootballEcosystemState["market"],
  "annualProspects" | "jucoProspects" | "walkOnProspects" | "nationallyExposedProspects" | "plannedClassSpots" | "developmentalPlayers" | "plannedPositionChanges" | "activeNegotiations" | "withdrawnOffers" | "transferCandidates" | "lowSchemeFitPlayers" | "programsInstallingNewSystems"
>;

export interface LegacyFootballEcosystemStateV4 extends Omit<
  FootballEcosystemState,
  "moduleVersion" | "teams" | "players" | "market" | "talentPipeline" | "competition" | "social"
> {
  moduleVersion: 4;
  teams: LegacyV4Team[];
  players: LegacyV4Player[];
  market: LegacyV4Market;
}

type LegacyV5Team = Omit<EcosystemTeam, "rosterPlan" | "tactical">;
type LegacyV5Player = Omit<EcosystemPlayer, "usagePlan" | "positionHistory" | "tactical">;
type LegacyV5Market = Omit<FootballEcosystemState["market"], "plannedClassSpots" | "developmentalPlayers" | "plannedPositionChanges" | "activeNegotiations" | "withdrawnOffers" | "transferCandidates" | "lowSchemeFitPlayers" | "programsInstallingNewSystems">;

export interface LegacyFootballEcosystemStateV5 extends Omit<
  FootballEcosystemState,
  "moduleVersion" | "teams" | "players" | "market" | "competition" | "social"
> {
  moduleVersion: 5;
  teams: LegacyV5Team[];
  players: LegacyV5Player[];
  market: LegacyV5Market;
}

export interface LegacyFootballEcosystemStateV6 extends Omit<FootballEcosystemState, "moduleVersion" | "teams" | "players" | "movementMarket" | "market" | "competition" | "social"> {
  moduleVersion: 6;
  teams: Array<Omit<EcosystemTeam, "tactical">>;
  players: Array<Omit<EcosystemPlayer, "tactical">>;
  market: Omit<FootballEcosystemState["market"], "activeNegotiations" | "withdrawnOffers" | "transferCandidates" | "lowSchemeFitPlayers" | "programsInstallingNewSystems">;
}

export interface LegacyFootballEcosystemStateV7 extends Omit<FootballEcosystemState, "moduleVersion" | "teams" | "players" | "market" | "competition" | "social"> {
  moduleVersion: 7;
  teams: Array<Omit<EcosystemTeam, "tactical">>;
  players: Array<Omit<EcosystemPlayer, "tactical">>;
  market: Omit<FootballEcosystemState["market"], "lowSchemeFitPlayers" | "programsInstallingNewSystems">;
}

export interface LegacyFootballEcosystemStateV8 extends Omit<FootballEcosystemState, "moduleVersion" | "competition" | "social"> {
  moduleVersion: 8;
}

export interface LegacyFootballEcosystemStateV9 extends Omit<FootballEcosystemState, "moduleVersion" | "social"> {
  moduleVersion: 9;
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

type PreRosterMarket = Omit<FootballEcosystemState["market"], "plannedClassSpots" | "developmentalPlayers" | "plannedPositionChanges" | "activeNegotiations" | "withdrawnOffers" | "transferCandidates" | "lowSchemeFitPlayers" | "programsInstallingNewSystems">;
type PreRosterWorld = Omit<FootballEcosystemState, "moduleVersion" | "teams" | "players" | "market" | "movementMarket" | "competition" | "social"> & {
  teams: Array<Omit<EcosystemTeam, "rosterPlan" | "tactical">>;
  players: Array<Omit<EcosystemPlayer, "usagePlan" | "positionHistory" | "tactical">>;
  market: PreRosterMarket;
};

function addTacticalLayer(
  teams: Array<Omit<EcosystemTeam, "tactical">>,
  players: Array<Omit<EcosystemPlayer, "tactical">>,
  coaches: EcosystemCoach[],
  seasonYear: number,
): { teams: EcosystemTeam[]; players: EcosystemPlayer[] } {
  const tacticalTeams: EcosystemTeam[] = teams.map((team) => {
    const headCoach = coaches.find((coach) => coach.teamId === team.id && coach.role === "head-coach");
    return {
      ...team,
      tactical: createTacticalIdentity(team, headCoach, new SeededRandom(`${team.seed}:tactical:v19`)),
    };
  });
  const teamMap = new Map(tacticalTeams.map((team) => [team.id, team]));
  const tacticalPlayers: EcosystemPlayer[] = players.map((player) => {
    const team = teamMap.get(player.teamId);
    if (!team) throw new Error(`Cannot assign tactical profile without team: ${player.teamId}`);
    return {
      ...player,
      tactical: createPlayerTacticalProfile(player, team.tactical, new SeededRandom(`${player.seed}:tactical:v19`)),
    };
  });
  return { teams: tacticalTeams, players: tacticalPlayers };
}

function normalizeRosterPlayers(
  players: Array<Omit<EcosystemPlayer, "usagePlan" | "positionHistory" | "tactical">>,
): Array<Omit<EcosystemPlayer, "tactical">> {
  return players.map((player) => ({
    ...player,
    usagePlan: player.depthRank === 1 ? "starter" : player.depthRank === 2 ? "rotation" : "developmental",
    positionHistory: [],
  }));
}

function finalizeRosterUpgrade(base: PreRosterWorld, currentDate: GameDate): FootballEcosystemState {
  const rosterPlayers = normalizeRosterPlayers(base.players);
  const rosterTeams: Array<Omit<EcosystemTeam, "tactical">> = base.teams.map((team) => ({
    ...team,
    rosterPlan: createEmptyRosterPlan(team, base.seasonYear),
  }));
  const tactical = addTacticalLayer(rosterTeams, rosterPlayers, base.coaches, base.seasonYear);
  const players = tactical.players;
  const teams = tactical.teams;
  const planning = reviewRosterManagement(
    teams,
    players,
    base.coaches,
    base.constitution,
    base.seasonYear,
    base.seasonWeek,
    new SeededRandom(`upgrade:roster-plans:${base.seasonYear}:${currentDate.month}:${currentDate.day}`),
    { applyOffseasonDecisions: false, reason: "Миграционный аудит состава и трёхлетний прогноз." },
  );
  const collegeTeams = planning.teams.filter((team) => team.level === "college");
  return {
    ...base,
    moduleVersion: 10,
    teams: planning.teams,
    players: planning.players,
    market: {
      ...base.market,
      plannedClassSpots: collegeTeams.reduce((sum, team) => sum + team.rosterPlan.targetClassSize, 0),
      developmentalPlayers: planning.players.filter((player) => player.usagePlan === "developmental" || player.usagePlan === "redshirt").length,
      plannedPositionChanges: collegeTeams.reduce((sum, team) => sum + team.rosterPlan.positionChanges.filter((change) => !change.applied).length, 0),
      activeNegotiations: 0,
      withdrawnOffers: 0,
      transferCandidates: planning.players.filter((player) => player.level === "college" && player.depthRank >= 3 && player.eligibilityYears > 1).length,
      lowSchemeFitPlayers: planning.players.filter((player) => player.level === "college" && player.tactical.schemeFit < 55).length,
      programsInstallingNewSystems: collegeTeams.filter((team) => team.tactical.installation < 58 || team.tactical.continuity < 48).length,
    },
    movementMarket: createUnifiedMovementMarket(planning.teams, planning.players, base.seasonYear),
    competition: createCompetitionState(base.seasonYear, base.conferences, planning.teams, new SeededRandom(`upgrade:competition:${base.seasonYear}`)),
    social: createSocialEcosystem(planning.teams, planning.players, base.coaches, base.seasonYear, new SeededRandom(`upgrade:social:${base.seasonYear}`), base.lastSimulatedDay),
  };
}

function currentSeasonYear(football: FootballCareerState): number {
  return football.college.arrivalDate?.year ?? football.season.year;
}

function heroPlayer(
  character: CharacterState,
  football: FootballCareerState,
): Omit<EcosystemPlayer, "tactical"> {
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
    usagePlan: football.depthChart.rank === 1 ? "starter" : football.depthChart.rank === 2 ? "rotation" : "developmental",
    positionHistory: [],
  };
}

export function upgradeFootballEcosystemV1(
  input: LegacyFootballEcosystemStateV1,
  character: CharacterState,
  football: FootballCareerState,
  currentDate: GameDate,
): FootballEcosystemState {
  const teams: Array<Omit<EcosystemTeam, "rosterPlan" | "tactical">> = input.teams.map((team) => ({
    ...team,
    conferenceWins: 0,
    conferenceLosses: 0,
    championships: 0,
    compliance: createTeamCompliance(team, team.rosterIds.length, new SeededRandom(`${team.seed}:compliance:v14`)),
    resources: createProgramResources(team, new SeededRandom(`${team.seed}:resources:v15`), currentDate.year),
  }));
  const conferenceSetup = assignCollegeConferences(teams);
  const players: Array<Omit<EcosystemPlayer, "usagePlan" | "positionHistory" | "tactical">> = input.players
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
  const compliantTeams: Array<Omit<EcosystemTeam, "rosterPlan" | "tactical">> = updatedTeams.map((team) => ({
    ...team,
    compliance: refreshTeamCompliance(team, players, new SeededRandom(`${team.seed}:compliance:upgrade`), constitution),
  }));
  return finalizeRosterUpgrade({
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
    talentPipeline: createTalentPipeline(normalizeRosterPlayers(players), currentDate.year),
  }, currentDate);
}


export function upgradeFootballEcosystemV2(
  input: LegacyFootballEcosystemStateV2,
  currentDate: GameDate,
): FootballEcosystemState {
  const constitution = createWorldConstitution();
  const players: Array<Omit<EcosystemPlayer, "usagePlan" | "positionHistory" | "tactical">> = input.players.map((player) => ({
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
  const teams: Array<Omit<EcosystemTeam, "rosterPlan" | "tactical">> = input.teams.map((team) => {
    const withCompliance: Omit<EcosystemTeam, "rosterPlan" | "tactical"> = {
      ...team,
      compliance: createTeamCompliance(team, team.rosterIds.length, new SeededRandom(`${team.seed}:compliance:v14`), constitution),
      resources: createProgramResources(team, new SeededRandom(`${team.seed}:resources:v15`), input.seasonYear),
    };
    return {
      ...withCompliance,
      compliance: refreshTeamCompliance(withCompliance, players, new SeededRandom(`${team.seed}:compliance:final:v14`), constitution),
    };
  });
  return finalizeRosterUpgrade({
    ...input,
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
    talentPipeline: createTalentPipeline(normalizeRosterPlayers(players), input.seasonYear),
  }, currentDate);
}


export function upgradeFootballEcosystemV3(
  input: LegacyFootballEcosystemStateV3,
  currentDate: GameDate,
): FootballEcosystemState {
  const players: Array<Omit<EcosystemPlayer, "usagePlan" | "positionHistory" | "tactical">> = input.players.map((player) => ({
    ...player,
    talent: createTalentProfile(
      { level: player.level, classYear: player.classYear, overall: player.overall, potential: player.potential, nationalRank: player.nationalRank, isHero: player.isHero },
      input.teams.find((team) => team.id === player.teamId)?.stateCode ?? "TX",
      input.seasonYear,
      new SeededRandom(`${player.seed}:talent:v16`),
    ),
  }));
  const teams: Array<Omit<EcosystemTeam, "rosterPlan" | "tactical">> = input.teams.map((team) => ({
    ...team,
    resources: createProgramResources(
      team,
      new SeededRandom(`${team.seed}:resources:v15`),
      input.seasonYear,
    ),
  }));
  const talentPipeline = createTalentPipeline(normalizeRosterPlayers(players), input.seasonYear);
  return finalizeRosterUpgrade({
    ...input,
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
  }, currentDate);
}

export function upgradeFootballEcosystemV4(
  input: LegacyFootballEcosystemStateV4,
  currentDate: GameDate,
): FootballEcosystemState {
  const players: Array<Omit<EcosystemPlayer, "usagePlan" | "positionHistory" | "tactical">> = input.players.map((player) => ({
    ...player,
    talent: createTalentProfile(
      { level: player.level, classYear: player.classYear, overall: player.overall, potential: player.potential, nationalRank: player.nationalRank, isHero: player.isHero },
      input.teams.find((team) => team.id === player.teamId)?.stateCode ?? "TX",
      input.seasonYear,
      new SeededRandom(`${player.seed}:talent:v16`),
    ),
  }));
  const talentPipeline = createTalentPipeline(normalizeRosterPlayers(players), input.seasonYear);
  return finalizeRosterUpgrade({
    ...input,
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
  }, currentDate);
}

export function upgradeFootballEcosystemV5(
  input: LegacyFootballEcosystemStateV5,
  currentDate: GameDate,
): FootballEcosystemState {
  return finalizeRosterUpgrade({
    ...input,
    cycle: resolveWorldCycle(currentDate),
  }, currentDate);
}

export function upgradeFootballEcosystemV6(
  input: LegacyFootballEcosystemStateV6,
  currentDate: GameDate,
): FootballEcosystemState {
  const rosterTeams = input.teams;
  const rosterPlayers = input.players;
  const tactical = addTacticalLayer(rosterTeams, rosterPlayers, input.coaches, input.seasonYear);
  const movementMarket = createUnifiedMovementMarket(tactical.teams, tactical.players, input.seasonYear);
  return {
    ...input,
    moduleVersion: 10,
    cycle: input.cycle ?? resolveWorldCycle(currentDate),
    teams: tactical.teams,
    players: tactical.players,
    market: {
      ...input.market,
      activeNegotiations: 0,
      withdrawnOffers: 0,
      transferCandidates: tactical.players.filter((player) => player.level === "college" && player.depthRank >= 3 && player.eligibilityYears > 1).length,
      lowSchemeFitPlayers: tactical.players.filter((player) => player.level === "college" && player.tactical.schemeFit < 55).length,
      programsInstallingNewSystems: tactical.teams.filter((team) => team.level === "college" && (team.tactical.installation < 58 || team.tactical.continuity < 48)).length,
    },
    movementMarket,
    competition: createCompetitionState(input.seasonYear, input.conferences, tactical.teams, new SeededRandom(`upgrade:competition:v18:${input.seasonYear}`)),
    social: createSocialEcosystem(tactical.teams, tactical.players, input.coaches, input.seasonYear, new SeededRandom(`upgrade:social:v18:${input.seasonYear}`), input.lastSimulatedDay),
  };
}

export function upgradeFootballEcosystemV7(
  input: LegacyFootballEcosystemStateV7,
  currentDate: GameDate,
): FootballEcosystemState {
  const tactical = addTacticalLayer(input.teams, input.players, input.coaches, input.seasonYear);
  return {
    ...input,
    moduleVersion: 10,
    cycle: input.cycle ?? resolveWorldCycle(currentDate),
    teams: tactical.teams,
    players: tactical.players,
    market: {
      ...input.market,
      lowSchemeFitPlayers: tactical.players.filter((player) => player.level === "college" && player.tactical.schemeFit < 55).length,
      programsInstallingNewSystems: tactical.teams.filter((team) => team.level === "college" && (team.tactical.installation < 58 || team.tactical.continuity < 48)).length,
    },
    competition: createCompetitionState(input.seasonYear, input.conferences, tactical.teams, new SeededRandom(`upgrade:competition:v19:${input.seasonYear}`)),
    social: createSocialEcosystem(tactical.teams, tactical.players, input.coaches, input.seasonYear, new SeededRandom(`upgrade:social:v19:${input.seasonYear}`), input.lastSimulatedDay),
  };
}

export function upgradeFootballEcosystemV8(
  input: LegacyFootballEcosystemStateV8,
  currentDate: GameDate,
): FootballEcosystemState {
  return {
    ...input,
    moduleVersion: 10,
    cycle: input.cycle ?? resolveWorldCycle(currentDate),
    competition: createCompetitionState(input.seasonYear, input.conferences, input.teams, new SeededRandom(`upgrade:competition:v20:${input.seasonYear}`)),
    social: createSocialEcosystem(input.teams, input.players, input.coaches, input.seasonYear, new SeededRandom(`upgrade:social:v20:${input.seasonYear}`), input.lastSimulatedDay),
  };
}


export function upgradeFootballEcosystemV9(
  input: LegacyFootballEcosystemStateV9,
  currentDate: GameDate,
): FootballEcosystemState {
  return {
    ...input,
    moduleVersion: 10,
    cycle: input.cycle ?? resolveWorldCycle(currentDate),
    social: createSocialEcosystem(
      input.teams,
      input.players,
      input.coaches,
      input.seasonYear,
      new SeededRandom(`upgrade:social:v21:${input.seasonYear}`),
      input.lastSimulatedDay,
    ),
  };
}
