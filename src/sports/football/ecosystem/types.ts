import type { GameDate } from "../../../core/calendar/types";
import type { FootballPosition } from "../career/types";

export type EcosystemLevel = "high-school" | "college";
export type EcosystemPlayerStatus = "starter" | "rotation" | "backup" | "injured";
export type EcosystemPlayerTrajectory = "surging" | "steady" | "slipping";
export type EcosystemCoachRole = "head-coach" | "coordinator";
export type EcosystemCoachStatus = "secure" | "watched" | "hot-seat";
export type EcosystemStoryKind =
  | "breakout"
  | "injury"
  | "depth-change"
  | "commitment"
  | "coach-pressure"
  | "coach-move"
  | "upset"
  | "market-shift";

export interface EcosystemPositionNeeds {
  QB: number;
  RB: number;
  WR: number;
  LB: number;
  CB: number;
}

export interface EcosystemTeam {
  id: string;
  seed: string;
  name: string;
  shortName: string;
  level: EcosystemLevel;
  stateCode: string;
  prestige: number;
  rating: number;
  expectation: number;
  wins: number;
  losses: number;
  streak: number;
  offenseStyle: string;
  defenseStyle: string;
  positionNeeds: EcosystemPositionNeeds;
  rosterIds: string[];
  coachIds: string[];
  trend: "rising" | "stable" | "falling";
}

export interface EcosystemPlayer {
  id: string;
  seed: string;
  name: string;
  teamId: string;
  level: EcosystemLevel;
  age: number;
  classYear: "Freshman" | "Sophomore" | "Junior" | "Senior";
  position: FootballPosition;
  overall: number;
  potential: number;
  health: number;
  form: number;
  status: EcosystemPlayerStatus;
  depthRank: number;
  trajectory: EcosystemPlayerTrajectory;
  nationalRank: number;
  recruitingStage: "unranked" | "tracked" | "offered" | "committed";
  committedTeamId?: string;
}

export interface EcosystemCoach {
  id: string;
  seed: string;
  name: string;
  teamId: string;
  role: EcosystemCoachRole;
  age: number;
  reputation: number;
  development: number;
  recruiting: number;
  pressure: number;
  jobSecurity: number;
  status: EcosystemCoachStatus;
  philosophy: string;
}

export interface EcosystemStory {
  id: string;
  kind: EcosystemStoryKind;
  createdOn: GameDate;
  week: number;
  title: string;
  detail: string;
  importance: 1 | 2 | 3 | 4 | 5;
  teamIds: string[];
  playerIds: string[];
  coachIds: string[];
  relatedToHero: boolean;
}

export interface EcosystemMarketState {
  openScholarships: number;
  activeRecruitments: number;
  committedPlayers: number;
  coachingHotSeats: number;
}

export interface FootballEcosystemState {
  moduleVersion: 1;
  lastSimulatedDay: number;
  currentWeek: number;
  lastUpdatedOn: GameDate;
  teams: EcosystemTeam[];
  players: EcosystemPlayer[];
  coaches: EcosystemCoach[];
  stories: EcosystemStory[];
  digest: string[];
  market: EcosystemMarketState;
}
