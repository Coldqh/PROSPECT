import type { FootballPosition } from "../career/types";

export type FootballRosterPosition = FootballPosition | "TE" | "OL" | "DL" | "S" | "K" | "P";
export type PlayerYear = "Freshman" | "Sophomore" | "Junior" | "Senior";
export type RosterUnit = "offense" | "defense" | "special";

export interface FootballCoach {
  id: string;
  name: string;
  role: "head-coach" | "position-coach" | "offensive-coordinator" | "defensive-coordinator";
  age: number;
  archetype: "builder" | "disciplinarian" | "strategist" | "recruiter";
  development: number;
  tactics: number;
  discipline: number;
  communication: number;
  youthPatience: number;
  pressure: number;
  relationship: number;
  summary: string;
}

export interface FootballRosterPlayer {
  id: string;
  name: string;
  position: FootballRosterPosition;
  unit: RosterUnit;
  year: PlayerYear;
  overall: number;
  potential: number;
  style: string;
  coachStanding: number;
  health: number;
  status: "starter" | "rotation" | "backup" | "injured";
  depthRank: number;
}

export interface FootballTeamStaff {
  headCoach: FootballCoach;
  positionCoach: FootballCoach;
  offensiveCoordinator: FootballCoach;
  defensiveCoordinator: FootballCoach;
}

export interface TeamDynamics {
  morale: number;
  cohesion: number;
  discipline: number;
  schemeMastery: number;
}

export interface DepthChartEvaluation {
  heroScore: number;
  comparisonScore: number;
  gap: number;
  trend: "rising" | "stable" | "falling";
  summary: string;
  reasons: string[];
  updatedOn: string;
}

export interface DepthChartDecision {
  type: "promoted" | "demoted" | "held";
  title: string;
  description: string;
  occurredOn: string;
}
