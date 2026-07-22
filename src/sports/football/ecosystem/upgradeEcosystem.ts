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

type LegacyTeam = Omit<
  EcosystemTeam,
  "conferenceId" | "conferenceWins" | "conferenceLosses" | "championships"
>;

type LegacyPlayer = Omit<
  EcosystemPlayer,
  "eligibilityYears" | "seasonsPlayed" | "transferStatus" | "previousTeamIds" | "isHero"
>;

type LegacyCoach = Omit<
  EcosystemCoach,
  "tenureYears" | "careerWins" | "careerLosses" | "previousTeamIds"
>;

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
  return {
    moduleVersion: 2,
    lastSimulatedDay: input.lastSimulatedDay,
    currentWeek: input.currentWeek,
    lastUpdatedOn: input.lastUpdatedOn,
    seasonYear: currentDate.year,
    seasonWeek: Math.max(1, Math.min(10, input.currentWeek)),
    phase: "regular-season",
    lastOffseasonYear: currentDate.year - 1,
    conferences: conferenceSetup.conferences,
    teams: updatedTeams,
    players,
    coaches,
    stories: input.stories,
    digest: input.digest,
    market: {
      ...input.market,
      portalPlayers: 0,
      coachOpenings: 0,
    },
    teamHistory: [],
    transactions: [],
  };
}
