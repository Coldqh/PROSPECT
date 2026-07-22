import type { GameDate } from "../../../core/calendar/types";
import type { FootballPosition } from "../career/types";

export type EcosystemLevel = "high-school" | "college";
export type EcosystemPlayerStatus = "starter" | "rotation" | "backup" | "injured";
export type EcosystemPlayerTrajectory = "surging" | "steady" | "slipping";
export type EcosystemCoachRole = "head-coach" | "coordinator";
export type EcosystemCoachStatus = "secure" | "watched" | "hot-seat";
export type EcosystemSeasonPhase = "regular-season" | "postseason" | "offseason";
export type EcosystemTransferStatus = "none" | "portal" | "transferred";
export type EcosystemStoryKind =
  | "breakout"
  | "injury"
  | "depth-change"
  | "commitment"
  | "coach-pressure"
  | "coach-move"
  | "upset"
  | "market-shift"
  | "conference-race"
  | "championship"
  | "transfer"
  | "graduation"
  | "enrollment";

export type EcosystemTransactionKind =
  | "portal-entry"
  | "transfer"
  | "coach-fired"
  | "coach-hired"
  | "graduation"
  | "recruit-enrolled";

export interface EcosystemPositionNeeds {
  QB: number;
  RB: number;
  WR: number;
  LB: number;
  CB: number;
}

export interface EcosystemConferenceChampion {
  seasonYear: number;
  teamId: string;
}

export interface EcosystemConference {
  id: string;
  name: string;
  shortName: string;
  region: string;
  prestige: number;
  teamIds: string[];
  champions: EcosystemConferenceChampion[];
}

export interface EcosystemTeam {
  id: string;
  seed: string;
  name: string;
  shortName: string;
  level: EcosystemLevel;
  stateCode: string;
  conferenceId?: string;
  prestige: number;
  rating: number;
  expectation: number;
  wins: number;
  losses: number;
  conferenceWins: number;
  conferenceLosses: number;
  streak: number;
  championships: number;
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
  eligibilityYears: number;
  seasonsPlayed: number;
  transferStatus: EcosystemTransferStatus;
  previousTeamIds: string[];
  isHero: boolean;
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
  tenureYears: number;
  careerWins: number;
  careerLosses: number;
  previousTeamIds: string[];
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

export interface EcosystemTeamSeasonRecord {
  id: string;
  seasonYear: number;
  teamId: string;
  conferenceId: string;
  wins: number;
  losses: number;
  conferenceWins: number;
  conferenceLosses: number;
  finalRating: number;
  finish: number;
  conferenceChampion: boolean;
  headCoachId?: string;
}

export interface EcosystemTransaction {
  id: string;
  kind: EcosystemTransactionKind;
  seasonYear: number;
  week: number;
  createdOn: GameDate;
  title: string;
  detail: string;
  playerId?: string;
  coachId?: string;
  fromTeamId?: string;
  toTeamId?: string;
  relatedToHero: boolean;
}

export interface EcosystemMarketState {
  openScholarships: number;
  activeRecruitments: number;
  committedPlayers: number;
  coachingHotSeats: number;
  portalPlayers: number;
  coachOpenings: number;
}

export interface FootballEcosystemState {
  moduleVersion: 2;
  lastSimulatedDay: number;
  currentWeek: number;
  lastUpdatedOn: GameDate;
  seasonYear: number;
  seasonWeek: number;
  phase: EcosystemSeasonPhase;
  lastOffseasonYear: number;
  conferences: EcosystemConference[];
  teams: EcosystemTeam[];
  players: EcosystemPlayer[];
  coaches: EcosystemCoach[];
  stories: EcosystemStory[];
  digest: string[];
  market: EcosystemMarketState;
  teamHistory: EcosystemTeamSeasonRecord[];
  transactions: EcosystemTransaction[];
}
